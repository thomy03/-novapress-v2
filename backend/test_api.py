"""Test API endpoint"""
import requests
from datetime import datetime

try:
    response = requests.get("http://localhost:5000/api/syntheses/", params={"limit": 5})
    data = response.json()

    print(f"API returned {len(data.get('data', []))} syntheses")
    print("\nSyntheses from API:")

    for i, s in enumerate(data.get("data", [])[:5]):
        created = s.get("createdAt", "Unknown")
        title = s.get("title", "No title")[:50]
        sid = s.get("id", "?")[:8]
        print(f"{i+1}. {created} | {title}... | ID: {sid}")

except Exception as e:
    print(f"Error: {e}")
