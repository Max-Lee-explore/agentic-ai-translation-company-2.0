"""Who works here: domains, teams and the people in them.

Translator roles (label, temperature, rules) come from backend/agents/*-translator/AGENT.md.
Team member ids are shared with the frontend scene, so keep them in sync with
frontend/src/scene/world/roster.js.
"""

from .runtime import registry


def _domains():
    out = {}
    for a in registry.load_agents().values():
        if a.kind == "translator":
            out[a.id] = {"label": a.label, "temperature": a.temperature, "role": a.name, "guidelines": a.rules}
    return out


DOMAINS = _domains()

TEAMS = {
    "creative": {
        "name": "Creative Studio",
        "domains": ["literary", "marketing"],
        "members": ["creative-1", "creative-2"],
    },
    "legal_business": {
        "name": "Legal & Business",
        "domains": ["legal", "business"],
        "members": ["legal-1", "legal-2"],
    },
    "science_medical": {
        "name": "Science & Medical",
        "domains": ["academic", "technical", "medical"],
        "members": ["science-1", "science-2"],
    },
    "news_media": {
        "name": "News & Media",
        "domains": ["news"],
        "members": ["news-1", "news-2"],
    },
    "master": {
        "name": "Master Translator",
        "domains": ["master"],
        "members": ["master"],
    },
}

TRANSLATION_TYPE_TO_DOMAIN = {
    "literary": "literary",
    "marketing": "marketing",
    "legal": "legal",
    "business": "business",
    "academic": "academic",
    "technical": "technical",
    "medical": "medical",
    "news": "news",
    "master translator": "master",
    "master": "master",
}


def team_for_domain(domain: str) -> str:
    for team_id, team in TEAMS.items():
        if domain in team["domains"]:
            return team_id
    return "master"


def normalize_domain(value: str) -> str:
    value = (value or "").lower()
    for key in DOMAINS:
        if key in value:
            return key
    aliases = {
        "journal": "news", "press": "news", "creative": "literary", "fiction": "literary",
        "poetry": "literary", "promo": "marketing", "advert": "marketing", "contract": "legal",
        "corporate": "business", "finance": "business", "scholar": "academic", "research": "academic",
        "scientific": "academic", "engineer": "technical", "software": "technical", "manual": "technical",
        "clinical": "medical", "health": "medical", "pharma": "medical",
    }
    for alias, domain in aliases.items():
        if alias in value:
            return domain
    return "master"
