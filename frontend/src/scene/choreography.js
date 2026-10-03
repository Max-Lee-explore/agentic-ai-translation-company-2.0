/**
 * Maps pipeline NDJSON events → staged office choreography.
 * Instant backend steps still play for a readable minimum duration.
 */

import { TEAM_MEMBERS } from './world/roster';
import { SEATS } from './world/layout';

export const MIN = {
  briefing: 2800,
  chunking: 1800,
  analyse: 1200,
  bind: 1500,
  deliver: 2500,
};

const IDLE_CAPTION = 'The office is open. Place an order above to watch the team at work.';

function wait(ms, reduced) {
  return new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 400) : ms));
}

export class Choreographer {
  constructor({ actors, playSfx, onDelivered, getReducedMotion }) {
    this.actors = actors;
    this.playSfx = playSfx;
    this.onDelivered = onDelivered;
    this.getReducedMotion = getReducedMotion;
    this.queue = [];
    this.busy = false;
    this.assignedWorkers = [];
    this.teamId = null;
    this.hasGlossary = false;
    this.briefText = '';
    this.machineActive = false;
    this.bindActive = false;
    this.packageAtDoor = false;
    this.stageLabel = IDLE_CAPTION;
    this.resetToken = 0;
  }

  get reduced() {
    return this.getReducedMotion?.() ?? false;
  }

  reset() {
    this.resetToken += 1;
    this.queue = [];
    this.busy = false;
    this.assignedWorkers = [];
    this.teamId = null;
    this.hasGlossary = false;
    this.briefText = '';
    this.machineActive = false;
    this.bindActive = false;
    this.packageAtDoor = false;
    this.stageLabel = IDLE_CAPTION;
    for (const a of Object.values(this.actors)) {
      a.path = [];
      a._onArrive = null;
      a.bubble = null;
      a.carrying = false;
      a.glow = false;
      a.x = a.home.x;
      a.y = a.home.y;
      a.setStatus('idling');
    }
    if (this.actors.client) {
      this.actors.client.x = SEATS.door.x;
      this.actors.client.y = SEATS.door.y;
      this.actors.client.home = { ...SEATS.door };
    }
  }

  dispatch(ev) {
    if (!ev || !ev.type) return;
    if (ev.type === 'reset') {
      this.reset();
      return;
    }
    this.queue.push(ev);
    this._pump();
  }

  async _pump() {
    if (this.busy) return;
    this.busy = true;
    const token = this.resetToken;
    while (this.queue.length && token === this.resetToken) {
      const ev = this.queue.shift();
      try {
        await this._handle(ev, token);
      } catch {
        /* ignore choreography errors */
      }
    }
    this.busy = false;
  }

  async _handle(ev, token) {
    if (token !== this.resetToken) return;
    const A = this.actors;
    const red = this.reduced;

    switch (ev.type) {
      case 'client_arrives': {
        this.briefText = ev.brief || 'Hello — I have a document to translate.';
        this.stageLabel = 'Client is briefing the Manager…';
        this.playSfx?.('door');
        await new Promise((resolve) => {
          A.client.walkTo('manager_guest', resolve);
        });
        if (token !== this.resetToken) return;
        A.client.setStatus('talking');
        A.manager.setStatus('talking');
        A.client.say(this.briefText.slice(0, 40) || 'I need this translated, please.', 2.8);
        A.manager.say('Welcome! Let me take a look…', 2.4);
        await wait(MIN.briefing, red);
        break;
      }

      case 'job_received': {
        this.hasGlossary = !!ev.has_glossary;
        break;
      }

      case 'chunking_started': {
        this.machineActive = true;
        this.stageLabel = 'Chunk-o-matic is slicing the manuscript…';
        this.playSfx?.('machine');
        A.manager.setStatus('working');
        A.client.setStatus('idling');
        A.client.walkTo('door_wait', () => A.client.setStatus('idling'));
        this._chunkStartedAt = performance.now();
        break;
      }

      case 'chunking_done': {
        const elapsed = performance.now() - (this._chunkStartedAt || performance.now());
        const remain = Math.max(0, MIN.chunking - elapsed);
        await wait(remain, red);
        if (token !== this.resetToken) return;
        this.machineActive = false;
        break;
      }

      case 'analysis_started': {
        this.stageLabel = 'Manager is analysing style & domain…';
        A.manager.setStatus('working');
        A.manager.say('Analysing style & domain…', 2);
        await wait(MIN.analyse * 0.4, red);
        break;
      }

      case 'analysis_done': {
        this.teamId = ev.team_id;
        this.assignedWorkers = ev.workers?.length ? [...ev.workers] : TEAM_MEMBERS[ev.team_id] || ['master'];
        this.stageLabel =
          ev.team_id === 'master' ? 'Master Translator is on the job.' : `${ev.team_name} is translating…`;
        A.manager.setStatus('talking');
        A.manager.say(
          ev.team_id === 'master' ? 'Assigning the Master Translator.' : `Assigning ${ev.team_name}.`,
          2.2,
        );
        await wait(900, red);
        if (token !== this.resetToken) return;
        A.manager.setStatus('idling');
        for (const id of this.assignedWorkers) {
          if (A[id]) A[id].setStatus('working');
        }
        this.playSfx?.('keyboard');
        break;
      }

      case 'translate_started': {
        const w = A[ev.worker];
        if (w) {
          w.setStatus('working');
          w.glow = true;
        }
        break;
      }

      case 'translate_done':
        break;

      case 'review_started':
      case 'improve_started': {
        this.stageLabel = ev.type === 'review_started' ? 'Editor is reviewing…' : 'Editor is revising…';
        A.editor.setStatus('working');
        A.editor.say(ev.type === 'review_started' ? 'Reviewing…' : 'Revising…', 1.6);
        this.playSfx?.('keyboard');
        break;
      }

      case 'improve_done':
        break;

      case 'terms_started': {
        this.stageLabel = 'Terminologist is checking the glossary…';
        for (const id of this.assignedWorkers) {
          if (A[id]) A[id].setStatus('idling');
        }
        A.editor.setStatus('idling');
        A.terminologist.setStatus('working');
        A.terminologist.say('Checking terms…', 1.8);
        break;
      }

      case 'terms_done':
        break;

      case 'binding_started': {
        this.stageLabel = 'Reception is wrapping the bound document…';
        for (const id of this.assignedWorkers) {
          if (A[id]) A[id].setStatus('idling');
        }
        A.editor.setStatus('idling');
        A.terminologist.setStatus('idling');
        this.bindActive = true;
        A.receptionist.setStatus('working');
        A.receptionist.say('Binding the pages…', 1.5);
        this.playSfx?.('paper');
        await wait(MIN.bind, red);
        break;
      }

      case 'binding_done': {
        this.bindActive = false;
        break;
      }

      case 'completed': {
        this.bindActive = false;
        this.stageLabel = 'Receptionist is delivering the package…';
        this.playSfx?.('paper');
        A.receptionist.setStatus('walking');
        A.receptionist.carrying = true;
        A.receptionist.say('Your package is ready!', 2);
        await new Promise((resolve) => {
          A.receptionist.walkTo('door', resolve);
        });
        if (token !== this.resetToken) return;
        A.receptionist.carrying = false;
        this.packageAtDoor = true;
        this.stageLabel = 'Package delivered to the client at the door.';
        A.client.setStatus('talking');
        A.client.say('Thank you!', 2);
        A.receptionist.say('Pleasure!', 1.5);
        await wait(MIN.deliver * 0.55, red);
        if (token !== this.resetToken) return;
        this.packageAtDoor = false;
        this.stageLabel = 'Job complete. Download your file above.';
        A.receptionist.goHome(() => A.receptionist.setStatus('idling'));
        A.client.setStatus('idling');
        this.onDelivered?.();
        break;
      }

      case 'error': {
        this.machineActive = false;
        this.bindActive = false;
        this.stageLabel = 'Something went wrong in the office.';
        for (const a of Object.values(A)) {
          a.carrying = false;
          a.setStatus('idling');
        }
        A.manager.say('Oh no — something went wrong.', 3);
        break;
      }

      default:
        break;
    }
  }
}
