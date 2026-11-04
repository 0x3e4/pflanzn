"""Pl@ntNet species pages as a reference for a plant: a link for the UI and a few
facts (names, traits, uses, pests) for the care helper prompt.

The page URL needs the full scientific name with author ("Ficus elastica Roxb. ex
Hornem."), while a plant only stores what the user typed or picked. Candidates, the
first page that loads wins: the full name saved with a matching Pl@ntNet
identification, GBIF's match for the name (its author sometimes differs from
Pl@ntNet's), and the name as typed. Results are cached in Redis.
"""
import html
import json
import logging
import re
from dataclasses import asdict, dataclass
from typing import Optional
from urllib.parse import quote

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import redis_client
from app.models import PlantIdentification

logger = logging.getLogger(__name__)

GBIF_MATCH_URL = "https://api.gbif.org/v1/species/match"
CACHE_SECONDS = 7 * 24 * 3600
MISS_CACHE_SECONDS = 24 * 3600
MAX_FACTS_CHARS = 1500
_HEADERS = {"User-Agent": "Pflanzn (+https://github.com/0x3e4/pflanzn)"}
_LANGUAGE = re.compile(r"^[a-z]{2}(-[a-z]{2,4})?$")
_SPECIES_RANKS = {"SPECIES", "SUBSPECIES", "VARIETY", "FORM"}

# The facts come from the English page: its section labels are what the parser looks for.
_FACTS_START = "Common names"
_FACTS_END = ("At a glance", "Distribution & seasonality")
_FACTS_SKIP = {"All names & votes"}


@dataclass
class PlantReference:
    name: str
    url: str
    facts: Optional[str] = None
    wikipedia_url: Optional[str] = None


def species_url(full_name: str, language: Optional[str] = None) -> str:
    language = (settings.PLANTNET_LANGUAGE if language is None else language).strip().lower()
    prefix = f"{language}/" if _LANGUAGE.match(language) and language != "en" else ""
    return f"https://identify.plantnet.org/{prefix}k-world-flora/species/{quote(full_name, safe='')}/data"


def extract_facts(page: str) -> tuple[Optional[str], Optional[str]]:
    """(facts text, Wikipedia URL) from a species page; None where the page doesn't have them."""
    main = re.search(r"(?is)<main\b.*?</main>", page)
    body = re.sub(r"(?is)<(script|style|noscript|svg)\b.*?</\1>", " ", main.group(0) if main else page)
    wikipedia = re.search(r'href="(https://[a-z-]+\.wikipedia\.org/wiki/[^"]+)"', body)

    lines = [html.unescape(part).strip() for part in re.split(r"<[^>]+>", body)]
    lines = [line for line in lines if line]
    if _FACTS_START not in lines:
        return None, wikipedia.group(1) if wikipedia else None
    start = lines.index(_FACTS_START)
    end = next((i for i, line in enumerate(lines) if i > start and line in _FACTS_END), len(lines))

    out: list[str] = []
    continue_line = False
    for line in lines[start:end]:
        if line in _FACTS_SKIP or re.fullmatch(r"\+\d+ more", line):
            if continue_line:
                out[-1] = out[-1].rstrip(",")
                continue_line = False
            continue
        if line == "," and out:
            out[-1] += ","
            continue_line = True
        elif continue_line:
            out[-1] += f" {line}"
            continue_line = False
        else:
            out.append(line)
    facts = "\n".join(out)[:MAX_FACTS_CHARS].strip()
    return facts or None, wikipedia.group(1) if wikipedia else None


def _identified_name(db: Session, species: str) -> Optional[str]:
    row = (
        db.query(PlantIdentification.scientific_name_full)
        .filter(PlantIdentification.scientific_name == species, PlantIdentification.scientific_name_full.isnot(None))
        .order_by(PlantIdentification.identified_at.desc())
        .first()
    )
    return row[0] if row else None


def _gbif_name(client: httpx.Client, species: str) -> Optional[str]:
    response = client.get(GBIF_MATCH_URL, params={"name": species, "kingdom": "Plantae"})
    if response.status_code != 200:
        return None
    match = response.json()
    if match.get("matchType") == "EXACT" and match.get("rank") in _SPECIES_RANKS:
        return match.get("scientificName")
    return None


def _cache_get(key: str) -> Optional[str]:
    try:
        return redis_client.get(key)
    except Exception:
        return None


def _cache_set(key: str, reference: Optional[PlantReference]) -> None:
    try:
        if reference:
            redis_client.setex(key, CACHE_SECONDS, json.dumps(asdict(reference)))
        else:
            redis_client.setex(key, MISS_CACHE_SECONDS, "")
    except Exception:
        pass


def lookup(db: Session, species: Optional[str]) -> Optional[PlantReference]:
    """The Pl@ntNet reference for a species name, or None if no page matches it."""
    species = (species or "").strip()
    if not species or species.lower() == "unknown" or len(species) > 200:
        return None

    key = f"plantnet:ref:{settings.PLANTNET_LANGUAGE}:{species.lower()}"
    cached = _cache_get(key)
    if isinstance(cached, str):
        return PlantReference(**json.loads(cached)) if cached else None

    reference = None
    try:
        with httpx.Client(timeout=10, headers=_HEADERS) as client:
            candidates = [_identified_name(db, species), _gbif_name(client, species), species]
            for name in dict.fromkeys(c for c in candidates if c):
                response = client.get(species_url(name, "en"))
                if response.status_code == 200:
                    facts, wikipedia_url = extract_facts(response.text)
                    reference = PlantReference(name, species_url(name), facts, wikipedia_url)
                    break
    except httpx.HTTPError as exc:
        # Not cached: the next request tries again.
        logger.warning(f"Pl@ntNet reference lookup failed for '{species}': {type(exc).__name__}")
        return None

    _cache_set(key, reference)
    return reference
