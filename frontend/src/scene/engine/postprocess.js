/** HD-2D post stack: bloom, volumetric god-rays, color grade, vignette, light fog.
 * Inspired by Octopath Traveler / UnrealBloom + radial light shafts.
 */

function make(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { canvas: c, ctx };
}

export function createPostStack(w, h) {
  const halfW = Math.max(1, Math.floor(w / 2));
  const halfH = Math.max(1, Math.floor(h / 2));
  const qW = Math.max(1, Math.floor(w / 4));
  const qH = Math.max(1, Math.floor(h / 4));
  return {
    w,
    h,
    scene: make(w, h),
    bright: make(halfW, halfH),
    blurA: make(qW, qH),
    blurB: make(qW, qH),
    rays: make(halfW, halfH),
  };
}

function extractBright(src, dest, threshold = 180) {
  dest.ctx.clearRect(0, 0, dest.canvas.width, dest.canvas.height);
  dest.ctx.drawImage(src.canvas, 0, 0, dest.canvas.width, dest.canvas.height);
  const { width, height } = dest.canvas;
  const img = dest.ctx.getImageData(0, 0, width, height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const luma = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    if (luma < threshold) {
      d[i] = d[i + 1] = d[i + 2] = 0;
      d[i + 3] = 0;
    } else {
      const k = (luma - threshold) / (255 - threshold);
      d[i] = Math.min(255, d[i] * (0.6 + k));
      d[i + 1] = Math.min(255, d[i + 1] * (0.55 + k * 0.8));
      d[i + 2] = Math.min(255, d[i + 2] * 0.35);
    }
  }
  dest.ctx.putImageData(img, 0, 0);
}

function blurPingPong(from, a, b, passes = 2) {
  a.ctx.clearRect(0, 0, a.canvas.width, a.canvas.height);
  a.ctx.drawImage(from.canvas, 0, 0, a.canvas.width, a.canvas.height);
  let src = a;
  let dst = b;
  for (let i = 0; i < passes; i++) {
    dst.ctx.clearRect(0, 0, dst.canvas.width, dst.canvas.height);
    dst.ctx.filter = 'blur(3px)';
    dst.ctx.drawImage(src.canvas, 0, 0, dst.canvas.width, dst.canvas.height);
    dst.ctx.filter = 'none';
    const tmp = src;
    src = dst;
    dst = tmp;
  }
  return src;
}

function godRays(bright, dest, lx, ly, samples = 16) {
  const { canvas, ctx } = dest;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'lighter';
  let s = 1;
  for (let i = 0; i < samples; i++) {
    s *= 0.94;
    ctx.globalAlpha = 0.11 * (1 - i / samples);
    const dw = canvas.width * s;
    const dh = canvas.height * s;
    const dx = lx * canvas.width * (1 - s);
    const dy = ly * canvas.height * (1 - s);
    ctx.drawImage(bright.canvas, dx, dy, dw, dh);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function vignette(ctx, w, h, strength = 0.55) {
  const g = ctx.createRadialGradient(w * 0.45, h * 0.42, h * 0.15, w * 0.5, h * 0.5, h * 0.82);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(8, 10, 18, ${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function haze(ctx, w, h, t, rich) {
  const drift = Math.sin(t / 1400) * 8;
  const g = ctx.createLinearGradient(0, 0, w * 0.7 + drift, h);
  g.addColorStop(0, rich ? 'rgba(255, 214, 150, 0.10)' : 'rgba(255, 214, 150, 0.05)');
  g.addColorStop(0.45, 'rgba(180, 200, 220, 0.04)');
  g.addColorStop(1, 'rgba(20, 28, 42, 0.10)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function dust(ctx, w, h, t, rich) {
  const n = rich ? 28 : 12;
  ctx.fillStyle = 'rgba(255, 236, 190, 0.45)';
  for (let i = 0; i < n; i++) {
    const x = ((Math.sin(t / 900 + i * 1.7) * 0.5 + 0.5) * w * 0.7 + 40) % w;
    const y = ((Math.cos(t / 1100 + i * 0.9) * 0.5 + 0.5) * h * 0.55 + 20) % (h * 0.7);
    const s = 1 + (i % 3);
    ctx.fillRect(x, y, s, s);
  }
}

/**
 * Composite HD-2D look onto the display context (already translated/scaled to world pixels).
 */
export function applyHd2d(stack, displayCtx, t, { rich = false, reduced = false } = {}) {
  const { scene, bright, blurA, blurB, rays, w, h } = stack;
  extractBright(scene, bright, rich ? 150 : 175);
  const blurred = blurPingPong(bright, blurA, blurB, rich ? 3 : 2);
  if (!reduced) godRays(bright, rays, 0.16, 0.12, rich ? 22 : 14);

  displayCtx.drawImage(scene.canvas, 0, 0);

  displayCtx.save();
  displayCtx.globalCompositeOperation = 'screen';
  displayCtx.globalAlpha = rich ? 0.9 : 0.62;
  displayCtx.drawImage(blurred.canvas, 0, 0, w, h);
  if (!reduced) {
    displayCtx.globalAlpha = rich ? 0.55 : 0.32;
    displayCtx.drawImage(rays.canvas, 0, 0, w, h);
  }
  displayCtx.restore();

  displayCtx.save();
  displayCtx.globalCompositeOperation = 'soft-light';
  displayCtx.fillStyle = rich ? 'rgba(255, 196, 120, 0.12)' : 'rgba(255, 196, 120, 0.06)';
  displayCtx.fillRect(0, 0, w, h);
  displayCtx.restore();

  haze(displayCtx, w, h, t, rich);
  if (!reduced) dust(displayCtx, w, h, t, rich);
  vignette(displayCtx, w, h, rich ? 0.38 : 0.22);
}

export function drawForegroundParapet(ctx, w, h) {
  const g = ctx.createLinearGradient(0, h - 78, 0, h);
  g.addColorStop(0, 'rgba(8, 10, 16, 0)');
  g.addColorStop(0.5, 'rgba(12, 10, 16, 0.12)');
  g.addColorStop(1, 'rgba(10, 8, 14, 0.38)');
  ctx.fillStyle = g;
  ctx.fillRect(0, h - 78, w, 78);
}
