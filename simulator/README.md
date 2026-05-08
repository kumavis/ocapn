# OCapN promise-shortening simulator

A browser-based playground for experimenting with promise-shortening
scenarios on top of `@endo/ocapn` from the
[`claude/implement-ocapn-flush-iisn9`](https://github.com/endojs/endo/tree/claude/implement-ocapn-flush-iisn9)
branch (the prototype that adds `op:flush` / `op:flush-done`).

The simulator runs `N` OCapN clients in web workers, connected through a
custom MessagePort-based netlayer with simulated latency. Each client
exposes a single sturdy ref `forward` that, on receipt of `forward(N)`,
sleeps a random fraction of a second, picks a random peer, sleeps again,
calls that peer's `forward(N - 1)`, and returns the answer wrapped in
`harden([answerPromise])`. The `[p]` wrapper is the same workaround used
in the package's `flush.test.js`: returning a bare promise from an async
function would let the marshal layer await it before serializing,
collapsing the chain rather than letting it propagate as a
`desc:import-promise`.

## Quick start

```sh
cd simulator
npm install
npm run dev
```

The first run downloads the `@endo/ocapn` source tree from the flush
branch into `vendor/@endo/ocapn`. See
`scripts/fetch-ocapn.mjs` for the file list and the small set of
patches applied:

- `node:crypto` → a WebCrypto-based `randomBytes` shim.
- `@endo/hex` → a six-line shim (the upstream package isn't published).
- `bootstrap.deposit-gift` accepts `passStyle === 'promise'` so a
  third-party handoff of an unresolved promise can succeed. Without
  this, the second hop in a forwarder chain rejects with "Gift must be
  remotable" the moment the answer-promise needs to be delivered to a
  third party.

Re-run with `node scripts/fetch-ocapn.mjs --force` to refresh.

## Layout

```
simulator/
  index.html
  package.json
  vite.config.js
  scripts/
    fetch-ocapn.mjs        downloads + patches @endo/ocapn
  src/
    main.js                page bootstrap
    sim-controller.js      worker pool, viz state, UI wiring
    bridge.js              brokers MessagePort pairs between workers
    visualization.js       SVG rendering of clients/sessions/flow
    sim-netlayer.js        custom netlayer (transport: 'simworker')
    worker.js              per-worker entry: SES, ocapn client, Forwarder
    styles.css
  vendor/                  generated; gitignored
```

## Wire protocol with the worker

Each worker hosts one `@endo/ocapn` client. The main thread brokers
`MessagePort` pairs in response to the worker's outgoing connections:

```
worker → main : { type: 'sim/connect', toDesignator }
main   → worker (peer A) : { type: 'sim/outgoing-port', toDesignator, port }
main   → worker (peer B) : { type: 'sim/incoming-port', peerDesignator, port }
```

After that, the two ports carry application bytes
(`{ kind: 'data', bytes }`) directly, with each side's netlayer
applying the user-configured per-write latency.

## Visualization

- One circle per worker, labelled with the first hex bytes of its
  designator.
- A solid edge between two circles means an active OCapN session
  (the workers have completed handshake; the export tables on each
  side hold at least the bootstrap plus one additional reference once
  any forward traffic begins).
- Dashed = idle session, solid blue = recent forward traffic.
- The blue ring on a node = currently busy serving or initiating
  a `forward(N)`.
- Small dots animate from sender to receiver each time a `forward`
  call is dispatched.

## Controls

- **Restart** — tear down all workers and bring up a fresh ring.
- **Kick off random chain** — pick a random worker and call its
  local `forward(<length>)`.
- **Flush a random imported promise** — pick a random worker that
  has at least one `desc:import-promise` open and invoke the debug
  `flushExport()` on it. The exporter swaps in a fresh local promise
  at that slot and replies with `op:flush-done`. This is the same
  primitive that a future shortening implementation would invoke
  automatically as part of a 3PH; here it's exposed manually so you
  can watch the table replacement happen.

## Known limitations

- The `flushExport` API is part of the prototype branch's debug
  surface; the simulator probes positions `p-0` through `p-63` to find
  candidates rather than iterating the export table, since the public
  `OcapnTable` doesn't expose iteration.
- The "exports beyond bootstrap" indicator is approximated from the
  active-session reports a worker emits on a 500 ms timer; visually
  it lags real-time table changes.
- This is a prototype to make the proposal concrete; it is not a
  conformance test for the spec.
