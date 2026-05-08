// Page entry. Wires up the controls and starts the controller.

import { SimController } from './sim-controller.js';

const $ = id => document.getElementById(id);

const svg = $('viz-svg');
const eventLog = $('log-events');
const sessionLog = $('log-sessions');

const controller = new SimController({ svg, eventLog, sessionLog });

const numericInput = (id, fallback) => {
  const el = $(id);
  const v = parseInt(el.value, 10);
  return Number.isFinite(v) ? v : fallback;
};

const restart = () =>
  controller.restart({
    clientCount: Math.min(12, Math.max(2, numericInput('control-client-count', 5))),
    latencyMs: Math.min(2000, Math.max(0, numericInput('control-latency', 50))),
  });

$('control-restart').addEventListener('click', () => {
  restart().catch(err => console.error(err));
});

$('control-kickoff').addEventListener('click', () => {
  controller.kickoff({
    chainLength: Math.min(20, Math.max(1, numericInput('control-chain-length', 6))),
  });
});

$('control-flush').addEventListener('click', () => {
  controller.flushRandom();
});

// Auto-start with defaults so the page does something on first load.
restart().catch(err => console.error(err));
