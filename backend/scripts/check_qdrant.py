import asyncio
import sys
import os

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.db.qdrant_client import init_qdrant, qdrant_service

async def check_qdrant():
    await init_qdrant()
    stats = qdrant_service.get_collection_stats()
    print(f"Points in Qdrant: {stats.get('points_count', 0)}")
    
    recent = qdrant_service.get_recent_articles(hours=48)
    print(f"Recent articles (48h): {len(recent)}")

if __name__ == "__main__":
    asyncio.run(check_qdrant())
