/** Procedural 2.5D Stardew-modern pixel sprites + layered office painter. */

import { PALETTE } from '../world/roster';
import { ROOMS } from '../world/layout';

const CHAR_W = 24;
const CHAR_H = 36;
const UI_FONT = '600 11px Nunito, ui-sans-serif, system-ui, sans-serif';
const UI_FONT_SMALL = '700 10px Nunito, ui-sans-serif, system-ui, sans-serif';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas: c, ctx };
}

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function shade(hex, amount) {
  const n = hex.replace('#', '');
  const num = parseInt(n.length === 3 ? n.split('').map((c) => c + c).join('') : n, 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 255) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 255) + amount));
  const b = Math.min(255, Math.max(0, (num & 255) + amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function drawCharacter(ctx, ox, oy, look, pose, frame) {
  const { hair, shirt, pants, skin, glasses, senior } = look;
  const hairHi = shade(hair, 40);
  const hairSh = shade(hair, -30);
  const shirtHi = shade(shirt, 36);
  const shirtSh = shade(shirt, -34);
  const pantsHi = shade(pants, 24);
  const pantsSh = shade(pants, -26);
  const skinHi = shade(skin, 30);
  const skinSh = shade(skin, -24);
  const ink = PALETTE.ink;

  const bob = pose === 'idle' ? (frame % 2 === 0 ? 0 : 1) : 0;
  const walk = pose === 'walk';
  const sit = pose === 'sit';
  const talk = pose === 'talk';
  const type = pose === 'type' || pose === 'work';
  const L = walk && frame % 2 ? 1 : 0;
  const R = walk && frame % 2 === 0 ? 1 : 0;

  ctx.fillStyle = 'rgba(12, 8, 6, 0.5)';
  ctx.beginPath();
  ctx.ellipse(ox + 12, oy + 34, 10, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();

  const footY = sit ? oy + 29 : oy + 31;
  px(ctx, ox + 5, footY + L, 6, 3, ink);
  px(ctx, ox + 13, footY + R, 6, 3, ink);
  px(ctx, ox + 5, footY + L, 2, 1, shade(ink, 40));

  if (sit) {
    px(ctx, ox + 6, oy + 22 + bob, 5, 8, pants);
    px(ctx, ox + 13, oy + 22 + bob, 5, 8, pants);
    px(ctx, ox + 6, oy + 22 + bob, 2, 8, pantsSh);
    px(ctx, ox + 9, oy + 23 + bob, 1, 4, pantsHi);
  } else {
    px(ctx, ox + 6, oy + 21 + bob + L, 5, 11 - L, pants);
    px(ctx, ox + 13, oy + 21 + bob + R, 5, 11 - R, pants);
    px(ctx, ox + 6, oy + 22 + bob, 2, 8, pantsSh);
    px(ctx, ox + 9, oy + 22 + bob, 1, 6, pantsHi);
  }

  const bodyY = (sit ? oy + 13 : oy + 11) + bob;
  px(ctx, ox + 5, bodyY, 14, 12, shirt);
  px(ctx, ox + 5, bodyY, 3, 12, shirtSh);
  px(ctx, ox + 8, bodyY, 2, 10, shirtHi);
  px(ctx, ox + 5, bodyY + 10, 14, 2, shirtSh);
  px(ctx, ox + 6, bodyY + 10, 12, 1, pantsSh);
  if (senior) {
    px(ctx, ox + 5, bodyY, 14, 2, PALETTE.honey);
    px(ctx, ox + 11, bodyY + 2, 2, 9, shade(PALETTE.honey, -18));
  }

  if (type) {
    px(ctx, ox + 2, bodyY + 2, 4, 5, shirtSh);
    px(ctx, ox + 1, bodyY + 5 + (frame % 2), 4, 3, skin);
    px(ctx, ox + 18, bodyY + 2, 4, 5, shirt);
    px(ctx, ox + 19, bodyY + 5, 4, 3, skinHi);
  } else if (talk) {
    px(ctx, ox + 2, bodyY + 1, 4, 8, shirtSh);
    px(ctx, ox + 1, bodyY + 2, 3, 4, skin);
    px(ctx, ox + 18, bodyY + 3, 4, 8, shirt);
    px(ctx, ox + 20, bodyY + 8, 3, 3, skinHi);
  } else {
    px(ctx, ox + 2, bodyY + 2, 4, 10, shirtSh);
    px(ctx, ox + 1, bodyY + 9, 3, 3, skinSh);
    px(ctx, ox + 18, bodyY + 2, 4, 10, shirt);
    px(ctx, ox + 20, bodyY + 9, 3, 3, skin);
  }

  const headY = (sit ? oy + 3 : oy + 1) + bob;
  px(ctx, ox + 10, headY + 9, 4, 3, skinSh);
  px(ctx, ox + 7, headY + 1, 10, 10, skin);
  px(ctx, ox + 8, headY, 8, 2, skinHi);
  px(ctx, ox + 7, headY + 2, 2, 8, skinSh);
  px(ctx, ox + 16, headY + 3, 1, 5, skinHi);
  px(ctx, ox + 6, headY + 4, 2, 3, skinSh);
  px(ctx, ox + 16, headY + 4, 2, 3, skin);

  px(ctx, ox + 7, headY - 1, 10, 4, hair);
  px(ctx, ox + 6, headY + 1, 3, 6, hair);
  px(ctx, ox + 15, headY + 1, 3, 6, hair);
  px(ctx, ox + 8, headY - 1, 4, 2, hairHi);
  px(ctx, ox + 6, headY + 2, 2, 4, hairSh);
  if (senior) px(ctx, ox + 8, headY + 1, 8, 2, PALETTE.lineStrong);

  px(ctx, ox + 9, headY + 5, 2, 2, ink);
  px(ctx, ox + 14, headY + 5, 2, 2, ink);
  px(ctx, ox + 9, headY + 5, 1, 1, '#fff8e8');
  px(ctx, ox + 14, headY + 5, 1, 1, '#fff8e8');
  px(ctx, ox + 11, headY + 7, 2, 1, skinSh);
  if (glasses) {
    ctx.strokeStyle = PALETTE.inkSoft;
    ctx.lineWidth = 1;
    ctx.strokeRect(ox + 8.5, headY + 4.5, 3, 3);
    ctx.strokeRect(ox + 13.5, headY + 4.5, 3, 3);
    px(ctx, ox + 11, headY + 5, 3, 1, PALETTE.inkSoft);
  }
  if (talk && frame % 2 === 0) px(ctx, ox + 11, headY + 8, 2, 1, PALETTE.terracotta);

  px(ctx, ox + 6, headY + 2, 1, 6, 'rgba(255, 224, 168, 0.55)');
  px(ctx, ox + 5, bodyY + 1, 1, 8, 'rgba(255, 214, 150, 0.32)');
}

function buildCharSheet(look) {
  const poses = ['idle', 'walk', 'sit', 'type', 'talk', 'work'];
  const frames = 2;
  const { canvas, ctx } = makeCanvas(CHAR_W * frames, CHAR_H * poses.length);
  poses.forEach((pose, pi) => {
    for (let f = 0; f < frames; f++) drawCharacter(ctx, f * CHAR_W, pi * CHAR_H, look, pose, f);
  });
  return { canvas, poses, frames, w: CHAR_W, h: CHAR_H };
}

export function buildSpriteBank(roster) {
  const chars = {};
  for (const r of roster) chars[r.id] = buildCharSheet(r);
  return { chars, charW: CHAR_W, charH: CHAR_H };
}

export function drawCharFrame(ctx, sheet, pose, frame, x, y, flip = false, scale = 1) {
  const pi = Math.max(0, sheet.poses.indexOf(pose));
  const f = frame % sheet.frames;
  const sx = f * sheet.w;
  const sy = pi * sheet.h;
  const dw = sheet.w * scale;
  const dh = sheet.h * scale;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (flip) {
    ctx.translate(x + dw, y);
    ctx.scale(-1, 1);
    ctx.drawImage(sheet.canvas, sx, sy, sheet.w, sheet.h, 0, 0, dw, dh);
  } else {
    ctx.drawImage(sheet.canvas, sx, sy, sheet.w, sheet.h, x, y, dw, dh);
  }
  ctx.restore();
}

function box25(ctx, x, y, w, h, depth, top, front, side) {
  if (depth > 0) {
    px(ctx, x - depth, y - depth, depth, h + depth, side || shade(front, -18));
    px(ctx, x - depth, y - depth, w + depth, depth, top);
  }
  px(ctx, x, y, w, h, front);
  if (depth > 0) px(ctx, x, y - depth, w, depth, top);
}

function plant(ctx, x, y, rich) {
  px(ctx, x + 2, y + 6, 3, 5, PALETTE.wood);
  px(ctx, x, y + 2, 7, 5, PALETTE.leaf);
  px(ctx, x + 1, y, 5, 3, PALETTE.sage);
  if (rich) {
    px(ctx, x - 1, y + 3, 3, 3, PALETTE.leaf);
    px(ctx, x + 5, y + 3, 3, 3, '#5a8a60');
  }
}

function windowWithBlinds(ctx, x, y, w, h, rich) {
  px(ctx, x, y, w, h, '#3a5578');
  px(ctx, x + 1, y + 1, w - 2, h - 2, '#5a7a9a');
  px(ctx, x + 2, y + 3, 3, 3, '#e8c878');
  px(ctx, x + 7, y + 5, 2, 2, '#f0a060');
  if (w > 14) px(ctx, x + 12, y + 2, 3, 4, '#9ad4ef');
  px(ctx, x + Math.floor(w / 2) - 1, y, 2, h, PALETTE.wood);
  px(ctx, x, y + Math.floor(h / 2) - 1, w, 2, PALETTE.wood);
  if (rich) {
    for (let i = 2; i < h - 2; i += 3) {
      px(ctx, x + 1, y + i, w - 2, 1, 'rgba(42,31,27,0.35)');
    }
    px(ctx, x - 1, y - 2, w + 2, 3, PALETTE.terracotta);
  }
}

export function loadBackdropImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

/** Painted HD-2D plate when `interior` is set; procedural shell otherwise. */
export function paintOfficeBackground(W, H, rooms, clusters, _props, _seats, { rich = false, interior = null } = {}) {
  const { canvas, ctx } = makeCanvas(W, H);

  if (interior) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(interior, 0, 0, W, H);
    return canvas;
  }

  px(ctx, 0, 0, W, H, '#d8c4a8');
  for (let y = 28; y < H; y += 6) {
    px(ctx, 0, y, W, 1, 'rgba(107,74,51,0.10)');
  }
  px(ctx, 0, 270, W, H - 270, '#c2b49c');
  for (let x = 0; x < W; x += 16) px(ctx, x, 292, 9, 2, 'rgba(90,70,55,0.18)');

  const sky = ctx.createLinearGradient(0, 0, 0, 28);
  sky.addColorStop(0, '#1a283c');
  sky.addColorStop(1, '#3d5570');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, 28);
  for (let x = 12; x < W; x += 48) {
    windowWithBlinds(ctx, x, 4, 28, 20, rich);
  }

  function roomShell(r) {
    const d = rich ? 7 : 5;
    px(ctx, r.x, r.y, r.w, r.h, '#efe4d4');
    px(ctx, r.x + 6, r.y + 8, r.w - 12, r.h - 16, shade('#efe4d4', rich ? 8 : 0));
    px(ctx, r.x - d, r.y - d, r.w + d, d, shade(PALETTE.wood, 22));
    px(ctx, r.x - d, r.y - d, d, r.h + d, shade(PALETTE.wood, -16));
    px(ctx, r.x + r.w, r.y - d, d, r.h + d, shade(PALETTE.wood, -8));
    windowWithBlinds(ctx, r.x + r.w - 36, r.y + 10, 24, 18, rich);
    px(ctx, r.x + 8, r.y + 6, 48, 9, 'rgba(42,31,27,0.55)');
    ctx.fillStyle = r.color;
    ctx.font = 'bold 7px sans-serif';
    ctx.fillText(r.label, r.x + 12, r.y + 13);
    if (rich) plant(ctx, r.x + 10, r.y + 22, true);
  }

  roomShell(rooms.manager);
  roomShell(rooms.editor);
  roomShell(rooms.master);

  for (const c of Object.values(clusters)) {
    px(ctx, c.x - 3, c.y + 4, c.w - 2, c.h - 10, shade(c.rug, -18));
    px(ctx, c.x, c.y + 6, c.w - 8, c.h - 14, c.rug);
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.font = 'bold 6px sans-serif';
    ctx.fillText(c.label, c.x + 6, c.y + 16);
    plant(ctx, c.x + c.w - 20, c.y + 8, rich);
  }

  px(ctx, 180, 148, 760, 8, shade(PALETTE.carpet, -8));
  if (rich) {
    for (let x = 200; x < 920; x += 28) px(ctx, x, 150, 14, 3, shade(PALETTE.carpet, 12));
  }

  return canvas;
}

function drawDeskProp(ctx, f, rich) {
  const d = f.wide ? 6 : 4;
  box25(ctx, f.x, f.y, f.w, f.h, d, shade(PALETTE.wood, 32), PALETTE.wood, shade(PALETTE.wood, -28));
  const mw = f.wide ? 16 : 12;
  box25(
    ctx,
    f.x + Math.floor(f.w / 2) - mw / 2,
    f.y - 11,
    mw,
    9,
    2,
    PALETTE.monitor,
    shade(PALETTE.monitor, -22),
    shade(PALETTE.monitor, -36),
  );
  px(ctx, f.x + Math.floor(f.w / 2) - mw / 2 + 2, f.y - 9, mw - 4, 5, PALETTE.monitorGlow);
  if (rich) {
    px(ctx, f.x + 3, f.y - 1, 7, 2, PALETTE.paper);
    px(ctx, f.x + f.w - 8, f.y - 2, 5, 3, PALETTE.terracotta);
  }
  if (f.lamp) {
    px(ctx, f.x + 4, f.y - 6, 3, 7, PALETTE.inkSoft);
    px(ctx, f.x + 2, f.y - 10, 7, 4, PALETTE.honey);
  }
}

function drawDoorframe(ctx, f) {
  const r = ROOMS[f.room];
  if (!r) return;
  const y = r.y + r.h - 4;
  const wall = shade(PALETTE.wood, 8);
  const lip = shade(PALETTE.wood, 28);
  px(ctx, r.x, y, r.doorX, 6, wall);
  px(ctx, r.x + r.doorX + r.doorW, y, r.w - r.doorX - r.doorW, 6, wall);
  px(ctx, r.x, y, r.doorX, 2, lip);
  px(ctx, r.x + r.doorX + r.doorW, y, r.w - r.doorX - r.doorW, 2, lip);
  px(ctx, r.x + r.doorX - 3, y - 10, 3, 16, shade(PALETTE.wood, -10));
  px(ctx, r.x + r.doorX + r.doorW, y - 10, 3, 16, shade(PALETTE.wood, -10));
}

export function drawWorldProp(ctx, f, { rich = false, plate = null } = {}) {
  switch (f.kind) {
    case 'plate-slice':
      if (plate) {
        const x = Math.round(f.x);
        const y = Math.round(f.y);
        const w = Math.round(f.w);
        const h = Math.round(f.h);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(plate, x, y, w, h, x, y, w, h);
        ctx.restore();
      }
      break;
    case 'desk':
      drawDeskProp(ctx, f, rich);
      break;
    case 'doorframe':
      drawDoorframe(ctx, f);
      break;
    case 'vending':
      box25(ctx, f.x, f.y, f.w, f.h, 4, '#6a8aa8', '#4a6a88', '#3a5470');
      px(ctx, f.x + 4, f.y + 6, f.w - 8, 10, '#9ad4ef');
      px(ctx, f.x + 5, f.y + 18, 6, 8, PALETTE.terracotta);
      px(ctx, f.x + 13, f.y + 18, 6, 8, PALETTE.sage);
      px(ctx, f.x + 8, f.y + f.h - 8, 10, 4, PALETTE.ink);
      break;
    case 'coffee':
      box25(ctx, f.x, f.y, f.w, f.h, 3, '#d8d0c4', '#8a7a6a', '#6a5a4a');
      px(ctx, f.x + 4, f.y + 4, f.w - 8, 8, PALETTE.monitor);
      px(ctx, f.x + 6, f.y + 6, 8, 4, PALETTE.honey);
      px(ctx, f.x + 8, f.y + 16, 6, 8, PALETTE.terracottaDark);
      break;
    case 'cooler':
      box25(ctx, f.x, f.y, f.w, f.h, 3, '#dce8f0', '#7aa0b8', '#5a8098');
      px(ctx, f.x + 4, f.y + 4, f.w - 8, 10, '#c5e8f6');
      px(ctx, f.x + 6, f.y + 16, 6, 6, PALETTE.sky);
      break;
    case 'printer':
      box25(ctx, f.x, f.y, f.w, f.h, 5, shade(PALETTE.inkSoft, 28), PALETTE.inkSoft, shade(PALETTE.inkSoft, -22));
      px(ctx, f.x + 6, f.y + 6, 14, 10, PALETTE.monitor);
      px(ctx, f.x + 8, f.y + 8, 10, 6, PALETTE.sky);
      px(ctx, f.x + 24, f.y + 8, 18, 12, PALETTE.paper);
      ctx.fillStyle = PALETTE.cream;
      ctx.font = 'bold 5px sans-serif';
      ctx.fillText('CHUNK', f.x + 8, f.y + f.h - 5);
      break;
    case 'reception':
      box25(ctx, f.x, f.y, f.w, f.h, 4, shade(PALETTE.wood, 30), PALETTE.wood, shade(PALETTE.wood, -25));
      box25(ctx, f.x + 16, f.y - 10, 16, 8, 2, PALETTE.monitor, shade(PALETTE.monitor, -20), shade(PALETTE.monitor, -35));
      px(ctx, f.x + 18, f.y - 8, 12, 5, PALETTE.monitorGlow);
      break;
    case 'bind':
      box25(ctx, f.x, f.y, f.w, f.h, 5, shade(PALETTE.inkSoft, 20), PALETTE.inkSoft, shade(PALETTE.inkSoft, -25));
      px(ctx, f.x + 6, f.y + 6, f.w - 12, 12, PALETTE.terracotta);
      px(ctx, f.x + 10, f.y + 10, 24, 6, PALETTE.honey);
      ctx.fillStyle = PALETTE.cream;
      ctx.font = 'bold 5px sans-serif';
      ctx.fillText('BIND', f.x + 14, f.y + f.h - 6);
      break;
    case 'glass-door':
      box25(ctx, f.x, f.y, f.w, f.h, 4, '#c8d8e8', '#7a9ab0', '#5a7a90');
      px(ctx, f.x + 6, f.y + 8, 18, f.h - 18, '#8eb4c8');
      px(ctx, f.x + 28, f.y + 8, 18, f.h - 18, '#7aa4bc');
      px(ctx, f.x + 8, f.y + 14, 6, 8, '#e8c878');
      px(ctx, f.x + 32, f.y + 18, 5, 6, '#f0a060');
      px(ctx, f.x + f.w - 10, f.y + 28, 3, 3, PALETTE.honey);
      break;
    default:
      break;
  }
}

export function drawAnimatedLight(ctx, rooms, t, rich) {
  const pulse = 0.78 + Math.sin(t / 2100) * 0.22;
  const drift = Math.sin(t / 1700) * (rich ? 5 : 2);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const wx = 90;
  const wy = 90;
  const glow = ctx.createRadialGradient(wx, wy, 8, wx, wy, rich ? 180 : 110);
  glow.addColorStop(0, `rgba(255, 226, 160, ${0.22 * pulse})`);
  glow.addColorStop(1, 'rgba(255, 176, 80, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 280, 280);
  const g = ctx.createLinearGradient(wx + drift, wy, wx + 40 + drift, wy + 160);
  g.addColorStop(0, `rgba(255, 236, 190, ${(rich ? 0.18 : 0.1) * pulse})`);
  g.addColorStop(1, 'rgba(255, 200, 120, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(wx - 6 + drift, wy);
  ctx.lineTo(wx + 28 + drift, wy);
  ctx.lineTo(wx + 90 + drift, wy + 170);
  ctx.lineTo(wx + 20 + drift, wy + 170);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawGlow(ctx, x, y, r = 18) {
  const g = ctx.createRadialGradient(x, y, 2, x, y, r);
  g.addColorStop(0, 'rgba(231,180,90,0.45)');
  g.addColorStop(1, 'rgba(231,180,90,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function drawNameplate(ctx, text, x, y) {
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.font = UI_FONT_SMALL;
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width;
  const pad = 5;
  const w = Math.ceil(tw + pad * 2);
  const h = 14;
  const bx = Math.round(x - w / 2);
  const by = Math.round(y);
  ctx.fillStyle = 'rgba(42,31,27,0.82)';
  ctx.beginPath();
  ctx.roundRect(bx, by, w, h, 3);
  ctx.fill();
  ctx.fillStyle = PALETTE.cream;
  ctx.fillText(text, bx + pad, by + h / 2 + 0.5);
  ctx.restore();
}

export function drawSpeechBubble(ctx, text, x, y) {
  const t = text.length > 36 ? `${text.slice(0, 34)}…` : text;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.font = UI_FONT;
  ctx.textBaseline = 'middle';
  const tw = Math.min(160, ctx.measureText(t).width);
  const w = Math.ceil(tw + 12);
  const h = 18;
  const bx = Math.round(x - w / 2);
  const by = Math.round(y - h - 6);
  ctx.fillStyle = PALETTE.paper;
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bx, by, w, h, 4);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 4, by + h);
  ctx.lineTo(x, by + h + 5);
  ctx.lineTo(x + 4, by + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.ink;
  ctx.fillText(t, bx + 6, by + h / 2 + 0.5);
  ctx.restore();
}

export function drawPackage(ctx, x, y) {
  box25(ctx, x, y, 10, 8, 2, shade(PALETTE.honey, 20), PALETTE.honey, shade(PALETTE.honey, -25));
  px(ctx, x + 1, y + 1, 8, 2, PALETTE.terracotta);
  px(ctx, x + 4, y, 2, 8, PALETTE.terracottaDark);
}

export function drawMachineActive(ctx, prop, frame) {
  const { x, y, w } = prop;
  px(ctx, x + 16, y + 4, 6, 6, frame % 2 ? PALETTE.honey : PALETTE.terracotta);
  const paperY = y + 6 + (frame % 4);
  px(ctx, x + 24, paperY, 8, 8, PALETTE.paper);
  px(ctx, x + 25, paperY + 2, 6, 1, PALETTE.lineStrong);
  px(ctx, x + 25, paperY + 4, 5, 1, PALETTE.lineStrong);
  drawGlow(ctx, x + w / 2, y + 8, 16);
}
