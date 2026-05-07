# Message Ordering in OCapN, CapTP-of-E, and Cap'n Proto

Research notes on how the E-family of capability-secure protocols
defines message-delivery ordering, where each protocol diverges,
and how the *Lost Resolution Bug* and *WormholeOp* fit in.

Primary mirrors for the Spritely thread, Cap'n Proto `rpc.capnp`,
cap-talk, selected `ocapn/ocapn` issues, and Mark Miller's thesis
(*Robust Composition*, JHU 2006) live under `notes/references/`
(see [`notes/references/README.md`](./references/README.md)).
**erights.org** pages are not mirrored here — clone
[`erights/erights-org-website`](https://github.com/erights/erights-org-website)
for offline access.

Reading order:
- §1 introduces the **types of ordering guarantee** with the
  protocols where each is seen.
- §2 walks through specific **protocols** and pins down what each
  one actually delivers, including whether the guarantee survives
  the network, mutually defensive parties, and promise shortening.
- §3 and §4 are case studies of two named bugs in the design space
  — the **Lost Resolution Bug** and **WormholeOp**.
- §5 is sources.
- §6 is a glossary for terms used throughout.

---

## 1. Types of ordering guarantees

Listed weakest to strongest. The named tiers come primarily from
[Mark Miller's thesis, *Robust Composition* §19](./references/markm-thesis/chapter-19-delivering-messages-in-e-order.md),
with §19.7 ("Notes on Related Work") providing the comparative
taxonomy.

### 1.1 UNORDERED, UNRELIABLE

The descriptive baseline of any distributed system. Only constraint:
a message can't be delivered before it is sent (no
*happened-before* cycles). Sent messages may not be delivered.
Delivered messages were sent.

> "In the taxonomy of distributed system message delivery orders,
> in the absence of further constraints, this would be termed
> UNORDERED, UNRELIABLE." — markm thesis §19.7

**Where it shows up:** raw IP, UDP, the abstract network model
behind Lamport's *happened-before* relation and the
Hewitt/Baker/Clinger actor calculus.

### 1.2 Per-channel FIFO (TCP)

Messages on a single channel arrive in send order. Multiple
channels between the same pair of parties have no inherent
relationship.

> "TCP only provides FIFO order separately within each
> communications channel. Rather than requiring m₁ and m₂ merely
> to be sent by the same Actor, TCP additionally requires that
> they be sent on the same channel." — markm thesis §19.7

**Where it shows up:** TCP, raw netlayer streams, the netlayer
component of OCapN (which provides this between two peers).

### 1.3 Fail-stop FIFO (per-pair-of-actors)

Messages sent in order between two actors are delivered in send
order, *and* if the channel breaks, no further messages are
delivered ("fail-stop"). Stronger than TCP per-channel FIFO
because it's defined per-pair-of-actors rather than per-channel.

> "Conventional FIFO order can be defined in terms of pairs of
> actors (processes/vats): If Alice sends m₁ and then m₂ to Bob,
> so that the sending of m₁ happens before the sending of m₂ in
> Alice's local arrival order, and if both are delivered to Bob,
> then the delivery of m₁ must happen before the delivery of
> m₂." — markm thesis §19.7
>
> "Fail-stop [is] the guarantee that a message sent later on a
> channel will only be delivered if all messages sent earlier on
> the same channel will eventually be delivered." — §19.7

**Where it shows up:** E for messages sent on a single reference
(thesis §19.1); Tyler Close's Waterken between two peers; OCapN
in the current draft (between two CapTP-session peers).

> [!NOTE]
> Markm's thesis §19.2 explicitly argues fail-stop FIFO **alone**
> is "too weak" as the baseline guarantee for a distributed ocap
> system. The argument: when Alice forwards a Carol-reference to
> Bob and Bob uses it, Bob's send may overtake Alice's earlier
> sends, even under cooperative assumptions. Forks are needed
> (§1.4 below).

### 1.4 End-to-end reference FIFO (per-sender, per-logical-reference)

Stronger than fail-stop FIFO between two CapTP-session peers,
weaker than full E-ORDER. **Per-sender, per-logical-reference**
FIFO that survives promise resolution / shortening: messages
sent by a single vat on what the application sees as the same
reference are delivered in send order at the eventual target,
even when the wire-level path or wire-level reference identity
changes underneath (because of shortening, three-party handoff,
or remotable-ref redirection).

In Mark Miller's contemporary framing
([Endo meeting 2026-05-06 transcript](./references/Endo%20Meeting%2020260506%20transcript.md)),
this is what he had wanted to call "point-to-point FIFO" all
along, but the term collided with TCP's per-channel meaning.
This document uses **end-to-end reference FIFO** for the same
idea (markm sometimes phrases it as "end-to-end FIFO per
reference" in the transcript; we use the former wording for
consistency).

> "I'm not willing to retreat from what I'll call **end-to-end
> FIFO** (per reference)—I'm just avoiding the confusing
> 'point-to-point' wording. It's still FIFO, not e-ordering."
> — markm, Endo meeting

> "We do *not* have it 'to references' in the sense you might
> think, because when a promise shortens it's still, to the
> application programmer, **the same promise**. You don't get to
> evade the FIFO guarantee by shortening; if you did, the FIFO
> guarantee would be useless to the application programmer. […]
> I'd say it's not a different promise but a **different path**.
> At the level of application code it's the same promise; it's
> just taking a different path now." — markm, Endo meeting

#### FIFO is per *reference*, not per ultimate target

Two messages on the same logical reference are FIFO with each
other. Two messages on different references that *happen to
target the same object* are **not** FIFO with each other. In
particular, this means a promise that resolves to Carol and a
direct remotable reference to that same Carol are independent
FIFO streams; messages on the promise are not synchronized
against messages on the direct reference, even after the
promise has resolved.

> "If you have a promise, successive messages sent on that same
> promise must be delivered to whatever the fulfillment
> eventually is. All messages sent on that promise must arrive
> in the order they were sent, to that eventual fulfillment.
> **If several promises eventually share the same fulfillment,
> FIFO is still per promise; there doesn't need to be
> inter-promise coordination just because they fulfill to the
> same target.**" — markm, Endo meeting

Concretely, if Alice holds:

- a promise `p` (which she sent `foo()` to, before learning that
  `p` resolves to Carol), and
- a direct remotable reference `c` to Carol (which she sent
  `bar()` to),

then `foo()` and `bar()` may be delivered to Carol in either
order. The FIFO guarantee binds messages sent on `p` to each
other, and messages sent on `c` to each other, but not the two
streams to one another. Cross-reference ordering would only be
enforced by full E-ORDER (§1.5), which markm now recommends
*against* standardizing for cost reasons.

#### Promise shortening requires additional synchronization

End-to-end reference FIFO is "for free" — implied by per-pair
vat-to-vat FIFO — *only when there is no protocol-level promise
shortening*:

> "Waterken had **no promise shortening**. If OCapN didn't
> shorten promises, then 'point-to-point' in the sense of local
> **vat-to-vat FIFO** would be enough to get what I'll call
> **end-to-end reference FIFO**. Vat-to-vat FIFO would implicitly
> give you end-to-end reference FIFO in the absence of
> shortening, as in Waterken." — markm, Endo meeting

The reason: without shortening, every message Alice sends on
reference `p` traverses the same wire path. Per-CapTP-session
FIFO (§1.3) on each link of that fixed path naturally composes
into end-to-end reference FIFO at the destination.

Promise shortening *changes the wire path mid-stream.* Before
shortening, Alice's sends on `p` travel A→B→C; after
shortening, they travel A→C directly. Per-session FIFO does
**not** relate the two paths — a message Alice sent before
shortening (still in flight along A→B→C) can be overtaken by a
later message Alice sent after shortening (going direct A→C).
End-to-end reference FIFO, the property the application sees,
would be violated.

But shortening is too valuable to give up. Markm in the Endo
meeting:

> "I think promises **must** shorten: Once it's clear that
> messages on a promise-chain go to **vat C** even though **vat B**
> had been the intermediary, it should at least be the case that
> after quiescence, if **vat B** goes offline, it does
> not further affect communication A→C. Because practically vats
> go offline a lot, and the cost of never shortening promises is
> too high (for availability)." — markm, Endo meeting

So OCapN cannot simply adopt Waterken-style "no shortening" if
it wants end-to-end reference FIFO at row §1.4. To preserve §1.4
*while* admitting shortening, the protocol must add explicit
synchronization at every shortening event. The mechanism choices
identified in `notes/issue-11-promise-shortening.md`:

- **Receiver-side embargo** (Cap'n Proto's Disembargo). When a
  promise resolves to a remote ref, the receiver embargoes the
  new direct path, sends a `Disembargo` along the old path, and
  releases the embargo only when the Disembargo round-trips
  back. The old path's drainage is what the round-trip
  signals.
- **Sender-side flush** (Ridley's `op:flush`). The
  promise-resolver tells the sender to quiesce its sends through
  the resolver before the 3PH switches the path. The sender's
  `flush-done` is the signal that all pre-shortening sends have
  been received.
- **Per-message ordering tag** (per-promise sequence numbers).
  The sender stamps each pipelined message with a per-promise
  monotonic counter; the destination reorders by counter,
  regardless of path. Shortening becomes invisible.

Without any of these, OCapN's spec-as-written admits exactly the
race that motivated [ocapn/ocapn#11](https://github.com/ocapn/ocapn/issues/11):
the application sees one promise, the protocol sees two paths,
and ordering breaks at the path switchover.

#### Strictly weaker than full E-ORDER

This is **strictly weaker** than full E-ORDER (§1.5). It does
*not* enforce the cross-sender forks constraint:

> "Suppose Alice first sends **X** to Carol, then sends **W** to
> Bob carrying the remotable reference to Carol; Bob receives it
> and sends **Y** to Carol on that reference. Under
> **e-ordering**, **Y** *cannot* be delivered to Carol until
> **X** has been delivered to Carol. […] [That constraint] is
> *not* implied by end-to-end reference FIFO alone." — markm,
> Endo meeting

**Where it shows up:**
- **Cap'n Proto RPC** — labelled "E-Order" in its `rpc.capnp`
  comments but, in fact, the embargo machinery only enforces
  this tier (see §2.5 below for the discrepancy).
- **Ridley's `op:flush` proposal** for OCapN — does not
  implement WormholeOp, so does not provide the forks property
  of full E-ORDER. The flush dance handles the single-sender
  promise-resolution case, which is exactly this tier.
- **Per-promise sequence numbers** alternative — also targets
  this tier (intrinsic per-message ordering).
- **Markm's contemporary recommendation for OCapN.** "[D]on't
  standardize e-ordering—it's too hard. Back off to […]
  end-to-end reference FIFO."

The cost difference is significant: end-to-end reference FIFO
needs only path-switchover serialization (Cap'n Proto's
Disembargo, Ridley's flush, or per-promise seq). Full E-ORDER
needs cross-sender forks ordering, which on the network requires
something like WormholeOp — and that complexity is what motivated
the retreat.

### 1.5 E-ORDER (Tree Order with forks)

All of fail-stop FIFO, plus: when a reference is included as an
argument of an eventually-sent message, the reference is **forked** at a position
**between** the sender’s prior eventual sends on it and the send
that carries it. The receiver does not receive the sender’s
original reference; they receive a **fork** whose deliveries at the
target cannot run **ahead of** those prior sends. The
forked reference's authority is "post-X target" — only enabling
messages to be delivered after X (and any other prior sends on
the original reference) have already been delivered.

Visualizable as a Hasse diagram (thesis Figure 19.1).

> "The reference Bob receives from Alice has no more power in
> Bob's hands than it had in Alice's. The assumptions Alice needs
> to make for herself, for the sake of her own sanity, are
> assumptions that remain valid as she delegates to Bob." — markm
> thesis §19.3

**Where it shows up:** E (intra-vat) is the original and only
unambiguous example. CapTP-of-E / Pluribus aspires to it across
the network and would need WormholeOp to enforce it (the canonical
erights page marks WormholeOp "Not yet implemented"). **Cap'n
Proto's `rpc.capnp` uses the term "E-Order"** and cites
`erights/partial-order.html`, but its embargo machinery only
handles the single-sender promise-resolution case — it provides
end-to-end reference FIFO (§1.4), *not* the cross-sender forks
property. See §2.5 for the discussion. Markm currently
recommends *not* standardizing this tier for OCapN
([Endo meeting 2026-05-06](./references/Endo%20Meeting%2020260506%20transcript.md)):

> "My response to that complexity is: **don't standardize
> e-ordering**—it's too hard. Back off to the weaker FIFO I had
> been calling 'point-to-point' just to *name* something less
> onerous than e-order. Concretely, we **allow Y from Bob to
> Carol to arrive before X from Alice to Carol**." — markm

(Later in the same conversation markm renames "point-to-point"
to "end-to-end FIFO per reference" — see §1.4. The two phrasings
refer to the same target tier.)

### 1.6 E-ORDER with joins (Partial Order)

E-ORDER plus joins: `E.join(a, b)` returns a promise whose
ordering constraints are the joins of the orders of `a` and `b`.
A message on the joined promise is delivered only after every
prior send on either input. This is what's needed for grant
matching and other distributed-equality patterns. (Thesis §19.5,
[erights `after-both.html`](http://erights.org/elib/equality/after-both.html).)

**Where it shows up:** E. Not commonly carried into other ocap
systems.

### 1.7 CAUSAL order

All of E-ORDER, plus full happens-before across all senders,
references, and forwarding paths. If the *send event* of m₁
happens before the *send event* of m₂ in any actor's local
ordering, then if both are delivered, the *delivery* of m₁
happens before the *delivery* of m₂.

Markm's thesis explicitly rejects CAUSAL order as a target for
distributed ocap:

> "E doesn't provide CAUSAL order because we don't know how to
> enforce it among mutually defensive machines. […] Enforcing
> CAUSAL order would require, in the case where VatB sends `o()`
> on `c2` in reaction to the arrival of `y()`, that `o()` must
> then be delivered only after `x()`. In order to enforce CAUSAL
> order on a possibly misbehaving VatB, somehow, the arrival of
> `y(carol)` from VatA would have to preclude this previously
> present possibility. In the absence of mutually-reliant
> hardware, this seems difficult.
>
> By contrast, E-ORDER only requires restricting the new
> possibilities the newly arriving reference-to-Carol provides
> to VatB, rather than the removal of previously present
> possibilities." — markm thesis §19.4

**Where it shows up:** Reliable-multicast / process-group systems
with cooperative members (Birman, Isis); blockchains and
state-machine-replication systems; explicitly **not** in any
ocap system because it cannot be enforced without
tamper-resistant mutually-reliant hardware (Smith and Tygar,
[ST94] in markm bibliography).

### 1.8 AGREED / total order

Strongest commonly-used ordering: all participants see all
messages in the same total order. Useful for state-machine
replication.

**Where it shows up:** atomic broadcast, Paxos / Raft consensus,
BFT consensus, blockchain ordering services. Not attempted in
ocap systems for the same reason as CAUSAL.

---

## 2. Protocols

For each protocol below: which ordering tier from §1 does it
provide, and under what conditions (across the network, against
mutually defensive parties, with or without protocol-level
promise shortening).

### 2.1 TCP / raw netlayer

| | |
|---|---|
| Ordering | §1.2 per-channel FIFO |
| Cross-network | Yes |
| Mutually defensive | No — TCP itself has no security; needs TLS or VatTP layered on top |
| Promise shortening | Not applicable (no notion of references) |

The base layer underneath everything else. OCapN explicitly
delegates ordering to a netlayer with this property.

### 2.2 Waterken (Tyler Close)

| | |
|---|---|
| Ordering | §1.3 fail-stop FIFO between two HTTP peers |
| Cross-network | Yes (HTTP/HTTPS) |
| Mutually defensive | Yes — via web-keys (unguessable URLs as capabilities) |
| Promise shortening | **No protocol-level shortening.** Introductions are URL-sharing; response promises resolve along the same pipe |

Waterken can hold the per-pipe FIFO contract cheaply because it
sidesteps the shortening problem entirely: there is always one
direct path between any two peers, so there's no race between an
old and a new path. OCapN, by treating shortening as a
protocol-level optimization, takes on a FIFO obligation that
Waterken does not.

### 2.3 E (intra-vat)

| | |
|---|---|
| Ordering | §1.5 + §1.6 E-ORDER with joins |
| Cross-network | No — single vat |
| Mutually defensive | Not relevant within a vat |
| Promise shortening | Trivial (everything is local) |

The original definition of E-ORDER. Per markm thesis §19.1,
intra-vat references provide fail-stop FIFO; per §19.3, sending a
reference as an argument forks it and the resulting Tree Order is
visualizable as a Hasse diagram.

### 2.4 CapTP-of-E (Pluribus, Mark Miller and Marc Stiegler)

| | |
|---|---|
| Ordering | §1.5 E-ORDER aspirational; in 2003-era E implementations (per `passing-rules.html`) the Lost Resolution Bug means a Far reference is downgraded to a Promise on 3-vat introduction |
| Cross-network | Yes (VatTP) |
| Mutually defensive | Yes by design — VatTP encrypts; introductions are cryptographic handoffs |
| Promise shortening | Yes via redirector + `whenMoreResolved` + WormholeOp; **WormholeOp is "Not yet implemented" per the canonical erights.org page**, which is why Lost Resolution exists |

Lifts E's intra-vat ordering aspirations across the network. The
mechanisms (redirector, `whenMoreResolved`, gift tables,
`provideFor` / `acceptFrom`) are all defined; WormholeOp is the
remaining piece that — when implemented — would close the
3-vat conflict (§3.2) and eliminate the Lost Resolution Bug.

### 2.5 Cap'n Proto RPC (Kenton Varda)

| | |
|---|---|
| Ordering | §1.4 end-to-end reference FIFO, enforced. **Note: `rpc.capnp` uses the term "E-Order" — that term ambiguously names two tiers on the page it cites; Cap'n Proto delivers the weaker (single-reference) one, not the §1.5 E-ORDER tier with cross-sender forks** — see below. |
| Cross-network | Yes |
| Mutually defensive | Yes (security model inherited from CapTP-of-E) |
| Promise shortening | Yes, *only* shortening from a 2-hop path to a 1-hop path. Multi-hop chains are pinned via the **forward-strictly-to-R** rule (line 746-754 of `rpc.capnp`) to avoid the Tribble 4-way race. Path switchover is serialized by Embargo / Disembargo. Trades long-term availability (R can never go offline without breaking the chain) for protocol simplicity. |

#### What `rpc.capnp` claims

From `rpc.capnp` lines 61-65 (local mirror
[`notes/references/capnproto-rpc.capnp`](./references/capnproto-rpc.capnp)):

> "Unless otherwise specified, messages must be delivered to the
> receiving application in the same order in which they were
> initiated by the sending application. The goal is to support
> 'E-Order', which states that two calls made on the same
> reference must be delivered in the order which they were made:
> http://erights.org/elib/concurrency/partial-order.html"

This citation is misleading. The page it links — erights
`partial-order.html` — defines E-ORDER as **fail-stop FIFO with
forks** (Tree Order). The definition Cap'n Proto gives
("two calls on the same reference") is only the per-reference
FIFO part — the §1.4 tier in this document, not the §1.5 tier.

#### What the embargo machinery actually enforces

From `rpc.capnp` lines 693-758 — the `Disembargo` documentation
spells out the only race that the embargo handles: "if foo() is
called on a promise, and that promise happens to resolve before
bar() is called, then the two calls may travel different paths
over the network, and thus could arrive in the wrong order."

Two scenarios:

- **Loopback case.** Promise P resolves locally inside Vat A.
  Vat A sends a Disembargo with `senderLoopback` set; it echoes
  through Vat B and back. While the echo is in flight, A queues
  outbound calls on the new direct path; the echo's return is
  the signal that all pipelined calls on the old path have
  drained, and queued direct-path calls are released in order.
- **Three-party case.** Promise P resolves to Carol in Vat C.
  Vat A's `Accept` to C plus pipelined calls on it are
  embargoed; a Disembargo is sent A→B→C. Once it arrives at C,
  the embargo on Accept (and queued pipelined calls) is lifted.

In both cases, the actor whose ordering is being preserved is
**the single sender (Alice)**. The mechanism guarantees Alice's
own calls on what she sees as the same logical reference (or
promise) are delivered to the destination in send order. That
is the §1.4 tier: end-to-end reference FIFO, per sender.

#### What it does *not* enforce

- The cross-sender forks case. If Alice sends X to Carol, then
  sends Carol's reference to Bob, and Bob then sends Y to Carol,
  Cap'n Proto does **not** guarantee Y arrives at Carol after X.
  Full §1.5 E-ORDER would require this; WormholeOp would be the
  mechanism. Cap'n Proto explicitly does not implement WormholeOp.
- Multi-hop chain shortening (Tribble 4-way race). The
  forward-strictly-to-R rule sidesteps this by *giving up* on
  further shortening: "[Once] a promise P has been resolved to a
  remote object reference R, then all further messages received
  addressed to P will be forwarded strictly to R. Even if it
  turns out later that R is itself a promise, and has resolved
  to some other object Q, messages sent to P will still be
  forwarded to R, not directly to Q." (Bracketed `[Once]`
  substitutes for a typo at the source: `rpc.capnp` line 746
  reads `One a promise P`.)

So in markm's contemporary vocabulary
([Endo meeting 2026-05-06](./references/Endo%20Meeting%2020260506%20transcript.md)),
Cap'n Proto provides **end-to-end reference FIFO** (per sender,
per logical reference, surviving the one shortening event that
moves a promise from a 2-hop path to a 1-hop path), *not* full
E-ORDER. The `rpc.capnp` "E-Order" *definition*
("two calls made on the same reference must be delivered in the
order which they were made") matches the **Full Order** tier
(single-reference, two-party) at the top of `partial-order.html`
— and the embargo machinery generalizes that property to survive
promise resolution. The page it cites also defines a stronger
**Tree Order** tier that adds cross-sender forks, and titles
itself *Partially-Ordered Message Delivery* (forks + joins).
Cap'n Proto's text picks the narrowest tier from the page and
the implementation matches it; what's potentially confusing is
that the same name "E-Order" / "E-ORDER" is used at both
granularities in the literature. A reader who follows the link
expecting forks will be disappointed.

#### Implementation note: ordering enforcement in `rpc.c++`

There is a real ordering-related `evalLater()` in Cap'n Proto's
C++ implementation, at
[`c++/src/capnp/rpc.c++` line 2803](https://github.com/capnproto/capnproto/blob/master/c%2B%2B/src/capnp/rpc.c%2B%2B#L2803),
in the message loop. The TODO comment alongside it describes the
race it prevents:

> "We add an `evalLater()` here so that anything we needed to do
> in reaction to the previous message has a chance to complete
> before the next message is handled. In particular, without
> this, I observed an ordering problem: I saw a case where a
> `Return` message was followed by a `Resolve` message, but the
> `PromiseClient` associated with the `Resolve` had its
> `resolve()` method invoked _before_ any `PromiseClient`s
> associated with pipelined capabilities resolved by the
> `Return`. This could lead to an incorrectly-ordered interaction
> between `PromiseClient`s when they resolve to each other."
> — `rpc.c++` comment at the call site

This is `kj::evalLater` from the [KJ async
library](https://github.com/capnproto/capnproto/blob/master/c%2B%2B/src/kj/async.h),
not Java's `CompletableFuture`. (An earlier draft of these notes
conflated the two; the actual mechanism is KJ's deferred
continuation, used to break depth-first PromiseClient resolution
into separate event-loop turns so that `Return`-then-`Resolve`
ordering is preserved at the level of `PromiseClient` callbacks.)
### 2.6 OCapN — current draft

| | |
|---|---|
| Ordering | §1.3 fail-stop FIFO between two CapTP-session peers — markm thesis §19.2 calls this "too weak" alone |
| Cross-network | Yes (via netlayer) |
| Mutually defensive | Yes — netlayer provides authentication and integrity |
| Promise shortening | Admitted as a protocol-level optimization, but **the spec does not currently preserve ordering across shortening events** |

Source quotes:

- CapTP session is "two entities exchanging CapTP messages over a
  reliable, in-order OCapN Netlayer channel" —
  [`draft-specifications/CapTP Specification.md` L59-61](https://github.com/kumavis/ocapn/blob/b0a681d/draft-specifications/CapTP%20Specification.md#L59-L61).
- Netlayer requirements include "Messages should be received in
  the order in which they were sent" —
  [`draft-specifications/Netlayers.md` L28-34](https://github.com/kumavis/ocapn/blob/b0a681d/draft-specifications/Netlayers.md#L28-L34).
- Implementation guide describes the netlayer as a "bidirectional
  FIFO" —
  [`implementation-guide/Implementation Guide.md` L43](https://github.com/kumavis/ocapn/blob/b0a681d/implementation-guide/Implementation%20Guide.md#L43).

The spec language reads as if the netlayer's per-pair FIFO is
sufficient. Per markm thesis §19.2, it is not. The
[ocapn/ocapn#11](https://github.com/ocapn/ocapn/issues/11)
discussion makes the gap explicit:

> "The 'points' I meant are the sending vat (vatA) and the
> receiving object (Charlie), respectively. […] If we don't
> mean that, then I fail to see how the programmer benefits from
> the FIFO guarantee. Programming with FIFO is too hard to do
> correctly. Programming with 'almost always FIFO' is too hard to
> tell that you did not code correctly." — erights, ocapn/ocapn#11

The proposed clarification, per markm's contemporary framing
([Endo meeting 2026-05-06](./references/Endo%20Meeting%2020260506%20transcript.md)),
is to upgrade OCapN's ordering guarantee from §1.3
(per-CapTP-session fail-stop FIFO) to §1.4 (end-to-end
reference FIFO) — *not* all the way to full §1.5 E-ORDER, which
markm now considers too costly to standardize:

> "Don't standardize e-ordering—it's too hard. Back off to […]
> end-to-end FIFO per reference. […] I'm not willing to retreat
> from what I'll call **end-to-end FIFO** (per reference)—I'm
> just avoiding the confusing 'point-to-point' wording. It's
> still FIFO, not e-ordering."

### 2.7 OCapN + `op:flush` (proposed)

| | |
|---|---|
| Ordering | §1.4 end-to-end reference FIFO (per sender, surviving shortening). **Not full §1.5 E-ORDER** — does not implement WormholeOp, so does not enforce the cross-sender forks property. |
| Cross-network | Yes |
| Mutually defensive | Yes (relies only on per-connection FIFO + existing 3PH security) |
| Promise shortening | Yes, with explicit per-shortening flush ceremony before the 3PH; preserves end-to-end reference FIFO across shortening |

Ridley's current proposal in
[ocapn/ocapn#11](https://github.com/ocapn/ocapn/issues/11). See
[`notes/issue-11-promise-shortening.md`](./issue-11-promise-shortening.md)
and the prototype branch `claude/ocapn-op-flush-WNRFV`. Aligned
with markm's contemporary recommendation in the
[Endo meeting 2026-05-06](./references/Endo%20Meeting%2020260506%20transcript.md):
end-to-end reference FIFO, *without* the WormholeOp-level
complexity of full E-ORDER.

### 2.8 OCapN + per-promise sequence numbers (alternative proposal)

| | |
|---|---|
| Ordering | §1.4 end-to-end reference FIFO (intrinsic, per sender). Does not enforce the cross-sender forks property of full §1.5 E-ORDER. |
| Cross-network | Yes |
| Mutually defensive | Yes |
| Promise shortening | Yes, transparent — sender tags pipelined messages with seq, destination reorders |

Alternative explored in
[`notes/issue-11-promise-shortening.md` §10.2](./issue-11-promise-shortening.md).
Trades a per-message varint for the per-event flush ceremony;
makes shortening fully transparent.

### 2.9 OCapN + `delivered-after` only (minimal hybrid proposal)

| | |
|---|---|
| Ordering | §1.3 fail-stop FIFO baseline; per-message opt-in to stronger ordering via `delivered-after` |
| Cross-network | Yes |
| Mutually defensive | Yes |
| Promise shortening | Protocol admits reorder; user opts in via `delivered-after` |

Lowest protocol cost; ships the disagreement out to user code.
See
[`notes/issue-11-promise-shortening.md` §10.1, §10.3](./issue-11-promise-shortening.md)
and the prototype branch `claude/ocapn-deliver-after-WNRFV`.

### 2.10 Goblins / SwingSet / other reference implementations

Not enumerated here — these are downstream choices made on top
of the OCapN spec. Their behavior depends on which row of §2.6 /
§2.7 / §2.8 / §2.9 they implement and on application-level
conventions on top.

---

## 3. The Lost Resolution Bug

### 3.1 What it actually is — markm's modern definition

In the [Endo meeting 2026-05-06](./references/Endo%20Meeting%2020260506%20transcript.md),
markm clarifies that the original "lost resolution" name is
historical and somewhat outdated:

> "In the days of E it was called the 'lost resolution' bug in
> a setting where an E promise could turn into its target—once
> fulfilled, the promise *became* the target. None of the modern
> ocap systems are trying to do that; for all of them the
> promise stays a promise and the fulfillment is distinct. So
> 'lost resolution' isn't really the right name anymore, but the
> underlying issue still exists if you try to implement
> e-order." — markm

The modern statement of the issue:

> "Alice holds a remotable reference to Carol (a remote presence
> locally). Alice sends message **X** on that reference; **X**
> hasn't arrived yet. Alice then sends Bob **her reference to
> Carol**; because it's remotable it must show up in Bob's vat
> as a remotable reference—canonically short—and be delivered
> to Bob. If we want **e-ordering**, then when Bob sends message
> **Y** to Carol on that reference, **Y** must be delivered
> **after X**. *That* requirement is what made **Wormhole op**
> the solution—and it's still a fine name in a modern setting."
> — markm, Endo meeting

So the "Lost Resolution Bug" is now best understood as a name
for the **cross-sender forks requirement** of full E-ORDER
(§1.5) — the requirement that Bob's send Y on a forwarded
reference must follow Alice's prior send X on the same logical
reference. This is exactly the constraint that distinguishes
full E-ORDER from end-to-end reference FIFO (§1.4), and it is
exactly what WormholeOp is designed to provide.

In Cap'n Proto terms: nothing in the embargo machinery enforces
this (§2.5). In OCapN-with-`op:flush` terms: the flush ceremony
also does not enforce this. Both protocols therefore deliver
end-to-end reference FIFO but not full E-ORDER, and the unhandled
cross-sender forks case is the modern face of the Lost
Resolution Bug.

### 3.2 Historical definition (E implementations, 2003-era)

The original page documenting the bug,
[erights `passing-rules.html#lost-resolution`](http://erights.org/elib/equality/passing-rules.html#lost-resolution):

> "In current implementations of E, a transmitted Far reference
> to Carol, sent by Alice to Bob, when Alice Bob and Carol reside
> in three separate vats, will be received instead as a promise
> for Carol that will eventually resolve into a Far reference to
> Carol. As a result, if Alice sends Bob a hashtable containing
> the reference to Carol as a key, the hashtable will fail to
> unserialize in Bob's vat. Although we know how to fix this
> problem, we may not fix it quickly due to other matters being
> higher priority."

In the original E setting where a fulfilled promise *became* its
target (no longer distinct), the visible failure was Far→Promise
downgrade across 3-vat introductions: hashtables-with-Carol-key
fail to unserialize. That specific visible failure does not
arise in modern ocap systems (where promises stay promises),
but the underlying race is the same one markm describes above.

### 3.3 Why the original E formulation exists — the three-way conflict

Three E semantic requirements pull against each other in the
3-vat case (from
[erights `WormholeOp.html#conflict`](http://erights.org/elib/distrib/captp/WormholeOp.html#conflict)):

1. **Partial ordering.** In a Granovetter introduction, the
   forked reference Bob receives must give him access only to
   "post-X Carol" — only enabling messages from Bob to arrive at
   Carol *after* X has been delivered.
2. **Going Home.** A Far (Resolved remote) reference sent home
   as an argument arrives as a Near reference — services like
   `MintMaker` rely on this to require Near `src` purses.
3. **Preserve passability.** A PassByCopy hashtable keyed on a
   PassByProxy reference should remain operational after passing
   between vats. Hashtables require Settled keys, which means a
   Carol-key arriving at Bob must be Settled (Far) too.

The conflict, in erights' words:

> "The conflict arises when, in the Preserve Passability
> scenario, Alice had sent messages (like X) to Carol that
> hadn't yet arrived in Carol's vat when she sends T to Bob. The
> reference to Carol that Bob gets in T must be 'behind' X,
> which would seem to make it different than other Resolved
> references Bob might have to Carol. However, since this new
> reference is Resolved as well, if Bob includes it as an
> argument in a message to Carol's vat, it must arrive as a Near
> reference to Carol. However, because Near references give
> immediate access, it may not arrive as a Near reference until
> all prior messages, such as X from Alice, have drained out."

Without WormholeOp the implementation cannot satisfy all three
at once for the Resolved case, so it gives up on (3) by
downgrading to a Promise. That downgrade is the Lost Resolution
Bug.

### 3.4 markm's framing in the Spritely thread

In [Spritely "Conundrum: Message Ordering" post #9](https://community.spritely.institute/t/conundrum-message-ordering/28/9)
(local mirror:
`notes/references/spritely-conundrum-message-ordering-28-post9.html`),
markm uses the bug as part of his broader case for retreating
from end-to-end E-ORDER. He opens by quoting an earlier passage
(rendered as a `<blockquote>` in the Discourse HTML), which
**originates with cwebber** in the
[cap-talk thread](https://groups.google.com/g/cap-talk/c/R5kc06XGqWs/m/WDraOqkQAgAJ)
under the subject "Examples of E-Order being useful" — verified
against the cap-talk archive mirror at
`notes/references/google-groups-cap-talk-R5kc06XGqWs-WDraOqkQAgAJ.html.gz`,
where the same paragraph appears as cwebber's authored post and
is quoted back in a follow-up that begins "[cwebber] writes:"
(square brackets ours: the source uses cwebber's full legal
name; we substitute the GitHub handle for consistency).

> "Prior to the 'Lost Resolution Bug', E-Order appears to be
> something delivered 'for free', falling out of the
> implementation naturally. We can jump up and down and say
> 'look at this thing we got at no extra cost!'"
> — cwebber, cap-talk "Examples of E-Order being useful";
> re-quoted by markm in Spritely #9

markm's own response in the same post:

> "This is indeed one of the considerations leading me to
> retreat to Tyler's Waterken point-to-point fifo." — markm,
> Spritely #9

So Lost Resolution is the historical moment that revealed
E-ORDER is **not** free in distributed implementations — it has
"uncomfortable edges which either must be programmed around or
be understood not to be exactly what we thought" (cwebber, in
the [cap-talk thread](https://groups.google.com/g/cap-talk/c/R5kc06XGqWs/m/WDraOqkQAgAJ)
that cwebber introduces in Spritely post #6 and that markm
re-quotes in #9; local mirror
`notes/references/google-groups-cap-talk-R5kc06XGqWs-WDraOqkQAgAJ.html.gz`).

That motivates the view that something weaker (Waterken-style
point-to-point FIFO, plus user-level e-order-like affordances)
is the more pragmatic target.

### 3.5 Relation to other named races

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
Both stem from preserving E-ORDER across indirect reference
passing, but they manifest in different ways and admit different
fixes.

### 3.6 How the descendants address it

- **Cap'n Proto** does not have the Lost Resolution Bug because
  it does not carry the same hashtable-PassByCopy semantics that
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
- **Mark Miller's contemporary view** has two stages, with the
  later one **superseding** the earlier:
  - *Spritely thread #8 / #9 (Oct 2022):* drop end-to-end
    E-ORDER in favor of "Tyler's Waterken point-to-point FIFO,"
    with e-order recovered at the user level via "appropriate
    affordances and conventions."
  - *Endo meeting transcript (May 2026):* clarify that
    "point-to-point" was a poorly-chosen term; the target tier
    is **end-to-end reference FIFO** (§1.4), strictly stronger
    than per-CapTP-session FIFO and strictly weaker than full
    E-ORDER. Promise shortening *is* required (for availability)
    and the protocol must add explicit synchronization at every
    shortening event to preserve §1.4. This 2026 framing is the
    current reference for OCapN.

---

## 4. WormholeOp

### 4.1 What it actually is

WormholeOp is **not** a side-channel "shortcut packet." Per the
canonical [erights `WormholeOp.html`](http://erights.org/elib/distrib/captp/WormholeOp.html),
it is a way for VatA to **tunnel her unacknowledged A↔C VatTP
traffic through VatB** so that VatB cannot deliver any message
that depends on VatC's state until VatC has already processed
that traffic. Wire shape:

```
WormholeOp(packets :byte[],
           source  :VatID,
           dest    :VatID)
```

Verbatim behavior, with the doc's note that it is unimplemented:

> "*Not yet implemented, but needed to fix the Lost Resolution
> Bug.*
>
> If `dest` is the receiving vat, then it should try sending
> this packets data to itself as encrypted VatTP communications
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

VatTP encrypts the traffic, so VatB cannot read or tamper with
the A↔C bits — VatB is just an untrusted relay.

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
> So, if VatA and VatB are cooperative, they are both assured
> that the needed `provideFor` 'from' VatA will be processed by
> VatC before VatC sees the corresponding `acceptFrom` from
> VatB. If either is uncooperative, they cannot cause damage
> beyond that accounted for by the object-level semantics.
> Because the data takes redundant paths, neither side will get
> stuck waiting on the other to timeout."

### 4.4 What it solves and what it doesn't

WormholeOp solves the 3-vat conflict between Partial Ordering,
Going Home, and Preserve Passability (§3.2). That is exactly
what makes the Lost Resolution Bug not happen — when WormholeOp
is present, the implementation can carry a Resolved
Carol-reference across the introduction without downgrading it.

It is *not* a fix for Tribble's 4-way race or for
promise-shortening in general. It is also a fundamentally
different mechanism from Cap'n Proto's embargo: Cap'n Proto's
embargo serializes a path *switchover* during promise
resolution; WormholeOp ensures that *introduced references*
arrive with all their prior dependencies already satisfied at
the destination.

### 4.5 Why the descendants don't use it

- **Cap'n Proto** does not need it because it does not have the
  same hashtable-PassByCopy passability semantics. For its own
  race (Tribble 4-way) it uses Embargo / Disembargo +
  forward-strictly-to-R, which is a different design.
- **OCapN** uses a pipelined version of the
  [erights `provideFor.html`](http://erights.org/elib/distrib/captp/provideFor.html)
  protocol — `provideFor` registers the gift at C, and an
  `acceptFrom` from B that arrives before the matching
  `provideFor` queues at C until the `provideFor` resolves it
  (so ordering is correct in the cooperative case, fail-safe
  otherwise). OCapN does not currently carry the
  Resolved-vs-Unresolved distinction the Lost Resolution Bug
  hangs on, so the bug does not manifest in the same form.
- markm (Spritely thread #8/#9) cites the Lost Resolution Bug
  as one reason to retreat from end-to-end E-ORDER to
  point-to-point FIFO with user-level affordances. The cost of
  WormholeOp specifically is named in the [Endo meeting
  2026-05-06](./references/Endo%20Meeting%2020260506%20transcript.md)
  ("having to standardize some form of **wormhole op**, flipped
  the cost–benefit for me") rather than in #9.

---

## 5. Sources

### OCapN (this repo)

- [`draft-specifications/CapTP Specification.md`](https://github.com/kumavis/ocapn/blob/b0a681d/draft-specifications/CapTP%20Specification.md)
- [`draft-specifications/Netlayers.md`](https://github.com/kumavis/ocapn/blob/b0a681d/draft-specifications/Netlayers.md)
- [`implementation-guide/Implementation Guide.md`](https://github.com/kumavis/ocapn/blob/b0a681d/implementation-guide/Implementation%20Guide.md)

### E and CapTP-of-E

- **Mark S. Miller, *Robust Composition: Towards a Unified
  Approach to Access Control and Concurrency Control*, Johns
  Hopkins PhD thesis, May 2006** — local mirror by chapter under
  [`notes/references/markm-thesis/`](./references/markm-thesis/).
  Authoritative for E-ORDER. Especially:
  - [Chapter 19 — Delivering Messages in E-ORDER](./references/markm-thesis/chapter-19-delivering-messages-in-e-order.md)
    (§19.1 fail-stop FIFO; §19.2 "FIFO is Too Weak"; §19.3
    forks; §19.4 "CAUSAL Order is Too Strong"; §19.5 joins;
    §19.6 fairness; §19.7 comparison to TCP / CAUSAL / AGREED)
  - [Chapter 16 — Promise Pipelining](./references/markm-thesis/chapter-16-promise-pipelining.md)
  - [Chapter 17 — Partial Failure](./references/markm-thesis/chapter-17-partial-failure.md)
    (`whenMoreResolved`)
  - [Chapter 18 — The when-catch Expression](./references/markm-thesis/chapter-18-the-when-catch-expression.md)
- [erights.org: Partially-Ordered Message Delivery](http://erights.org/elib/concurrency/partial-order.html) — Full / Tree / Partial Order tiers
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

- **[Endo meeting 2026-05-06 — message ordering](./references/Endo%20Meeting%2020260506%20transcript.md)** (edited transcript) — markm clarifies that "point-to-point FIFO" was a poorly-chosen term for what he meant; the correct framing is **end-to-end reference FIFO** (markm phrases it variously as "end-to-end FIFO per reference"). Also: don't standardize full E-ORDER, the modern Lost Resolution Bug definition, and why promise shortening is required for availability.
- [Spritely Conundrum: Message Ordering #8 (markm)](https://community.spritely.institute/t/conundrum-message-ordering/28/8) — local mirror `notes/references/spritely-conundrum-message-ordering-28-post8.html`
- [Spritely Conundrum: Message Ordering #9 (markm)](https://community.spritely.institute/t/conundrum-message-ordering/28/9) — local mirror `notes/references/spritely-conundrum-message-ordering-28-post9.html`
- [Spritely Conundrum: Message Ordering — thread index](https://community.spritely.institute/t/conundrum-message-ordering/28) — local mirror `notes/references/spritely-conundrum-message-ordering-28.json`
- Excerpts in readable form: `notes/references/spritely-conundrum-message-ordering-excerpts.md`

### Related ocapn issues (local mirrors)

- `notes/references/ocapn-ocapn-issue-15.json` — "Replacing deliver.rdr with op:listen?"
- `notes/references/ocapn-ocapn-issue-24.json` — referenced by zarutian in the wire-trace example
- `notes/references/ocapn-ocapn-issue-236.json` — original promise-shortening discussion before #11
- `notes/references/ocapn-ocapn-issue-265.json` — Two Generals concern in 3PH

---

## 6. Glossary

**Vat.** A single event-loop with a heap of objects. Within a
vat, processing is single-threaded and turn-based. Cross-vat
communication is asynchronous.

**Eventual send (`<-`).** E's asynchronous message operator.
`target <- verb(args)` queues a delivery into the recipient's
vat for a future turn and returns a promise for the result. The
basic unit that ordering is defined over.

**Reference.** A capability — a designator for an object that
also conveys authority to invoke it. Each promise and each
presence is a reference.

**Promise.** Placeholder for a value not yet known. Resolved
with a value (possibly another promise) or broken with a reason.

**Promise pipelining.** Sending messages to a promise before it
resolves. Over the wire, the messages can be queued at the
holder of the promise's resolution, eliminating round trips.

**Granovetter introduction (3-vat).** Vat A holds references to
objects in Vats B and C; A introduces them by sending B a
message that contains a reference to C's object. The canonical
three-party handoff scenario.

**Three-party handoff (3PH).** The CapTP machinery for a
Granovetter introduction across vats — getting B a usable
reference to C without B and C having previously talked.

**Gift table.** A table at the destination vat (C) holding
pending introductions, indexed by a nonce. A deposits the gift;
B redeems it.

**4 Tables (CapTP).** The per-connection state in CapTP-of-E:
Questions, Answers, Imports, Exports.

**Hasse diagram.** The visualization markm uses (thesis Figure
19.1) for E-ORDER constraints. References as arrows; messages
between the source-and-arrowhead points; forks where references
get sent as arguments.

**E-ORDER.** Markm's thesis (Chapter 19) name for fail-stop FIFO
with forks; joins (§19.5) are presented as part of the same
chapter and so can also be considered part of E-ORDER. This
document splits them for clarity: §1.5 is "E-ORDER (Tree Order
with forks)" and §1.6 is "E-ORDER with joins (Partial Order)" —
matching the tier names on `partial-order.html` and
`after-both.html`. The forks property is what distinguishes
E-ORDER from end-to-end reference FIFO. Markm's contemporary view
(Endo meeting 2026-05-06) is that full E-ORDER is too costly to
standardize over the network and OCapN should target end-to-end
reference FIFO (§1.4) instead.

**Fail-stop FIFO.** Per markm thesis §19.7, "the guarantee that
a message sent later on a channel will only be delivered if all
messages sent earlier on the same channel will eventually be
delivered." Per-pair-of-actors, stronger than per-channel TCP
FIFO. See §1.3.

**Full / Tree / Partial Order.** The three tiers of E's ordering
spec (erights `partial-order.html` plus `after-both.html`):
*Full Order* on a single reference, two-party; *Tree Order*
across forks (three-party Granovetter); *Partial Order* once
joins are added (four-party grant matching).

**Point-to-point FIFO (Waterken / Tyler Close).** Per-HTTP-pipe
FIFO between two peers. Doesn't try to follow references across
hops. Mark Miller's stated current preference (Spritely thread).

**Embargo / Disembargo (Cap'n Proto).** When a promise resolves
to a remote ref, the receiver queues outbound messages on the
new direct path and sends a `Disembargo` with `senderLoopback`;
once the same `Disembargo` returns with `receiverLoopback`, the
queue flushes. Forces any in-flight messages on the old path to
drain first, preserving E-ORDER across resolution.

**Forward-strictly-to-R (Cap'n Proto).** Once a promise P
resolves to a remote ref R, all further messages to P are
forwarded only to R, *never* re-shortened to R's own resolution.
Sidesteps the Tribble 4-way race by giving up further
shortening. The chain stays pinned through the first remote ref
forever.

**Tribble 4-way race.** Named for Dean Tribble. A race in which
a remote promise P1 resolves to another remote promise P2 which
simultaneously resolves to a fourth-vat object Q. dtribble in
[ocapn/ocapn#11](https://github.com/ocapn/ocapn/issues/11)
confirms this is the same as "the Midori four vat promise
shortening case."

**WormholeOp.** A CapTP-of-E mechanism in which VatA tunnels
her unacknowledged A↔C VatTP traffic *through VatB* on the way
to VatC, so that VatB cannot deliver any message that depends
on VatC's state until VatC has processed VatA's prior A→C
traffic. The wormhole'd bytes are VatTP-encrypted, so VatB is
just an untrusted relay. Marked "Not yet implemented" on the
canonical erights page; not adopted by Cap'n Proto or OCapN.

**Lost Resolution Bug.** A documented bug in current E
implementations: a Far (Resolved) Carol-reference, transmitted
through Bob to a third vat, arrives at Bob as a Promise
(Unresolved) instead. The "resolution" that gets *lost* is the
**resolved-ness** of the reference. The implementation
downgrade is the deliberate workaround for the lack of
WormholeOp.

**Auxiliary Data Problem.** Agoric-internal name for related
distributed-data races; markm's "cheap auxdata" approximation
PR is [agoric-sdk#6355](https://github.com/Agoric/agoric-sdk/pull/6355).

**Promise shortening.** A protocol-level optimization. Initially
Alice's promise `p1` (held in vatA) routes through vatB; once B
has resolved `p1` to something hosted in vatC, the chain is
shortened so messages from A to that target travel A→C
directly, bypassing B. Two motivations: (a) performance —
fewer hops, shorter latency; (b) availability — once shortened,
B can leave the network without breaking A↔C.

**End-to-end reference FIFO.** Per-sender, per-logical-reference
FIFO that survives promise shortening (§1.4). Messages sent by a
single vat on what the application sees as the same reference
are delivered in send order at the destination, even when the
wire-level path or wire-level reference identity changes
underneath. This is the actual goal `op:flush` (and its
alternatives) are trying to deliver and what Cap'n Proto's
embargo machinery actually delivers. **Strictly weaker than
full E-ORDER (§1.5)** — does not enforce the cross-sender forks
constraint (Bob's Y must arrive after Alice's X when the
reference was forwarded). Markm's contemporary recommendation
for OCapN
([Endo meeting 2026-05-06](./references/Endo%20Meeting%2020260506%20transcript.md)).

**Causal order.** The general distributed-systems property: if
message m₁ causally precedes m₂ (e.g., the sender of m₂ had
observed m₁'s effects before sending m₂), then m₂ is delivered
after m₁. Stronger than per-pipe FIFO; weaker than total order.
End-to-end reference FIFO is one specific slice of causal order —
the slice along a single logical reference from a single sender.
Markm thesis §19.4 explicitly rejects full causal order as a
target for distributed ocap.
