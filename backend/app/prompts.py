import json
import re
from typing import Dict, List, Optional

from .company import DOMAINS
from .runtime import registry

STYLE_SHEET_LIMIT = 6000
CONTEXT_CHARS = 400

# Role identities, rules and skills live in backend/agents/*/AGENT.md and backend/skills/*/SKILL.md.
# Users can override an agent's identity paragraph in Studio settings; its skills always apply.


def default_prompts() -> Dict[str, str]:
    return {a.id: a.prompt for a in registry.load_agents().values()}


def _sys(key: str, overrides: Optional[Dict[str, str]] = None) -> str:
    custom = ((overrides or {}).get(key) or "").strip()
    return custom or registry.agent(key).prompt


def skill_blocks(agent_id: str, source_lang: str, target_lang: str, locale_hint: str = "") -> str:
    """Bodies of the agent's skills that apply to this language pair and locale."""
    return "\n\n".join(s.body for s in registry.skills_for(agent_id, source_lang, target_lang, locale_hint))


def _system(agent_id: str, overrides, source_lang: str, target_lang: str, profile: Optional[Dict], prefix: str = "") -> str:
    locale_hint = (profile or {}).get("locale", "")
    head = f"{_sys(agent_id, overrides)} {prefix}".strip()
    return _join(head, skill_blocks(agent_id, source_lang, target_lang, locale_hint))


def _bullets(items: List[str]) -> str:
    return "\n".join(f"- {i}" for i in items) if items else "- (none specified)"


def _glossary_block(terms: Dict[str, str]) -> str:
    if not terms:
        return "No term base entries apply to this passage."
    lines = "\n".join(f"- {src} → {tgt}" for src, tgt in terms.items())
    return (
        "Term base entries that appear in this passage (MANDATORY — use exactly these target terms, "
        f"fitting them grammatically into natural sentences):\n{lines}"
    )


def _style_sheet_block(style_sheet: Optional[str]) -> str:
    if not style_sheet:
        return "No client style sheet was provided."
    text = style_sheet.strip()
    if len(text) > STYLE_SHEET_LIMIT:
        text = text[:STYLE_SHEET_LIMIT] + "\n[…style sheet truncated…]"
    return f"Client style sheet (MANDATORY — follow every rule; it overrides general conventions):\n\"\"\"\n{text}\n\"\"\""


def _reader_block(profile: Optional[Dict]) -> str:
    profile = profile or {}
    parts = []
    if profile.get("target_reader"):
        parts.append(f"Target reader: {profile['target_reader']}")
    if profile.get("locale"):
        parts.append(f"Target locale: {profile['locale']}")
    pitfalls = profile.get("naturalness_pitfalls") or []
    if pitfalls:
        parts.append("Naturalness pitfalls the manager flagged for this text:\n" + _bullets(pitfalls))
    return "\n".join(parts)


def _context_block(context: Optional[Dict[str, str]]) -> str:
    context = context or {}
    src = (context.get("prev_source") or "").strip()
    tgt = (context.get("prev_target") or "").strip()
    if not src and not tgt:
        return ""
    out = ["Context from the end of the previous passage (read-only — do NOT translate or repeat it; use it only for continuity of pronouns, terminology, tone and sentence flow):"]
    if src:
        out.append(f"Previous source ending:\n\"\"\"\n…{src[-CONTEXT_CHARS:]}\n\"\"\"")
    if tgt:
        out.append(f"Previous translation ending:\n\"\"\"\n…{tgt[-CONTEXT_CHARS:]}\n\"\"\"")
    return "\n".join(out)


def _memory_block(memory: str) -> str:
    if not (memory or "").strip():
        return ""
    return (
        "Job memory — rendering decisions already made in earlier passages (reuse them exactly for consistency, "
        f"unless the term base says otherwise):\n{memory}"
    )


def _feedback_block(feedback: Optional[Dict[str, str]]) -> str:
    if not feedback:
        return ""
    return _join(
        "The Senior Editor sent your previous draft back. Redo the passage, fixing every issue below while "
        "keeping what was already right.",
        f"Your previous draft:\n\"\"\"\n{feedback.get('draft', '')}\n\"\"\"",
        f"Editor's notes:\n{feedback.get('notes', '')}",
    )


def _join(*blocks: str) -> str:
    return "\n\n".join(b for b in blocks if b and b.strip())


def manager_prompt(translation_type: str, brief: str, sample: str, source_lang: str, target_lang: str,
                   has_glossary: bool, has_style_sheet: bool, overrides: Optional[Dict[str, str]] = None):
    system = _sys("manager", overrides)
    domain_list = ", ".join(k for k in DOMAINS)
    forced = translation_type and translation_type.lower() != "help me to decide"
    decision = (
        f'The client explicitly asked for "{translation_type}" translation; set "domain" accordingly.'
        if forced
        else "Choose the single best domain for this text."
    )
    user = f"""New order: {source_lang} → {target_lang}.
Client brief: {brief.strip() or "(no brief given)"}
Client supplied a term base: {"yes" if has_glossary else "no"}. Client supplied a style sheet: {"yes" if has_style_sheet else "no"}.

Source text sample:
\"\"\"
{sample[:1800]}
\"\"\"

Available domains: {domain_list}. Use "master" for mixed or unusual content.
{decision}

The company's goal is a translation that reads as if it were originally written in {target_lang} for its readers — no translationese, no unnecessary transliteration. Your guidelines should help the translators achieve that for THIS text.

Reply with ONLY a JSON object:
{{
  "domain": "one of the available domains",
  "detected_style": "short description of the text type and register",
  "target_reader": "who will read the translation, where, and for what purpose (one sentence)",
  "locale": "specific target locale/variety, e.g. 'Traditional Chinese (Taiwan)', 'Traditional Chinese (Hong Kong)', 'US English' — infer from the brief and target language; say 'unspecified' if unclear",
  "style_guidelines": ["3-5 concrete guidelines for the translators about register, tone and phrasing"],
  "naturalness_pitfalls": ["2-4 specific constructions in this source text that are likely to produce translationese or literal renderings in {target_lang}, each with how to handle it"],
  "quality_requirements": ["2-4 quality checks for the editor"],
  "reasoning": "2-4 sentences explaining your decision with reference to the brief and text",
  "client_reply": "one friendly sentence (max 20 words) you say to the client after reading the brief"
}}"""
    return system, user


def translator_prompt(domain: str, chunk: str, index: int, total: int, source_lang: str, target_lang: str,
                      guidelines: List[str], terms: Dict[str, str], style_sheet: Optional[str],
                      overrides: Optional[Dict[str, str]] = None, profile: Optional[Dict] = None,
                      context: Optional[Dict[str, str]] = None, memory: str = "",
                      feedback: Optional[Dict[str, str]] = None):
    agent = registry.agent(domain)
    system = _system(
        agent.id, overrides, source_lang, target_lang, profile,
        f"You translate from {source_lang} into {target_lang}, writing as a native {target_lang} "
        "professional would. Before finalising, you check your draft against the client's term base and "
        "style sheet, and reread it as a native reader.",
    )
    user = _join(
        f"Translate passage {index + 1} of {total} from {source_lang} into {target_lang}.",
        f"Domain rules:\n{_bullets(agent.rules)}",
        f"Project guidelines from the manager:\n{_bullets(guidelines)}",
        _reader_block(profile),
        _memory_block(memory),
        _glossary_block(terms),
        _style_sheet_block(style_sheet),
        _context_block(context),
        f"Passage to translate:\n\"\"\"\n{chunk}\n\"\"\"",
        _feedback_block(feedback),
        "Return ONLY the translated passage — no notes, no quotes, no preamble. Keep the paragraph breaks "
        "and headings of the source, but restructure sentences within each paragraph as freely as natural "
        f"{target_lang} requires.",
    )
    return system, user


def review_prompt(chunk: str, draft: str, source_lang: str, target_lang: str, guidelines: List[str],
                  requirements: List[str], terms: Dict[str, str], style_sheet: Optional[str],
                  overrides: Optional[Dict[str, str]] = None, profile: Optional[Dict] = None,
                  memory: str = "", round_no: int = 1):
    system = _system("editor_review", overrides, source_lang, target_lang, profile)
    user = _join(
        f"Review this {source_lang} → {target_lang} draft in two passes."
        + (f" This is review round {round_no}: the translator has already revised once." if round_no > 1 else ""),
        f"Draft:\n\"\"\"\n{draft}\n\"\"\"",
        f"Source:\n\"\"\"\n{chunk}\n\"\"\"",
        f"Project guidelines:\n{_bullets(guidelines)}",
        f"Quality requirements:\n{_bullets(requirements)}",
        _reader_block(profile),
        _memory_block(memory),
        _glossary_block(terms),
        _style_sheet_block(style_sheet),
        f"""Pass 1 — Native read: read the draft on its own, as a native {target_lang} reader who has never seen the source. Flag every phrase that sounds translated: calques, literal idioms, unnatural word order, stacked nouns or modifiers, unnecessary pronouns/passives, transliterations where an established {target_lang} form exists, wrong-locale vocabulary, source-style punctuation.

Pass 2 — Fidelity check: compare against the source for mistranslations, omissions, additions, shifts in tone or register, term base and style sheet compliance.

Format each issue as one bullet:
- [Naturalness|Accuracy|Terminology|Style] "quoted problem text" → suggested natural rewrite (brief reason)

Prioritise the most important issues (max ~15 bullets). If the draft already reads natively and is accurate, say so in one line.

Finish with exactly one verdict line:
VERDICT: PASS — the draft is accurate; any remaining issues are polish the editor can fix directly.
VERDICT: REVISE — there are mistranslations, omissions, additions or pervasive translationese that the translator must redo.""",
    )
    return system, user


def parse_verdict(review: str) -> str:
    """'revise' only on an explicit REVISE verdict; anything else (missing, malformed) passes."""
    match = re.findall(r"VERDICT:\s*(PASS|REVISE)", review or "", flags=re.I)
    return "revise" if match and match[-1].upper() == "REVISE" else "pass"


def improve_prompt(chunk: str, draft: str, review: str, source_lang: str, target_lang: str,
                   terms: Dict[str, str], style_sheet: Optional[str],
                   overrides: Optional[Dict[str, str]] = None, profile: Optional[Dict] = None,
                   context: Optional[Dict[str, str]] = None, memory: str = ""):
    system = _system("editor_improve", overrides, source_lang, target_lang, profile)
    user = _join(
        f"Produce the final {target_lang} version of this passage using the review notes.",
        f"Source ({source_lang}):\n\"\"\"\n{chunk}\n\"\"\"",
        f"Draft:\n\"\"\"\n{draft}\n\"\"\"",
        f"Review notes:\n{review}",
        _reader_block(profile),
        _memory_block(memory),
        _glossary_block(terms),
        _style_sheet_block(style_sheet),
        _context_block(context),
        "Apply every valid review note. You may rewrite whole sentences — not just patch words — wherever "
        "that makes the text read as natively written. Do not add or drop meaning, and keep every term base "
        "entry and style sheet rule. Finish with one last read as a native reader.\n\n"
        "Return ONLY the final revised translation — no commentary.",
    )
    return system, user


def terminology_prompt(translation: str, source_lang: str, target_lang: str, terms: Dict[str, str],
                       overrides: Optional[Dict[str, str]] = None, profile: Optional[Dict] = None):
    system = _system("terminologist", overrides, source_lang, target_lang, profile)
    user = _join(
        f"Check this {target_lang} translation against the term base and correct any deviations.",
        _glossary_block(terms),
        f"Translation:\n\"\"\"\n{translation}\n\"\"\"",
        "Replace every non-compliant term with the term base entry. Adjust only the immediately surrounding "
        "words (measure words, particles, articles, agreement, inflection, word order) needed to keep the "
        "sentence grammatical and natural. Change nothing else.\n\n"
        "Return ONLY the corrected translation.",
    )
    return system, user


def memory_prompt(chunk: str, final: str, source_lang: str, target_lang: str, known: str,
                  overrides: Optional[Dict[str, str]] = None, profile: Optional[Dict] = None):
    """Editor extracts rendering decisions from a finished passage into the job's shared memory."""
    system = _system("editor_improve", overrides, source_lang, target_lang, profile)
    user = _join(
        f"From this finished {source_lang} → {target_lang} passage, list the rendering decisions later passages "
        "must reuse for consistency: names of people, places and organisations; recurring terms or concepts NOT "
        "already in the term base; titles; set phrases; and tone/form-of-address choices.",
        f"Already recorded (do not repeat):\n{known or '(nothing yet)'}",
        f"Source:\n\"\"\"\n{chunk}\n\"\"\"",
        f"Final translation:\n\"\"\"\n{final}\n\"\"\"",
        'Reply with ONLY a JSON object: {"decisions": [{"source": "…", "target": "…", "note": "optional, max 8 words"}]}. '
        "At most 8 new decisions; an empty list is fine.",
    )
    return system, user


def parse_decisions(text: str) -> List[Dict[str, str]]:
    try:
        data = parse_json(text)
    except Exception:
        return []
    out = []
    for item in data.get("decisions") or []:
        if isinstance(item, dict) and str(item.get("source", "")).strip() and str(item.get("target", "")).strip():
            out.append({k: str(item.get(k, "")).strip() for k in ("source", "target", "note")})
    return out[:8]


def clean_output(text: str) -> str:
    text = (text or "").strip()
    fence = re.match(r"^```[a-zA-Z]*\n(.*?)\n```$", text, re.S)
    if fence:
        text = fence.group(1).strip()
    if len(text) >= 6 and text.startswith('"""') and text.endswith('"""'):
        text = text[3:-3].strip()
    return text


def parse_json(text: str) -> dict:
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("No JSON object in manager response")
    return json.loads(text[start : end + 1])
