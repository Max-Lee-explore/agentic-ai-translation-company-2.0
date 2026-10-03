"""The translation job, emitted as a stream of events the office scene can act out.

Flow: receive → chunk → manager analysis → translators (parallel within the team)
→ editor (review + improve) → terminologist (only with a term base) → binding → delivery.
"""

import asyncio
import os
import time
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional

from . import files
from .company import DOMAINS, TEAMS, team_for_domain

EDITOR_SLOTS = 2
TERMINOLOGIST_SLOTS = 2


@dataclass
class Job:
    job_id: str
    out_dir: str
    file_path: str
    file_name: str
    source_lang: str
    target_lang: str
    translation_type: str
    brief: str
    output_format: str
    chunk_size: int
    provider: str
    model: str
    glossary: Optional[Dict[str, str]] = None
    style_sheet: Optional[str] = None
    style_sheet_name: Optional[str] = None
    glossary_name: Optional[str] = None
    started_at: float = field(default_factory=time.time)

    @property
    def stem(self) -> str:
        return os.path.splitext(self.file_name)[0] or "document"


class _Stop:
    pass


STOP = _Stop()


async def run_job(job: Job, brain, emit: Callable[[dict], None]):
    stage = "receiving"

    def send(event_type: str, **data):
        emit({"type": event_type, "ts": round(time.time(), 3), **data})

    try:
        send(
            "job_received",
            job_id=job.job_id,
            file_name=job.file_name,
            source_lang=job.source_lang,
            target_lang=job.target_lang,
            translation_type=job.translation_type,
            brief=job.brief[:280],
            has_glossary=bool(job.glossary),
            glossary_terms=len(job.glossary or {}),
            has_style_sheet=bool(job.style_sheet),
            demo=brain.demo,
            provider=job.provider,
            model=job.model,
        )

        stage = "chunking"
        send("chunking_started")
        text = await asyncio.to_thread(files.extract_text, job.file_path)
        chunks = files.split_text(text, job.chunk_size)
        if not chunks:
            raise files.FileError("No readable text was found in the uploaded file.")
        total = len(chunks)
        send("chunking_done", chunks=total, characters=len(text), chunk_sizes=[len(c) for c in chunks])

        stage = "analysis"
        send("analysis_started")
        analysis = await brain.analyze(
            job.translation_type, job.brief, chunks[0], job.source_lang, job.target_lang,
            bool(job.glossary), bool(job.style_sheet),
        )
        domain = analysis["domain"]
        team_id = team_for_domain(domain)
        team = TEAMS[team_id]
        workers: List[str] = list(team["members"])
        guidelines = analysis["style_guidelines"]
        requirements = analysis["quality_requirements"]
        send(
            "analysis_done",
            domain=domain,
            domain_label=DOMAINS[domain]["label"],
            team_id=team_id,
            team_name=team["name"],
            workers=workers,
            detected_style=analysis["detected_style"],
            target_reader=analysis.get("target_reader", ""),
            locale=analysis.get("locale", ""),
            naturalness_pitfalls=analysis.get("naturalness_pitfalls", []),
            reasoning=analysis["reasoning"],
            style_guidelines=guidelines,
            quality_requirements=requirements,
            client_reply=analysis["client_reply"],
        )

        stage = "translation"
        chunk_details = [{"index": i, "original": c, "steps": []} for i, c in enumerate(chunks)]
        finals: List[Optional[str]] = [None] * total
        translate_q: asyncio.Queue = asyncio.Queue()
        editor_q: asyncio.Queue = asyncio.Queue()
        term_q: asyncio.Queue = asyncio.Queue()
        for i in range(total):
            translate_q.put_nowait(i)
        drafts: Dict[int, str] = {}
        edited: Dict[int, str] = {}
        state = {"completed": 0}

        profile = {
            "target_reader": analysis.get("target_reader", ""),
            "locale": analysis.get("locale", ""),
            "naturalness_pitfalls": analysis.get("naturalness_pitfalls", []),
        }

        def terms_for(i: int) -> Dict[str, str]:
            return files.relevant_terms(job.glossary, chunks[i]) if job.glossary else {}

        def context_for(i: int) -> Dict[str, str]:
            # Chunks run in parallel, so the previous translation may not exist yet.
            if i == 0:
                return {}
            return {"prev_source": chunks[i - 1], "prev_target": edited.get(i - 1) or drafts.get(i - 1, "")}

        def finish(i: int, final_text: str):
            finals[i] = final_text
            state["completed"] += 1
            send("chunk_completed", chunk=i, completed=state["completed"], total=total)

        async def translator(worker: str):
            while True:
                try:
                    i = translate_q.get_nowait()
                except asyncio.QueueEmpty:
                    return
                terms = terms_for(i)
                send("translate_started", chunk=i, total=total, worker=worker, terms=len(terms),
                     style_sheet=bool(job.style_sheet))
                draft = await brain.translate(
                    domain, chunks[i], i, total, job.source_lang, job.target_lang,
                    guidelines, terms, job.style_sheet, profile=profile, context=context_for(i),
                )
                drafts[i] = draft
                chunk_details[i]["translator"] = worker
                chunk_details[i]["steps"].append({"step": "Translation", "agent": worker, "result": draft})
                send("translate_done", chunk=i, total=total, worker=worker)
                await editor_q.put(i)

        async def editor(slot: int):
            while True:
                i = await editor_q.get()
                if i is STOP:
                    return
                terms = terms_for(i)
                send("review_started", chunk=i, total=total, slot=slot)
                notes = await brain.review(
                    chunks[i], drafts[i], job.source_lang, job.target_lang, guidelines, requirements,
                    terms, job.style_sheet, profile=profile,
                )
                chunk_details[i]["steps"].append({"step": "Editor review", "agent": "editor", "result": notes})
                send("review_done", chunk=i, total=total, slot=slot)
                send("improve_started", chunk=i, total=total, slot=slot)
                improved = await brain.improve(
                    chunks[i], drafts[i], notes, job.source_lang, job.target_lang, terms, job.style_sheet,
                    profile=profile, context=context_for(i),
                )
                edited[i] = improved
                chunk_details[i]["steps"].append({"step": "Editor revision", "agent": "editor", "result": improved})
                send("improve_done", chunk=i, total=total, slot=slot)
                if job.glossary:
                    await term_q.put(i)
                else:
                    finish(i, improved)

        async def terminologist(slot: int):
            while True:
                i = await term_q.get()
                if i is STOP:
                    return
                terms = terms_for(i)
                send("terms_started", chunk=i, total=total, terms=len(terms), slot=slot)
                if terms:
                    checked = await brain.check_terms(
                        edited[i], job.source_lang, job.target_lang, terms, profile=profile,
                    )
                else:
                    checked = edited[i]
                chunk_details[i]["steps"].append({"step": "Terminology check", "agent": "terminologist", "result": checked})
                send("terms_done", chunk=i, total=total, terms=len(terms), changed=checked != edited[i], slot=slot)
                finish(i, checked)

        async def translators_stage():
            await asyncio.gather(*(translator(w) for w in workers))
            for _ in range(EDITOR_SLOTS):
                await editor_q.put(STOP)

        async def editors_stage():
            await asyncio.gather(*(editor(s) for s in range(EDITOR_SLOTS)))
            for _ in range(TERMINOLOGIST_SLOTS):
                await term_q.put(STOP)

        async def terms_stage():
            await asyncio.gather(*(terminologist(s) for s in range(TERMINOLOGIST_SLOTS)))

        try:
            async with asyncio.TaskGroup() as tg:
                tg.create_task(translators_stage())
                tg.create_task(editors_stage())
                tg.create_task(terms_stage())
        except BaseExceptionGroup as group:
            raise group.exceptions[0]

        stage = "binding"
        send("binding_started", chunks=total)
        blocks = [f or "" for f in finals]
        if brain.demo:
            blocks = [
                "DEMO MODE — no AI provider was called. The text below is the source text with the "
                "client's term base applied, bound exactly as a real delivery would be.",
                *blocks,
            ]
        usage = getattr(getattr(brain, "client", None), "usage", None)
        details = {
            "job_id": job.job_id,
            "file_name": job.file_name,
            "source_lang": job.source_lang,
            "target_lang": job.target_lang,
            "translation_type": job.translation_type,
            "brief": job.brief,
            "demo": brain.demo,
            "provider": job.provider,
            "model": job.model,
            "analysis": analysis,
            "team": {"id": team_id, "name": team["name"], "members": workers},
            "term_base": {"file": job.glossary_name, "entries": len(job.glossary or {})},
            "style_sheet": {"file": job.style_sheet_name, "provided": bool(job.style_sheet)},
            "chunks": chunk_details,
            "usage": {
                "calls": usage.calls if usage else 0,
                "input_tokens": usage.input_tokens if usage else 0,
                "output_tokens": usage.output_tokens if usage else 0,
                "total_tokens": usage.total if usage else 0,
            },
            "duration_seconds": round(time.time() - job.started_at, 1),
        }
        meta = {"source_lang": job.source_lang, "target_lang": job.target_lang, "file_name": job.file_name}
        output_path = await asyncio.to_thread(files.save_translation, blocks, job.out_dir, job.stem, job.output_format, meta)
        details_path = await asyncio.to_thread(files.save_details, details, job.out_dir, job.stem)
        send("binding_done", output_file=os.path.basename(output_path))

        translated_text = "\n\n".join(blocks)
        send(
            "completed",
            result={
                "job_id": job.job_id,
                "output_file": os.path.basename(output_path),
                "details_file": os.path.basename(details_path),
                "download_url": f"/api/download/{job.job_id}/translation",
                "details_url": f"/api/download/{job.job_id}/details",
                "translated_text": translated_text[:60000],
                "details": details,
            },
        )
    except asyncio.CancelledError:
        raise
    except Exception as exc:  # surfaced to the UI and acted out in the scene
        send("error", stage=stage, message=str(exc) or exc.__class__.__name__)
