"""Script to check syntheses dates in Qdrant"""
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

from qdrant_client import QdrantClient
from datetime import datetime

# Connect directly to Qdrant
qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
print(f"Connecting to Qdrant at: {qdrant_url}")

client = QdrantClient(url=qdrant_url)
syntheses_collection = os.getenv("QDRANT_SYNTHESES_COLLECTION", "novapress_syntheses")

# Get all syntheses to check their dates
all_synths = []
offset = None
while True:
    result, next_offset = client.scroll(
        collection_name=syntheses_collection,
        limit=100,
        offset=offset,
        with_payload=True,
        with_vectors=False
    )
    if not result:
        break
    all_synths.extend(result)
    if next_offset is None:
        break
    offset = next_offset

print(f"Total syntheses in DB: {len(all_synths)}")
print("\nAll syntheses sorted by created_at (most recent first):")

synths_data = []
for p in all_synths:
    created_at = p.payload.get("created_at", 0)
    title = p.payload.get("title", "No title")[:50]
    synths_data.append((created_at, title, p.id))

# Sort by created_at descending
synths_data.sort(key=lambda x: x[0], reverse=True)

for i, (created, title, sid) in enumerate(synths_data[:15]):
    if created:
        dt = datetime.fromtimestamp(created).strftime("%Y-%m-%d %H:%M")
    else:
        dt = "Unknown"
    print(f"{i+1}. {dt} | {title}... | ID: {str(sid)[:8]}")

print("\n--- Oldest 5 syntheses ---")
for i, (created, title, sid) in enumerate(synths_data[-5:]):
    if created:
        dt = datetime.fromtimestamp(created).strftime("%Y-%m-%d %H:%M")
    else:
        dt = "Unknown"
    print(f"  {dt} | {title}... | ID: {str(sid)[:8]}")
