import asyncio
import json
import os
import re
import shutil
import time
import uuid
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from app import files
from app.brains import DemoBrain, RealBrain
from app.llm import SUPPORTED_PROVIDERS, LLMClient
from app.pipeline import Job, run_job

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JOBS_DIR = os.path.join(BASE_DIR, "jobs")
FRONTEND_DIST = os.path.join(BASE_DIR, "..", "frontend", "dist")
JOB_TTL_SECONDS = 24 * 3600
os.makedirs(JOBS_DIR, exist_ok=True)

app = FastAPI(title="Agentic AI Translation Company 2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


def _cleanup_old_jobs():
    now = time.time()
    for name in os.listdir(JOBS_DIR):
        path = os.path.join(JOBS_DIR, name)
        if os.path.isdir(path) and now - os.path.getmtime(path) > JOB_TTL_SECONDS:
            shutil.rmtree(path, ignore_errors=True)


def _safe_name(name: Optional[str], fallback: str) -> str:
    base = os.path.basename(name or "") or fallback
    base = re.sub(r"[^\w.\- ()\u00C0-\uFFFF]", "_", base).strip() or fallback
    return base[:120]


async def _save_upload(upload: UploadFile, out_dir: str, prefix: str) -> str:
    path = os.path.join(out_dir, f"{prefix}{_safe_name(upload.filename, 'upload')}")
    with open(path, "wb") as buffer:
        await asyncio.to_thread(shutil.copyfileobj, upload.file, buffer)
    return path


@app.get("/api/health")
async def health():
    return {"ok": True, "providers": sorted(SUPPORTED_PROVIDERS)}


@app.post("/api/translate")
async def translate(
    file: UploadFile = File(...),
    glossary_file: Optional[UploadFile] = File(None),
    style_sheet_file: Optional[UploadFile] = File(None),
    source_lang: str = Form(...),
    target_lang: str = Form(...),
    translation_type: str = Form("Help me to decide"),
    brief: str = Form(""),
    output_format: str = Form("docx"),
    provider: str = Form("openrouter"),
    model: str = Form(""),
    api_key: str = Form(""),
    chunk_size: int = Form(2000),
    temperatures: str = Form(""),
    prompt_overrides: str = Form(""),
):
    _cleanup_old_jobs()
    job_id = uuid.uuid4().hex
    out_dir = os.path.join(JOBS_DIR, job_id)
    os.makedirs(out_dir, exist_ok=True)

    try:
        file_path = await _save_upload(file, out_dir, "source_")
        files.validate(file_path, files.DOCUMENT_EXTENSIONS, "Document")

        glossary = glossary_name = None
        if glossary_file is not None and glossary_file.filename:
            glossary_path = await _save_upload(glossary_file, out_dir, "termbase_")
            files.validate(glossary_path, files.GLOSSARY_EXTENSIONS, "Terminology list")
            glossary = await asyncio.to_thread(files.parse_glossary, glossary_path)
            glossary_name = glossary_file.filename

        style_sheet = style_sheet_name = None
        if style_sheet_file is not None and style_sheet_file.filename:
            style_path = await _save_upload(style_sheet_file, out_dir, "stylesheet_")
            files.validate(style_path, files.STYLE_SHEET_EXTENSIONS, "Style sheet")
            style_sheet = (await asyncio.to_thread(files.extract_text, style_path)).strip() or None
            style_sheet_name = style_sheet_file.filename
    except files.FileError as exc:
        shutil.rmtree(out_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        shutil.rmtree(out_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"Could not read the uploaded files: {exc}")

    temp_map = {}
    if temperatures:
        try:
            temp_map = {k: float(v) for k, v in json.loads(temperatures).items()}
        except (ValueError, AttributeError, TypeError, json.JSONDecodeError):
            temp_map = {}

    override_map = {}
    if prompt_overrides:
        try:
            raw = json.loads(prompt_overrides)
            if isinstance(raw, dict):
                override_map = {str(k): str(v) for k, v in raw.items() if isinstance(v, str) and v.strip()}
        except (ValueError, TypeError, json.JSONDecodeError):
            override_map = {}

    client = None
    if api_key.strip():
        provider = provider.lower().strip()
        if provider not in SUPPORTED_PROVIDERS:
            raise HTTPException(status_code=400, detail=f"Unsupported provider '{provider}'.")
        if not model.strip():
            raise HTTPException(status_code=400, detail="Please choose a model in the settings menu.")
        client = LLMClient(provider=provider, api_key=api_key.strip(), model=model.strip())
        brain = RealBrain(client, temp_map, prompt_overrides=override_map)
    else:
        brain = DemoBrain()
        provider, model = "demo", "demo"

    job = Job(
        job_id=job_id,
        out_dir=out_dir,
        file_path=file_path,
        file_name=_safe_name(file.filename, "document.txt"),
        source_lang=source_lang,
        target_lang=target_lang,
        translation_type=translation_type,
        brief=brief,
        output_format=output_format,
        chunk_size=max(300, min(int(chunk_size or 2000), 12000)),
        provider=provider,
        model=model,
        glossary=glossary,
        glossary_name=glossary_name,
        style_sheet=style_sheet,
        style_sheet_name=style_sheet_name,
    )

    async def stream():
        queue: asyncio.Queue = asyncio.Queue()
        task = asyncio.create_task(run_job(job, brain, queue.put_nowait))
        try:
            while True:
                event = await queue.get()
                if event["type"] == "completed":
                    with open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8") as f:
                        json.dump(
                            {"translation": event["result"]["output_file"], "details": event["result"]["details_file"]},
                            f,
                        )
                yield json.dumps(event, ensure_ascii=False) + "\n"
                if event["type"] in ("completed", "error"):
                    break
        finally:
            if not task.done():
                task.cancel()
            if client is not None:
                await client.aclose()

    return StreamingResponse(stream(), media_type="application/x-ndjson")


@app.get("/api/download/{job_id}/{kind}")
async def download(job_id: str, kind: str):
    if not re.fullmatch(r"[0-9a-f]{32}", job_id) or kind not in ("translation", "details"):
        raise HTTPException(status_code=404, detail="Not found")
    manifest_path = os.path.join(JOBS_DIR, job_id, "manifest.json")
    if not os.path.exists(manifest_path):
        raise HTTPException(status_code=404, detail="This delivery has expired or does not exist.")
    with open(manifest_path, encoding="utf-8") as f:
        filename = json.load(f)[kind]
    path = os.path.join(JOBS_DIR, job_id, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, filename=filename)


if os.path.isdir(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
