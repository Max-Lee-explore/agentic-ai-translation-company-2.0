import { useEffect, useState } from 'react';
import {
  Eye, EyeOff, ExternalLink, KeyRound, Cpu, Server, SlidersHorizontal, Scissors, X, Sparkles, MessageSquareText, RotateCcw,
} from 'lucide-react';
import { DOMAIN_TEMPERATURES, MODELS, PROVIDERS } from '../lib/constants';
import { DEFAULT_AGENT_PROMPTS, PROMPT_FIELDS, mergePrompts } from '../lib/prompts';

export default function SettingsDrawer({ open, onClose, settings, setSettings }) {
  const [showKey, setShowKey] = useState(false);
  const [promptTab, setPromptTab] = useState('manager');
  const provider = PROVIDERS.find((p) => p.id === settings.provider) ?? PROVIDERS[0];
  const models = MODELS[settings.provider] ?? [];
  const prompts = mergePrompts(settings.prompts);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const update = (patch) => setSettings((prev) => ({ ...prev, ...patch }));
  const setProvider = (id) => update({ provider: id, model: MODELS[id]?.[0] ?? 'custom', customModel: '' });
  const setTemp = (domain, value) => update({ temperatures: { ...settings.temperatures, [domain]: value } });
  const setPrompt = (id, value) => update({ prompts: { ...settings.prompts, [id]: value } });
  const resetPrompt = (id) => setPrompt(id, DEFAULT_AGENT_PROMPTS[id]);
  const resetAllPrompts = () => update({ prompts: { ...DEFAULT_AGENT_PROMPTS } });

  const activeField = PROMPT_FIELDS.find((f) => f.id === promptTab) || PROMPT_FIELDS[0];
  const isCustom = (prompts[activeField.id] || '') !== DEFAULT_AGENT_PROMPTS[activeField.id];

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-night/40 transition-opacity duration-200 ${open ? 'opacity-100 backdrop-blur-[2px]' : 'invisible opacity-0'}`}
        onClick={onClose}
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-[min(460px,94vw)] flex-col border-l border-line bg-paper shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-label="Settings"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-extrabold text-ink">Studio settings</h2>
            <p className="text-xs text-muted">AI provider, prompts and fine-tuning</p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-cream" aria-label="Close settings">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div
            className={`flex gap-3 rounded-xl border p-3 text-xs leading-relaxed ${
              settings.apiKey ? 'border-sage/40 bg-sage-soft text-[#3f6b47]' : 'border-honey/50 bg-honey-soft text-[#7a5210]'
            }`}
          >
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
            {settings.apiKey ? (
              <span>
                <b>Live mode.</b> Your team will call <b>{provider.label}</b> for every step. The key only lives in this
                browser tab and is sent straight to your local backend.
              </span>
            ) : (
              <span>
                <b>Demo mode.</b> With no API key, the office still animates on your real file, but language work is
                simulated. Add a key to translate for real.
              </span>
            )}
          </div>

          <section className="space-y-3">
            <div>
              <label className="label">
                <Server className="h-3.5 w-3.5" /> AI provider
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProvider(p.id)}
                    className={`rounded-lg border px-2 py-1.5 text-xs font-bold transition ${
                      settings.provider === p.id
                        ? 'border-terracotta bg-terracotta text-white shadow-sm'
                        : 'border-line bg-[#fbf7f0] text-ink-soft hover:border-line-strong hover:text-ink'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">
                <Cpu className="h-3.5 w-3.5" /> Model
              </label>
              <select className="field" value={settings.model} onChange={(e) => update({ model: e.target.value })}>
                {models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
                <option value="custom">Custom model ID…</option>
              </select>
              {settings.model === 'custom' && (
                <input
                  className="field mt-2"
                  placeholder="e.g. meta-llama/llama-5-70b"
                  value={settings.customModel}
                  onChange={(e) => update({ customModel: e.target.value })}
                />
              )}
            </div>

            <div>
              <label className="label">
                <KeyRound className="h-3.5 w-3.5" /> API key
              </label>
              <div className="relative">
                <input
                  className="field pr-9"
                  type={showKey ? 'text' : 'password'}
                  placeholder={`Paste your ${provider.label} key (leave empty for Demo)`}
                  value={settings.apiKey}
                  onChange={(e) => update({ apiKey: e.target.value.trim() })}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                  aria-label={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[0.7rem] text-muted">
                <span>Kept in memory only, never saved.</span>
                <a href={provider.keyUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-bold text-terracotta hover:underline">
                  Get a key <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </section>

          <section className="space-y-2 border-t border-line pt-4">
            <label className="label">
              <Scissors className="h-3.5 w-3.5" /> Chunk size{' '}
              <span className="ml-auto font-semibold tabular-nums text-ink">{settings.chunkSize} chars</span>
            </label>
            <input
              type="range"
              min={400}
              max={6000}
              step={100}
              value={settings.chunkSize}
              onChange={(e) => update({ chunkSize: Number(e.target.value) })}
              className="w-full accent-terracotta"
            />
          </section>

          <section className="space-y-3 border-t border-line pt-4">
            <div className="flex items-center justify-between gap-2">
              <label className="label !mb-0">
                <MessageSquareText className="h-3.5 w-3.5" /> Agent system prompts
              </label>
              <button
                type="button"
                onClick={resetAllPrompts}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.65rem] font-bold text-muted hover:bg-cream hover:text-ink"
              >
                <RotateCcw className="h-3 w-3" /> Reset all
              </button>
            </div>
            <p className="text-[0.7rem] leading-relaxed text-muted">
              Edit each role&apos;s identity prompt. Saved in this browser; sent with Live jobs. The naturalness
              standard and language-pair notes are always added on top.
            </p>
            <div className="flex flex-wrap gap-1">
              {PROMPT_FIELDS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPromptTab(f.id)}
                  className={`rounded-full border px-2 py-0.5 text-[0.62rem] font-bold transition ${
                    promptTab === f.id
                      ? 'border-terracotta bg-terracotta text-white'
                      : prompts[f.id] !== DEFAULT_AGENT_PROMPTS[f.id]
                        ? 'border-honey/70 bg-honey-soft text-[#8a5a12]'
                        : 'border-line bg-[#fbf7f0] text-ink-soft hover:text-ink'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-line bg-[#fbf7f0] p-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[0.72rem] font-extrabold text-ink">{activeField.label}</span>
                {isCustom && (
                  <button type="button" onClick={() => resetPrompt(activeField.id)} className="text-[0.62rem] font-bold text-terracotta hover:underline">
                    Restore default
                  </button>
                )}
              </div>
              <textarea
                className="field min-h-[110px] resize-y text-[0.75rem] leading-relaxed"
                value={prompts[activeField.id] || ''}
                onChange={(e) => setPrompt(activeField.id, e.target.value)}
                spellCheck={false}
              />
            </div>
          </section>

          <section className="space-y-3 border-t border-line pt-4">
            <div className="flex items-center justify-between">
              <label className="label !mb-0">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Advanced: per-specialist temperature
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={settings.advanced}
                onClick={() => update({ advanced: !settings.advanced })}
                className={`relative h-5 w-9 rounded-full transition ${settings.advanced ? 'bg-terracotta' : 'bg-line-strong'}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${settings.advanced ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
            </div>
            {settings.advanced && (
              <div className="grid grid-cols-1 gap-2.5 rounded-xl border border-line bg-[#fbf7f0] p-3">
                {Object.entries(DOMAIN_TEMPERATURES).map(([domain, { label, value }]) => {
                  const current = settings.temperatures[domain] ?? value;
                  return (
                    <div key={domain} className="grid grid-cols-[88px_1fr_36px] items-center gap-2 text-xs">
                      <span className="font-bold text-ink-soft">{label}</span>
                      <input
                        type="range"
                        min={0}
                        max={1.2}
                        step={0.05}
                        value={current}
                        onChange={(e) => setTemp(domain, Number(e.target.value))}
                        className="accent-sage"
                      />
                      <span className="text-right font-semibold tabular-nums text-ink">{current.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="border-t border-line px-5 py-3 text-[0.7rem] text-muted">
          Agentic AI Translation Company 2.0 · created by Max Lee
        </div>
      </aside>
    </div>
  );
}
