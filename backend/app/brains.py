"""The thinking behind each agent: real LLM calls, or a demo stand-in with realistic pacing."""

import asyncio
import random
import re
from typing import Dict, List, Optional

from . import prompts
from .company import DOMAINS, TRANSLATION_TYPE_TO_DOMAIN, normalize_domain
from .llm import LLMClient


def forced_domain(translation_type: str) -> Optional[str]:
    return TRANSLATION_TYPE_TO_DOMAIN.get((translation_type or "").strip().lower())


class RealBrain:
    demo = False

    def __init__(self, client: LLMClient, temperatures: Dict[str, float], prompt_overrides: Optional[Dict[str, str]] = None):
        self.client = client
        self.temperatures = temperatures
        self.prompt_overrides = prompt_overrides or {}

    def _temp(self, domain: str) -> float:
        return self.temperatures.get(domain, DOMAINS.get(domain, DOMAINS["master"])["temperature"])

    async def analyze(self, translation_type, brief, sample, source_lang, target_lang, has_glossary, has_style_sheet):
        system, user = prompts.manager_prompt(
            translation_type, brief, sample, source_lang, target_lang, has_glossary, has_style_sheet,
            overrides=self.prompt_overrides,
        )
        raw = await self.client.chat(system, user, temperature=0.4)
        try:
            data = prompts.parse_json(raw)
        except Exception:
            data = {"reasoning": raw.strip()[:800]}
        domain = forced_domain(translation_type) or normalize_domain(str(data.get("domain", "")))
        locale = str(data.get("locale") or "").strip()
        if locale.lower() == "unspecified":
            locale = ""
        return {
            "domain": domain,
            "detected_style": data.get("detected_style") or DOMAINS[domain]["label"],
            "target_reader": str(data.get("target_reader") or "").strip(),
            "locale": locale,
            "naturalness_pitfalls": [str(p) for p in (data.get("naturalness_pitfalls") or [])][:5],
            "style_guidelines": [str(g) for g in (data.get("style_guidelines") or DOMAINS[domain]["guidelines"])][:6],
            "quality_requirements": [str(q) for q in (data.get("quality_requirements") or [
                "Accurate and complete", "Natural target-language flow"])][:5],
            "reasoning": str(data.get("reasoning") or "Selected based on the content of the source text."),
            "client_reply": str(data.get("client_reply") or "Thank you — we'll take great care of this."),
        }

    async def translate(self, domain, chunk, index, total, source_lang, target_lang, guidelines, terms, style_sheet,
                        profile=None, context=None):
        system, user = prompts.translator_prompt(
            domain, chunk, index, total, source_lang, target_lang, guidelines, terms, style_sheet,
            overrides=self.prompt_overrides, profile=profile, context=context,
        )
        return prompts.clean_output(await self.client.chat(system, user, temperature=self._temp(domain)))

    async def review(self, chunk, draft, source_lang, target_lang, guidelines, requirements, terms, style_sheet,
                     profile=None):
        system, user = prompts.review_prompt(
            chunk, draft, source_lang, target_lang, guidelines, requirements, terms, style_sheet,
            overrides=self.prompt_overrides, profile=profile,
        )
        return (await self.client.chat(system, user, temperature=0.3)).strip()

    async def improve(self, chunk, draft, review, source_lang, target_lang, terms, style_sheet,
                      profile=None, context=None):
        system, user = prompts.improve_prompt(
            chunk, draft, review, source_lang, target_lang, terms, style_sheet,
            overrides=self.prompt_overrides, profile=profile, context=context,
        )
        return prompts.clean_output(await self.client.chat(system, user, temperature=0.4))

    async def check_terms(self, translation, source_lang, target_lang, terms, profile=None):
        system, user = prompts.terminology_prompt(
            translation, source_lang, target_lang, terms, overrides=self.prompt_overrides, profile=profile,
        )
        return prompts.clean_output(await self.client.chat(system, user, temperature=0.1))


_DEMO_KEYWORDS = {
    "literary": ["once upon", "she said", "he whispered", "novel", "poem", "chapter", "heart", "dream", "moon", "sea"],
    "marketing": ["discover", "exclusive", "offer", "brand", "customers", "limited", "buy", "launch", "!"],
    "legal": ["hereby", "agreement", "party", "shall", "clause", "liability", "pursuant", "contract", "terms"],
    "business": ["revenue", "quarter", "stakeholder", "strategy", "market share", "board", "fiscal", "kpi"],
    "academic": ["study", "hypothesis", "et al", "findings", "methodology", "literature", "abstract"],
    "technical": ["install", "configure", "click", "api", "server", "version", "settings", "device"],
    "medical": ["patient", "dose", "mg", "clinical", "symptoms", "treatment", "diagnosis"],
    "news": ["reported", "according to", "on monday", "on tuesday", "officials", "said on", "press"],
}

_DEMO_REPLIES = {
    "literary": "What a lovely piece — our Creative Studio will keep every bit of its voice.",
    "marketing": "Great copy! Our Creative Studio will make it sing for your new market.",
    "legal": "Understood. Legal & Business will handle this with full precision.",
    "business": "Clear brief. Legal & Business will keep it crisp and professional.",
    "academic": "Interesting research — Science & Medical will keep the rigour intact.",
    "technical": "Our Science & Medical team knows docs like these inside out.",
    "medical": "Patient safety first — Science & Medical will be meticulous.",
    "news": "Fresh story! News & Media will turn it around quickly and accurately.",
    "master": "A tricky mix — this one goes straight to our Master Translator.",
}


def _apply_terms(text: str, terms: Dict[str, str]) -> str:
    for src, tgt in sorted(terms.items(), key=lambda kv: -len(kv[0])):
        text = re.sub(re.escape(src), tgt, text, flags=re.I)
    return text


class DemoBrain:
    """Plays the part of every agent without an API key.

    Real files are read, chunked, checked against the term base and bound;
    only the language work itself is simulated.
    """

    demo = True

    def __init__(self, speed: float = 1.0):
        self.speed = speed

    async def _think(self, low: float, high: float, text_len: int = 0):
        base = random.uniform(low, high) + min(text_len / 1500, 2.5)
        await asyncio.sleep(base / self.speed)

    async def analyze(self, translation_type, brief, sample, source_lang, target_lang, has_glossary, has_style_sheet):
        await self._think(2.5, 3.5)
        domain = forced_domain(translation_type)
        if not domain:
            haystack = f"{brief} {sample}".lower()
            scores = {d: sum(haystack.count(k) for k in kws) for d, kws in _DEMO_KEYWORDS.items()}
            best = max(scores, key=scores.get)
            domain = best if scores[best] >= 2 else "master"
        label = DOMAINS[domain]["label"]
        guidelines = list(DOMAINS[domain]["guidelines"][:3])
        if has_style_sheet:
            guidelines.append("Follow the client's style sheet on every page")
        if has_glossary:
            guidelines.append("Use the client's term base without exception")
        return {
            "domain": domain,
            "detected_style": f"{label} text",
            "style_guidelines": guidelines,
            "quality_requirements": ["Accurate and complete", "Natural flow in " + target_lang, "Consistent terminology"],
            "reasoning": (
                f"(Demo mode) The brief and source text read as {label.lower()} content, so the job is routed to the "
                f"{label} specialists. Guidelines emphasise {DOMAINS[domain]['guidelines'][0].lower()}."
            ),
            "client_reply": _DEMO_REPLIES[domain],
        }

    async def translate(self, domain, chunk, index, total, source_lang, target_lang, guidelines, terms, style_sheet,
                        profile=None, context=None):
        await self._think(3.0, 5.0, len(chunk))
        return _apply_terms(chunk, terms)

    async def review(self, chunk, draft, source_lang, target_lang, guidelines, requirements, terms, style_sheet,
                     profile=None):
        await self._think(1.5, 2.5, len(chunk) // 3)
        notes = ["- Accuracy: no omissions found.", "- Fluency: reads naturally; minor rhythm tweaks suggested."]
        if terms:
            notes.append(f"- Term base: {len(terms)} term(s) verified.")
        if style_sheet:
            notes.append("- Style sheet: checked capitalisation, punctuation and tone rules.")
        return "(Demo review)\n" + "\n".join(notes)

    async def improve(self, chunk, draft, review, source_lang, target_lang, terms, style_sheet,
                      profile=None, context=None):
        await self._think(1.5, 2.5, len(chunk) // 3)
        return draft

    async def check_terms(self, translation, source_lang, target_lang, terms, profile=None):
        await self._think(1.0, 1.6)
        return _apply_terms(translation, terms)
