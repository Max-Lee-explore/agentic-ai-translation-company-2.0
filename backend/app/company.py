"""Who works here: domains, teams and the people in them.

Agent ids are shared with the frontend scene, so keep them in sync with
frontend/src/scene/world/roster.js.
"""

DOMAINS = {
    "literary": {
        "label": "Literary",
        "temperature": 0.8,
        "role": "Literary Translation Specialist experienced with fiction, poetry and creative non-fiction",
        "guidelines": [
            "Recreate the author's voice, tone, rhythm and register as a native author would write them",
            "Render metaphors, idioms and imagery with target-language equivalents, never literally",
            "Recreate the effect of literary devices (alliteration, repetition, wordplay), not their exact form",
            "Adapt cultural references so native readers feel what the original readers felt",
            "Dialogue must sound like real native speech for the character's age, class and mood",
        ],
    },
    "marketing": {
        "label": "Marketing",
        "temperature": 0.8,
        "role": "Marketing & Transcreation Specialist",
        "guidelines": [
            "Keep brand voice, emotional appeal and persuasive impact",
            "Transcreate slogans, headlines and calls to action so they land in the target market; rewrite rather than translate",
            "Respect local conventions for tone, humour and formality",
            "Copy should read like it was written by a native copywriter in the target market",
        ],
    },
    "legal": {
        "label": "Legal",
        "temperature": 0.65,
        "role": "Legal Translation Specialist",
        "guidelines": [
            "Use precise, established legal terminology of the target jurisdiction",
            "Preserve the exact legal meaning, scope and obligations; never weaken or broaden them",
            "Use the target legal system's own drafting conventions; do not mirror source constructions (e.g. English 'shall', 'hereby', 'notwithstanding') word for word",
            "Keep numbering, defined terms and cross-references intact",
            "Maintain a formal register",
        ],
    },
    "business": {
        "label": "Business",
        "temperature": 0.7,
        "role": "Business & Corporate Translation Specialist",
        "guidelines": [
            "Keep a professional, clear corporate tone",
            "Use the business and financial terminology native professionals use, not translated jargon",
            "Preserve figures, currencies, dates and metrics exactly, formatted per target-locale conventions",
        ],
    },
    "academic": {
        "label": "Academic",
        "temperature": 0.7,
        "role": "Academic Translation Specialist",
        "guidelines": [
            "Maintain academic rigour, hedging and formal register",
            "Use the discipline's established target-language terminology consistently",
            "Follow target-language academic prose conventions rather than the source's sentence structure",
            "Preserve citations, references and theoretical framing",
        ],
    },
    "technical": {
        "label": "Technical",
        "temperature": 0.65,
        "role": "Technical Documentation Translation Specialist",
        "guidelines": [
            "Be precise and unambiguous; keep instructions actionable",
            "Leave code, commands, file paths and specifications untouched; keep UI strings as given unless the term base supplies localised ones",
            "Write the surrounding prose like native-written documentation (e.g. natural imperative instructions)",
            "Use consistent technical terminology",
        ],
    },
    "medical": {
        "label": "Medical",
        "temperature": 0.6,
        "role": "Medical Translation Specialist",
        "guidelines": [
            "Use accurate clinical terminology; patient safety comes first",
            "Preserve dosages, units and measurements exactly",
            "Match the register to the audience (clinician vs. patient); patient materials must be plain and natural",
            "Use the phrasing found in native medical literature and patient leaflets, not translated phrasing",
        ],
    },
    "news": {
        "label": "News",
        "temperature": 0.7,
        "role": "News & Journalism Translation Specialist",
        "guidelines": [
            "Keep journalistic style: clear, factual, concise",
            "Preserve news value, attribution and quotes accurately",
            "Adapt headlines idiomatically in target-language headline style",
            "Add a brief explanation of an unfamiliar reference only when native readers would otherwise be lost",
            "Use the established target-language names for people, places and organisations in the news",
        ],
    },
    "master": {
        "label": "Master",
        "temperature": 0.7,
        "role": "Master Translator with decades of experience across every genre",
        "guidelines": [
            "Identify each register in mixed content and adapt accordingly",
            "Be fully faithful in meaning while writing natural, idiomatic target-language prose",
        ],
    },
}

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
