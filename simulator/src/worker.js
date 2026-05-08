// Worker entrypoint. One worker hosts one OCapN client.
//
// Lifecycle:
//   1. Main thread postMessages { type: 'sim/init', designator, peerDesignators, latencyMs }.
//   2. Worker calls SES `lockdown`, registers the simulator netlayer
//      with the supplied designator, and registers a `forward`
//      sturdyref bound to the local Forwarder.
//   3. Worker postMessages { type: 'sim/ready', location }.
//   4. Main thread can later send:
//        - sim/kickoff       { chainLength, traceId }
//        - sim/flush-random  { traceId }
//        - sim/shutdown
//      and receives results / status reports.
//
// The netlayer brokers MessagePort pairs through the main thread; see
// sim-netlayer.js for the wire protocol with the bridge.

import 'ses';

// Fail loud if the host doesn't allow the SES sloppy `lockdown` we need.
// `errorTaming: 'unsafe'` keeps stack traces useful for debugging.
lockdown({
  errorTaming: 'unsafe',
  consoleTaming: 'unsafe',
  overrideTaming: 'severe',
  domainTaming: 'unsafe',
});

import harden from '@endo/harden';
import { Far } from '@endo/marshal';
import { E, HandledPromise } from '@endo/eventual-send';
import {
  makeClient,
  encodeSwissnum,
  locationToLocationId,
} from '@endo/ocapn';

import { makeSimNetlayerFactory } from './sim-netlayer.js';

const SWISSNUM_FORWARD = 'forward';

/** @type {string} */
let myDesignator;
/** @type {string[]} */
let peerDesignators = [];
let latencyMs = 50;
let client;
let netlayer;

const log = (...args) => {
  postMessage({ type: 'sim/log', from: myDesignator, args: args.map(String) });
};
const reportEvent = (event, detail = {}) => {
  postMessage({ type: 'sim/event', from: myDesignator, event, detail });
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = () => Math.floor(Math.random() * 1000);

/** @type {Map<string, Promise<any>>} */
const remoteForwarderCache = new Map();

const getRemoteForwarder = peerDesignator => {
  let cached = remoteForwarderCache.get(peerDesignator);
  if (cached) return cached;
  const peerLocation = harden({
    type: 'ocapn-peer',
    transport: 'simworker',
    designator: peerDesignator,
    hints: harden({}),
  });
  const sturdyRef = client.makeSturdyRef(
    peerLocation,
    encodeSwissnum(SWISSNUM_FORWARD),
  );
  cached = client.enlivenSturdyRef(sturdyRef);
  remoteForwarderCache.set(peerDesignator, cached);
  cached.catch(err => {
    log('enlivenSturdyRef failed', String(err));
    remoteForwarderCache.delete(peerDesignator);
  });
  return cached;
};

const pickRandomPeer = () => {
  if (peerDesignators.length === 0) return undefined;
  const idx = Math.floor(Math.random() * peerDesignators.length);
  return peerDesignators[idx];
};

/**
 * The Forwarder object exposed at swissnum 'forward'. forward(N):
 *   - sleep 0-1s (simulating "do some work")
 *   - if N <= 0, return ['done@<me>']  (wrapped in array per [p] workaround)
 *   - pick a random peer, enliven its forwarder
 *   - sleep 0-1s
 *   - call peer.forward(N - 1) and return [answerPromise]
 *
 * The wrap in `harden([answerPromise])` matters: returning a bare promise
 * from an async function gets awaited and serialized as the *settled*
 * value, which collapses the chain. Wrapping it in an array forces the
 * marshal layer to emit it as a `desc:import-promise`, preserving the
 * shortening opportunity that `op:flush` exists to exploit.
 */
const makeForwarder = () => Far('Forwarder', {
  forward: async (n) => {
    reportEvent('forward-received', { n });
    await sleep(randomDelay());
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) {
      return harden([`done@${myDesignator.slice(0, 8)}`]);
    }
    const peer = pickRandomPeer();
    if (peer === undefined) {
      return harden([`no-peers@${myDesignator.slice(0, 8)}`]);
    }
    let remote;
    try {
      remote = await getRemoteForwarder(peer);
    } catch (err) {
      reportEvent('forward-enliven-failed', { peer, err: String(err) });
      throw err;
    }
    await sleep(randomDelay());
    reportEvent('forward-sent', { to: peer, n: n - 1 });
    // `[answer]` keeps the answer as a desc:import-promise so the chain
    // is observable.
    const answer = E(remote).forward(n - 1);
    return harden([answer]);
  },
});

const makeMainBridge = () => harden({
  postToMain: (msg, transfer) => {
    if (transfer) {
      postMessage(msg, transfer);
    } else {
      postMessage(msg);
    }
  },
  onMainMessage: handler => {
    addEventListener('message', ev => {
      const msg = ev.data;
      // Only forward netlayer-targeted messages to the netlayer.
      if (msg && typeof msg.type === 'string' && msg.type.startsWith('sim/')) {
        if (
          msg.type === 'sim/incoming-port' ||
          msg.type === 'sim/outgoing-port' ||
          msg.type === 'sim/connect-failed'
        ) {
          handler(msg);
        }
      }
    });
  },
});

const setupClient = async () => {
  client = makeClient({
    debugLabel: `worker-${myDesignator.slice(0, 6)}`,
    verbose: false,
    debugMode: true,
  });
  client.registerSturdyRef(SWISSNUM_FORWARD, makeForwarder());
  netlayer = await client.registerNetlayer(
    makeSimNetlayerFactory({
      designator: myDesignator,
      getLatencyMs: () => latencyMs,
      mainBridge: makeMainBridge(),
    }),
  );
};

/**
 * Walk the [p] wrap. The chain returns `[innerPromise]`; we await
 * the array, then unwrap once. We follow the chain by repeatedly
 * unwrapping until we reach a leaf string.
 *
 * The traversal is bounded so we don't loop on a buggy peer.
 *
 * @param {any} initial
 * @param {number} maxDepth
 */
const drainForwardAnswer = async (initial, maxDepth) => {
  let cursor = initial;
  for (let i = 0; i < maxDepth + 4; i += 1) {
    const arr = await cursor;
    if (!Array.isArray(arr) || arr.length === 0) {
      return arr;
    }
    cursor = arr[0];
    if (typeof cursor === 'string') return cursor;
  }
  return '<truncated>';
};

const reportSnapshot = () => {
  // Map active sessions and approximate "exports beyond bootstrap"
  // for each peer. The OcapnTable doesn't expose iteration, so we
  // approximate via a counter tied to message subscription. We expose
  // the active peer set; the main thread combines that with its own
  // observation of forward activity to decide which edges to highlight.
  const peers = [];
  if (client?._debug) {
    for (const peer of peerDesignators) {
      const peerLocation = harden({
        type: 'ocapn-peer',
        transport: 'simworker',
        designator: peer,
        hints: harden({}),
      });
      const session = client._debug.sessionManager.getActiveSession(
        locationToLocationId(peerLocation),
      );
      if (session) {
        peers.push({ designator: peer });
      }
    }
  }
  postMessage({ type: 'sim/snapshot', from: myDesignator, peers });
};

let snapshotTimer;
const startSnapshotLoop = () => {
  stopSnapshotLoop();
  snapshotTimer = setInterval(reportSnapshot, 500);
};
const stopSnapshotLoop = () => {
  if (snapshotTimer !== undefined) {
    clearInterval(snapshotTimer);
    snapshotTimer = undefined;
  }
};

addEventListener('message', async ev => {
  const msg = ev.data;
  if (!msg || typeof msg.type !== 'string') return;
  try {
    if (msg.type === 'sim/init') {
      myDesignator = msg.designator;
      peerDesignators = (msg.peerDesignators || []).filter(
        d => d !== myDesignator,
      );
      latencyMs = msg.latencyMs ?? 50;
      await setupClient();
      startSnapshotLoop();
      postMessage({
        type: 'sim/ready',
        from: myDesignator,
        location: { ...netlayer.location },
      });
    } else if (msg.type === 'sim/update-peers') {
      peerDesignators = (msg.peerDesignators || []).filter(
        d => d !== myDesignator,
      );
      latencyMs = msg.latencyMs ?? latencyMs;
    } else if (msg.type === 'sim/kickoff') {
      const { chainLength, traceId } = msg;
      reportEvent('kickoff', { chainLength });
      try {
        const local = makeForwarder();
        const startPromise = E(local).forward(chainLength);
        const result = await drainForwardAnswer(startPromise, chainLength);
        postMessage({
          type: 'sim/kickoff-result',
          from: myDesignator,
          traceId,
          result,
        });
      } catch (err) {
        postMessage({
          type: 'sim/kickoff-result',
          from: myDesignator,
          traceId,
          error: String(err),
        });
      }
    } else if (msg.type === 'sim/flush-random') {
      const { traceId } = msg;
      const result = await flushRandomPromise();
      postMessage({
        type: 'sim/flush-result',
        from: myDesignator,
        traceId,
        result,
      });
    } else if (msg.type === 'sim/shutdown') {
      stopSnapshotLoop();
      try { client?.shutdown(); } catch {}
    }
  } catch (err) {
    log('worker top-level error', String(err));
  }
});

const flushRandomPromise = async () => {
  // Best-effort: walk our active sessions, ask each ocapn instance's
  // debug API for any imported promises (slot 'p-…'), pick one at
  // random, and call flushExport on it. The OcapnTable doesn't expose
  // an iterator so we have to peek at internals through `_debug`.
  if (!client?._debug) return { ok: false, reason: 'no debug api' };
  const candidates = [];
  for (const peer of peerDesignators) {
    const peerLocation = harden({
      type: 'ocapn-peer',
      transport: 'simworker',
      designator: peer,
      hints: harden({}),
    });
    const session = client._debug.sessionManager.getActiveSession(
      locationToLocationId(peerLocation),
    );
    if (!session) continue;
    const ocapnDebug = session.ocapn._debug;
    if (!ocapnDebug) continue;
    const table = ocapnDebug.ocapnTable;
    // Probe positions 0..32 for an imported promise. The bootstrap
    // sits at o-0; promises start their numbering at p-0 typically.
    for (let pos = 0n; pos < 64n; pos += 1n) {
      const slot = `p-${pos}`;
      const value = table.getValueForSlot(slot);
      if (value !== undefined) {
        candidates.push({ peer, slot, value, ocapnDebug });
      }
    }
  }
  if (candidates.length === 0) {
    return { ok: false, reason: 'no imported promises' };
  }
  const choice = candidates[Math.floor(Math.random() * candidates.length)];
  reportEvent('flush-start', { peer: choice.peer, slot: choice.slot });
  try {
    await choice.ocapnDebug.flushExport(choice.value);
    reportEvent('flush-done', { peer: choice.peer, slot: choice.slot });
    return { ok: true, peer: choice.peer, slot: choice.slot };
  } catch (err) {
    reportEvent('flush-failed', {
      peer: choice.peer,
      slot: choice.slot,
      err: String(err),
    });
    return { ok: false, reason: String(err) };
  }
};
