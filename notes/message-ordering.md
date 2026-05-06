# Message Ordering in OCapN, CapTP-of-E, and Cap'n Proto

Research notes synthesizing how the E-family of capability-secure protocols
defines message-delivery ordering, where each protocol diverges, and how the
"Lost Resolution Bug" and WormholeOp fit in.

Primary mirrors for the Spritely thread, Cap'n Proto `rpc.capnp`, cap-talk,
and selected `ocapn/ocapn` issues live under `notes/references/` (see
`notes/references/README.md`). **erights.org** pages are not mirrored here
(canonical content is available from the usual GitHub / archive mirrors).
Remaining gap: erights.org animations and wiki-only material cited in passing
still rely on other mirrors if the live site is blocked.

---

## 1. Glossary

**Vat.** A single event-loop with a heap of objects. Within a vat, processing
is single-threaded and turn-based. Cross-vat communication is asynchronous.

**Eventual send (`<-`).** E's asynchronous message operator. `target <- verb(args)`
queues a delivery into the recipient's vat for a future turn and returns a
promise for the result. The basic unit that ordering is defined over.

**Reference.** A capability — a designator for an object that also conveys
authority to invoke it. Each promise and each presence is a reference.

**Promise.** Placeholder for a value not yet known. Resolved with a value
(possibly another promise) or broken with a reason.

**Promise pipelining.** Sending messages to a promise before it resolves. Over
the wire, the messages can be queued at the holder of the promise's
resolution, eliminating round trips.

**Granovetter introduction (3-vat).** Vat A holds references to objects in
Vats B and C; A introduces them by sending B a message that contains a
reference to C's object. The canonical three-party handoff scenario.

**Three-party handoff.** The CapTP machinery for a Granovetter introduction
across vats — getting B a usable reference to C without B and C having
previously talked.

**Gift table.** A table at the destination vat (C) holding pending
introductions, indexed by a nonce. A deposits the gift; B redeems it.

**4 Tables (CapTP).** The per-connection state in CapTP-of-E: Questions,
Answers, Imports, Exports.

**E-order.** "Two calls made on the same reference are delivered in the order
they were made." Per-reference FIFO. The headline ordering guarantee of E.

**Partial order (in CapTP).** The system-wide guarantee is only partial:
ordering is enforced per reference, not globally across references or vats.

**Point-to-point FIFO (Waterken / Tyler Close).** A weaker, simpler guarantee:
order is preserved along a single two-party connection, regardless of which
reference a message targets. Doesn't try to follow references across hops.
Mark Miller's stated current preference (Spritely thread).

**Embargo / Disembargo (Cap'n Proto).** When a promise resolves to a remote
ref, the receiver queues outbound messages on the new direct path and sends a
`Disembargo` with `senderLoopback`; once the same `Disembargo` returns with
`receiverLoopback`, the queue flushes. Forces any in-flight messages on the
old path to drain first, preserving E-order across resolution.

**Tribble 4-way race.** Named for Dean Tribble. Race in which a remote promise
P1 resolves to another remote promise P2 which simultaneously resolves to a
fourth-vat object Q. Cap'n Proto avoids this by the rule: once P resolves to
remote ref R, all further messages to P forward strictly to R, even if R
itself later resolves to Q.

**WormholeOp.** CapTP-of-E side-channel packet. The introducing vat A sends
gift information directly to the destination vat C, in parallel with the
"long path" handoff message that travels through B. C is told to "process
this data ahead of further requests from the sending vat"; redundant arrivals
(via short and long path) are deduped by sequence number.

**Lost Resolution Bug.** A class of three-party race in CapTP-of-E in which
the binding "promise → target" can be discarded mid-handoff, causing
in-flight messages addressed to the promise to be silently dropped and
E-order to be broken. Identified by Miller, Tribble, Hibbert, and Warner
(see `agoric-sdk#40`).

---

## 2. The ordering guarantee, by protocol

### 2.1 OCapN (current draft)

OCapN does not define ordering at the CapTP layer; it pushes the requirement
onto the netlayer.

- CapTP session is "two entities exchanging CapTP messages over a reliable,
  in-order OCapN Netlayer channel"
  — [`draft-specifications/CapTP Specification.md` L59-61](https://github.com/kumavis/ocapn/blob/b0a681d/draft-specifications/CapTP%20Specification.md#L59-L61).
- Netlayer requirements include "Messages should be received in the order in
  which they were sent"
  — [`draft-specifications/Netlayers.md` L28-34](https://github.com/kumavis/ocapn/blob/b0a681d/draft-specifications/Netlayers.md#L28-L34).
- Implementation guide describes the netlayer as a "bidirectional FIFO"
  — [`implementation-guide/Implementation Guide.md` L43](https://github.com/kumavis/ocapn/blob/b0a681d/implementation-guide/Implementation%20Guide.md#L43).

This is point-to-point FIFO between two peers in a single session — no
explicit per-reference E-order, no global ordering.

### 2.2 E (the language)

Per-reference FIFO on `<-`:

> "Among messages successively sent on a single reference, E guarantees fully
> order-preserving delivery. All messages are delivered in the order sent
> unless and until the reference breaks (because of partition)."
> — [erights.org: Partial Order](https://erights.org/elib/concurrency/partial-order.html)

The page is titled *Partially-Ordered Message Delivery* because the global
ordering is only partial: nothing relates the order of messages sent on
different references.

### 2.3 CapTP-of-E (Mark Miller, original)

Goal: lift E's per-reference FIFO across the network. Mechanisms:

- 4 Tables for per-connection state
  ([`4tables.html`](http://erights.org/elib/distrib/captp/4tables.html)).
- Three-party handoff for Granovetter introductions, with gift tables and
  `acceptFrom`
  ([`acceptFrom.html`](http://www.erights.org/elib/distrib/captp/acceptFrom.html)).
- WormholeOp as the A→C shortcut to keep handoffs from inverting subsequent
  messages ([`WormholeOp.html`](http://www.erights.org/elib/distrib/captp/WormholeOp.html)).
- Per Miller (Spritely thread #8): prior to the Lost Resolution Bug, E-order
  appeared to be delivered "for free" — falling out of the implementation —
  ([Conundrum: Message Ordering #8](https://community.spritely.institute/t/conundrum-message-ordering/28/8)).

When the Lost Resolution Bug surfaced, Miller retreated from end-to-end
E-order toward Tyler Close's Waterken-style point-to-point FIFO (post #9).

### 2.4 Cap'n Proto RPC (Kenton Varda)

Explicitly preserves E-order on the wire:

> "Unless otherwise specified, messages must be delivered to the receiving
> application in the same order in which they were initiated by the sending
> application."
> — [`c++/src/capnp/rpc.capnp`](https://github.com/capnproto/capnproto/blob/master/c++/src/capnp/rpc.capnp)

Mechanisms:

- **Embargo / Disembargo** for promise resolution. Two cases: loopback (P
  resolves locally) and three-party (P resolves to a third vat). In both
  cases the new direct path is embargoed until a `Disembargo` round-trip
  drains the old path.
- **Strict forward-to-R** rule for chained resolution: "Once a promise P has
  been resolved to a remote object reference R, then all further messages
  received addressed to P will be forwarded strictly to R. Even if it turns
  out later that R is itself a promise, and has resolved to some other
  object Q, messages sent to P will still be forwarded to R, not directly to
  Q." Closes the Tribble 4-way race.
- **Implementation hazard:** in C++, "E-ordering may be broken if
  `CompletableFuture` completes immediately"; the impl uses `kj::evalLater()`
  to defer all method calls into a later turn, mirroring vat-turn semantics.
- **Discussion:** [Promise Pipelining in Cap'n Proto RPC — Lobsters](https://lobste.rs/s/0ykbk6/promise_pipelining_cap_n_proto_rpc).

---

## 3. The Lost Resolution Bug

### 3.1 Caveat on definition

The phrase "Lost Resolution Bug" appears in Mark Miller's post #9 on the
Spritely "Conundrum: Message Ordering" thread (mirrored under
`notes/references/`, especially `spritely-conundrum-message-ordering-excerpts.md`)
and in Agoric's `agoric-sdk#40`. The Spritely quote is verbatim but rhetorical
(prior to that bug, E-order seemed to come “for free”); warner in the Agoric
issue still says "I won't be able to capture the full idea here" for a tight
formal spec.
Per dtribble in [ocapn/ocapn#11](https://github.com/ocapn/ocapn/issues/11),
the same family of issues is also called "**Tribble's 4-way race**"
and "the **Midori four vat promise shortening case**" — dtribble
explicitly confirms they are the same thing.

The most defensible reading is therefore: **the Lost Resolution Bug is
markm's name for the same multi-party promise-shortening ordering
race that Cap'n Proto's `rpc.capnp` calls the Tribble 4-way race.**
"Lost resolution" likely refers to the ordering of resolutions being
broken, not to a binding being discarded.

### 3.2 The scenario (per dtribble in ocapn/ocapn#11)

Four parties: A, B, C, D. A pipelines through Bob, who pipelines
through Carol, who pipelines through Derek. Each link can shorten
when the next-link's promise resolves. dtribble's writeup:

> "B forwards X to Y, resulting in the handoff. C forwards Y to Z,
> resulting in the handoff. […] Those two shortenings overlap, and
> messages could be sent on any of the X,Y,Z,R between any
> shortenings where the shortenings happen in almost any order, so
> those messages arrive at R in a broad range of orders."

The 4-vat case is irreducible — the 3-vat case doesn't have crossing
shortenings — and dtribble's view is that any implementation should
generalize the 4-vat solution rather than worry about 5, 6, etc.

### 3.3 How the descendants address it

- **Cap'n Proto:** "Forward strictly to R" rule + Embargo / Disembargo.
  Once P resolves to a remote R, P is forwarded only to R, never
  re-shortened to R's own resolution. This freezes the chain and
  sidesteps the race entirely. Receiver-side embargo serializes
  the path switchover.
- **Ridley's `op:flush` proposal (current):** Allows transitive
  shortening; each link of a long resolution chain can shorten with
  its own flush. The cost is per-link round trips; the win is the
  availability property erights motivates the issue with — once
  shortened, intermediate vats can leave the network.
- **Mark Miller's later view (per Spritely thread):** Drop end-to-end
  E-order entirely; use point-to-point FIFO. Per-(connection)
  ordering only; shortening admits reordering.

Sources for this section: [ocapn/ocapn#11](https://github.com/ocapn/ocapn/issues/11)
(specifically [dtribble's 4-vat scenario](https://github.com/ocapn/ocapn/issues/11#issuecomment-1492469923));
[agoric-sdk#40](https://github.com/Agoric/agoric-sdk/issues/40);
[PlaygroundVat limitations.md](https://github.com/agoric-labs/PlaygroundVat/blob/master/docs/limitations.md);
[Spritely Conundrum: Message Ordering #9 (markm)](https://community.spritely.institute/t/conundrum-message-ordering/28/9).

---

## 4. WormholeOp

### 4.1 What it is

CapTP-of-E side-channel packet. When Vat A sends `bob!foo(carol)` — a
three-party handoff — A also sends a WormholeOp directly to Carol's vat
(Vat C) carrying the same gift information.

> "If `dest` is the receiving vat, [the source] should try sending the
> packet's data to itself as encrypted VatTP communications originating with
> `source`, processing sequence info so that redundant packets data are
> simply ignored. The receiving vat should process this data ahead of
> processing further requests from the sending vat."
> — [WormholeOp — erights.org](http://www.erights.org/elib/distrib/captp/WormholeOp.html)

### 4.2 The handoff without WormholeOp

1. A sends `bob!foo(carol)` to B; the message carries a gift nonce.
2. B has no session with C yet; B opens one and calls `acceptFrom(C, nonce)`.
3. C looks up the gift, binds it to B, returns the reference.
4. B can now deliver `foo(carol)` and route any subsequent A-originated
   messages addressed to Carol via the new B↔C path.

The cost: every `foo(carol)` blocks on a B↔C round trip. Meanwhile A's next
message — say `carol <- bar()` — can race B's `acceptFrom`, arriving at C
before the gift has been registered. E-order is broken.

### 4.3 The handoff with WormholeOp

A sends *two* things:

- `bob!foo(<gift-nonce>)` along the long path A→B (and eventually B→C).
- A WormholeOp packet along the short path A→C, carrying the same gift info.

C "processes this data ahead of further requests" — registers the gift
immediately, so:

- B's eventual `acceptFrom(N)` succeeds with no extra round trip.
- A's next message to Carol arrives at C with the binding already in place.

Sequence numbers ensure the gift packet that arrives second (whichever path
that is) is recognized as a duplicate and ignored.

### 4.4 Relation to the Lost Resolution Bug

WormholeOp and the Lost Resolution Bug attack the same triangle (A, B, C)
from opposite directions:

- WormholeOp **pre-stages a fresh gift** at C so that the handoff
  registration is in place before subsequent messages need it. It addresses
  the "introduction" version of the race.
- Lost Resolution arises in the **promise-resolution** version of the race:
  the binding being lost is not a fresh gift but an existing
  promise→target forwarder being dismantled too eagerly.

WormholeOp doesn't fix Lost Resolution because it pre-stages a *gift table
entry*, not a *forwarder*. The forwarder lives at B (the resolver of the
promise), not at C; nothing A sends ahead of B's `Resolve` can keep B's
forwarder alive after B chooses to discard it.

### 4.5 Why the descendants don't use it

- **Cap'n Proto** drops WormholeOp entirely. Its embargo / disembargo +
  forward-strictly-to-R is a different design that solves the broader race
  (handoff *and* resolution) at the receiver, without an A→C side channel.
- **OCapN** doesn't have a WormholeOp either; it relies on netlayer FIFO and
  has not yet specified ordering behavior across handoffs — see `Implementation Guide.md`'s discussion of three-party handoffs around the
  videos in `implementation-guide/`.

Sources: [WormholeOp](http://www.erights.org/elib/distrib/captp/WormholeOp.html);
[acceptFrom()](http://www.erights.org/elib/distrib/captp/acceptFrom.html);
[3-Vat Granovetter](http://erights.org/elib/distrib/captp/3vat.html);
[PlaygroundVat limitations.md](https://github.com/agoric-labs/PlaygroundVat/blob/master/docs/limitations.md)
("ACK ... interacts with the ordering properties of three-party handoffs to
implement the WormholeOp").

---

## 5. Summary table

| Protocol | Ordering guarantee | Three-party mechanism | Promise-resolution race fix |
|---|---|---|---|
| E (in-vat) | Per-reference FIFO on `<-` | n/a | n/a (single vat) |
| CapTP-of-E | Per-reference FIFO, attempted across the wire | WormholeOp shortcut + ACK/sequencing | None robust; **Lost Resolution Bug** |
| Cap'n Proto | E-order, enforced | No WormholeOp; receiver embargoes | Embargo/Disembargo + forward-strictly-to-R (Tribble 4-way race) |
| Waterken (Tyler Close) | Point-to-point FIFO per connection | Doesn't preserve order across handoffs | Not attempted; weaker guarantee by design |
| OCapN (draft) | Point-to-point FIFO per session, delegated to netlayer | Underspecified | Underspecified |

Mark Miller's stated current preference (Spritely thread): the
Waterken-style point-to-point FIFO row, not the E-order row.

---

## 6. Sources

### OCapN (this repo)

- [`draft-specifications/CapTP Specification.md`](https://github.com/kumavis/ocapn/blob/b0a681d/draft-specifications/CapTP%20Specification.md)
- [`draft-specifications/Netlayers.md`](https://github.com/kumavis/ocapn/blob/b0a681d/draft-specifications/Netlayers.md)
- [`implementation-guide/Implementation Guide.md`](https://github.com/kumavis/ocapn/blob/b0a681d/implementation-guide/Implementation%20Guide.md)

### E and CapTP-of-E

- [erights.org: Partially-Ordered Message Delivery](https://erights.org/elib/concurrency/partial-order.html)
- [erights.org: Eventual Send Expression](http://erights.org/elang/kernel/SendExpr.html)
- [erights.org: CapTP — index](http://erights.org/elib/distrib/captp/index.html)
- [erights.org: CapTP — The 4 Tables](http://erights.org/elib/distrib/captp/4tables.html)
- [erights.org: CapTP — 3-Vat Granovetter](http://erights.org/elib/distrib/captp/3vat.html)
- [erights.org: WormholeOp](http://www.erights.org/elib/distrib/captp/WormholeOp.html)
- [erights.org: acceptFrom()](http://www.erights.org/elib/distrib/captp/acceptFrom.html)

### Cap'n Proto

- [Cap'n Proto: RPC Protocol](https://capnproto.org/rpc.html)
- [`capnproto/c++/src/capnp/rpc.capnp`](https://github.com/capnproto/capnproto/blob/master/c++/src/capnp/rpc.capnp) — Embargo, Disembargo, Tribble 4-way race comments
- [`capnproto/c++/src/capnp/rpc.c++`](https://github.com/capnproto/capnproto/blob/master/c%2B%2B/src/capnp/rpc.c%2B%2B) — embargo enforcement
- [Promise Pipelining in Cap'n Proto RPC — Lobsters discussion](https://lobste.rs/s/0ykbk6/promise_pipelining_cap_n_proto_rpc)

### The Lost Resolution Bug

- [agoric-sdk#40: deny passing Presences in arguments?](https://github.com/Agoric/agoric-sdk/issues/40)
- [PlaygroundVat — limitations.md](https://github.com/agoric-labs/PlaygroundVat/blob/master/docs/limitations.md)
- [cap-talk: Goblin semantics, and thinking through / planning for CapTP](https://groups.google.com/g/cap-talk/c/xWv2-J62g-I)

### Mark Miller's contemporary view

- [Spritely Conundrum: Message Ordering #8 (markm)](https://community.spritely.institute/t/conundrum-message-ordering/28/8)
- [Spritely Conundrum: Message Ordering #9 (markm)](https://community.spritely.institute/t/conundrum-message-ordering/28/9)
- [Spritely Conundrum: Message Ordering — thread index](https://community.spritely.institute/t/conundrum-message-ordering/28)
