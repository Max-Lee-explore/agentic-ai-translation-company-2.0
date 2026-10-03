"""Shared job memory: rendering decisions every agent reuses for cross-passage consistency."""

from dataclasses import dataclass, field
from typing import Dict, List

MAX_ENTRIES = 60


@dataclass
class JobMemory:
    decisions: Dict[str, Dict[str, str]] = field(default_factory=dict)   # key: lowercased source

    def add(self, items: List[Dict[str, str]], glossary: Dict[str, str] = None) -> List[Dict[str, str]]:
        """Record new decisions; the term base always wins, and earlier decisions are never overwritten."""
        glossary_keys = {k.lower() for k in (glossary or {})}
        added = []
        for item in items:
            key = item["source"].lower()
            if key in self.decisions or key in glossary_keys or len(self.decisions) >= MAX_ENTRIES:
                continue
            self.decisions[key] = item
            added.append(item)
        return added

    def render(self, text: str = "") -> str:
        """Bullet list of decisions; if text is given, only those whose source appears in it."""
        lowered = (text or "").lower()
        rows = [d for k, d in self.decisions.items() if not text or k in lowered]
        return "\n".join(
            f"- {d['source']} → {d['target']}" + (f" ({d['note']})" if d.get("note") else "") for d in rows
        )

    def as_list(self) -> List[Dict[str, str]]:
        return list(self.decisions.values())
