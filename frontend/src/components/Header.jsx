import { Menu, Volume2, VolumeX } from 'lucide-react';

function PixelLogo() {
  return (
    <svg viewBox="0 0 16 16" className="h-7 w-7 pixelated" shapeRendering="crispEdges" aria-hidden>
      <rect x="1" y="4" width="14" height="11" fill="#6b4a33" />
      <rect x="0" y="3" width="16" height="2" fill="#c8643b" />
      <rect x="2" y="1" width="12" height="2" fill="#a94f2c" />
      <rect x="3" y="6" width="4" height="3" fill="#bfe3f2" />
      <rect x="9" y="6" width="4" height="3" fill="#bfe3f2" />
      <rect x="6" y="10" width="4" height="5" fill="#e7b45a" />
      <rect x="9" y="12" width="1" height="1" fill="#6b4a33" />
      <rect x="3" y="10" width="2" height="2" fill="#6e9a74" />
      <rect x="11" y="10" width="2" height="2" fill="#6e9a74" />
    </svg>
  );
}

export default function Header({ isDemo, providerLabel, model, soundOn, onToggleSound, onOpenMenu }) {
  return (
    <header className="flex items-center justify-between gap-3 px-0.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-paper shadow-sm">
          <PixelLogo />
        </div>
        <div className="min-w-0">
          <h1 className="flex items-baseline gap-1.5 text-[1.1rem] font-extrabold leading-tight tracking-tight text-ink">
            <span className="truncate">Agentic AI Translation Company</span>
            <span className="rounded bg-terracotta px-1.5 py-0.5 text-[0.62rem] font-bold leading-none tracking-wide text-white">
              2.0
            </span>
          </h1>
          <p className="hidden truncate text-[0.72rem] text-ink-soft sm:block">
            Watch your AI team translate, review and deliver in the office below.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenMenu}
          className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem] font-bold transition sm:flex ${
            isDemo
              ? 'border-honey/60 bg-honey-soft text-[#8a5a12] hover:bg-[#f8e6c0]'
              : 'border-sage/40 bg-sage-soft text-[#3f6b47] hover:bg-[#d8e8d5]'
          }`}
          title={isDemo ? 'No API key: running in Demo mode. Click to add one.' : 'Live mode'}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isDemo ? 'bg-honey' : 'bg-sage'} animate-pulse`} />
          {isDemo ? 'Demo' : `${providerLabel} · ${model}`}
        </button>
        <button
          type="button"
          onClick={onToggleSound}
          className="grid h-8 w-8 place-items-center rounded-full border border-line bg-paper text-ink-soft transition hover:bg-white hover:text-ink"
          aria-label={soundOn ? 'Mute office sounds' : 'Play office sounds'}
          title={soundOn ? 'Mute office sounds' : 'Play office sounds'}
        >
          {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={onOpenMenu}
          className="grid h-8 w-8 place-items-center rounded-full border border-line bg-ink text-cream shadow-sm transition hover:bg-wood"
          aria-label="Open settings menu"
        >
          <Menu className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
