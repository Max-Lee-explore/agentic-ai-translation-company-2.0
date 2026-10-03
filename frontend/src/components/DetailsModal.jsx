import { useEffect, useState } from 'react';
import { ChevronDown, Download, FileJson, X } from 'lucide-react';

const TABS = [
  { id: 'translation', label: 'Translation' },
  { id: 'manager', label: "Manager's notes" },
  { id: 'chunks', label: 'Chunk journey' },
  { id: 'job', label: 'Job info' },
];

const AGENT_NAMES = {
  editor: 'Editor',
  terminologist: 'Terminologist',
  master: 'Master Translator',
};

function agentName(id) {
  if (AGENT_NAMES[id]) return AGENT_NAMES[id];
  const [team, n] = String(id).split('-');
  const teams = { creative: 'Creative Studio', legal: 'Legal & Business', science: 'Science & Medical', news: 'News & Media' };
  return teams[team] ? `${teams[team]} translator #${n}` : id;
}

function List({ items }) {
  return (
    <ul className="space-y-1">
      {(items || []).map((item, i) => (
        <li key={i} className="flex gap-2 text-[0.82rem] leading-relaxed text-ink">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-honey" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function ChunkCard({ chunk }) {
  const [open, setOpen] = useState(chunk.index === 0);
  return (
    <div className="rounded-xl border border-line bg-white">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-2.5 text-left">
        <span className="text-[0.82rem] font-extrabold text-ink">
          Chunk {chunk.index + 1}
          <span className="ml-2 font-bold text-muted">
            {chunk.original.length} chars · {chunk.translator ? agentName(chunk.translator) : '—'}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 text-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-line px-4 py-3">
          <div>
            <p className="mb-1 text-[0.68rem] font-extrabold uppercase tracking-wide text-muted">Source</p>
            <p className="whitespace-pre-wrap text-[0.8rem] leading-relaxed text-ink-soft">{chunk.original}</p>
          </div>
          {chunk.steps.map((step, i) => (
            <div key={i}>
              <p className="mb-1 text-[0.68rem] font-extrabold uppercase tracking-wide text-terracotta">
                {step.step} · {agentName(step.agent)}
              </p>
              <p className="whitespace-pre-wrap text-[0.8rem] leading-relaxed text-ink">{step.result}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DetailsModal({ open, onClose, result, analysis, onDownload }) {
  const [tab, setTab] = useState('translation');
  const details = result?.details;
  const notes = details?.analysis || analysis;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open && !result) setTab('manager');
  }, [open, result]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6">
      <div className="absolute inset-0 bg-night/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="pop-in relative flex max-h-[86vh] w-[min(920px,100%)] flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="flex items-center gap-1 rounded-xl bg-cream p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                disabled={!result && t.id !== 'manager'}
                className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition disabled:opacity-40 ${
                  tab === t.id ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {result && (
              <>
                <a
                  href={result.details_url}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink-soft hover:text-ink"
                >
                  <FileJson className="h-3.5 w-3.5" /> Details JSON
                </a>
                <button type="button" onClick={onDownload} className="flex h-8 items-center gap-1.5 rounded-lg bg-terracotta px-3 text-xs font-extrabold text-white hover:bg-terracotta-dark">
                  <Download className="h-3.5 w-3.5" /> Download
                </button>
              </>
            )}
            <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-cream" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-5">
          {tab === 'translation' && result && (
            <article className="whitespace-pre-wrap text-[0.9rem] leading-[1.75] text-ink">{result.translated_text}</article>
          )}

          {tab === 'manager' && notes && (
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-4 md:col-span-2">
                <div className="rounded-xl border border-honey/50 bg-honey-soft p-4">
                  <p className="text-[0.68rem] font-extrabold uppercase tracking-wide text-[#8a5a12]">Decision</p>
                  <p className="mt-1 text-[0.9rem] font-bold text-ink">
                    {notes.detected_style} → {notes.team_name || details?.team?.name}
                    {notes.domain_label ? ` (${notes.domain_label})` : ''}
                  </p>
                  <p className="mt-2 text-[0.84rem] leading-relaxed text-ink-soft">{notes.reasoning}</p>
                </div>
              </div>
              <div>
                <p className="mb-2 text-[0.72rem] font-extrabold uppercase tracking-wide text-muted">Style guidelines</p>
                <List items={notes.style_guidelines} />
              </div>
              <div>
                <p className="mb-2 text-[0.72rem] font-extrabold uppercase tracking-wide text-muted">Quality requirements</p>
                <List items={notes.quality_requirements} />
              </div>
            </div>
          )}

          {tab === 'chunks' && details && (
            <div className="space-y-2.5">
              {details.chunks.map((c) => (
                <ChunkCard key={c.index} chunk={c} />
              ))}
            </div>
          )}

          {tab === 'job' && details && (
            <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-[0.84rem] md:grid-cols-3">
              {[
                ['File', details.file_name],
                ['Languages', `${details.source_lang} → ${details.target_lang}`],
                ['Requested type', details.translation_type],
                ['Team', details.team?.name],
                ['Mode', details.demo ? 'Demo (simulated)' : `${details.provider} · ${details.model}`],
                ['Chunks', details.chunks.length],
                ['Term base', details.term_base?.file ? `${details.term_base.file} (${details.term_base.entries} entries)` : '—'],
                ['Style sheet', details.style_sheet?.file || '—'],
                ['Duration', `${details.duration_seconds}s`],
                ['AI calls', details.usage?.calls ?? 0],
                ['Tokens', (details.usage?.total_tokens ?? 0).toLocaleString()],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[0.68rem] font-extrabold uppercase tracking-wide text-muted">{k}</dt>
                  <dd className="mt-0.5 font-bold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
