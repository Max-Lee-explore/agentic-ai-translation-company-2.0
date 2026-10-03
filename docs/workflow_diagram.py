"""Render the Agentic AI Translation Company 2.0 production pipeline as PDF + PNG.

Mirrors backend/main.py → app/pipeline.py (run_job) → app/brains.py (RealBrain) → app/prompts.py.

Requirements:
    brew install graphviz        # or apt-get install graphviz
    pip install graphviz

Usage:
    python docs/workflow_diagram.py            # writes docs/workflow.pdf and docs/workflow.png
"""

import os

from graphviz import Digraph

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
FONT = "Helvetica"

PALETTE = {
    "intake": ("#EEF2FF", "#6366F1"),
    "prep": ("#F1F5F9", "#64748B"),
    "manager": ("#FFF7ED", "#EA580C"),
    "team": ("#ECFDF5", "#059669"),
    "editor": ("#FDF4FF", "#C026D3"),
    "terms": ("#FEF2F2", "#DC2626"),
    "deliver": ("#EFF6FF", "#2563EB"),
    "decision": ("#FEFCE8", "#CA8A04"),
    "data": ("#FFFFFF", "#94A3B8"),
}


def card(title, lines=(), badge=None):
    """HTML-like label: bold title, optional badge, small grey detail lines."""
    rows = [f'<TR><TD ALIGN="LEFT"><B><FONT POINT-SIZE="13">{title}</FONT></B></TD></TR>']
    if badge:
        rows.append(f'<TR><TD ALIGN="LEFT"><FONT POINT-SIZE="9" COLOR="#475569"><I>{badge}</I></FONT></TD></TR>')
    for line in lines:
        rows.append(f'<TR><TD ALIGN="LEFT"><FONT POINT-SIZE="10" COLOR="#334155">{line}</FONT></TD></TR>')
    return "<<TABLE BORDER=\"0\" CELLBORDER=\"0\" CELLSPACING=\"1\" CELLPADDING=\"1\">" + "".join(rows) + "</TABLE>>"


def node(g, name, kind, title, lines=(), badge=None, shape="box"):
    fill, stroke = PALETTE[kind]
    g.node(
        name, card(title, lines, badge), shape=shape, style="rounded,filled" if shape == "box" else "filled",
        fillcolor=fill, color=stroke, penwidth="1.6", fontname=FONT, margin="0.18,0.10",
    )


def decision(g, name, text):
    fill, stroke = PALETTE["decision"]
    g.node(name, f"<<B>{text}</B>>", shape="diamond", style="filled", fillcolor=fill, color=stroke,
           penwidth="1.6", fontname=FONT, fontsize="11", margin="0.05")


def data(g, name, title, lines=()):
    fill, stroke = PALETTE["data"]
    g.node(name, card(title, lines), shape="note", style="filled", fillcolor=fill, color=stroke,
           penwidth="1.2", fontname=FONT, margin="0.15,0.08")


def cluster(parent, key, label, kind):
    fill, stroke = PALETTE[kind]
    c = parent.subgraph(name=f"cluster_{key}")
    label = label.replace("&", "&amp;")
    return c, dict(label=f"<<B>{label}</B>>", labeljust="l", fontname=FONT, fontsize="14",
                   style="rounded,dashed", color=stroke, fontcolor=stroke, bgcolor="#FFFFFF", margin="16")


def build() -> Digraph:
    g = Digraph("pipeline", format="pdf")
    g.attr(
        rankdir="TB", splines="spline", nodesep="0.45", ranksep="0.55", pad="0.4",
        fontname=FONT, bgcolor="white", newrank="true",
        label=(
            "<<FONT POINT-SIZE=\"22\"><B>Agentic AI Translation Company 2.0 — Production Pipeline</B></FONT><BR/>"
            "<FONT POINT-SIZE=\"11\" COLOR=\"#64748B\">POST /api/translate → run_job() · events streamed to the client "
            "as NDJSON · every LLM call: OpenRouter / OpenAI / Anthropic / Gemini / xAI, up to 3 retries</FONT>>"
        ),
        labelloc="t",
    )
    g.attr("edge", color="#64748B", penwidth="1.3", arrowsize="0.8", fontname=FONT, fontsize="9", fontcolor="#475569")

    # 1 · Intake --------------------------------------------------------------
    c, attrs = cluster(g, "intake", "1 · Order intake  (backend/main.py)", "intake")
    with c as s:
        s.attr(**attrs)
        node(s, "order", "intake", "Client order",
             ["Source document: PDF · DOCX · PPTX · HTML · JSON · MD · TXT",
              "Source → target language · translation type · brief",
              "Output format · provider · model · API key",
              "Chunk size · per-specialist temperatures · prompt overrides"])
        node(s, "termfile", "intake", "Term base (optional)",
             ["CSV · TSV · XLSX · JSON · TXT", "Parsed to {source term → target term}"])
        node(s, "stylefile", "intake", "Style sheet (optional)",
             ["TXT · MD · DOCX · PDF · HTML · JSON", "Extracted to plain text (≤ 6,000 chars in prompts)"])
        node(s, "validate", "intake", "Validate &amp; store uploads", ["File-type checks · per-job folder (24 h TTL)"])

    # 2 · Preparation ---------------------------------------------------------
    c, attrs = cluster(g, "prep", "2 · Preparation  (app/files.py)", "prep")
    with c as s:
        s.attr(**attrs)
        node(s, "extract", "prep", "Text extraction", ["Document → plain text"])
        node(s, "chunk", "prep", "Chunking",
             ["Recursive split: paragraph → line → sentence → word",
              "Chunk size clamped 300–12,000 chars · no overlap"])

    # 3 · Analysis ------------------------------------------------------------
    c, attrs = cluster(g, "analysis", "3 · Project analysis  (RealBrain.analyze)", "manager")
    with c as s:
        s.attr(**attrs)
        node(s, "manager", "manager", "Project Manager", badge="LLM · temperature 0.4",
             lines=["Reads the brief + first 1,800 chars of passage 1",
              "Knows whether a term base / style sheet was supplied"])
        data(s, "profile", "Project profile (JSON)",
             ["domain · detected style · target reader · locale",
              "style guidelines (3–5) · naturalness pitfalls (2–4)",
              "quality requirements (2–4) · reasoning · client reply"])
        decision(s, "forced", "Client chose a<BR/>translation type?")
        node(s, "use_client", "manager", "Use client's type", ["e.g. Legal → legal"])
        node(s, "use_manager", "manager", "Use manager's domain", ["normalised; fallback → master"])
        node(s, "route", "manager", "Route to one specialist team", ["team_for_domain(domain)"])

    # 4 · Translation ---------------------------------------------------------
    c, attrs = cluster(g, "translate", "4 · Translation  (passage queue, team members work in parallel)", "team")
    with c as s:
        s.attr(**attrs)
        node(s, "t_creative", "team", "Creative Studio", ["Literary (0.8) · Marketing (0.8)", "2 translators"])
        node(s, "t_legal", "team", "Legal &amp; Business", ["Legal (0.65) · Business (0.7)", "2 translators"])
        node(s, "t_science", "team", "Science &amp; Medical",
             ["Academic (0.7) · Technical (0.65) · Medical (0.6)", "2 translators"])
        node(s, "t_news", "team", "News &amp; Media", ["News (0.7)", "2 translators"])
        node(s, "t_master", "team", "Master Translator", ["Mixed / unusual content (0.7)", "1 translator"])
        data(s, "tprompt", "Translator prompt (per passage)",
             ["Role prompt (editable) + naturalness standard",
              "+ language-pair notes (EN→zh-TW / zh-HK, zh→EN)",
              "+ domain rules + manager guidelines + reader profile",
              "+ term-base entries found in this passage",
              "+ style sheet + end of previous passage (context)"])

    # 5 · Editing -------------------------------------------------------------
    c, attrs = cluster(g, "edit", "5 · Editing  (editor queue · 2 parallel slots)", "editor")
    with c as s:
        s.attr(**attrs)
        node(s, "review", "editor", "Senior Editor · Review", badge="LLM · temperature 0.3",
             lines=["Pass 1 — native read: translationese, transliteration, locale",
              "Pass 2 — fidelity vs. source, term base, style sheet",
              "Output: tagged issues with suggested rewrites"])
        node(s, "improve", "editor", "Senior Editor · Improve", badge="LLM · temperature 0.4",
             lines=["Applies review notes · may rewrite whole sentences",
              "Keeps meaning, term base and style sheet"])

    # 6 · Terminology ---------------------------------------------------------
    c, attrs = cluster(g, "terms", "6 · Terminology  (term queue · 2 parallel slots)", "terms")
    with c as s:
        s.attr(**attrs)
        decision(s, "has_glossary", "Term base<BR/>uploaded?")
        decision(s, "has_terms", "Terms appear<BR/>in passage?")
        node(s, "terminologist", "terms", "Terminologist", badge="LLM · temperature 0.1",
             lines=["Swaps non-compliant terms for term-base entries",
              "Adjusts only neighbouring words for grammar"])
        node(s, "passthrough", "terms", "Pass through unchanged", ["Edited passage is final"])

    # 7 · Delivery ------------------------------------------------------------
    c, attrs = cluster(g, "deliver", "7 · Binding & delivery", "deliver")
    with c as s:
        s.attr(**attrs)
        node(s, "bind", "deliver", "Binding", ["Waits for every passage · reassembles in source order"])
        node(s, "outfile", "deliver", "Translation file", ["DOCX · TXT · MD · HTML · JSON"])
        node(s, "details", "deliver", "Job details report (JSON)",
             ["Analysis · team · per-passage steps (draft → review → revision → terms)",
              "Token usage · duration"])
        node(s, "download", "deliver", "Client download", ["GET /api/download/{job_id}/translation | details"])

    # Flow ---------------------------------------------------------------------
    g.edge("order", "validate")
    g.edge("termfile", "validate", style="dashed")
    g.edge("stylefile", "validate", style="dashed")
    g.edge("validate", "extract")
    g.edge("extract", "chunk")
    g.edge("chunk", "manager", label="  passage 1 sample")
    g.edge("manager", "profile")
    g.edge("profile", "forced")
    g.edge("forced", "use_client", label="  yes")
    g.edge("forced", "use_manager", label="  no  (Help me to decide)")
    g.edge("use_client", "route")
    g.edge("use_manager", "route")
    for t in ("t_creative", "t_legal", "t_science", "t_news", "t_master"):
        g.edge("route", t)
        g.edge(t, "review")
    with g.subgraph() as same:
        same.attr(rank="same")
        for t in ("t_creative", "t_legal", "t_science", "t_news", "t_master"):
            same.node(t)
    g.edge("route", "tprompt", style="invis")
    g.edge("tprompt", "t_science", label="  every passage", style="dashed", color="#94A3B8")
    g.edge("review", "improve", label="  review notes")
    g.edge("improve", "has_glossary")
    g.edge("has_glossary", "has_terms", label="  yes")
    g.edge("has_glossary", "bind", label="  no", xlabel="")
    g.edge("has_terms", "terminologist", label="  yes")
    g.edge("has_terms", "passthrough", label="  no")
    g.edge("terminologist", "bind")
    g.edge("passthrough", "bind")
    g.edge("bind", "outfile")
    g.edge("bind", "details")
    g.edge("outfile", "download")
    g.edge("details", "download")

    # Shared inputs into later stages
    g.edge("profile", "review", label="  guidelines · requirements · profile", style="dotted", color="#EA580C",
           constraint="false")
    g.edge("termfile", "has_terms", label="  relevant terms per passage", style="dotted", color="#DC2626",
           constraint="false")

    return g


def main():
    g = build()
    base = os.path.join(OUT_DIR, "workflow")
    g.render(base, format="pdf", cleanup=True)
    g.render(base, format="png", cleanup=True)
    print(f"Wrote {base}.pdf and {base}.png")


if __name__ == "__main__":
    main()
