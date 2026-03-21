"""
Legal Reference Verifier - Anti-hallucination for NovaLex
Extracts legal references from LLM output and verifies them against Legifrance API.
Computes a confidence score based on verified references.
"""
import re
from typing import List, Dict, Any, Optional, Tuple
import asyncio
import httpx
from loguru import logger


# Patterns for extracting French/EU legal references
LEGAL_REFERENCE_PATTERNS = [
    # French law articles: "Article 5 du RGPD", "Art. L.121-1 du Code de commerce"
    re.compile(
        r"(?:Article|Art\.?)\s+(?:L\.?|R\.?|D\.?)?\s*(\d+[\-\.\d]*)"
        r"(?:\s+(?:du|de la|de l['\u2019])\s+(.+?)(?:\.|,|\s*$))",
        re.IGNORECASE | re.MULTILINE
    ),
    # RGPD articles: "RGPD art. 5", "article 6 RGPD"
    re.compile(
        r"(?:RGPD|GDPR)\s*(?:,?\s*)?(?:article|art\.?)\s*(\d+)",
        re.IGNORECASE
    ),
    re.compile(
        r"(?:article|art\.?)\s*(\d+)\s+(?:du\s+)?(?:RGPD|GDPR)",
        re.IGNORECASE
    ),
    # Loi Informatique et Libertes
    re.compile(
        r"(?:loi\s+)?(?:informatique\s+et\s+libert[e\u00e9]s).*?(?:article|art\.?)\s*(\d+)",
        re.IGNORECASE
    ),
    # EU directives/regulations: "Directive 2016/680", "Reglement (UE) 2016/679"
    re.compile(
        r"(?:Directive|R[e\u00e8]glement|D[e\u00e9]cision)\s*(?:\((?:UE|CE|EU)\)\s*)?(\d{4}/\d+)",
        re.IGNORECASE
    ),
    # CNIL decision references: "Deliberation n°2024-001", "SAN-2024-001"
    re.compile(
        r"(?:D[e\u00e9]lib[e\u00e9]ration|SAN|MED)\s*(?:n[°\u00b0]?\s*)?(\d{4}[\-/]\d+)",
        re.IGNORECASE
    ),
]


def extract_legal_references(text: str) -> List[Dict[str, str]]:
    """
    Extract all legal references from a synthesis text.

    Returns list of dicts with:
    - reference: the full matched reference string
    - type: "article", "directive", "decision", "regulation"
    - number: the extracted number/code
    - law: the law name if identified
    """
    references = []
    seen = set()

    for pattern in LEGAL_REFERENCE_PATTERNS:
        for match in pattern.finditer(text):
            full_match = match.group(0).strip()
            if full_match in seen:
                continue
            seen.add(full_match)

            # Determine type
            lower = full_match.lower()
            if "directive" in lower:
                ref_type = "directive"
            elif any(w in lower for w in ["reglement", "r\u00e8glement", "rgpd", "gdpr"]):
                ref_type = "regulation"
            elif any(w in lower for w in ["san-", "med-", "deliberation", "d\u00e9lib\u00e9ration"]):
                ref_type = "decision"
            else:
                ref_type = "article"

            number = match.group(1) if match.lastindex >= 1 else ""
            law = match.group(2).strip() if match.lastindex >= 2 else ""

            references.append({
                "reference": full_match,
                "type": ref_type,
                "number": number,
                "law": law,
            })

    return references


async def verify_reference_legifrance(
    reference: Dict[str, str],
    client: httpx.AsyncClient,
) -> Dict[str, Any]:
    """
    Verify a single legal reference against Legifrance public search.
    Returns verification result with status and details.
    """
    query = reference["reference"]
    try:
        # Use Legifrance public search as verification
        response = await client.get(
            "https://www.legifrance.gouv.fr/search/all",
            params={"tab_selection": "all", "searchField": "ALL", "query": query, "page": "1", "pageSize": "1"},
            timeout=15.0,
        )

        if response.status_code == 200:
            text = response.text.lower()
            # Check if results were found (simplified heuristic)
            has_results = "aucun r\u00e9sultat" not in text and "r\u00e9sultat" in text
            return {
                "reference": reference["reference"],
                "verified": has_results,
                "source": "legifrance",
                "confidence": 0.8 if has_results else 0.2,
            }

        return {
            "reference": reference["reference"],
            "verified": False,
            "source": "legifrance",
            "confidence": 0.0,
            "error": f"HTTP {response.status_code}",
        }

    except Exception as e:
        logger.debug(f"Legifrance verification failed for '{query}': {e}")
        return {
            "reference": reference["reference"],
            "verified": False,
            "source": "legifrance",
            "confidence": 0.0,
            "error": str(e),
        }


async def verify_reference_eurlex(
    reference: Dict[str, str],
    client: httpx.AsyncClient,
) -> Dict[str, Any]:
    """
    Verify EU reference against EUR-Lex search.
    """
    query = reference["reference"]
    try:
        response = await client.get(
            "https://eur-lex.europa.eu/search.html",
            params={"scope": "EURLEX", "text": query, "type": "quick"},
            timeout=15.0,
        )

        if response.status_code == 200:
            text = response.text.lower()
            has_results = "no results" not in text and "result" in text
            return {
                "reference": reference["reference"],
                "verified": has_results,
                "source": "eurlex",
                "confidence": 0.8 if has_results else 0.2,
            }

        return {
            "reference": reference["reference"],
            "verified": False,
            "source": "eurlex",
            "confidence": 0.0,
            "error": f"HTTP {response.status_code}",
        }

    except Exception as e:
        logger.debug(f"EUR-Lex verification failed for '{query}': {e}")
        return {
            "reference": reference["reference"],
            "verified": False,
            "source": "eurlex",
            "confidence": 0.0,
            "error": str(e),
        }


async def verify_synthesis(
    synthesis_text: str,
    max_verifications: int = 10,
) -> Dict[str, Any]:
    """
    Verify all legal references in a synthesis.

    Returns:
    - references_found: number of references extracted
    - references_verified: number verified successfully
    - confidence_score: 0-100 (% of verified references)
    - details: list of verification results
    - needs_regeneration: True if score < 80
    """
    references = extract_legal_references(synthesis_text)

    if not references:
        return {
            "references_found": 0,
            "references_verified": 0,
            "confidence_score": 100,  # No references = nothing to verify
            "details": [],
            "needs_regeneration": False,
            "warning": "No legal references found in synthesis",
        }

    # Limit verifications to avoid rate limiting
    refs_to_verify = references[:max_verifications]

    async with httpx.AsyncClient(
        headers={"User-Agent": "NovaPressBot/2.0 (legal-verifier)"},
        follow_redirects=True,
    ) as client:
        tasks = []
        for ref in refs_to_verify:
            if ref["type"] in ("directive", "regulation") and "/" in ref["number"]:
                tasks.append(verify_reference_eurlex(ref, client))
            else:
                tasks.append(verify_reference_legifrance(ref, client))

        results = await asyncio.gather(*tasks, return_exceptions=True)

    # Compute score
    details = []
    verified_count = 0
    for result in results:
        if isinstance(result, Exception):
            details.append({
                "reference": "unknown",
                "verified": False,
                "error": str(result),
            })
        else:
            details.append(result)
            if result.get("verified"):
                verified_count += 1

    total = len(refs_to_verify)
    score = int((verified_count / total) * 100) if total > 0 else 100

    return {
        "references_found": len(references),
        "references_verified": verified_count,
        "confidence_score": score,
        "details": details,
        "needs_regeneration": score < 80,
    }
