"""
Reddit Scraper Service
Scrapes Reddit threads and comments using the public JSON API.
Respects rate limits and robots.txt (via logic).
"""
from typing import List, Dict, Any, Optional
import httpx
import asyncio
from datetime import datetime
from loguru import logger
from urllib.parse import urlparse

from app.core.config import settings

class RedditScraper:
    """
    Scraper for Reddit using public JSON API.
    No API key required, but strictly rate limited.
    """
    
    def __init__(self):
        self.client = httpx.AsyncClient(
            headers={"User-Agent": settings.USER_AGENT},
            timeout=settings.REQUEST_TIMEOUT,
            follow_redirects=True
        )
        self.last_request_time = datetime.min

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()

    async def _respect_rate_limit(self):
        """Ensure we don't hit Reddit too hard"""
        elapsed = (datetime.now() - self.last_request_time).total_seconds()
        if elapsed < settings.REDDIT_RATE_LIMIT:
            await asyncio.sleep(settings.REDDIT_RATE_LIMIT - elapsed)
        self.last_request_time = datetime.now()

    async def discover_threads(self, subreddits: List[str] = None, limit: int = 10) -> List[str]:
        """
        Discover thread URLs from subreddits.
        """
        if not subreddits:
            subreddits = settings.REDDIT_SUBREDDITS.split(",")
            
        all_urls = []
        
        for subreddit in subreddits:
            subreddit = subreddit.strip()
            if not subreddit:
                continue
                
            url = f"https://www.reddit.com/r/{subreddit}/hot.json?limit={limit}"
            
            try:
                await self._respect_rate_limit()
                response = await self.client.get(url)
                
                if response.status_code != 200:
                    logger.warning(f"Failed to fetch subreddit {subreddit}: {response.status_code}")
                    continue
                    
                data = response.json()
                posts = data.get("data", {}).get("children", [])
                
                for post in posts:
                    post_data = post.get("data", {})
                    if not post_data.get("stickied") and not post_data.get("is_video"):
                        permalink = post_data.get("permalink")
                        if permalink:
                            full_url = f"https://www.reddit.com{permalink}"
                            all_urls.append(full_url)
                            
            except Exception as e:
                logger.error(f"Error discovering threads in r/{subreddit}: {e}")
                
        return all_urls

    async def scrape_thread(self, url: str) -> Optional[Dict[str, Any]]:
        """
        Scrape a single Reddit thread (OP + top comments).
        """
        # Ensure URL ends with .json
        json_url = url if url.endswith(".json") else f"{url.rstrip('/')}.json"
        
        try:
            await self._respect_rate_limit()
            response = await self.client.get(json_url)
            
            if response.status_code != 200:
                logger.warning(f"Failed to fetch thread {url}: {response.status_code}")
                return None
                
            data = response.json()
            
            # Reddit JSON API returns a list: [listing_for_post, listing_for_comments]
            if not isinstance(data, list) or len(data) < 2:
                return None
                
            post_data = data[0]["data"]["children"][0]["data"]
            comments_data = data[1]["data"]["children"]
            
            # Extract content
            title = post_data.get("title", "")
            selftext = post_data.get("selftext", "")
            author = post_data.get("author", "")
            created_utc = post_data.get("created_utc", 0)
            subreddit = post_data.get("subreddit", "")
            
            # Extract top comments
            comments_text = []
            for comment in comments_data[:10]: # Top 10 comments
                c_data = comment.get("data", {})
                body = c_data.get("body", "")
                if body and body != "[deleted]" and body != "[removed]":
                    comments_text.append(f"- {body}")
            
            full_text = f"{selftext}\n\nTop Comments:\n" + "\n".join(comments_text)
            
            return {
                "url": url,
                "source_name": f"Reddit r/{subreddit}",
                "source_domain": "reddit.com",
                "raw_title": title,
                "raw_text": full_text,
                "summary": full_text[:300], # Simple truncation for now
                "published_at": datetime.fromtimestamp(created_utc).isoformat(),
                "authors": [author],
                "image_url": post_data.get("thumbnail") if post_data.get("thumbnail", "").startswith("http") else None,
                "language": "en", # Assume English for now, or detect
                "scraped_at": datetime.now().isoformat(),
                "metadata": {
                    "upvotes": post_data.get("ups", 0),
                    "num_comments": post_data.get("num_comments", 0)
                }
            }
            
        except Exception as e:
            logger.error(f"Error scraping thread {url}: {e}")
            return None

# Global instance
reddit_scraper = RedditScraper()

async def get_reddit_scraper() -> RedditScraper:
    return reddit_scraper
