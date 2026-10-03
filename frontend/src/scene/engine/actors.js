/** Lightweight character agents with waypoint walking. */

import { HUBS, seatOf } from '../world/layout';
import { drawCharFrame, drawGlow, drawNameplate, drawSpeechBubble, drawPackage } from '../assets/sprites';

const WALK_SPEED = 90; // px / sec

function dist(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

function nearestHub(p) {
  let best = HUBS[0];
  let bestD = Infinity;
  for (const h of HUBS) {
    const d = dist(p, h);
    if (d < bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
}

/** Build a simple path: current → nearest hub → target hub → target */
export function buildPath(from, to) {
  if (dist(from, to) < 6) return [{ x: to.x, y: to.y }];
  const a = nearestHub(from);
  const b = nearestHub(to);
  const path = [];
  if (dist(from, a) > 4) path.push({ x: a.x, y: a.y });
  if (a !== b) {
    if (dist(a, b) > 160) {
      const mid = HUBS.find((h) => h.id === 'hall_mid') || HUBS[2];
      if (mid !== a && mid !== b) path.push({ x: mid.x, y: mid.y });
    }
    path.push({ x: b.x, y: b.y });
  }
  path.push({ x: to.x, y: to.y });
  return path;
}

export class Actor {
  constructor(def, seat) {
    this.id = def.id;
    this.def = def;
    this.x = seat.x;
    this.y = seat.y;
    this.home = { x: seat.x, y: seat.y };
    this.pose = 'idle';
    this.frame = 0;
    this.frameT = 0;
    this.facing = 1;
    this.path = [];
    this.status = 'idling'; // idling | walking | working | talking
    this.bubble = null;
    this.bubbleT = 0;
    this.glow = false;
    this.carrying = false;
    this.visible = true;
    this.animSpeed = 0.35;
  }

  setStatus(status) {
    this.status = status;
    if (status === 'working') {
      this.pose = this.def.role === 'client' ? 'talk' : 'type';
      this.glow = true;
    } else if (status === 'talking') {
      this.pose = 'talk';
      this.glow = true;
    } else if (status === 'idling') {
      this.pose = this._idlePose();
      this.glow = false;
    } else if (status === 'walking') {
      this.pose = 'walk';
      this.glow = false;
    }
  }

  _idlePose() {
    return 'idle';
  }

  say(text, duration = 2.5) {
    this.bubble = text;
    this.bubbleT = duration;
  }

  walkTo(target, onArrive) {
    const dest = typeof target === 'string' ? seatOf(target) : target;
    this.path = buildPath({ x: this.x, y: this.y }, dest);
    this._onArrive = onArrive;
    if (!this.path.length) {
      this.x = dest.x;
      this.y = dest.y;
      onArrive?.();
      return;
    }
    this.setStatus('walking');
  }

  goHome(onArrive) {
    this.walkTo(this.home, () => {
      this.setStatus('idling');
      onArrive?.();
    });
  }

  update(dt, reducedMotion) {
    this.frameT += dt;
    const interval = reducedMotion ? 999 : this.animSpeed;
    if (this.frameT >= interval) {
      this.frameT = 0;
      this.frame = (this.frame + 1) % 2;
    }

    if (this.bubbleT > 0) {
      this.bubbleT -= dt;
      if (this.bubbleT <= 0) this.bubble = null;
    }

    if (this.path.length) {
      const target = this.path[0];
      const d = dist(this, target);
      if (d < 1.5) {
        this.x = target.x;
        this.y = target.y;
        this.path.shift();
        if (!this.path.length) {
          const cb = this._onArrive;
          this._onArrive = null;
          cb?.();
        }
      } else {
        const step = WALK_SPEED * dt;
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const len = Math.hypot(dx, dy) || 1;
        this.x += (dx / len) * Math.min(step, d);
        this.y += (dy / len) * Math.min(step, d);
        if (Math.abs(dx) > 0.3) this.facing = dx >= 0 ? 1 : -1;
      }
    }
  }

  draw(ctx, sheet) {
    if (!this.visible || !sheet) return;
    const scale = 2;
    const drawX = Math.round(this.x - (sheet.w * scale) / 2);
    const drawY = Math.round(this.y - sheet.h * scale + 4);
    if (this.glow) drawGlow(ctx, this.x, this.y - 22, 28);
    drawCharFrame(ctx, sheet, this.pose, this.frame, drawX, drawY, this.facing < 0, scale);
    if (this.carrying) drawPackage(ctx, this.x + 12, this.y - 36);
    if (this.bubble) drawSpeechBubble(ctx, this.bubble, this.x, drawY);
    if (this.status === 'working' || this.status === 'talking') {
      const label = this.def.title || this.def.name;
      drawNameplate(ctx, label, this.x, this.bubble ? drawY - 36 : drawY - 14);
    }
  }
}

export function createActors(roster, seats) {
  const map = {};
  for (const def of roster) {
    const seat = seats[def.seat] || seats.door;
    map[def.id] = new Actor(def, seat);
  }
  // place client at door by default standing idle
  if (map.client) {
    map.client.pose = 'idle';
    map.client.setStatus('idling');
  }
  return map;
}
