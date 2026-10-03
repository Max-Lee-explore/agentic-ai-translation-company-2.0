import json
import re
from typing import Dict, List, Optional

from .company import DOMAINS

STYLE_SHEET_LIMIT = 6000
CONTEXT_CHARS = 400

# Role identities. Users can override these in Studio settings; the naturalness
# rules and language-pair notes below are appended in code so they always apply.
DEFAULT_SYSTEM_PROMPTS = {
    "manager": (
        "You are the Project Manager of a boutique translation company. You read the client's brief, "
        "study the source text, work out who will read the translation, and decide which specialist "
        "handles the job. You are warm with clients and precise with your team."
    ),
    "literary": (
        "You are a Literary Translation Specialist experienced with fiction, poetry and creative non-fiction. "
        "You recreate the author's voice, rhythm and imagery so the text reads as if it had been written "
        "in the target language."
    ),
    "marketing": (
        "You are a Marketing & Transcreation Specialist. You rewrite copy so it persuades native readers "
        "of the target market as strongly as the original persuades its own, keeping the brand voice."
    ),
    "legal": (
        "You are a Legal Translation Specialist. You render exact legal meaning using the drafting "
        "conventions and established terminology of the target legal system."
    ),
    "business": (
        "You are a Business & Corporate Translation Specialist. You write clear, professional copy in the "
        "phrasing native business writers actually use, with figures and metrics exact."
    ),
    "academic": (
        "You are an Academic Translation Specialist. You keep scholarly rigour and hedging while writing "
        "in the conventions of academic prose in the target language."
    ),
    "technical": (
        "You are a Technical Documentation Translation Specialist. You produce precise, unambiguous "
        "documentation that reads like it was written natively for target-language users."
    ),
    "medical": (
        "You are a Medical Translation Specialist. Clinical accuracy and patient safety come first; you use "
        "the terminology and phrasing native clinicians and patient materials actually use."
    ),
    "news": (
        "You are a News & Journalism Translation Specialist. You write in the house style of a quality "
        "target-language newsroom: clear, factual and concise, with attribution and quotes accurate."
    ),
    "master": (
        "You are a Master Translator with decades of experience across every genre. You identify each "
        "register in mixed content and write each one as a native expert in that register would."
    ),
    "editor_review": (
        "You are the Senior Editor of a translation company. You review drafts rigorously and constructively, "
        "with a sharp ear for anything that sounds translated rather than natively written."
    ),
    "editor_improve": (
        "You are the Senior Editor of a translation company. You turn reviewed drafts into polished final "
        "copy that reads as if it were originally written in the target language."
    ),
    "terminologist": (
        "You are the Terminologist of a translation company. You enforce the client's term base exactly "
        "while keeping every sentence grammatical and natural."
    ),
}

NATURALNESS_RULES = """Naturalness standard (applies to every translation):
- Translate meaning, intent and effect — not words. Write what a skilled native writer of the target language would write for the same readers and purpose.
- Restructure freely: split or merge sentences, reorder clauses, change parts of speech, switch active/passive, and turn nouns into verbs whenever the target language prefers it. Never mirror source word order or sentence boundaries just because they are there.
- Avoid translationese: calques and word-for-word phrasing, stacked abstract nouns ("the implementation of the improvement of…"), long chains of pre-modifiers, unnecessary pronouns and possessives, overuse of the passive, source-language connectors and punctuation carried over mechanically.
- Idioms, metaphors and set phrases: use the target language's own equivalent; if none exists, express the meaning plainly. Never translate an idiom literally.
- No transliteration where an established target-language form exists. Use the conventional target-language names for places, organisations, people with established renderings, concepts, units and titles. Only transliterate proper names that have no accepted equivalent, and never leave source-language words untranslated unless the term base, style sheet or brief requires it.
- Follow target-locale conventions for punctuation, quotation marks, numbers, dates, currencies and units.
- Do not add, drop or soften meaning. Natural does not mean loose: every fact, nuance, qualification and obligation must survive.
- Before answering, reread your translation as a native reader who has never seen the source. Rewrite anything that sounds translated."""

_ZH_COMMON_TARGET = """English → Chinese pitfalls to eliminate:
- 被 overuse: English passives usually become active voice, topic–comment structure, or 受到／獲得／遭 only where idiomatic.
- Long 的-chains and heavy pre-modifiers: break long English noun phrases into short clauses; rarely allow more than two 的 in one phrase.
- 當……時／當……的時候 for every "when"; 作為 at the start of sentences; 透過／通過 for every "through/by"; 對於／關於 openers — use only where a native writer would.
- Empty verbs + nouns (進行討論, 作出決定, 加以改善, 予以處理): use the plain verb (討論, 決定, 改善, 處理).
- 一個／一種 for every "a/an"; 他／她／它／他們 for every pronoun — Chinese drops pronouns that are clear from context.
- Calques such as 在……方面, 在……的情況下, 基於……的考量, 是……的 framings, 「為……所……」, 「使得」 chains, 「具有……性」 — rewrite into direct Chinese.
- Keep English-style clause order only when it reads naturally; Chinese usually puts time, condition and cause before the main clause and the conclusion last.
- Punctuation: full-width （，。、；：？！）, 「」 for primary quotes and 『』 for nested quotes, ⋯⋯ for ellipsis, —— for dashes; no half-width punctuation inside Chinese text.
- Use established Chinese names for people, places, companies and brands when they exist; do not invent phonetic transliterations for names that already have a conventional form."""

_ZH_TW = """Locale: Traditional Chinese for Taiwan (zh-TW).
- Use Taiwan vocabulary: 軟體, 硬體, 網路, 影片, 資訊, 品質, 程式, 伺服器, 預設, 檔案, 滑鼠, 行動電話／手機, 計程車, 捷運, 專案, 介面, 列印, 支援, 解析度.
- Avoid Mainland and Hong Kong usage (軟件, 網絡, 視頻, 信息, 質量, 默認, 文件 for "file", 的士, 港鐵, 項目 for "project").
- Use Taiwan Ministry of Education standard character forms (e.g. 裡, 線); for 台／臺 follow the style sheet, otherwise use 台 consistently."""

_ZH_HK = """Locale: Traditional Chinese for Hong Kong (zh-HK), written standard Chinese (書面語), not Cantonese colloquial, unless the brief asks for Cantonese.
- Use Hong Kong vocabulary: 軟件, 硬件, 網絡, 影片, 資訊, 質素, 程式, 伺服器, 預設, 檔案, 的士, 港鐵, 項目, 流動電話, 打印, 支援, 解像度.
- Avoid Taiwan-only usage (軟體, 網路, 品質 for "quality", 捷運, 計程車, 專案) and Mainland usage (視頻, 信息, 質量, 默認).
- Use Hong Kong government and legal terminology where relevant (e.g. 條例, 附例, 特區政府, 立法會) and Hong Kong forms of names and places.
- Character forms: Hong Kong commonly uses 裏 and 綫; follow the style sheet if it specifies, otherwise use one form consistently."""

_ZH_TRAD_GENERIC = """Locale: Traditional Chinese. If the brief or manager notes indicate Taiwan or Hong Kong, use that region's vocabulary consistently; otherwise default to Taiwan usage (軟體, 網路, 影片, 資訊, 品質). Never mix regional vocabularies within one document."""

_ZH_TO_EN = """Chinese → English pitfalls to eliminate:
- Do not follow Chinese topic–comment order or run-on comma-spliced sentences; recast into idiomatic English sentences with clear subjects and verbs.
- Supply the subjects, articles, tense, number and connectors Chinese leaves implicit; choose them from context, not guesswork.
- Four-character idioms (成語) and set phrases: render the meaning idiomatically (e.g. 一石二鳥 → "kill two birds with one stone", but 畫蛇添足 → "overdo it", not a literal snake story).
- Remove redundancy that is stylistic in Chinese but padding in English (repeated subjects, paired synonyms like 認真負責, formulaic openers like 隨著……的發展).
- Avoid Chinglish calques: "carry out the work of…", "strengthen the construction of…", "make great efforts to…", "under the leadership of…" stacks, "very" + adjective inflation.
- Names: use established English names for organisations and places (e.g. 立法院 → Legislative Yuan, 行政院 → Executive Yuan, 立法會 → Legislative Council). For personal names use the person's own romanisation if known (Taiwan names often Wade–Giles style, Hong Kong names Cantonese romanisation); otherwise Hanyu Pinyin for Mainland names. Do not pinyin-transliterate names that have established English forms.
- Convert Chinese punctuation to English punctuation; replace 「」 with English quotation marks."""


def _is_trad_chinese(lang: str) -> bool:
    lang = (lang or "").lower()
    return "chinese" in lang and ("traditional" in lang or "taiwan" in lang or "hong kong" in lang)


def _is_chinese(lang: str) -> bool:
    lang = (lang or "").lower()
    return "chinese" in lang or "mandarin" in lang or "cantonese" in lang


def _locale_variant(target_lang: str, locale_hint: str) -> str:
    text = f"{target_lang} {locale_hint}".lower()
    if "hong kong" in text or "zh-hk" in text or "hk" in text.split():
        return "hk"
    if "taiwan" in text or "zh-tw" in text or "tw" in text.split():
        return "tw"
    return "generic"


def language_pair_notes(source_lang: str, target_lang: str, locale_hint: str = "") -> str:
    """Pair-specific naturalness notes appended to translator, editor and terminologist prompts."""
    blocks: List[str] = []
    if _is_trad_chinese(target_lang) and not _is_chinese(source_lang):
        blocks.append(_ZH_COMMON_TARGET)
        variant = _locale_variant(target_lang, locale_hint)
        blocks.append({"tw": _ZH_TW, "hk": _ZH_HK}.get(variant, _ZH_TRAD_GENERIC))
    elif _is_chinese(source_lang) and (target_lang or "").lower().startswith("english"):
        blocks.append(_ZH_TO_EN)
    return "\n\n".join(blocks)


def _sys(key: str, overrides: Optional[Dict[str, str]] = None) -> str:
    overrides = overrides or {}
    custom = (overrides.get(key) or "").strip()
    if custom:
        return custom
    return DEFAULT_SYSTEM_PROMPTS.get(key, DEFAULT_SYSTEM_PROMPTS["master"])


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
                      context: Optional[Dict[str, str]] = None):
    info = DOMAINS.get(domain, DOMAINS["master"])
    base = _sys(domain if domain in DEFAULT_SYSTEM_PROMPTS else "master", overrides)
    locale_hint = (profile or {}).get("locale", "")
    system = _join(
        f"{base} You translate from {source_lang} into {target_lang}, writing as a native {target_lang} "
        "professional would. Before finalising, you check your draft against the client's term base and "
        "style sheet, and reread it as a native reader.",
        NATURALNESS_RULES,
        language_pair_notes(source_lang, target_lang, locale_hint),
    )
    user = _join(
        f"Translate passage {index + 1} of {total} from {source_lang} into {target_lang}.",
        f"Domain rules:\n{_bullets(info['guidelines'])}",
        f"Project guidelines from the manager:\n{_bullets(guidelines)}",
        _reader_block(profile),
        _glossary_block(terms),
        _style_sheet_block(style_sheet),
        _context_block(context),
        f"Passage to translate:\n\"\"\"\n{chunk}\n\"\"\"",
        "Return ONLY the translated passage — no notes, no quotes, no preamble. Keep the paragraph breaks "
        "and headings of the source, but restructure sentences within each paragraph as freely as natural "
        f"{target_lang} requires.",
    )
    return system, user


def review_prompt(chunk: str, draft: str, source_lang: str, target_lang: str, guidelines: List[str],
                  requirements: List[str], terms: Dict[str, str], style_sheet: Optional[str],
                  overrides: Optional[Dict[str, str]] = None, profile: Optional[Dict] = None):
    locale_hint = (profile or {}).get("locale", "")
    system = _join(
        _sys("editor_review", overrides),
        NATURALNESS_RULES,
        language_pair_notes(source_lang, target_lang, locale_hint),
    )
    user = _join(
        f"Review this {source_lang} → {target_lang} draft in two passes.",
        f"Draft:\n\"\"\"\n{draft}\n\"\"\"",
        f"Source:\n\"\"\"\n{chunk}\n\"\"\"",
        f"Project guidelines:\n{_bullets(guidelines)}",
        f"Quality requirements:\n{_bullets(requirements)}",
        _reader_block(profile),
        _glossary_block(terms),
        _style_sheet_block(style_sheet),
        f"""Pass 1 — Native read: read the draft on its own, as a native {target_lang} reader who has never seen the source. Flag every phrase that sounds translated: calques, literal idioms, unnatural word order, stacked nouns or modifiers, unnecessary pronouns/passives, transliterations where an established {target_lang} form exists, wrong-locale vocabulary, source-style punctuation.

Pass 2 — Fidelity check: compare against the source for mistranslations, omissions, additions, shifts in tone or register, term base and style sheet compliance.

Format each issue as one bullet:
- [Naturalness|Accuracy|Terminology|Style] "quoted problem text" → suggested natural rewrite (brief reason)

Prioritise the most important issues (max ~15 bullets). If the draft already reads natively and is accurate, say so in one line.""",
    )
    return system, user


def improve_prompt(chunk: str, draft: str, review: str, source_lang: str, target_lang: str,
                   terms: Dict[str, str], style_sheet: Optional[str],
                   overrides: Optional[Dict[str, str]] = None, profile: Optional[Dict] = None,
                   context: Optional[Dict[str, str]] = None):
    locale_hint = (profile or {}).get("locale", "")
    system = _join(
        _sys("editor_improve", overrides),
        NATURALNESS_RULES,
        language_pair_notes(source_lang, target_lang, locale_hint),
    )
    user = _join(
        f"Produce the final {target_lang} version of this passage using the review notes.",
        f"Source ({source_lang}):\n\"\"\"\n{chunk}\n\"\"\"",
        f"Draft:\n\"\"\"\n{draft}\n\"\"\"",
        f"Review notes:\n{review}",
        _reader_block(profile),
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
    locale_hint = (profile or {}).get("locale", "")
    system = _join(
        _sys("terminologist", overrides),
        language_pair_notes(source_lang, target_lang, locale_hint),
    )
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
