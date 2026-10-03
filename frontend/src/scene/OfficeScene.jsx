import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { ROSTER, TEAM_MEMBERS, TEAM_TITLES } from './world/roster';
import { WORLD, ROOMS, CLUSTERS, SEATS, FURNITURE } from './world/layout';
import {
  buildSpriteBank,
  paintOfficeBackground,
  loadBackdropImage,
  drawMachineActive,
  drawPackage,
  drawGlow,
  drawAnimatedLight,
  drawWorldProp,
} from './assets/sprites';
import { createActors } from './engine/actors';
import { createSfx } from './engine/sfx';
import { Choreographer } from './choreography';
import { createPostStack, applyHd2d } from './engine/postprocess';

const OfficeScene = forwardRef(function OfficeScene(
  { onDelivered, muted = true, rich = false, fullscreen = false, onToggleFullscreen },
  ref,
) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const captionRef = useRef(null);
  const expertRef = useRef(null);
  const stateRef = useRef(null);

  useImperativeHandle(ref, () => ({
    dispatch(ev) {
      stateRef.current?.choreo?.dispatch(ev);
    },
    setMuted(v) {
      stateRef.current?.sfx?.setMuted(!!v);
    },
  }));

  useEffect(() => {
    stateRef.current?.sfx?.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    state.bg = paintOfficeBackground(WORLD.w, WORLD.h, ROOMS, CLUSTERS, null, SEATS, {
      rich,
      interior: state.interior,
    });
    state.rich = rich;
  }, [rich]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;

    const ctx = canvas.getContext('2d');
    let cancelled = false;
    let ro;

    const boot = async () => {
      if (cancelled) return;

      const sprites = buildSpriteBank(ROSTER);
      let interior = null;
      try {
        interior = await loadBackdropImage('/scene/office-interior.jpg');
      } catch {
        interior = null;
      }
      if (cancelled) return;
      const bg = paintOfficeBackground(WORLD.w, WORLD.h, ROOMS, CLUSTERS, null, SEATS, {
        rich,
        interior,
      });
      const actors = createActors(ROSTER, SEATS);
      const sfx = createSfx();
      sfx.setMuted(muted);
      const post = createPostStack(WORLD.w, WORLD.h);

      const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

      const choreo = new Choreographer({
        actors,
        playSfx: (n) => sfx.play(n),
        onDelivered: () => onDelivered?.(),
        getReducedMotion: reducedMotion,
      });

      const state = {
        sprites,
        bg,
        interior,
        actors,
        sfx,
        choreo,
        post,
        running: true,
        last: performance.now(),
        rich,
      };
      stateRef.current = state;

      const resize = () => {
        const rect = wrap.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.max(1, Math.floor(rect.width * dpr));
        canvas.height = Math.max(1, Math.floor(rect.height * dpr));
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        state.view = { w: rect.width, h: rect.height, dpr };
      };
      resize();
      ro = new ResizeObserver(resize);
      ro.observe(wrap);

      const fit = () => {
        const { w, h, dpr } = state.view || { w: 1, h: 1, dpr: 1 };
        const scale = Math.max(w / WORLD.w, h / WORLD.h);
        const fittedW = WORLD.w * scale;
        const fittedH = WORLD.h * scale;
        const ox = (w - fittedW) / 2;
        const oy = fittedH > h ? (h - fittedH) * 0.55 : (h - fittedH) / 2;
        return { scale, ox, oy, dpr };
      };

      const loop = (now) => {
        if (!state.running) return;
        const dt = Math.min(0.05, (now - state.last) / 1000);
        state.last = now;
        const red = reducedMotion();
        for (const a of Object.values(actors)) a.update(dt, red);

        const sctx = state.post.scene.ctx;
        sctx.imageSmoothingEnabled = true;
        sctx.imageSmoothingQuality = 'high';
        sctx.clearRect(0, 0, WORLD.w, WORLD.h);
        sctx.drawImage(state.bg, 0, 0);
        if (!red) drawAnimatedLight(sctx, ROOMS, now, state.rich);

        const drawables = FURNITURE.map((f) => ({
          sortY: f.sortY,
          draw: () => {
            sctx.imageSmoothingEnabled = true;
            drawWorldProp(sctx, f, { rich: state.rich, plate: state.bg });
            if (f.id === 'printer' && choreo.machineActive) {
              drawGlow(sctx, f.glowX ?? f.x + 32, f.glowY ?? f.y + 16, 28);
              drawMachineActive(sctx, f, Math.floor(now / 180));
            }
            if (f.id === 'bind' && choreo.bindActive) {
              drawGlow(sctx, f.glowX ?? f.x + 36, f.glowY ?? f.y + 16, 28);
            }
          },
        }));
        for (const a of Object.values(actors)) {
          drawables.push({
            sortY: a.y,
            draw: () => {
              sctx.imageSmoothingEnabled = false;
              a.draw(sctx, sprites.chars[a.id]);
            },
          });
        }
        if (choreo.packageAtDoor) {
          drawables.push({
            sortY: SEATS.door.y + 2,
            draw: () => drawPackage(sctx, SEATS.door.x - 4, SEATS.door.y - 18),
          });
        }
        drawables.sort((a, b) => a.sortY - b.sortY);
        for (const d of drawables) d.draw();

        const { scale, ox, oy, dpr } = fit();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#1c1814';
        ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        ctx.save();
        ctx.translate(ox, oy);
        ctx.scale(scale, scale);
        applyHd2d(state.post, ctx, now, { rich: state.rich, reduced: red });
        ctx.restore();
        if (captionRef.current) captionRef.current.textContent = captionFor(choreo);
        if (expertRef.current) {
          const text = expertsOnDuty(choreo, actors);
          expertRef.current.textContent = text;
          expertRef.current.classList.toggle('hidden', !text);
        }

        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    };

    boot();

    return () => {
      cancelled = true;
      if (stateRef.current) stateRef.current.running = false;
      ro?.disconnect();
      stateRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`relative h-full w-full overflow-hidden ${fullscreen ? 'bg-[#0c1018]' : 'bg-[#1a2230]'}`}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        aria-label="HD-2D pixel art translation company office"
      />
      <div className="pointer-events-none absolute left-3 top-2 z-10 flex flex-col items-start gap-1">
        <span className="rounded-md bg-night/55 px-2 py-0.5 text-[0.72rem] font-semibold tracking-wide text-cream/90">
          Live office
        </span>
        <span
          ref={expertRef}
          className="hidden max-w-[min(70vw,22rem)] rounded-md bg-terracotta/90 px-2 py-0.5 text-[0.72rem] font-semibold text-white shadow-sm"
        />
      </div>
      <div
        ref={captionRef}
        className="pointer-events-none absolute bottom-2 left-1/2 z-10 max-w-[90%] -translate-x-1/2 truncate rounded-md bg-night/60 px-3 py-1 text-center text-[0.8rem] font-semibold text-cream/90"
      >
        The office is open. Place an order above to watch the team at work.
      </div>
      {onToggleFullscreen && (
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="absolute right-3 top-2 z-10 flex items-center gap-1.5 rounded-lg border border-line/40 bg-night/70 px-2.5 py-1.5 text-[0.7rem] font-bold text-cream shadow-md backdrop-blur-sm transition hover:bg-night"
          title={fullscreen ? 'Exit fullscreen office' : 'Expand office with richer lighting & detail'}
          aria-label={fullscreen ? 'Exit fullscreen office' : 'Expand office fullscreen'}
        >
          {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          {fullscreen ? 'Exit' : 'Fullscreen'}
        </button>
      )}
    </div>
  );
});

function captionFor(choreo) {
  return choreo.stageLabel || 'The office is open. Place an order above to watch the team at work.';
}

function expertsOnDuty(choreo, actors) {
  const labels = [];
  const seen = new Set();
  const push = (text) => {
    if (!text || text === 'Client' || seen.has(text)) return;
    seen.add(text);
    labels.push(text);
  };

  const teamWorking = (TEAM_MEMBERS[choreo.teamId] || []).some((id) => {
    const a = actors[id];
    return a && (a.status === 'working' || a.status === 'talking');
  });
  const done = /complete|wrong|the office is open/i.test(choreo.stageLabel || '');
  if (!done && (teamWorking || (choreo.teamId && choreo.assignedWorkers?.length))) {
    push(TEAM_TITLES[choreo.teamId]);
  }

  for (const a of Object.values(actors)) {
    if (a.status !== 'working' && a.status !== 'talking') continue;
    if (a.def.team && a.def.team === choreo.teamId && teamWorking) continue;
    push(a.def.title || a.def.name);
  }
  return labels.join(' · ');
}

export default OfficeScene;
