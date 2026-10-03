/** Soft WebAudio office SFX — no external files required. */

export function createSfx() {
  let ctx = null;
  let muted = true;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type = 'sine', gain = 0.04) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.connect(g);
    g.connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + dur);
  }

  return {
    setMuted(v) {
      muted = v;
    },
    play(name) {
      if (muted) return;
      switch (name) {
        case 'door':
          tone(180, 0.12, 'triangle', 0.05);
          setTimeout(() => tone(140, 0.18, 'triangle', 0.04), 80);
          break;
        case 'keyboard':
          tone(520 + Math.random() * 80, 0.04, 'square', 0.02);
          break;
        case 'machine':
          tone(90, 0.3, 'sawtooth', 0.03);
          setTimeout(() => tone(120, 0.2, 'sawtooth', 0.025), 150);
          break;
        case 'paper':
          tone(320, 0.08, 'triangle', 0.035);
          setTimeout(() => tone(280, 0.1, 'triangle', 0.03), 60);
          break;
        default:
          break;
      }
    },
  };
}
