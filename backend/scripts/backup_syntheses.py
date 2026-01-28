#!/usr/bin/env python3
"""
Backup & Restore Syntheses - NovaPress AI
==========================================
Sauvegarde et restaure les synthèses depuis/vers Qdrant en fichiers JSON.

Usage:
    python scripts/backup_syntheses.py backup              # Sauvegarde toutes les synthèses
    python scripts/backup_syntheses.py backup --name test  # Sauvegarde avec nom personnalisé
    python scripts/backup_syntheses.py restore             # Restaure le dernier backup
    python scripts/backup_syntheses.py restore --file X    # Restaure un backup spécifique
    python scripts/backup_syntheses.py list                # Liste tous les backups
    python scripts/backup_syntheses.py auto                # Backup automatique (appelé par pipeline)
"""

import sys
import os
import json
import argparse
from datetime import datetime
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import requests
from typing import List, Dict, Any, Optional
# uuid removed - not needed


# Configuration
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
COLLECTION_NAME = os.getenv("QDRANT_COLLECTION", "novapress_articles")
SYNTHESES_COLLECTION = "novapress_syntheses"  # Separate collection for syntheses
BACKUP_DIR = Path(__file__).parent.parent / "data" / "backups"

# Ensure backup directory exists
BACKUP_DIR.mkdir(parents=True, exist_ok=True)


def get_all_syntheses() -> List[Dict[str, Any]]:
    """Récupère toutes les synthèses depuis Qdrant (collection novapress_syntheses)."""
    syntheses = []
    offset = None

    while True:
        payload = {
            "limit": 100,
            "with_payload": True,
            "with_vector": True,
        }
        if offset:
            payload["offset"] = offset

        response = requests.post(
            f"{QDRANT_URL}/collections/{SYNTHESES_COLLECTION}/points/scroll",
            json=payload
        )

        if response.status_code != 200:
            print(f"Erreur Qdrant: {response.status_code}")
            break

        data = response.json()
        points = data.get("result", {}).get("points", [])

        for point in points:
            syntheses.append({
                "id": point["id"],
                "payload": point["payload"],
                "vector": point.get("vector", [])
            })

        offset = data.get("result", {}).get("next_page_offset")
        if not offset or not points:
            break

    return syntheses


def get_all_articles() -> List[Dict[str, Any]]:
    """Récupère tous les articles depuis Qdrant (pour backup complet)."""
    articles = []
    offset = None

    while True:
        payload = {
            "limit": 100,
            "with_payload": True,
            "with_vector": True,
        }
        if offset:
            payload["offset"] = offset

        response = requests.post(
            f"{QDRANT_URL}/collections/{COLLECTION_NAME}/points/scroll",
            json=payload
        )

        if response.status_code != 200:
            print(f"Erreur Qdrant: {response.status_code}")
            break

        data = response.json()
        points = data.get("result", {}).get("points", [])

        for point in points:
            articles.append({
                "id": point["id"],
                "payload": point["payload"],
                "vector": point.get("vector", [])
            })

        offset = data.get("result", {}).get("next_page_offset")
        if not offset or not points:
            break

    return articles


def backup_syntheses(name: Optional[str] = None, include_articles: bool = False) -> str:
    """
    Sauvegarde les synthèses en JSON.

    Args:
        name: Nom personnalisé pour le backup
        include_articles: Si True, inclut aussi les articles

    Returns:
        Chemin du fichier backup créé
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    if name:
        filename = f"syntheses_{name}_{timestamp}.json"
    else:
        filename = f"syntheses_{timestamp}.json"

    filepath = BACKUP_DIR / filename

    print(f"[...] Récupération des synthèses depuis Qdrant...")
    syntheses = get_all_syntheses()

    backup_data = {
        "metadata": {
            "created_at": datetime.now().isoformat(),
            "qdrant_url": QDRANT_URL,
            "collection": COLLECTION_NAME,
            "syntheses_count": len(syntheses),
            "version": "1.0"
        },
        "syntheses": syntheses
    }

    if include_articles:
        print(f"[...] Récupération des articles...")
        articles = get_all_articles()
        backup_data["articles"] = articles
        backup_data["metadata"]["articles_count"] = len(articles)
        filename = filename.replace("syntheses_", "full_backup_")
        filepath = BACKUP_DIR / filename

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(backup_data, f, ensure_ascii=False, indent=2)

    print(f"[OK] Backup créé: {filepath}")
    print(f"   - {len(syntheses)} synthèses sauvegardées")
    if include_articles:
        print(f"   - {len(articles)} articles sauvegardés")

    return str(filepath)


def restore_syntheses(filepath: Optional[str] = None) -> int:
    """
    Restaure les synthèses depuis un backup JSON.

    Args:
        filepath: Chemin du fichier backup (ou None pour le dernier)

    Returns:
        Nombre de synthèses restaurées
    """
    backup_path: Path

    if filepath is None:
        # Trouver le dernier backup
        backups = list(BACKUP_DIR.glob("*.json"))
        if not backups:
            print("[ERROR] Aucun backup trouvé!")
            return 0
        backup_path = max(backups, key=lambda p: p.stat().st_mtime)
    else:
        backup_path = Path(filepath)
        if not backup_path.exists():
            # Essayer dans le dossier backups
            backup_path = BACKUP_DIR / backup_path.name
            if not backup_path.exists():
                print(f"[ERROR] Fichier non trouvé: {backup_path}")
                return 0

    print(f"[...] Chargement du backup: {backup_path}")

    with open(backup_path, 'r', encoding='utf-8') as f:
        backup_data = json.load(f)

    syntheses = backup_data.get("syntheses", [])
    articles = backup_data.get("articles", []) if "articles" in backup_data else []

    if not syntheses and not articles:
        print("[ERROR] Aucune donnée à restaurer!")
        return 0

    print(f"[BACKUP] Donnees trouvees:")
    print(f"   - {len(syntheses)} synthèses")
    print(f"   - {len(articles)} articles")

    # Restaurer les synthèses
    restored = 0

    if syntheses:
        print(f"[...] Restauration des synthèses...")
        points = []
        for s in syntheses:
            point = {
                "id": s["id"],
                "payload": s["payload"],
            }
            if s.get("vector"):
                point["vector"] = s["vector"]
            points.append(point)

        # Upsert par batch de 100
        for i in range(0, len(points), 100):
            batch = points[i:i+100]
            response = requests.put(
                f"{QDRANT_URL}/collections/{COLLECTION_NAME}/points",
                json={"points": batch},
                params={"wait": "true"}
            )
            if response.status_code == 200:
                restored += len(batch)
            else:
                print(f"[WARN] Erreur batch {i}: {response.text}")

    # Restaurer les articles si présents
    if articles:
        print(f"[...] Restauration des articles...")
        points = []
        for a in articles:
            point = {
                "id": a["id"],
                "payload": a["payload"],
            }
            if a.get("vector"):
                point["vector"] = a["vector"]
            points.append(point)

        for i in range(0, len(points), 100):
            batch = points[i:i+100]
            response = requests.put(
                f"{QDRANT_URL}/collections/{COLLECTION_NAME}/points",
                json={"points": batch},
                params={"wait": "true"}
            )
            if response.status_code == 200:
                restored += len(batch)

    print(f"[OK] Restauration terminée: {restored} points restaurés")
    return restored


def list_backups():
    """Liste tous les backups disponibles."""
    backups = list(BACKUP_DIR.glob("*.json"))

    if not backups:
        print("[DIR] Aucun backup trouve dans:", BACKUP_DIR)
        return

    print(f"\n[DIR] Backups disponibles ({len(backups)}):\n")
    print(f"{'Fichier':<50} {'Taille':<12} {'Date':<20}")
    print("-" * 82)

    for backup in sorted(backups, key=lambda p: p.stat().st_mtime, reverse=True):
        size = backup.stat().st_size
        mtime = datetime.fromtimestamp(backup.stat().st_mtime)

        if size > 1024 * 1024:
            size_str = f"{size / (1024*1024):.1f} MB"
        elif size > 1024:
            size_str = f"{size / 1024:.1f} KB"
        else:
            size_str = f"{size} B"

        # Load metadata
        try:
            with open(backup, 'r') as f:
                data = json.load(f)
                meta = data.get("metadata", {})
                count = meta.get("syntheses_count", "?")
                print(f"{backup.name:<50} {size_str:<12} {mtime.strftime('%Y-%m-%d %H:%M')} ({count} synthèses)")
        except:
            print(f"{backup.name:<50} {size_str:<12} {mtime.strftime('%Y-%m-%d %H:%M')}")


def auto_backup():
    """Backup automatique appelé par le pipeline."""
    # Garde les 10 derniers backups auto
    auto_backups = list(BACKUP_DIR.glob("syntheses_auto_*.json"))
    if len(auto_backups) > 10:
        oldest = sorted(auto_backups, key=lambda p: p.stat().st_mtime)[:len(auto_backups)-10]
        for f in oldest:
            f.unlink()
            print(f"🗑️ Ancien backup supprimé: {f.name}")

    return backup_syntheses(name="auto", include_articles=True)


def main():
    parser = argparse.ArgumentParser(
        description="Backup & Restore des synthèses NovaPress",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples:
  python scripts/backup_syntheses.py backup              # Sauvegarde synthèses
  python scripts/backup_syntheses.py backup --full       # Sauvegarde tout (synthèses + articles)
  python scripts/backup_syntheses.py restore             # Restaure le dernier backup
  python scripts/backup_syntheses.py restore --file X    # Restaure un backup spécifique
  python scripts/backup_syntheses.py list                # Liste les backups
        """
    )

    parser.add_argument("action", choices=["backup", "restore", "list", "auto"],
                       help="Action à effectuer")
    parser.add_argument("--name", "-n", help="Nom personnalisé pour le backup")
    parser.add_argument("--file", "-f", help="Fichier de backup à restaurer")
    parser.add_argument("--full", action="store_true",
                       help="Inclure les articles dans le backup")

    args = parser.parse_args()

    print("\n" + "="*60)
    print("[BACKUP] NovaPress - Backup & Restore")
    print("="*60 + "\n")

    if args.action == "backup":
        backup_syntheses(name=args.name, include_articles=args.full)
    elif args.action == "restore":
        restore_syntheses(filepath=args.file)
    elif args.action == "list":
        list_backups()
    elif args.action == "auto":
        auto_backup()

    print()


if __name__ == "__main__":
    main()
