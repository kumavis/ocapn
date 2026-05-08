// Top-level orchestration. Owns the worker pool, the bridge, the viz,
// and the UI controls. Re-creates everything on Restart.

import { Bridge } from './bridge.js';
import { makeViz } from './visualization.js';

const HEX = '0123456789abcdef';
const randomHex = bytes => {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let out = '';
  for (const b of buf) out += HEX[b >>> 4] + HEX[b & 0x0f];
  return out;
};

const trim = (str, max) =>
  str.length <= max ? str : `${str.slice(0, max)}…`;

const nowStr = () => new Date().toLocaleTimeString();

export class SimController {
  /**
   * @param {object} opts
   * @param {SVGSVGElement} opts.svg
   * @param {HTMLElement} opts.eventLog
   * @param {HTMLElement} opts.sessionLog
   */
  constructor({ svg, eventLog, sessionLog }) {
    this.svg = svg;
    this.eventLog = eventLog;
    this.sessionLog = sessionLog;
    this.viz = makeViz(svg);
    this.bridge = null;
    this.workers = [];          // [{ designator, worker, ready }]
    this.designators = [];
    /** @type {Map<string, Set<string>>} */
    this.peersOfWorker = new Map(); // designator -> Set<peerDesignator> from snapshots
    /** @type {Map<string, number>} */
    this.activityScore = new Map(); // edgeKey -> last activity timestamp
    this.busyDesignators = new Set();
    this.traceCounter = 0;
  }

  log(line) {
    const ts = nowStr();
    this.eventLog.textContent =
      `[${ts}] ${line}\n` + this.eventLog.textContent;
    if (this.eventLog.textContent.length > 8000) {
      this.eventLog.textContent = this.eventLog.textContent.slice(0, 8000);
    }
  }

  edgeKey(a, b) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  async restart({ clientCount, latencyMs }) {
    if (this.bridge) {
      this.bridge.shutdown();
      this.bridge = null;
    }
    this.workers = [];
    this.peersOfWorker = new Map();
    this.activityScore = new Map();
    this.busyDesignators = new Set();
    this.designators = Array.from({ length: clientCount }, () => randomHex(8));
    this.bridge = new Bridge();
    this.bridge.onUnknownMessage = ({ from, msg }) =>
      this.handleWorkerMessage(from, msg);

    const readyPromises = [];
    for (const designator of this.designators) {
      const worker = new Worker(new URL('./worker.js', import.meta.url), {
        type: 'module',
      });
      this.bridge.add(designator, worker);
      this.workers.push({ designator, worker });
      readyPromises.push(
        new Promise(resolve => {
          const onMsg = ev => {
            if (ev.data?.type === 'sim/ready') {
              worker.removeEventListener('message', onMsg);
              resolve();
            }
          };
          worker.addEventListener('message', onMsg);
        }),
      );
      worker.postMessage({
        type: 'sim/init',
        designator,
        peerDesignators: this.designators,
        latencyMs,
      });
    }

    this.log(`Spawning ${clientCount} workers (latency=${latencyMs}ms)…`);
    await Promise.all(readyPromises);
    this.log('All workers ready.');
    this.renderViz();
  }

  handleWorkerMessage(from, msg) {
    switch (msg.type) {
      case 'sim/snapshot': {
        const set = new Set(msg.peers.map(p => p.designator));
        this.peersOfWorker.set(from, set);
        this.renderViz();
        break;
      }
      case 'sim/event': {
        const { event, detail } = msg;
        if (event === 'forward-sent') {
          this.viz.pulse(from, detail.to, 600);
          this.activityScore.set(this.edgeKey(from, detail.to), Date.now());
          this.busyDesignators.add(from);
          this.busyDesignators.add(detail.to);
          setTimeout(() => {
            this.busyDesignators.delete(from);
            this.busyDesignators.delete(detail.to);
            this.renderViz();
          }, 1500);
        } else if (event === 'forward-received') {
          this.busyDesignators.add(from);
          setTimeout(() => {
            this.busyDesignators.delete(from);
            this.renderViz();
          }, 1500);
        } else if (event === 'flush-start') {
          this.log(`flush start: ${trim(from, 6)} → ${detail.slot} on ${trim(detail.peer, 6)}`);
        } else if (event === 'flush-done') {
          this.log(`flush done: ${trim(from, 6)} → ${detail.slot} on ${trim(detail.peer, 6)}`);
        } else if (event === 'flush-failed') {
          this.log(`flush failed: ${trim(from, 6)}: ${detail.err}`);
        }
        break;
      }
      case 'sim/log': {
        this.log(`[${trim(from, 6)}] ${msg.args.join(' ')}`);
        break;
      }
      case 'sim/kickoff-result':
      case 'sim/flush-result': {
        if (msg.error) {
          this.log(`${msg.type.replace('sim/', '')} (${trim(from, 6)}): error ${msg.error}`);
        } else {
          this.log(`${msg.type.replace('sim/', '')} (${trim(from, 6)}): ${JSON.stringify(msg.result)}`);
        }
        break;
      }
      default:
        break;
    }
  }

  renderViz() {
    const sessions = new Set();
    for (const [from, peers] of this.peersOfWorker) {
      for (const peer of peers) {
        sessions.add(this.edgeKey(from, peer));
      }
    }
    // "active" = had recent forward traffic
    const active = new Set();
    const now = Date.now();
    for (const [key, ts] of this.activityScore) {
      if (now - ts < 3000) active.add(key);
    }
    this.viz.render({
      designators: this.designators,
      sessions,
      active,
      busyDesignators: this.busyDesignators,
    });
    // Sessions log
    const lines = [];
    for (const designator of this.designators) {
      const peers = Array.from(this.peersOfWorker.get(designator) ?? [])
        .map(p => trim(p, 6));
      lines.push(`${trim(designator, 6)} : [${peers.join(', ')}]`);
    }
    this.sessionLog.textContent = lines.join('\n');
  }

  kickoff({ chainLength }) {
    if (this.workers.length === 0) {
      this.log('no workers; press Restart first');
      return;
    }
    const idx = Math.floor(Math.random() * this.workers.length);
    const target = this.workers[idx];
    const traceId = ++this.traceCounter;
    this.log(`kickoff #${traceId}: ${trim(target.designator, 6)} forward(${chainLength})`);
    target.worker.postMessage({
      type: 'sim/kickoff',
      chainLength,
      traceId,
    });
  }

  flushRandom() {
    if (this.workers.length === 0) {
      this.log('no workers; press Restart first');
      return;
    }
    // Try every worker; the first one with an imported promise wins.
    const idx = Math.floor(Math.random() * this.workers.length);
    const target = this.workers[idx];
    const traceId = ++this.traceCounter;
    this.log(`flush-random #${traceId}: ${trim(target.designator, 6)}`);
    target.worker.postMessage({ type: 'sim/flush-random', traceId });
  }
}
