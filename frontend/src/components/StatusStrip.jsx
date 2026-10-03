import { AlertTriangle, Check, Download, FileSearch, Loader2, Users, RotateCcw } from 'lucide-react';
import { PIPELINE_STEPS } from '../lib/constants';

function Stepper({ activeStep, doneSteps, skipped, failed }) {
  return (
    <ol className="flex items-center gap-1">
      {PIPELINE_STEPS.map((step, i) => {
        const done = doneSteps.has(step.id);
        const active = activeStep === step.id;
        const skip = skipped.has(step.id);
        return (
          <li key={step.id} className="flex items-center gap-1">
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.66rem] font-bold transition ${
                failed && active
                  ? 'bg-terracotta text-white'
                  : active
                    ? 'bg-ink text-cream'
                    : done
                      ? 'bg-sage-soft text-[#3f6b47]'
                      : skip
                        ? 'text-line-strong line-through'
                        : 'text-muted'
              }`}
            >
              {done && !active ? <Check className="h-3 w-3" /> : active && !failed ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              {step.label}
            </span>
            {i < PIPELINE_STEPS.length - 1 && <span className={`h-px w-2 ${done ? 'bg-sage/60' : 'bg-line-strong'}`} />}
          </li>
        );
      })}
    </ol>
  );
}

export default function StatusStrip({ job, onDetails, onDownload, onReset }) {
  const { phase, activity, completed, total, team, activeStep, doneSteps, skipped, error } = job;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const idle = phase === 'idle';

  return (
    <section className="card flex h-[44px] shrink-0 items-center gap-3 px-3">
      <div className="hidden min-w-0 xl:block">
        <Stepper activeStep={activeStep} doneSteps={doneSteps} skipped={skipped} failed={phase === 'error'} />
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        {phase === 'error' ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-terracotta" />
        ) : phase === 'done' ? (
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sage text-white">
            <Check className="h-3 w-3" />
          </span>
        ) : idle ? (
          <span className="h-2 w-2 shrink-0 rounded-full bg-line-strong" />
        ) : (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-terracotta" />
        )}
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[0.8rem] font-bold ${phase === 'error' ? 'text-terracotta' : 'text-ink'}`} title={error || activity}>
            {phase === 'error' ? error : activity}
          </p>
          {!idle && phase !== 'error' && (
            <div className="mt-1 h-1.5 w-full max-w-[340px] overflow-hidden rounded-full bg-line">
              <div
                className={`h-full rounded-full bg-gradient-to-r from-honey to-terracotta transition-all duration-500 ${phase === 'running' ? 'progress-shimmer' : ''}`}
                style={{ width: `${phase === 'done' ? 100 : Math.max(4, pct)}%` }}
              />
            </div>
          )}
        </div>
        {total > 0 && !idle && (
          <span className="shrink-0 text-[0.78rem] font-semibold tabular-nums text-ink-soft">
            {completed}/{total} chunks
          </span>
        )}
        {team && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-honey/60 bg-honey-soft px-2.5 py-1 text-[0.7rem] font-extrabold text-[#8a5a12]">
            <Users className="h-3.5 w-3.5" />
            {team.team_id === 'master' ? 'Master Translator' : `${team.team_name} team`}
            {team.team_id !== 'master' && <span className="font-bold text-[#b07a2a]">· {team.domain_label}</span>}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {(phase === 'done' || phase === 'error') && (
          <button type="button" onClick={onReset} className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft transition hover:bg-cream hover:text-ink" title="Start a new order">
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onDetails}
          disabled={!job.result && !job.analysis}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-bold text-ink-soft transition hover:text-ink disabled:opacity-40"
        >
          <FileSearch className="h-3.5 w-3.5" /> Details
        </button>
        <button
          type="button"
          onClick={onDownload}
          disabled={phase !== 'done'}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-terracotta px-3.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-terracotta-dark disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-white/90"
        >
          <Download className="h-3.5 w-3.5" /> Download
        </button>
      </div>
    </section>
  );
}
