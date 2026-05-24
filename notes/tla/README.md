# TLA+ model: two-party promise resolution + optional shortening

A small TLA+ specification that models the two-party promise pipelining
scenario discussed in [`notes/message-ordering.md`](../message-ordering.md)
and demonstrates, by exhaustive model-checking, that **end-to-end
reference FIFO falls out of per-pair vat-to-vat FIFO alone — except when
the protocol admits promise shortening to a local target**, in which
case the model checker produces a concrete race trace.

This spec covers only the simplest "promise resolves to a remotable
reference on one of the two existing vats" case. It does **not** model
promise-resolves-to-promise (chain shortening / Tribble 4-way), 3-vat
introductions, joins, or partition.

## The scenario

Two vats — Alice and Bob — with per-pair FIFO channels `chanAB` and
`chanBA`. Alice calls Bob; the answer is a promise P that Bob will
resolve. Alice pipelines messages on P with monotonically increasing
sequence numbers. We track the order in which those messages arrive at
OBJ, the final target of P.

Two parameters select the scenario:

| Constant  | Values             | Meaning                                          |
|-----------|--------------------|--------------------------------------------------|
| `TARGET`  | `"A"` or `"B"`     | which vat hosts OBJ (the resolution target)      |
| `SHORTEN` | `TRUE` or `FALSE`  | does Alice take a direct path post-resolution    |

## Predicted truth table

| `TARGET` | `SHORTEN` | `EndToEndFIFO`             | Why                                                                       |
|----------|-----------|----------------------------|---------------------------------------------------------------------------|
| `"A"`    | `FALSE`   | **holds**                  | Every send rides A→B→A; per-channel FIFO orders them at OBJ.              |
| `"A"`    | `TRUE`    | **violated**               | Post-resolution local sends race past in-flight pipelined predecessors.   |
| `"B"`    | `FALSE`   | **holds**                  | Every send rides A→B; Bob delivers locally to OBJ in receive order.       |
| `"B"`    | `TRUE`    | **holds**                  | Shortening to a ref-on-B doesn't change the wire path (still A→B).        |

The `TARGET = "B"` rows are the analog of the `sameConnection` fast-path
in E-on-Java's [`DelayedRedirector.run`][delayed-redirector] and of
Cap'n Proto's "skip-Disembargo-if-same-vat" optimization: when the
resolution target shares a vat with the resolver, no path switch
happens, so no synchronization is needed.

## Files

| File                                 | Contents                                              |
|--------------------------------------|-------------------------------------------------------|
| `PromiseShortening.tla`              | The TLA+ spec (single module, ~9 actions)             |
| `MC_TargetA_NoShorten.cfg`           | Model config: `TARGET="A"`, `SHORTEN=FALSE`           |
| `MC_TargetA_Shorten.cfg`             | Model config: `TARGET="A"`, `SHORTEN=TRUE` (race)     |
| `MC_TargetB_NoShorten.cfg`           | Model config: `TARGET="B"`, `SHORTEN=FALSE`           |
| `MC_TargetB_Shorten.cfg`             | Model config: `TARGET="B"`, `SHORTEN=TRUE`            |
| `counterexample-target-a-shorten.txt`| Saved TLC trace of the minimal violating run          |

## How to run

You need `tla2tools.jar` (TLC v2.x). One way:

```bash
mkdir -p ~/tla
curl -sSL -o ~/tla/tla2tools.jar \
  https://github.com/tlaplus/tlaplus/releases/latest/download/tla2tools.jar
```

Then, from this directory:

```bash
for cfg in MC_TargetA_NoShorten MC_TargetA_Shorten \
           MC_TargetB_NoShorten MC_TargetB_Shorten; do
  echo "=========== $cfg ==========="
  java -cp ~/tla/tla2tools.jar tlc2.TLC \
       -workers auto -config "$cfg.cfg" PromiseShortening.tla \
    | grep -E "Error|Invariant|Model checking completed|states generated"
  echo
done
```

Expected (with `NumMessages = 3`):

```
=========== MC_TargetA_NoShorten ===========
Model checking completed. No error has been found.
133 states generated, 65 distinct states found, 0 states left on queue.

=========== MC_TargetA_Shorten ===========
Error: Invariant EndToEndFIFO is violated.
...

=========== MC_TargetB_NoShorten ===========
Model checking completed. No error has been found.
103 states generated, 50 distinct states found, 0 states left on queue.

=========== MC_TargetB_Shorten ===========
Model checking completed. No error has been found.
103 states generated, 50 distinct states found, 0 states left on queue.
```

Note that the `MC_TargetB_*` runs explore the same 50 distinct states
with `SHORTEN = TRUE` as with `SHORTEN = FALSE` — confirming that the
shortening branch is, by construction, observationally a no-op when the
resolution target is on Bob.

## What this does and doesn't prove

**What it shows.** Under the modeled assumptions — two vats, per-pair
FIFO channels, single-sender pipelining, the resolution is to a single
remotable reference on one of the two existing vats — the only ordering
hazard for end-to-end reference FIFO is **the protocol decision to
short-circuit post-resolution sends to a local target**. The same model
that admits the race in one configuration excludes it in the other three
by per-channel FIFO alone.

**What it doesn't show.**

- **Cross-sender forks (Tribble 3-vat / WormholeOp scenario).** Not
  modeled. End-to-end reference FIFO is strictly weaker than full
  E-Order; this spec only addresses the former.
- **Chain shortening** (promise-resolves-to-promise, the Tribble 4-way
  race). Not modeled. The resolution target here is always a remotable
  reference, never another promise.
- **Three-party introductions.** Not modeled.
- **Partition / disconnection.** Not modeled.
- **The fix.** This spec shows the bug; it does not encode any of
  `DelayedRedirector`, `Disembargo`/`senderLoopback`, Waterken's `Flush`
  task, or `op:flush`. Adding any of those would close the
  `MC_TargetA_Shorten` violation, but is left for a follow-on spec.

## Pointers

- `notes/message-ordering.md` — full background on the ordering tiers
  and where each protocol sits
- `notes/issue-11-promise-shortening.md` — design notes from the OCapN
  shortening discussion
- E-on-Java's [`DelayedRedirector`][delayed-redirector] — the
  implementation-level fix for the violation this spec demonstrates
- Cap'n Proto's [`Disembargo` comments][capnp-disembargo] in `rpc.capnp`
  for the equivalent fix there

[delayed-redirector]: https://github.com/kpreid/e-on-java/blob/a0b3b599cf267b3138eea5f5fb83f27cebd28373/src/jsrc/org/erights/e/elib/ref/DelayedRedirector.java
[capnp-disembargo]: https://github.com/capnproto/capnproto/blob/09a8406f1f26ea7fc49ca72c77987ee28fda0620/c%2B%2B/src/capnp/rpc.capnp#L693-L758
