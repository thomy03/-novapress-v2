#!/usr/bin/env python3
"""
NovaPress AI v2 - Setup Validation Script
==========================================

Ce script vérifie que tous les prérequis sont installés et configurés correctement.

Usage:
    cd backend
    source venv/bin/activate
    python scripts/validate_setup.py

Auteur: Claude Code Assistant
Date: 2025-11-24
Version: 1.0.0
"""

import sys
import os
import subprocess
from pathlib import Path
from typing import Tuple, List, Dict

# Colors pour output terminal
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_header(text: str):
    """Affiche un header formaté"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text.center(70)}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*70}{Colors.END}\n")

def print_success(text: str):
    """Affiche un message de succès"""
    print(f"{Colors.GREEN}✅ {text}{Colors.END}")

def print_error(text: str):
    """Affiche un message d'erreur"""
    print(f"{Colors.RED}❌ {text}{Colors.END}")

def print_warning(text: str):
    """Affiche un avertissement"""
    print(f"{Colors.YELLOW}⚠️  {text}{Colors.END}")

def print_info(text: str):
    """Affiche une information"""
    print(f"{Colors.BLUE}ℹ️  {text}{Colors.END}")

def check_python_version() -> bool:
    """Vérifie la version Python (>= 3.8)"""
    print_info("Vérification version Python...")

    version = sys.version_info
    version_str = f"{version.major}.{version.minor}.{version.micro}"

    if version.major == 3 and version.minor >= 8:
        print_success(f"Python {version_str} (OK)")
        return True
    else:
        print_error(f"Python {version_str} (Python 3.8+ requis)")
        return False

def check_docker_services() -> Dict[str, bool]:
    """Vérifie que les conteneurs Docker sont en cours d'exécution"""
    print_info("Vérification services Docker...")

    results = {
        "postgres": False,
        "redis": False,
        "qdrant": False
    }

    containers_map = {
        "postgres": "tradingbot_v2-postgres-1",
        "redis": "tradingbot_v2-redis-1",
        "qdrant": "tradingbot_v2-qdrant-1"
    }

    try:
        # Lister les conteneurs actifs
        result = subprocess.run(
            ["docker", "ps", "--format", "{{.Names}}"],
            capture_output=True,
            text=True,
            check=True
        )

        running_containers = result.stdout.strip().split('\n')

        for service, container_name in containers_map.items():
            if container_name in running_containers:
                print_success(f"{service.capitalize()} running ({container_name})")
                results[service] = True
            else:
                print_error(f"{service.capitalize()} NOT running ({container_name})")
                print_info(f"   Démarrer avec: docker start {container_name}")

    except subprocess.CalledProcessError:
        print_error("Docker n'est pas accessible ou n'est pas installé")
    except FileNotFoundError:
        print_error("Docker n'est pas installé")

    return results

def check_docker_health() -> Dict[str, bool]:
    """Vérifie la santé des services Docker"""
    print_info("Vérification santé services Docker...")

    results = {
        "postgres": False,
        "redis": False,
        "qdrant": False
    }

    # PostgreSQL health check
    try:
        result = subprocess.run(
            ["docker", "exec", "tradingbot_v2-postgres-1", "pg_isready", "-U", "novapress"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            print_success("PostgreSQL healthy")
            results["postgres"] = True
        else:
            print_error("PostgreSQL unhealthy")
    except:
        print_error("PostgreSQL health check failed")

    # Redis health check
    try:
        result = subprocess.run(
            ["docker", "exec", "tradingbot_v2-redis-1", "redis-cli", "ping"],
            capture_output=True,
            text=True
        )
        if "PONG" in result.stdout:
            print_success("Redis healthy (PONG)")
            results["redis"] = True
        else:
            print_error("Redis unhealthy (no PONG)")
    except:
        print_error("Redis health check failed")

    # Qdrant health check (simple HTTP check)
    try:
        import urllib.request
        response = urllib.request.urlopen("http://localhost:6333/healthz", timeout=5)
        if response.status == 200:
            print_success("Qdrant healthy")
            results["qdrant"] = True
        else:
            print_error(f"Qdrant unhealthy (status {response.status})")
    except:
        print_error("Qdrant health check failed (not accessible on :6333)")

    return results

def check_env_file() -> bool:
    """Vérifie l'existence et les variables critiques du fichier .env"""
    print_info("Vérification fichier .env...")

    env_path = Path("backend/.env")

    if not env_path.exists():
        print_error(".env file NOT found (backend/.env)")
        print_info("   Copier .env.example vers .env et configurer les variables")
        return False

    print_success(".env file exists")

    # Variables critiques à vérifier
    critical_vars = [
        "DATABASE_URL",
        "REDIS_URL",
        "QDRANT_URL",
        "OPENROUTER_API_KEY",
        "SECRET_KEY"
    ]

    try:
        with open(env_path) as f:
            env_content = f.read()

        missing_vars = []
        for var in critical_vars:
            if var not in env_content or f"{var}=" not in env_content:
                missing_vars.append(var)

        if missing_vars:
            print_warning(f"Variables manquantes: {', '.join(missing_vars)}")
        else:
            print_success("Toutes les variables critiques présentes")

        # Vérifier le port Redis (6380 vs 6379)
        if "REDIS_URL=redis://localhost:6380" in env_content:
            print_success("REDIS_URL configuré avec le bon port (6380)")
        elif "REDIS_URL=redis://localhost:6379" in env_content:
            print_error("REDIS_URL utilise le mauvais port (6379 au lieu de 6380)")
            return False

        return True
    except Exception as e:
        print_error(f"Erreur lecture .env: {e}")
        return False

def check_spacy_model() -> bool:
    """Vérifie que le modèle spaCy français est téléchargé"""
    print_info("Vérification modèle spaCy français...")

    try:
        import spacy
        nlp = spacy.load("fr_core_news_lg")

        # Tester le modèle
        doc = nlp("Test de validation")

        print_success(f"spaCy fr_core_news_lg loaded (v{nlp.meta['version']})")
        return True
    except OSError:
        print_error("spaCy model 'fr_core_news_lg' NOT found")
        print_info("   Installer avec: python -m spacy download fr_core_news_lg")
        return False
    except ImportError:
        print_error("spaCy NOT installed")
        print_info("   Installer avec: pip install spacy")
        return False

def check_pytorch() -> bool:
    """Vérifie l'installation de PyTorch"""
    print_info("Vérification PyTorch...")

    try:
        import torch

        version = torch.__version__
        cuda_available = torch.cuda.is_available()

        print_success(f"PyTorch {version} installed")

        if cuda_available:
            print_success(f"CUDA available (device: {torch.cuda.get_device_name(0)})")
        else:
            print_warning("CUDA NOT available (CPU-only mode)")
            print_info("   Pour GPU: pip install torch==2.4.1+cu121 --index-url https://download.pytorch.org/whl/cu121")

        return True
    except ImportError:
        print_error("PyTorch NOT installed")
        print_info("   Installer avec: pip install torch==2.4.1")
        return False

def check_sentence_transformers() -> bool:
    """Vérifie l'installation de sentence-transformers (BGE-M3)"""
    print_info("Vérification sentence-transformers...")

    try:
        from sentence_transformers import SentenceTransformer

        # Vérifier si le modèle BGE-M3 est téléchargé
        try:
            model = SentenceTransformer('BAAI/bge-m3')
            print_success("sentence-transformers installed + BGE-M3 model downloaded")
            return True
        except:
            print_warning("sentence-transformers installed but BGE-M3 NOT downloaded")
            print_info("   Le modèle sera téléchargé au premier usage (peut prendre quelques minutes)")
            return True
    except ImportError:
        print_error("sentence-transformers NOT installed")
        print_info("   Installer avec: pip install sentence-transformers==3.2.1")
        return False

def check_critical_packages() -> Dict[str, bool]:
    """Vérifie l'installation des packages critiques"""
    print_info("Vérification packages Python critiques...")

    packages = {
        "fastapi": "FastAPI",
        "uvicorn": "Uvicorn",
        "sqlalchemy": "SQLAlchemy",
        "qdrant_client": "Qdrant Client",
        "redis": "Redis",
        "httpx": "HTTPX",
        "pydantic": "Pydantic",
        "newspaper": "Newspaper3k"
    }

    results = {}

    for package, display_name in packages.items():
        try:
            __import__(package)
            print_success(f"{display_name} installed")
            results[package] = True
        except ImportError:
            print_error(f"{display_name} NOT installed")
            results[package] = False

    return results

def generate_report(checks: Dict[str, bool]) -> Tuple[int, int]:
    """Génère un rapport final"""
    print_header("RAPPORT DE VALIDATION")

    total = len(checks)
    passed = sum(checks.values())
    failed = total - passed

    success_rate = (passed / total * 100) if total > 0 else 0

    print(f"\n{Colors.BOLD}Résultats:{Colors.END}")
    print(f"  ✅ Succès: {passed}/{total}")
    print(f"  ❌ Échecs: {failed}/{total}")
    print(f"  📊 Taux de réussite: {success_rate:.1f}%\n")

    if success_rate == 100:
        print(f"{Colors.GREEN}{Colors.BOLD}🎉 TOUT EST PRÊT ! Vous pouvez lancer le projet.{Colors.END}\n")
    elif success_rate >= 80:
        print(f"{Colors.YELLOW}{Colors.BOLD}⚠️  Quelques éléments nécessitent attention, mais le projet devrait fonctionner.{Colors.END}\n")
    else:
        print(f"{Colors.RED}{Colors.BOLD}❌ Des éléments critiques manquent. Veuillez corriger avant de lancer.{Colors.END}\n")

    return passed, total

def main():
    """Fonction principale"""
    print_header("NOVAPRESS AI V2 - VALIDATION SETUP")
    print(f"{Colors.BOLD}Date:{Colors.END} 2025-11-24")
    print(f"{Colors.BOLD}Version:{Colors.END} 1.0.0\n")

    checks = {}

    # 1. Python version
    print_header("1. ENVIRONNEMENT PYTHON")
    checks["python_version"] = check_python_version()

    # 2. Docker services
    print_header("2. SERVICES DOCKER")
    docker_services = check_docker_services()
    checks.update({f"docker_{k}": v for k, v in docker_services.items()})

    # 3. Docker health
    print_header("3. SANTÉ SERVICES DOCKER")
    docker_health = check_docker_health()
    checks.update({f"health_{k}": v for k, v in docker_health.items()})

    # 4. Fichier .env
    print_header("4. CONFIGURATION (.env)")
    checks["env_file"] = check_env_file()

    # 5. Modèles ML
    print_header("5. MODÈLES MACHINE LEARNING")
    checks["spacy_model"] = check_spacy_model()
    checks["pytorch"] = check_pytorch()
    checks["sentence_transformers"] = check_sentence_transformers()

    # 6. Packages Python
    print_header("6. PACKAGES PYTHON CRITIQUES")
    packages = check_critical_packages()
    checks.update({f"package_{k}": v for k, v in packages.items()})

    # 7. Rapport final
    passed, total = generate_report(checks)

    # Exit code basé sur le résultat
    success_rate = (passed / total * 100) if total > 0 else 0
    sys.exit(0 if success_rate >= 80 else 1)

if __name__ == "__main__":
    main()
