import { useCallback, useEffect, useRef, useState } from 'react';
import Header from './components/Header';
import OrderForm from './components/OrderForm';
import StatusStrip from './components/StatusStrip';
import SettingsDrawer from './components/SettingsDrawer';
import DetailsModal from './components/DetailsModal';
import OfficeScene from './scene/OfficeScene';
import { MODELS, PROVIDERS } from './lib/constants';
import { DEFAULT_AGENT_PROMPTS, mergePrompts } from './lib/prompts';
import { loadSampleFiles, streamTranslation } from './lib/api';

const PREFS_KEY = 'atc2-prefs';
const DELIVERY_FALLBACK_MS = 30000;

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
  } catch {
    return {};
  }
}

const IDLE_JOB = {
  phase: 'idle',
  activity: 'The office is open. Upload a document to place an order.',
  activeStep: null,
  doneSteps: new Set(),
  skipped: new Set(),
  completed: 0,
  total: 0,
  team: null,
  analysis: null,
  result: null,
  error: null,
};

const TEAM_MEMBER_LABEL = (worker) => {
  if (worker === 'master') return 'The Master Translator';
  const n = worker.split('-')[1];
  return `Translator #${n}`;
};

export default function App() {
  const prefs = loadPrefs();
  const [settings, setSettings] = useState({
    provider: prefs.provider || 'openrouter',
    model: prefs.model || MODELS.openrouter[0],
    customModel: prefs.customModel || '',
    apiKey: '',
    chunkSize: prefs.chunkSize || 1200,
    advanced: prefs.advanced || false,
    temperatures: prefs.temperatures || {},
    prompts: mergePrompts(prefs.prompts),
  });
  const [soundOn, setSoundOn] = useState(prefs.soundOn ?? false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [officeFullscreen, setOfficeFullscreen] = useState(false);
  const [form, setForm] = useState({
    file: null,
    glossaryFile: null,
    styleSheetFile: null,
    sourceLang: 'English',
    targetLang: 'Spanish',
    translationType: 'Help me to decide',
    outputFormat: 'docx',
    brief: '',
  });
  const [job, setJob] = useState(IDLE_JOB);
  const sceneRef = useRef(null);
  const abortRef = useRef(null);
  const liveRef = useRef(null);
  const fallbackRef = useRef(null);

  useEffect(() => {
    const { apiKey: _omit, ...persist } = settings;
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...persist, soundOn }));
  }, [settings, soundOn]);

  useEffect(() => {
    sceneRef.current?.setMuted(!soundOn);
  }, [soundOn]);

  const isDemo = !settings.apiKey;
  const model = settings.model === 'custom' ? settings.customModel : settings.model;
  const providerLabel = PROVIDERS.find((p) => p.id === settings.provider)?.label ?? settings.provider;
  const busy = job.phase === 'running' || job.phase === 'delivering';

  const markDelivered = useCallback(() => {
    clearTimeout(fallbackRef.current);
    setJob((prev) => {
      if (prev.phase !== 'delivering') return prev;
      const d = prev.result?.details;
      return {
        ...prev,
        phase: 'done',
        activeStep: null,
        doneSteps: new Set(['brief', 'chunk', 'analyse', 'translate', 'edit', 'terms', 'bind', 'deliver'].filter((s) => !prev.skipped.has(s))),
        completed: prev.total,
        activity: `Delivered! ${prev.total} chunk${prev.total === 1 ? '' : 's'} translated into ${d?.target_lang ?? 'the target language'} in ${d?.duration_seconds ?? '?'}s. Your file is ready.`,
      };
    });
  }, []);

  const applyEvent = useCallback((ev) => {
    const live = liveRef.current ?? { translating: new Map(), translated: 0, edited: 0, termed: 0, editing: null, terms: null, total: 0 };
    switch (ev.type) {
      case 'chunking_done':
        live.total = ev.chunks;
        break;
      case 'translate_started':
        live.translating.set(ev.worker, { worker: ev.worker, chunk: ev.chunk, redo: !!ev.redo });
        break;
      case 'translate_done':
        live.translating.delete(ev.worker);
        if (!ev.redo) live.translated += 1;
        break;
      case 'revision_requested':
        live.editing = null;
        break;
      case 'review_started':
      case 'improve_started':
        live.editing = ev.chunk;
        live.editingStage = ev.type === 'review_started' ? 'reviewing' : 'revising';
        break;
      case 'improve_done':
        live.editing = null;
        live.edited += 1;
        break;
      case 'terms_started':
        live.terms = ev.chunk;
        break;
      case 'terms_done':
        live.terms = null;
        live.termed += 1;
        break;
      default:
        break;
    }
    const parts = [];
    if (live.translating.size === 1) {
      const [{ worker, chunk, redo }] = live.translating.values();
      parts.push(`${TEAM_MEMBER_LABEL(worker)} is ${redo ? 'redoing' : 'translating'} chunk ${chunk + 1}`);
    } else if (live.translating.size > 1) {
      parts.push(`${live.translating.size} translators working in parallel`);
    }
    if (live.editing != null) parts.push(`Editor ${live.editingStage} chunk ${live.editing + 1}`);
    if (live.terms != null) parts.push(`Terminologist checking chunk ${live.terms + 1}`);
    const summaryText = parts.join(' · ') || 'Passing pages between desks…';
    const allTranslated = live.total > 0 && live.translated >= live.total;
    const allEdited = live.total > 0 && live.edited >= live.total;
    const allTermed = live.total > 0 && live.termed >= live.total;

    setJob((prev) => {
      const next = { ...prev, doneSteps: new Set(prev.doneSteps), skipped: new Set(prev.skipped) };
      const summary = () => summaryText;
      switch (ev.type) {
        case 'job_received':
          next.activity = 'The client is briefing the Manager';
          if (!ev.has_glossary) next.skipped.add('terms');
          break;
        case 'chunking_started':
          next.doneSteps.add('brief');
          next.activeStep = 'chunk';
          next.activity = 'The Chunk-o-matic is slicing the document';
          break;
        case 'chunking_done':
          next.total = ev.chunks;
          next.doneSteps.add('chunk');
          next.activity = `Split into ${ev.chunks} chunk${ev.chunks === 1 ? '' : 's'} (${ev.characters.toLocaleString()} characters)`;
          break;
        case 'analysis_started':
          next.activeStep = 'analyse';
          next.activity = 'The Manager is analysing the brief and the text';
          break;
        case 'analysis_done':
          next.doneSteps.add('analyse');
          next.activeStep = 'translate';
          next.team = { team_id: ev.team_id, team_name: ev.team_name, domain_label: ev.domain_label };
          next.analysis = ev;
          next.activity =
            ev.team_id === 'master' ? 'Assigned to the Master Translator' : `Assigned to the ${ev.team_name} team (${ev.domain_label})`;
          break;
        case 'translate_started':
          next.activity = summary();
          break;
        case 'translate_done':
          if (allTranslated) {
            next.doneSteps.add('translate');
            next.activeStep = 'edit';
          }
          next.activity = summary();
          break;
        case 'review_started':
        case 'improve_started':
          if (allTranslated) next.activeStep = 'edit';
          next.activity = summary();
          break;
        case 'revision_requested':
          next.activity = `The Editor sent chunk ${ev.chunk + 1} back to the translator for a redo`;
          break;
        case 'improve_done':
          if (allEdited) {
            next.doneSteps.add('edit');
            if (!prev.skipped.has('terms')) next.activeStep = 'terms';
          }
          next.activity = summary();
          break;
        case 'terms_started':
          if (allEdited) next.activeStep = 'terms';
          next.activity = summary();
          break;
        case 'terms_done':
          if (allTermed) next.doneSteps.add('terms');
          next.activity = summary();
          break;
        case 'chunk_completed':
          next.completed = ev.completed;
          break;
        case 'binding_started':
          ['translate', 'edit'].forEach((s) => next.doneSteps.add(s));
          if (!prev.skipped.has('terms')) next.doneSteps.add('terms');
          next.activeStep = 'bind';
          next.activity = 'The binding machine is assembling your document';
          break;
        case 'binding_done':
          next.doneSteps.add('bind');
          break;
        case 'completed':
          next.phase = 'delivering';
          next.activeStep = 'deliver';
          next.doneSteps.add('bind');
          next.result = ev.result;
          next.completed = prev.total;
          next.activity = 'The Receptionist is carrying the package to the client…';
          break;
        case 'error':
          next.phase = 'error';
          next.error = ev.message;
          break;
        default:
          break;
      }
      return next;
    });
  }, []);

  const handleSubmit = async () => {
    if (!form.file || busy) return;
    clearTimeout(fallbackRef.current);
    liveRef.current = { translating: new Map(), translated: 0, edited: 0, termed: 0, editing: null, editingStage: '', terms: null };
    setJob({ ...IDLE_JOB, doneSteps: new Set(), skipped: new Set(), phase: 'running', activeStep: 'brief', activity: 'A client is walking into the office…' });

    sceneRef.current?.dispatch({
      type: 'client_arrives',
      brief: form.brief,
      file_name: form.file.name,
      source_lang: form.sourceLang,
      target_lang: form.targetLang,
      translation_type: form.translationType,
    });

    const data = new FormData();
    data.append('file', form.file);
    if (form.glossaryFile) data.append('glossary_file', form.glossaryFile);
    if (form.styleSheetFile) data.append('style_sheet_file', form.styleSheetFile);
    data.append('source_lang', form.sourceLang);
    data.append('target_lang', form.targetLang);
    data.append('translation_type', form.translationType);
    data.append('brief', form.brief);
    data.append('output_format', form.outputFormat);
    data.append('provider', settings.provider);
    data.append('model', model || '');
    data.append('api_key', settings.apiKey);
    data.append('chunk_size', String(settings.chunkSize));
    if (settings.advanced) data.append('temperatures', JSON.stringify(settings.temperatures));
    const promptPayload = {};
    for (const [k, v] of Object.entries(settings.prompts || {})) {
      if (typeof v === 'string' && v.trim() && v.trim() !== DEFAULT_AGENT_PROMPTS[k]) promptPayload[k] = v.trim();
    }
    if (Object.keys(promptPayload).length) data.append('prompt_overrides', JSON.stringify(promptPayload));

    const controller = new AbortController();
    abortRef.current = controller;
    let finished = false;
    try {
      await streamTranslation(data, {
        signal: controller.signal,
        onEvent: (ev) => {
          if (ev.type === 'completed' || ev.type === 'error') finished = true;
          applyEvent(ev);
          sceneRef.current?.dispatch(ev);
          if (ev.type === 'completed') {
            fallbackRef.current = setTimeout(markDelivered, DELIVERY_FALLBACK_MS);
          }
        },
      });
      if (!finished) throw new Error('The connection closed before the job finished.');
    } catch (err) {
      if (err.name === 'AbortError') return;
      const ev = { type: 'error', message: err.message || 'Something went wrong.' };
      applyEvent(ev);
      sceneRef.current?.dispatch(ev);
    }
  };

  const handleSample = async () => {
    try {
      const files = await loadSampleFiles();
      setForm((prev) => ({
        ...prev,
        ...files,
        sourceLang: 'English',
        targetLang: 'Spanish',
        translationType: 'Help me to decide',
        outputFormat: 'docx',
        brief:
          'A short literary story for our winter anthology. Keep the gentle, melancholic tone and the rhythm of the prose. Readers are adults in Spain.',
      }));
    } catch {
      /* samples are optional */
    }
  };

  const handleDownload = () => {
    if (!job.result) return;
    const a = document.createElement('a');
    a.href = job.result.download_url;
    a.download = job.result.output_file;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleReset = () => {
    abortRef.current?.abort();
    clearTimeout(fallbackRef.current);
    setJob(IDLE_JOB);
    sceneRef.current?.dispatch({ type: 'reset' });
  };

  useEffect(() => {
    if (!officeFullscreen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOfficeFullscreen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [officeFullscreen]);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-cream">
      {!officeFullscreen && (
        <div className="mx-auto flex w-full max-w-[1480px] shrink-0 flex-col gap-1.5 px-4 pb-1.5 pt-2" style={{ height: 'clamp(280px, 38vh, 400px)' }}>
          <Header
            isDemo={isDemo}
            providerLabel={providerLabel}
            model={model}
            soundOn={soundOn}
            onToggleSound={() => setSoundOn((v) => !v)}
            onOpenMenu={() => setMenuOpen(true)}
          />
          <OrderForm form={form} setForm={setForm} onSubmit={handleSubmit} onSample={handleSample} busy={busy} isDemo={isDemo} />
          <StatusStrip job={job} onDetails={() => setDetailsOpen(true)} onDownload={handleDownload} onReset={handleReset} />
        </div>
      )}

      <div className={`relative min-h-0 ${officeFullscreen ? 'h-full flex-1' : 'flex-1'}`}>
        <OfficeScene
          ref={sceneRef}
          onDelivered={markDelivered}
          muted={!soundOn}
          rich={officeFullscreen}
          fullscreen={officeFullscreen}
          onToggleFullscreen={() => setOfficeFullscreen((v) => !v)}
        />
      </div>

      {officeFullscreen && (
        <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-line/30 bg-night/75 px-3 py-1.5 text-[0.7rem] font-bold text-cream backdrop-blur-sm">
          <span className="max-w-[50vw] truncate">{job.activity}</span>
          {(job.phase === 'done' || job.phase === 'error') && (
            <button type="button" onClick={handleDownload} disabled={job.phase !== 'done'} className="rounded-full bg-terracotta px-2.5 py-0.5 text-white disabled:opacity-40">
              Download
            </button>
          )}
        </div>
      )}

      <SettingsDrawer open={menuOpen} onClose={() => setMenuOpen(false)} settings={settings} setSettings={setSettings} />
      <DetailsModal open={detailsOpen} onClose={() => setDetailsOpen(false)} result={job.result} analysis={job.analysis} onDownload={handleDownload} />
    </div>
  );
}
