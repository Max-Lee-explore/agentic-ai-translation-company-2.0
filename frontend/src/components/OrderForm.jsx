import { useRef, useState } from 'react';
import {
  ArrowLeftRight, BookMarked, FileText, Languages, NotebookPen, Palette, Send, Sparkles, Upload, X, FileType, Briefcase,
} from 'lucide-react';
import { DOC_ACCEPT, GLOSSARY_ACCEPT, LANGUAGES, OUTPUT_FORMATS, STYLE_ACCEPT, TRANSLATION_TYPES } from '../lib/constants';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function useDrop(onFile) {
  const [over, setOver] = useState(false);
  return {
    over,
    props: {
      onDragOver: (e) => {
        e.preventDefault();
        setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      },
    },
  };
}

function DocumentDrop({ file, onFile, disabled }) {
  const input = useRef(null);
  const drop = useDrop(onFile);
  return (
    <div
      {...drop.props}
      onClick={() => !disabled && input.current?.click()}
      className={`group relative flex h-full min-h-[64px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-2 text-center transition ${
        drop.over
          ? 'border-terracotta bg-[#fbeee6]'
          : file
            ? 'border-sage/60 bg-sage-soft/60'
            : 'border-line-strong bg-[#fbf7f0] hover:border-terracotta/60 hover:bg-white'
      } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    >
      <input ref={input} type="file" accept={DOC_ACCEPT} className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      {file ? (
        <>
          <FileText className="mb-0.5 h-5 w-5 text-sage" />
          <p className="max-w-full truncate text-[0.74rem] font-bold text-ink">{file.name}</p>
          <p className="text-[0.62rem] text-muted">{formatSize(file.size)} · click to replace</p>
        </>
      ) : (
        <>
          <div className="mb-1 grid h-7 w-7 place-items-center rounded-full bg-white shadow-sm transition group-hover:scale-105">
            <Upload className="h-3.5 w-3.5 text-ink-soft" />
          </div>
          <p className="text-[0.74rem] font-bold text-ink">Upload or drop a file</p>
          <p className="text-[0.62rem] text-muted">PDF, DOCX, PPTX, JSON, HTML, TXT, MD</p>
        </>
      )}
    </div>
  );
}

function SmallDrop({ icon: Icon, label, hint, accept, file, onFile, onClear, disabled }) {
  const input = useRef(null);
  const drop = useDrop(onFile);
  return (
    <div
      {...drop.props}
      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 transition ${
        drop.over ? 'border-terracotta bg-[#fbeee6]' : file ? 'border-sage/50 bg-sage-soft/50' : 'border-line bg-[#fbf7f0]'
      } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${file ? 'text-sage' : 'text-muted'}`} />
      <button type="button" onClick={() => input.current?.click()} className="min-w-0 flex-1 text-left">
        <p className="truncate text-[0.7rem] font-bold text-ink">{file ? file.name : label}</p>
        <p className="truncate text-[0.58rem] text-muted">{file ? 'Team checks against this' : hint}</p>
      </button>
      {file ? (
        <button type="button" onClick={onClear} className="grid h-5 w-5 place-items-center rounded-full text-muted hover:bg-white hover:text-ink" aria-label={`Remove ${label}`}>
          <X className="h-3 w-3" />
        </button>
      ) : (
        <span className="rounded bg-white px-1 py-0.5 text-[0.58rem] font-bold text-muted">Opt</span>
      )}
      <input ref={input} type="file" accept={accept} className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </div>
  );
}

export default function OrderForm({ form, setForm, onSubmit, onSample, busy, isDemo }) {
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const swap = () => set({ sourceLang: form.targetLang, targetLang: form.sourceLang });
  const canSubmit = !!form.file && !busy && form.sourceLang !== form.targetLang;

  return (
    <section className="card flex min-h-0 flex-1 flex-col px-3.5 pb-2.5 pt-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-[0.85rem] font-extrabold text-ink">
          <FileText className="h-3.5 w-3.5 text-terracotta" /> Translation Details
        </h2>
        <button
          type="button"
          onClick={onSample}
          disabled={busy}
          className="flex items-center gap-1 rounded-full border border-line bg-[#fbf7f0] px-2 py-0.5 text-[0.65rem] font-bold text-ink-soft transition hover:border-terracotta/50 hover:text-terracotta disabled:opacity-50"
        >
          <Sparkles className="h-3 w-3" /> Try a sample job
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-2.5">
        <div className="col-span-12 flex min-h-0 flex-col gap-1.5 md:col-span-4">
          <div className="min-h-0 flex-1">
            <DocumentDrop file={form.file} onFile={(f) => set({ file: f })} disabled={busy} />
          </div>
          <SmallDrop
            icon={BookMarked}
            label="Terminology list"
            hint="CSV / XLSX / JSON"
            accept={GLOSSARY_ACCEPT}
            file={form.glossaryFile}
            onFile={(f) => set({ glossaryFile: f })}
            onClear={() => set({ glossaryFile: null })}
            disabled={busy}
          />
          <SmallDrop
            icon={Palette}
            label="Style sheet"
            hint="TXT / MD / DOCX / PDF"
            accept={STYLE_ACCEPT}
            file={form.styleSheetFile}
            onFile={(f) => set({ styleSheetFile: f })}
            onClear={() => set({ styleSheetFile: null })}
            disabled={busy}
          />
        </div>

        <div className="col-span-12 flex flex-col gap-1.5 md:col-span-3">
          <div>
            <label className="label !mb-1">
              <Languages className="h-3 w-3" /> Languages
            </label>
            <div className="flex items-center gap-1">
              <select className="field !py-1.5 text-[0.75rem]" value={form.sourceLang} onChange={(e) => set({ sourceLang: e.target.value })} disabled={busy} aria-label="Source language">
                {LANGUAGES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={swap}
                disabled={busy}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line bg-white text-ink-soft transition hover:rotate-180 hover:text-terracotta"
                aria-label="Swap languages"
              >
                <ArrowLeftRight className="h-3 w-3" />
              </button>
              <select className="field !py-1.5 text-[0.75rem]" value={form.targetLang} onChange={(e) => set({ targetLang: e.target.value })} disabled={busy} aria-label="Target language">
                {LANGUAGES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
            {form.sourceLang === form.targetLang && <p className="mt-0.5 text-[0.62rem] font-bold text-terracotta">Pick two different languages.</p>}
          </div>
          <div>
            <label className="label !mb-1">
              <Briefcase className="h-3 w-3" /> Translation type
            </label>
            <select className="field !py-1.5 text-[0.75rem]" value={form.translationType} onChange={(e) => set({ translationType: e.target.value })} disabled={busy}>
              {TRANSLATION_TYPES.map(({ group, options }) =>
                group ? (
                  <optgroup key={group} label={group}>
                    {options.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </optgroup>
                ) : (
                  options.map((o) => (
                    <option key={o} value={o}>
                      Help me to decide (Manager picks)
                    </option>
                  ))
                ),
              )}
            </select>
          </div>
          <div>
            <label className="label !mb-1">
              <FileType className="h-3 w-3" /> Output format
            </label>
            <select className="field !py-1.5 text-[0.75rem]" value={form.outputFormat} onChange={(e) => set({ outputFormat: e.target.value })} disabled={busy}>
              {OUTPUT_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="col-span-12 flex min-h-0 flex-col md:col-span-5">
          <label className="label !mb-1">
            <NotebookPen className="h-3 w-3" /> Manager&apos;s brief
          </label>
          <textarea
            className="field min-h-[48px] flex-1 resize-none text-[0.75rem] leading-relaxed"
            placeholder="Audience, purpose, tone — the client will brief the Manager in person."
            value={form.brief}
            onChange={(e) => set({ brief: e.target.value })}
            disabled={busy}
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="mt-1.5 flex h-8 items-center justify-center gap-1.5 rounded-lg bg-ink text-[0.8rem] font-extrabold text-cream shadow-[0_6px_16px_-8px_rgba(59,47,42,0.8)] transition hover:bg-wood disabled:cursor-not-allowed disabled:bg-[#8f837b] disabled:shadow-none"
          >
            <Send className="h-3.5 w-3.5" />
            {busy ? 'Your team is on it…' : isDemo ? 'Start translation (Demo)' : 'Start translation'}
          </button>
        </div>
      </div>
    </section>
  );
}
