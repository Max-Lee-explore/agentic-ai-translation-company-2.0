"""Discovers the company's agents (agents/*/AGENT.md) and skills (skills/*/SKILL.md).

Both use a small front-matter header followed by Markdown:

    ---
    id: legal
    temperature: 0.65
    skills: [naturalness-standard, legal-drafting]
    ---
    Identity paragraph (the editable role prompt).

    ## Rules
    - rule one

Only a tiny subset of YAML is supported (scalars and [a, b] lists) so no extra dependency is needed.
"""

import os
import re
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Dict, List, Optional

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AGENTS_DIR = os.path.join(BACKEND_DIR, "agents")
SKILLS_DIR = os.path.join(BACKEND_DIR, "skills")

_FRONT = re.compile(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", re.S)


def _parse_value(raw: str):
    raw = raw.strip()
    if raw.startswith("[") and raw.endswith("]"):
        return [v.strip().strip("'\"") for v in raw[1:-1].split(",") if v.strip()]
    if re.fullmatch(r"-?\d+(\.\d+)?", raw):
        return float(raw) if "." in raw else int(raw)
    if raw.lower() in ("true", "false"):
        return raw.lower() == "true"
    return raw.strip("'\"")


def parse_markdown(text: str):
    match = _FRONT.match(text.replace("\r\n", "\n"))
    if not match:
        return {}, text.strip()
    meta = {}
    for line in match.group(1).splitlines():
        if ":" in line and not line.lstrip().startswith("#"):
            key, value = line.split(":", 1)
            meta[key.strip()] = _parse_value(value)
    return meta, match.group(2).strip()


def _sections(body: str):
    """Split a body into (intro, {heading: text})."""
    parts = re.split(r"^##\s+(.+)$", body, flags=re.M)
    intro = parts[0].strip()
    sections = {parts[i].strip().lower(): parts[i + 1].strip() for i in range(1, len(parts) - 1, 2)}
    return intro, sections


def _bullets(text: str) -> List[str]:
    return [re.sub(r"^[-*]\s+", "", line).strip() for line in text.splitlines() if re.match(r"^\s*[-*]\s+", line)]


@dataclass
class Agent:
    id: str
    name: str
    kind: str                      # manager | translator | editor | terminologist
    prompt: str                    # identity paragraph — the user-editable role prompt
    temperature: float = 0.7
    label: str = ""
    team: Optional[str] = None
    rules: List[str] = field(default_factory=list)
    skills: List[str] = field(default_factory=list)
    tools: List[str] = field(default_factory=list)   # reserved for the tool-calling phase
    path: str = ""


@dataclass
class Skill:
    name: str
    description: str
    body: str
    source: List[str] = field(default_factory=list)   # language match rules; empty = any
    target: List[str] = field(default_factory=list)
    exclude_source: List[str] = field(default_factory=list)
    locale: List[str] = field(default_factory=list)   # locale keywords (target lang + manager's locale)
    exclude_locale: List[str] = field(default_factory=list)
    path: str = ""

    def applies(self, source_lang: str, target_lang: str, locale_hint: str = "") -> bool:
        src, tgt = (source_lang or "").lower(), (target_lang or "").lower()
        loc = f"{tgt} {(locale_hint or '').lower()}"
        if self.source and not any(k in src for k in self.source):
            return False
        if self.exclude_source and any(k in src for k in self.exclude_source):
            return False
        if self.target and not all(any(alt in tgt for alt in k.split("|")) for k in self.target):
            return False
        if self.locale and not any(k in loc for k in self.locale):
            return False
        if self.exclude_locale and any(k in loc for k in self.exclude_locale):
            return False
        return True


def _read(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


@lru_cache(maxsize=1)
def load_agents() -> Dict[str, Agent]:
    agents: Dict[str, Agent] = {}
    for folder in sorted(os.listdir(AGENTS_DIR)):
        path = os.path.join(AGENTS_DIR, folder, "AGENT.md")
        if not os.path.isfile(path):
            continue
        meta, body = parse_markdown(_read(path))
        intro, sections = _sections(body)
        agent_id = str(meta.get("id") or folder)
        agents[agent_id] = Agent(
            id=agent_id,
            name=str(meta.get("name") or agent_id),
            kind=str(meta.get("kind") or "translator"),
            prompt=" ".join(intro.split()),
            temperature=float(meta.get("temperature", 0.7)),
            label=str(meta.get("label") or meta.get("name") or agent_id),
            team=meta.get("team"),
            rules=_bullets(sections.get("rules", "")),
            skills=list(meta.get("skills") or []),
            tools=list(meta.get("tools") or []),
            path=path,
        )
    return agents


@lru_cache(maxsize=1)
def load_skills() -> Dict[str, Skill]:
    skills: Dict[str, Skill] = {}
    for folder in sorted(os.listdir(SKILLS_DIR)):
        path = os.path.join(SKILLS_DIR, folder, "SKILL.md")
        if not os.path.isfile(path):
            continue
        meta, body = parse_markdown(_read(path))
        name = str(meta.get("name") or folder)
        skills[name] = Skill(
            name=name,
            description=str(meta.get("description") or ""),
            body=body,
            source=[s.lower() for s in meta.get("source", []) or []],
            target=[s.lower() for s in meta.get("target", []) or []],
            exclude_source=[s.lower() for s in meta.get("exclude_source", []) or []],
            locale=[s.lower() for s in meta.get("locale", []) or []],
            exclude_locale=[s.lower() for s in meta.get("exclude_locale", []) or []],
            path=path,
        )
    return skills


def agent(agent_id: str) -> Agent:
    agents = load_agents()
    return agents.get(agent_id) or agents["master"]


def skills_for(agent_id: str, source_lang: str, target_lang: str, locale_hint: str = "") -> List[Skill]:
    """Skills listed by the agent whose language/locale conditions match this job."""
    library = load_skills()
    chosen = []
    for name in agent(agent_id).skills:
        skill = library.get(name)
        if skill and skill.applies(source_lang, target_lang, locale_hint):
            chosen.append(skill)
    return chosen


def reload():
    load_agents.cache_clear()
    load_skills.cache_clear()
