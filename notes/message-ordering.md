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

**E-order.** Informal name for E's "fully order-preserving" delivery on a
single reference using `<-`. From the canonical [erights `partial-order.html`
"Partially-Ordered Message Delivery"](http://erights.org/elib/concurrency/partial-order.html):
"Among messages successively sent on a single reference (ie, using the
eventual send operator '<-'), E guarantees fully order-preserving delivery.
All messages are delivered in the order sent unless and until the reference
breaks." The `rpc.capnp` spec re-defines and enforces this guarantee under
the same name (see local mirror `notes/references/capnproto-rpc.capnp`).

**Full / Tree / Partial Order.** The three tiers of E's ordering spec
([erights `partial-order.html`](http://erights.org/elib/concurrency/partial-order.html)
plus its sequel
[erights `after-both.html`](http://erights.org/elib/equality/after-both.html)):
*Full Order* on a single reference, two-party; *Tree Order* across forks
(three-party Granovetter — sending a reference as an argument **forks** the
reference, with the fork-position between the surrounding sends defining
the partial order); *Partial Order* once the equality construct `E.join`
adds joins to that tree (four-party grant matching). "Partial order in
CapTP" usually refers to this whole spec.

**Point-to-point FIFO (Waterken / Tyler Close).** A weaker, simpler guarantee:
order is preserved along a single two-party connection, regardless of which
reference a message targets. Doesn't try to follow references across hops.
Mark Miller's stated current preference (Spritely thread).

**Embargo / Disembargo (Cap'n Proto).** When a promise resolves to a remote
ref, the receiver queues outbound messages on the new direct path and sends a
`Disembargo` with `senderLoopback`; once the same `Disembargo` returns with
`receiverLoopback`, the queue flushes. Forces any in-flight messages on the
old path to drain first, preserving E-order across resolution.

**Tribble 4-way race.** Named for Dean Tribble. A race in which a remote
promise P1 resolves to another remote promise P2 which simultaneously
resolves to a fourth-vat object Q. Cap'n Proto avoids it by the rule: once
P resolves to remote ref R, all further messages to P forward strictly to
R, even if R itself later resolves to Q. dtribble in
[ocapn/ocapn#11](https://github.com/ocapn/ocapn/issues/11) confirms this is
the same as "the Midori four vat promise shortening case."

**WormholeOp.** A CapTP-of-E mechanism in which VatA tunnels her
unacknowledged A↔C VatTP traffic *through VatB* on the way to VatC, so
that VatB cannot deliver any message that depends on VatC's state until
VatC has processed VatA's prior A→C traffic. The wormhole'd bytes are
VatTP-encrypted, so VatB is just an untrusted relay. Per the canonical
[erights `WormholeOp.html`](http://erights.org/elib/distrib/captp/WormholeOp.html):
"The receiving vat should process this data ahead of processing further
requests from the sending vat." Marked "Not yet implemented" on the
erights page; not adopted by Cap'n Proto or OCapN. *Not* a side-channel
"shortcut" packet, despite the name suggesting otherwise — it travels the
same A→B→C path as everything else, just carrying redundant copies of
A→C traffic.

**Lost Resolution Bug.** A documented bug in current E implementations.
From the canonical [erights `passing-rules.html#lost-resolution`](http://erights.org/elib/equality/passing-rules.html#lost-resolution):
"In current implementations of E, a transmitted Far reference to Carol,
sent by Alice to Bob, when Alice Bob and Carol reside in three separate
vats, will be received instead as a promise for Carol that will eventually
resolve into a Far reference to Carol. As a result, if Alice sends Bob a
hashtable containing the reference to Carol as a key, the hashtable will
fail to unserialize in Bob's vat." The "resolution" that gets *lost* is
the **resolved-ness** of the reference (Far→Promise downgrade across
3-vat introductions). In current E implementations the bug is the
deliberate workaround for the lack of WormholeOp; "fixing" it requires
implementing WormholeOp. Distinct from Tribble's 4-way race, though
both stem from preserving E-order across indirect reference passing.

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

### 3.1 Authoritative definition

From [erights `passing-rules.html#lost-resolution`](http://erights.org/elib/equality/passing-rules.html#lost-resolution),
the original page documenting the bug:

> "In current implementations of E, a transmitted Far reference to
> Carol, sent by Alice to Bob, when Alice Bob and Carol reside in
> three separate vats, will be received instead as a promise for
> Carol that will eventually resolve into a Far reference to Carol.
> As a result, if Alice sends Bob a hashtable containing the
> reference to Carol as a key, the hashtable will fail to
> unserialize in Bob's vat. Although we know how to fix this problem,
> we may not fix it quickly due to other matters being higher
> priority."

The *resolution* that gets **lost** is the **resolved-ness** of the
reference: a Far (Settled) Carol-reference becomes a Promise
(Unresolved) on arrival at Bob. The named consequence in the spec
is that hashtables fail to unserialize, because hashtable keys
must be Settled.

This is a real, named, *implementation* bug. It is not a name for
the broader ordering race or for a forwarder being discarded; my
earlier notes had this wrong.

### 3.2 Why it exists — the three-way conflict

Three E semantic requirements pull against each other in the 3-vat
case (from
[erights `WormholeOp.html#conflict`](http://erights.org/elib/distrib/captp/WormholeOp.html#conflict)):

1. **Partial ordering.** In a Granovetter introduction, the forked
   reference Bob receives must give him access only to "post-X
   Carol" — only enabling messages from Bob to arrive at Carol
   *after* X has been delivered.
2. **Going Home.** A Far (Resolved remote) reference sent home as
   an argument arrives as a Near reference — services like
   `MintMaker` rely on this to require Near `src` purses.
3. **Preserve passability.** A PassByCopy hashtable keyed on a
   PassByProxy reference should remain operational after passing
   between vats. Hashtables require Settled keys, which means a
   Carol-key arriving at Bob must be Settled (Far) too.

The conflict, in erights' words:

> "The conflict arises when, in the Preserve Passability scenario,
> Alice had sent messages (like X) to Carol that hadn't yet
> arrived in Carol's vat when she sends T to Bob. The reference to
> Carol that Bob gets in T must be 'behind' X, which would seem to
> make it different than other Resolved references Bob might have
> to Carol. However, since this new reference is Resolved as well,
> if Bob includes it as an argument in a message to Carol's vat,
> it must arrive as a Near reference to Carol. However, because
> Near references give immediate access, it may not arrive as a
> Near reference until all prior messages, such as X from Alice,
> have drained out."

Without WormholeOp the implementation cannot satisfy all three at
once for the Resolved case, so it gives up on (3) by downgrading
to a Promise. That downgrade is the Lost Resolution Bug.

### 3.3 markm's contemporary framing

In [Spritely "Conundrum: Message Ordering" post #9](https://community.spritely.institute/t/conundrum-message-ordering/28/9)
(local mirror: `notes/references/spritely-conundrum-message-ordering-28-post9.html`),
markm uses the bug as part of his broader case for retreating from
end-to-end E-order:

> "Prior to the 'Lost Resolution Bug', E-Order appears to be
> something delivered 'for free', falling out of the
> implementation naturally. We can jump up and down and say 'look
> at this thing we got at no extra cost!'"
>
> "This is indeed one of the considerations leading me to retreat
> to Tyler's Waterken point-to-point fifo."

So Lost Resolution is the historical moment that revealed E-order
is **not** free in distributed implementations — it has
"uncomfortable edges which either must be programmed around or be
understood not to be exactly what we thought" (cwebber, in the
[cap-talk thread](https://groups.google.com/g/cap-talk/c/R5kc06XGqWs/m/WDraOqkQAgAJ)
linked from markm #9; local mirror
`notes/references/google-groups-cap-talk-R5kc06XGqWs-WDraOqkQAgAJ.html.gz`).

That motivates the view that something weaker (Waterken-style
point-to-point FIFO, plus user-level e-order-like affordances) is
the more pragmatic target.

### 3.4 Relation to other named races

| Name | Source | Specific scenario |
|---|---|---|
| Lost Resolution Bug | erights `passing-rules.html` | Far→Promise downgrade when a Carol-ref is sent through Bob; hashtables-with-Carol-key fail to unserialize |
| WormholeOp / "the conflict" | erights `WormholeOp.html` | The 3-vat conflict between Partial Ordering, Going Home, and Preserve Passability |
| Tribble 4-way race | Cap'n Proto `rpc.capnp` | Promise resolution across 4 parties — chained shortenings |
| Midori four-vat promise shortening | dtribble in [ocapn/ocapn#11](https://github.com/ocapn/ocapn/issues/11) (= Tribble 4-way) | Same as above |
| Auxiliary Data Problem | markm in Spritely #9; [agoric-sdk#6355](https://github.com/Agoric/agoric-sdk/pull/6355) | Agoric-internal name for related distributed-data races |

These are related but distinct. The Lost Resolution Bug is
specifically about *resolved-ness* preservation when an
*already-resolved* Carol reference is passed through a 3-vat
introduction. Tribble's 4-way race is about ordering across
*unresolved* promise chains that shorten across multiple parties.
Both stem from preserving E-order across indirect reference
passing, but they manifest in different ways and admit different
fixes.

### 3.5 How the descendants address it

- **Cap'n Proto** does not have the Lost Resolution Bug because it
  does not carry the same hashtable-PassByCopy semantics that
  motivated WormholeOp. It uses Embargo / Disembargo + the
  forward-strictly-to-R rule for Tribble's 4-way race, which is a
  related but separate issue.
- **OCapN** uses a pipelined version of the
  `provideFor` / `acceptFrom` protocol from
  [erights `provideFor.html`](http://erights.org/elib/distrib/captp/provideFor.html)
  for Granovetter introductions, but without WormholeOp. Because
  OCapN does not currently specify hashtable-passability the same
  way E does, the bug does not manifest in the same form.
- **Ridley's `op:flush` proposal** addresses the
  promise-shortening (Tribble 4-way) version, *not* the
  Lost-Resolution (hashtable-key) version.
- **Mark Miller's contemporary view** (Spritely #8, #9): drop
  end-to-end E-order in favor of point-to-point FIFO, with
  e-order recovered at the user level via "appropriate
  affordances and conventions."

---

## 4. WormholeOp

### 4.1 What it actually is

WormholeOp is **not** a side-channel "shortcut packet." Per the
canonical [erights `WormholeOp.html`](http://erights.org/elib/distrib/captp/WormholeOp.html),
it is a way for VatA to **tunnel her unacknowledged A↔C VatTP
traffic through VatB** so that VatB cannot deliver any message that
depends on VatC's state until VatC has already processed that
traffic. Wire shape:

```
WormholeOp(packets :byte[],
           source  :VatID,
           dest    :VatID)
```

Verbatim behavior, with the doc's note that it is unimplemented:

> "*Not yet implemented, but needed to fix the Lost Resolution Bug.*
>
> If `dest` is the receiving vat, then it should try sending this
> packets data to itself as encrypted VatTP communications
> originating with `source`, processing sequence info so that
> redundant packets data are simply ignored. The receiving vat
> should process this data ahead of processing further requests
> from the sending vat.
>
> If `dest` is not the receiving vat, and if it currently has a
> live connection to `dest` or if it forms one while still
> connected to the requesting vat, then it should wormhole these
> bytes towards `dest` before allowing any further causality to
> flow from the requesting vat through the receiving vat to
> `dest`."

VatTP encrypts the traffic, so VatB cannot read or tamper with the
A↔C bits — VatB is just an untrusted relay.

### 4.2 The introduction protocol with WormholeOp

The full 3-vat handoff for sharing a Far reference (also from
`WormholeOp.html`):

```
VatA to VatC:
  def vine := NonceLocator <- provideFor(farCarol,
                                          vatBID,
                                          nonce,
                                          carolSwissHash)

VatA to VatB:
  WormholeOp(/* unacknowledged encrypted A-to-C traffic */,
             vatAID, vatCID)
  ... Far3Desc(VatCSearchPath, VatCID, nonce,
              carolSwissHash, vine) ...

VatB to VatC:
  WormholeOp(/* unacknowledged encrypted A-to-C traffic */,
             vatAID, vatCID)
  def carolPromise := NonceLocator <- acceptFrom(vatAID, nonce,
                                                  carolSwissHash, vine)
```

The wormhole-tunneled traffic carries (among other things) the
`provideFor` from A to C registering the gift. By the time VatB
issues `acceptFrom` to VatC, the wormhole-forwarded `provideFor`
has already been processed at VatC, *and* any prior Alice→Carol
messages (like X) have drained.

### 4.3 Failure mode

Per `WormholeOp.html`:

> "If VatB fails to deliver the wormhole data to VatC, then the
> `acceptFrom` message will either arrive too early and find no
> reference to Carol (fail safe), or arrive after the
> `provideFor`, and thus after the preceding messages to VatC
> (correct partial ordering).
>
> So, if VatA and VatB are cooperative, they are both assured that
> the needed `provideFor` 'from' VatA will be processed by VatC
> before VatC sees the corresponding `acceptFrom` from VatB. If
> either is uncooperative, they cannot cause damage beyond that
> accounted for by the object-level semantics. Because the data
> takes redundant paths, neither side will get stuck waiting on
> the other to timeout."

### 4.4 What it solves and what it doesn't

WormholeOp solves the 3-vat conflict between Partial Ordering,
Going Home, and Preserve Passability (§3.2). That is exactly what
makes the Lost Resolution Bug not happen — when WormholeOp is
present, the implementation can carry a Resolved Carol-reference
across the introduction without downgrading it.

It is *not* a fix for Tribble's 4-way race or for promise-shortening
in general. It is also a fundamentally different mechanism from
Cap'n Proto's embargo: Cap'n Proto's embargo serializes a path
*switchover* during promise resolution; WormholeOp ensures that
*introduced references* arrive with all their prior dependencies
already satisfied at the destination.

### 4.5 Why the descendants don't use it

- **Cap'n Proto** does not need it because it does not have the same
  hashtable-PassByCopy passability semantics. For its own race
  (Tribble 4-way) it uses Embargo / Disembargo + forward-strictly-to-R,
  which is a different design.
- **OCapN** uses a pipelined version of the
  [erights `provideFor.html`](http://erights.org/elib/distrib/captp/provideFor.html)
  protocol — `provideFor` registers the gift at C, and an
  `acceptFrom` from B that arrives before the matching
  `provideFor` queues at C until the `provideFor` resolves it (so
  ordering is correct in the cooperative case, fail-safe
  otherwise). OCapN does not currently carry the
  Resolved-vs-Unresolved distinction the Lost Resolution Bug hangs
  on, so the bug does not manifest in the same form.
- markm (Spritely thread #9) explicitly cites WormholeOp's cost as
  one reason to retreat from end-to-end E-order to point-to-point
  FIFO with user-level affordances.

Sources: [`WormholeOp.html`](http://erights.org/elib/distrib/captp/WormholeOp.html);
[`acceptFrom.html`](http://erights.org/elib/distrib/captp/acceptFrom.html);
[`provideFor.html`](http://erights.org/elib/distrib/captp/provideFor.html)
(the gift-table mechanism, including the case where `acceptFrom`
arrives ahead of `provideFor` and the resulting promise queue is
how ordering is preserved without WormholeOp);
[`3vat.html`](http://erights.org/elib/distrib/captp/3vat.html) (stub —
referenced for completeness, the live page redirects to the others).

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

- [erights.org: Partially-Ordered Message Delivery](http://erights.org/elib/concurrency/partial-order.html) — Full / Tree / Partial Order tiers; per-reference FIFO
- [erights.org: Four Party Partial Order](http://erights.org/elib/equality/after-both.html) — joins via `E.join`
- [erights.org: WormholeOp](http://erights.org/elib/distrib/captp/WormholeOp.html) — verbatim wire shape, "the conflict solved by WormholeOp," all four solution candidates
- [erights.org: passing-rules.html#lost-resolution](http://erights.org/elib/equality/passing-rules.html#lost-resolution) — **the authoritative Lost Resolution Bug definition**
- [erights.org: provideFor](http://erights.org/elib/distrib/captp/provideFor.html) — gift-table 3PH protocol; queue-on-acceptFrom-arrives-first behavior
- [erights.org: acceptFrom](http://erights.org/elib/distrib/captp/acceptFrom.html)
- [erights.org: DeliverOp](http://erights.org/elib/distrib/captp/DeliverOp.html) — `whenMoreResolved` animation referenced by markm in ocapn/ocapn#11
- [erights.org: Eventual Send Expression](http://erights.org/elang/kernel/SendExpr.html)
- [erights.org: CapTP — index](http://erights.org/elib/distrib/captp/index.html)
- [erights.org: CapTP — The 4 Tables](http://erights.org/elib/distrib/captp/4tables.html)

The whole erights.org website source is open; clone
[`erights/erights-org-website`](https://github.com/erights/erights-org-website)
for offline reading.

### Cap'n Proto

- [Cap'n Proto: RPC Protocol](https://capnproto.org/rpc.html)
- [`capnproto/c++/src/capnp/rpc.capnp`](https://github.com/capnproto/capnproto/blob/master/c++/src/capnp/rpc.capnp) — Embargo, Disembargo, Tribble 4-way race comments. Local mirror: `notes/references/capnproto-rpc.capnp`
- [`capnproto/c++/src/capnp/rpc.c++`](https://github.com/capnproto/capnproto/blob/master/c%2B%2B/src/capnp/rpc.c%2B%2B) — embargo enforcement
- [Promise Pipelining in Cap'n Proto RPC — Lobsters discussion](https://lobste.rs/s/0ykbk6/promise_pipelining_cap_n_proto_rpc)

### The Lost Resolution Bug

- [agoric-sdk#40: deny passing Presences in arguments?](https://github.com/Agoric/agoric-sdk/issues/40)
- [agoric-sdk#6355: cheap auxdata](https://github.com/Agoric/agoric-sdk/pull/6355) (markm's "Auxiliary Data Problem" approximation)
- [PlaygroundVat — limitations.md](https://github.com/agoric-labs/PlaygroundVat/blob/master/docs/limitations.md)
- [cap-talk: Goblin semantics, and thinking through / planning for CapTP](https://groups.google.com/g/cap-talk/c/xWv2-J62g-I) — local mirror `notes/references/google-groups-cap-talk-xWv2-J62g-I.html.gz`
- [cap-talk thread linked from markm Spritely #9](https://groups.google.com/g/cap-talk/c/R5kc06XGqWs/m/WDraOqkQAgAJ) — local mirror `notes/references/google-groups-cap-talk-R5kc06XGqWs-WDraOqkQAgAJ.html.gz` (cwebber's `carol~.x()` / `bob~.y(carol)` / `carol~.z()` example)

### Mark Miller's contemporary view

- [Spritely Conundrum: Message Ordering #8 (markm)](https://community.spritely.institute/t/conundrum-message-ordering/28/8) — local mirror `notes/references/spritely-conundrum-message-ordering-28-post8.html`
- [Spritely Conundrum: Message Ordering #9 (markm)](https://community.spritely.institute/t/conundrum-message-ordering/28/9) — local mirror `notes/references/spritely-conundrum-message-ordering-28-post9.html`
- [Spritely Conundrum: Message Ordering — thread index](https://community.spritely.institute/t/conundrum-message-ordering/28) — local mirror `notes/references/spritely-conundrum-message-ordering-28.json`
- Excerpts in readable form: `notes/references/spritely-conundrum-message-ordering-excerpts.md`

### Related ocapn issues (local mirrors)

- `notes/references/ocapn-ocapn-issue-15.json` — "Replacing deliver.rdr with op:listen?"
- `notes/references/ocapn-ocapn-issue-24.json` — referenced by zarutian in the wire-trace example
- `notes/references/ocapn-ocapn-issue-236.json` — original promise-shortening discussion before #11
- `notes/references/ocapn-ocapn-issue-265.json` — Two Generals concern in 3PH
