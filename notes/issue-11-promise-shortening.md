# Issue #11: Promise Shortening and Point-to-Point FIFO

Working notes summarizing [ocapn/ocapn#11](https://github.com/ocapn/ocapn/issues/11),
"Promise Shortening." Tracks the problem identified, the disagreement over
what OCapN's FIFO guarantee actually means, and Ridley's evolving proposal.

## 1. Context

Issue #11 was opened by [@erights](https://github.com/erights) (Mark Miller)
in April 2021 as a placeholder asking [@dtribble](https://github.com/dtribble)
to explain "the Midori four-vat promise shortening case." It sat largely
dormant until March 2026, when a closely-related discussion in
[#236](https://github.com/ocapn/ocapn/issues/236) was migrated into it by
[@RidleyWrites](https://github.com/RidleyWrites) and the design conversation
began in earnest.

Active participants: erights, RidleyWrites, dtribble, zarutian, davexunit,
zenhack, kriskowal, gibson042, cwebber.

## 2. Glossary (for this document)

**Promise shortening.** A protocol-level optimization. Initially Alice's
promise `p1` (held in vatA) routes through vatB; once B has resolved `p1` to
something hosted in vatC, the chain is shortened so messages from A to that
target travel A→C directly, bypassing B. Two motivations:

- **Performance.** Fewer hops, shorter latency.
- **Availability.** "Once messages from Alice in vatA to Charlie in vatC no
  longer need to go through vatB, in any quiescent state following that, if
  vatB alone goes offline, … messages from Alice in vatA to Charlie in vatC
  should still be delivered." (erights)

**Point-to-point FIFO.** OCapN's stated ordering guarantee. The point of
contention in this issue is *which* points: (a) the two peers of a single
CapTP session, or (b) the sending vat and the receiving object end-to-end,
even when the path goes through a third party.

**End-to-end reference FIFO.** Messages sent on the *same logical
reference* (from the application's perspective) are delivered in send
order at the destination, even when the wire-level reference identity
changes during promise shortening. This is the actual goal `op:flush`
(and its alternatives) are trying to deliver — not the more general
"vat-to-object FIFO."

**Causal order.** The general distributed-systems property: if message m₁
causally precedes m₂ (e.g., the sender of m₂ had observed m₁'s effects
before sending m₂), then m₂ is delivered after m₁. Stronger than per-pipe
FIFO; weaker than total order. End-to-end reference FIFO is one specific
slice of causal order — the slice along a single logical reference from
a single sender.

**Settled / resolved / forwarded.** Modern promise terminology used by
erights:
- *Settled* = fulfilled or broken (terminal).
- *Resolved* = fulfilled or broken or *forwarded* (i.e., the promise has
  been pointed at another promise; resolution may not yet be terminal).
- E historically conflated these; the distinction matters here.

**Redirector (E term).** Internal-to-CapTP object that controls where a
remote promise points. Resolver-like but not a resolver: redirectors can be
invoked more than once to update where the promise points. In E, the
redirector is what implements the embargo during shortening.

**`whenMoreResolved` / `whenMoreSettled` (E).** A meta-message that travels
along a promise chain. Its arrival at any link in the chain is taken as
evidence that all prior messages on that chain have already passed through.
Used by E to implement the shortening miracle.

**`op:flush` (RidleyWrites' proposal).** A new CapTP op. Conceptually a
descendant of E's `whenMoreSettled`, but specified as a protocol-level
operation rather than a meta-message visible to user code.

**Two Generals' Problem.** Mentioned by cwebber as a concern — the
impossibility of guaranteeing two parties can come to consensus over an
unreliable channel. Surfaced when discussing alternatives to the flush
proposal; Ridley notes the same concern already applies to three-party
handoff (#265) and so isn't a unique blocker for shortening.

**WormholeOp.** Side-channel A→C packet from CapTP-of-E (see
`notes/message-ordering.md`). erights states explicitly in this thread:
"E-order does indeed need WormholeOp, and this is indeed a major reason to
avoid an E-order requirement. **vat-to-object fifo with promise shortening,
with or without the improved pipelining, has no need whatsoever for
WormholeOp.**" Settling on per-object FIFO instead of E-order lets OCapN
drop WormholeOp altogether.

## 3. The problem

### 3.1 The corner case

erights' three-vat scenario, slightly paraphrased:

```
vatA: Alice                  vatB: Bob                  vatC: Clair → Charlie
  |                            |                          |
  | -- x() -------------------> Bob.x():
  |     (returns p1)            |  p2 = E(clair).y()
  |                             |  return p2
  | <- (later) p1 = p2 -------- |                         |
  |                                                       |
  | (eventually p1 shortens directly to p3 in vatC)       |
  |                                                       |
  | -- z() on p1 -------> goes A→B (p1 still via Bob)     |
  | -- w() on p1 -----------------------------> goes A→C  |  (direct)
  |                                                       |
  |                       Bob forwards z() onward to C ─→ |
```

If `w()` along the short path A→C arrives before `z()` finishes its longer
journey A→B→C, Charlie sees `w()` then `z()` — out of order. Note what
breaks: the application sent both `z()` and `w()` on `p1`, the same
*logical* promise. But under shortening, those two sends use *different
wire references*: `z()` was sent via Alice's import for Bob (call it
`ref_B`), and `w()` was sent via Alice's import for Carol (`ref_C`).
Per-connection FIFO between Alice and any one peer does not relate
messages sent on different references. So even though every individual
two-peer connection is FIFO, the application-visible reference FIFO is
broken at exactly the moment Alice's send-target-reference changes.

### 3.2 The 4-vat generalization (Tribble / Midori)

dtribble's earliest comment generalizes the problem. Two shortening events
can overlap:

```
A.X → B.Y → C.Z → D.R                    (initial chain)
A.X → C.Z → D.R    and    A.X → B.Y → D.R   (after one shortening each)
A.X → D.R          and    B.X → D.R         (after the other shortening)
```

Messages can cross any of these edges in any order, and "the 4-party case
should be generalized in any implementation such that we don't need to
worry about the 5, 6, etc. party cases. The 3-party case just didn't
include crossing shortenings." (dtribble)

zenhack notes this is the same race that Cap'n Proto's `rpc.capnp` calls
the **Tribble 4-way race**.

### 3.3 The disagreement about what "FIFO" means

This is the pivotal exchange, and it's worth quoting:

> **RidleyWrites:** "As far as I have understood previous discussions, this
> group has only agreed to preserve FIFO between two peers. This example
> includes a third peer."
>
> **erights:** "Perhaps we were confused about what we thought we were
> agreeing to. This is never what I meant by 'point to point FIFO'. The
> 'points' I meant are the sending vat (vatA) and the receiving object
> (Charlie), respectively. This effectively implies: 'sending object
> (Alice) and receiving object (Charlie), respectively'. If we don't mean
> that, then I fail to see how the programmer benefits from the FIFO
> guarantee. Programming with FIFO is too hard to do correctly. Programming
> with 'almost always FIFO' is too hard to tell that you did not code
> correctly."

So the OCapN spec's current netlayer-level "messages received in the order
sent" may understate what users (and erights) expect. The strong reading
demanded here is **end-to-end reference FIFO**: messages sent on the same
logical promise are delivered in send order even when shortening changes
the wire-level reference Alice uses to send them. (erights phrases this as
"sending object and receiving object," which amounts to the same property
in this design — the "reference" the application holds is what binds Alice
and Charlie together across path changes.) This is strictly stronger than
per-session FIFO and strictly weaker than full E-order (which would also
require WormholeOp for cross-reference ordering on three-party handoffs).

### 3.4 What flush is actually solving: end-to-end reference FIFO as a slice of causal order

Promise shortening changes which wire reference Alice uses to send.
Per-connection FIFO holds on each individual reference; it does not
hold across a switch from one reference to another. The application
sees one promise; the protocol sees two references. Flush bridges
the gap.

This is a special case of *causal order*. Causal order in
distributed systems says: if m₁ causally precedes m₂ (m₂ was sent
after m₁'s effects were observable to the sender), m₂ is delivered
after m₁. Mark Miller's thesis frames the design space directly:
fail-stop FIFO is "too weak" (§19.2), CAUSAL order is "too strong"
(§19.4), and **E-ORDER** sits between them as the right point.

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
> possibilities the newly arriving reference-to-Carol provides to
> VatB, rather than the removal of previously present
> possibilities."
> — markm, *Robust Composition* §19.4

Three increasingly weak slices of causal order are at play here:

| Slice | Definition | Status in OCapN |
|---|---|---|
| Full causal order | Across all senders, references, and forwarding paths, m₁ → m₂ implies m₂ delivered after m₁ | Explicitly **not** attempted (markm thesis §19.4: "we don't know how to enforce it among mutually defensive machines") |
| E-ORDER (= end-to-end reference FIFO with forks) | Per-sender, per-logical-reference: messages sent in order on the same promise are delivered in order, even across shortening or 3PH | What `op:flush`, per-promise seq, and erights' position are all targeting; markm's thesis §19.3 |
| Fail-stop FIFO (per-CapTP-session) | One sender, one wire reference, one connection: messages on a single CapTP session arrive in send order | What netlayers already provide; what Ridley's reading takes the spec to mean today; markm thesis §19.1 calls this "too weak" alone |

E-ORDER is the specific slice of causal order this issue is about.
It's the property an application programmer naturally expects when
they hold a promise and call `p.foo()` then `p.bar()`. Anything
stronger (full causal order) is out of scope by markm's
own argument. Anything weaker (per-CapTP-session FIFO alone)
breaks programmer expectations precisely at shortening events,
which is the "too weak" condition.

What flush is *not* doing:

- Not enforcing ordering between messages on different references
  (those are independent).
- Not enforcing ordering between messages from different senders
  (those interleave arbitrarily, as is normal in ocap systems).
- Not enforcing ordering of effects across vats (Bob processing
  one of Alice's messages before Carol processes a related one is
  a separate, application-level concern).

What flush *is* doing:

- Bridging the wire-level reference change during shortening so
  that the application's view — "two sends on the same promise" —
  remains FIFO at the destination.

Calling this guarantee "end-to-end reference FIFO" rather than
"vat-to-object FIFO" is more precise. Two independent references
held by Alice that both happen to point at Charlie are not made
FIFO by flush; they were never related in the application's
intent.

### 3.5 Waterken comparison

Waterken (Tyler Close) is a useful reference point because erights, on the
Spritely thread, said he had retreated from E-order toward "Tyler's
Waterken point-to-point FIFO" — and yet here in #11 he's pushing for
something stronger than what Waterken actually delivers. The four rows
make the disagreement legible:

| Reading | Guarantee | Requires | Cost |
|---|---|---|---|
| Waterken (Tyler Close) | Per-HTTP-pipe FIFO between two peers | FIFO+reliable HTTP. **No protocol-level promise shortening** — introductions are URL-sharing, response promises resolve along the same pipe. | Cheap. No availability win from shortening. |
| Ridley's reading of OCapN | Per-CapTP-session FIFO | Same as Waterken in practice | Cheap. Admits that shortening reorders. |
| erights' reading of OCapN (#11) | End-to-end reference FIFO across shortening | Flush/embargo around each shortening event | Moderate. Needs `op:flush` or equivalent. |
| Full E-order | Per-reference FIFO including across handoffs | WormholeOp + embargo + forward-strictly-to-R | Heaviest. |

Waterken can be row 1 cheaply because it sidesteps the shortening
optimization entirely: there is always one direct path between two peers,
so there's no race between an old and a new path. OCapN, by treating
shortening as a protocol-level feature, takes on the FIFO obligation that
Waterken can sidestep.

erights' position in this issue is row 3: end-to-end reference FIFO
preserved across shortening, *without* the WormholeOp tax of full
E-order. Quoting his explicit framing: "vat-to-object fifo with promise
shortening, with or without the improved pipelining, has no need
whatsoever for WormholeOp." (His "vat-to-object" phrasing reduces to
end-to-end reference FIFO in this design — a single sender's sends on a
single logical reference must arrive in order.) Row 3 is the sweet spot
if it can be implemented; Ridley's `op:flush` proposal is an attempt at
exactly that.

## 4. How E solved it (for context)

erights walked through the historical E solution. Sketch:

1. When vatA sends `x()` to Bob, vatA also sends `whenMoreSettled(p1Rdr)`
   on the question-promise `p1`. `p1Rdr` is vatA's redirector for `p1`.
2. That `whenMoreSettled` flows through any chain of intermediate promises
   (p2, p3, …) following the same path as data messages.
3. When it reaches a promise's eventual fulfillment, the receiving vat
   sends `run(local-promise)` back to `p1Rdr` in vatA.
4. On receiving `run(p3)`, `p1Rdr` knows shortening is possible. It:
    - Switches `p1` to **embargo** mode: further messages buffer in vatA.
    - Sends a fresh `whenMoreSettled(p1Shortener)` on `p1`.
5. That second `whenMoreSettled` follows the *same* path as in-flight
   messages like `z()`. Its arrival at vatC is the signal that everything
   sent earlier on the long path has already been forwarded onward.
6. `p1Shortener` then releases the embargo: buffered messages (`w()`) are
   sent on the now-direct A→C path. They arrive *after* `z()` because `z()`
   has already passed through.

Key idea: a meta-message that **travels along the same promise chain as
real messages** is the natural barrier. Whatever was sent before it has
already passed each waypoint. erights' phrasing: this is a **flush**
synchronizer in disguise.

erights does not recommend reifying redirectors or `whenMoreSettled` as
user-visible objects in OCapN. They should be **ops** — invisible to user
code and outside the questions/answers invocation path.

## 5. Ridley's proposals (chronological)

### 5.1 First proposal — `op:flush` initiated by Alice

[Comment 2026-03-12](https://github.com/ocapn/ocapn/issues/11#issuecomment-4049548223)

```
<op:flush target-desc       ; <desc:answer> | <desc:export>
          resolver-desc>    ; <desc:import-object> | <desc:sig-envelope>
```

Flow:

- Alice tracks promises she's sent messages on.
- When Alice's resolver receives a shortening notice (p-bob → p-carol):
    - If Alice never sent any messages on p-bob, no flush is needed; carry on.
    - Otherwise, Alice creates a new local resolver `r-alice`, exports it,
      buffers further messages locally, and sends
      `op:flush(p-bob, r-alice)` to Bob.
- Bob, seeing `p-bob` resolved to `p-carol`, prepares a third-party handoff
  of `r-alice` to Carol and sends `op:flush(p-carol, sig-envelope)` onward.
- Carol completes the 3PH (acquires `r-alice` via the usual mechanism) and
  delivers a message to `r-alice`, signaling that the flush has reached her.
- Alice's buffered messages then go out on the now-direct A→C path; FIFO
  preserved.

Constraint: `op:flush` MUST NOT be sent if no pipelined messages were sent
to that promise, and MUST NOT be sent if no further messages will be sent
post-shortening. (Avoids gratuitous overhead.)

[davexunit](https://github.com/davexunit) endorsed: "doesn't add any
overhead to the majority of messages being sent, just in the (probably
infrequent) shortening cases."

### 5.2 erights' pipelining enhancement (alternative)

[Comment 2026-04-15](https://github.com/ocapn/ocapn/issues/11#issuecomment-4248843272)

erights suggests **moving the embargo to vatC** to keep pipelining flowing
during the shortening window:

- vatC, on receiving the deposit-gift, creates a promise/resolver pair
  locally to serve as the embargo, and sends both p3 and the embargo
  promise to vatA along with the gift.
- vatA's redirector switches incoming messages to flow toward the embargo
  promise immediately (no longer buffered at A).
- When vatA releases the embargo, all those messages are already at vatC
  ready to forward to the shorter promise.

erights frames this as a generalization of the existing 3PH gift-table
buffering already described at `provideFor.html#elems10`: when vatB asks
vatC for a gift before vatA has deposited it, vatC creates a promise for
the gift and resolves it later. The shortening case is "simply not
prohibiting" the gift sender and gift recipient from being the same vat.

Trade-off: better pipelining; more implementation complexity. Ridley's
reaction: "the difference would not be one of round-trips but only of the
time it takes to transmit any embargoed messages, right? … I'm not
convinced that the additional implementation challenges would be worth it."

### 5.3 Second proposal — flush every peer in the chain

[Comments 2026-04-22](https://github.com/ocapn/ocapn/issues/11#issuecomment-4280776681)

Ridley diagrammed a 4-party scenario showing his first proposal *doesn't*
preserve FIFO: flushing A→B→C ensures Alice's messages reached Carol, but
not that they reached Derek. The fix:

> "If we have peers 1, 2, …, p, …, n where p is the first peer we sent a
> message to for this promise chain (Bob in our example), we must send a
> flush to every peer in p, …, n − 1 as shortening to that peer occurs."

I.e., shortening propagates and each shortening event triggers a flush at
the new tail of the chain.

### 5.4 The bug in #5.3 — Bob doesn't know where to forward

[Comment 2026-04-29](https://github.com/ocapn/ocapn/issues/11#issuecomment-4302069946)

When Alice sends `op:flush` to Bob, the flush needs to follow Alice's
messages to wherever those messages are now headed. But Bob's `p2` may
*itself* have already been shortened by the time the flush arrives —
shortened to Derek, not Carol. So Bob would forward the flush to the wrong
peer. Ridley abandons this direction.

### 5.5 Third proposal — flush initiated by Bob (current latest)

[Comment 2026-04-29](https://github.com/ocapn/ocapn/issues/11#issuecomment-4302134692)

Inverts who starts the flush. Bob, when he is ready to shorten, initiates
the flush *toward Alice* against Alice's resolver `r` for `p1`:

1. Bob sends a flush to Alice, targeting `r`.
2. Alice creates a fresh promise/resolver pair `(p', r')`. She fulfills `r`
   with `p'` and replaces `r` in her export table at the same position with
   `r'`. Further messages on `p1` now buffer locally in `p'`.
3. Alice replies with a "flush done" message.
4. Bob, on receiving "flush done," knows every message Alice ever sent on
   `p1` has been received by Bob.
5. Bob now performs a normal third-party handoff of `p2`, targeting Alice's
   `r'`. Because B↔C is FIFO, Carol cannot receive the deposit-gift until
   she has received every forwarded Alice-message that came through Bob.
6. Alice connects to Carol via the handoff. `p'` is fulfilled with the
   handoff promise `p''`. Alice's buffered messages flush directly to Carol
   in order, after the messages that came through Bob.

Advantages claimed:
- Fewer messages than #5.1.
- Reasonable to implement.
- Generalizes to N parties (Ridley diagrammed the 4-party case).

Disadvantages:
- Flush must occur on every shortening, even if Alice never sent messages.
  (Lost the optimization of #5.1's "no flush if no messages sent.")

This is the current state of the proposal as of 2026-05-06.

### 5.6 Naming bikeshed

A side discussion on whether to keep Alice/Bob/Carol/Derek (more readable
in discussion) or switch to role names for the spec. Ridley's current
suggestion: `[Caller, Shortener₁, …, Shortenerₙ, Settler]`, or in
spec-friendly form, `P₁…Pₙ` for peers and `Oₚ,ₘ` for object m on peer p.

## 6. Comparison: `op:flush` vs. Cap'n Proto's embargo

Both are mechanisms for preserving message ordering across promise
resolution. Both explicitly avoid WormholeOp. But the two designs make
contrasting architectural choices that clarify what Ridley's proposal is
optimizing for.

### 6.1 At a glance

| Dimension | Cap'n Proto embargo | Ridley `op:flush` (current latest) |
|---|---|---|
| What it preserves | E-order (per-wire-reference FIFO) | End-to-end reference FIFO (per-logical-reference, surviving shortening) |
| Who initiates | Receiver of `Resolve` (Alice) | Promise-host ready to shorten (Bob) |
| Where the buffer lives | Receiver's queue on the new direct path | Sender's local promise `p'` (Alice) |
| Synchronization signal | `Disembargo` round-trip looped through the *old* path | `op:flush` / "flush-done" round-trip on A↔B; B→C 3PH gift sequenced behind forwarded messages |
| Trigger | Each `Resolve` to a remote ref | Each shortening event |
| Relationship to 3PH | Orthogonal — embargo guards the new path that 3PH creates | Sequenced — flush completes *before* 3PH starts |
| Multi-hop chains | "Forward strictly to R" — chain is **never** collapsed past the first remote ref | Transitive shortening — each link may shorten with its own flush |
| Tribble 4-way race fix | "Forward strictly to R" rule | Per-shortening flush; collapses each have to flush |
| Wire visibility | Internal control message | New top-level CapTP op |
| Pipelining during the gap | Messages can queue at receiver (Cap'n Proto) | Messages buffer at sender (erights' §5.2 enhancement would move them to far end) |

### 6.2 Three structural differences

**1. Who decides to synchronize.** Cap'n Proto puts the trigger on the
*receiver*: Alice has just been told about a resolution and decides to
embargo before using the new direct path. Ridley puts the trigger on
the *resolver*: Bob, who is about to shorten a chain, asks Alice to
quiesce her sends through him before he triggers the 3PH. The
receiver-initiated model fits naturally when the resolution information
itself is the trigger; the resolver-initiated model fits when shortening
is a discrete event that some other party can choose to enact.

**2. How the "drained" signal is constructed.** Cap'n Proto uses a
*loopback through the old path*: it sends `Disembargo` along whatever
path the now-stale messages were on; when the disembargo returns, FIFO
guarantees that path has drained. Ridley uses a *direct
request-response on a different link*: Bob asks Alice via `op:flush` "are
you done?", Alice swaps her export-table entry for the resolver (so any
future sends will buffer in `p'` rather than go over the wire to Bob via
the old `r`), and Alice replies "flush done." The rendezvous is the
flush plus its reply; FIFO of A↔B is what makes the reply mean what it
needs to mean. The B→C 3PH gift then naturally sequences behind any
previously-forwarded A→B→C messages because B↔C is FIFO.

In both designs, the underlying primitive is the same — per-connection
FIFO from the netlayer. They just exploit it on different topologies:
Cap'n Proto exploits FIFO on the path that needs to drain, Ridley
exploits FIFO on A↔B for the rendezvous and FIFO on B↔C for the gift's
relative ordering.

**3. Whether resolution chains collapse.** This is the most important
divergence. Cap'n Proto's "forward strictly to R" rule says: once P
resolves to a remote R, the chain is frozen — even if R itself later
resolves remotely, P keeps forwarding to R, not to R's resolution. This
sidesteps the Tribble 4-way race by *giving up further shortening*.
Ridley's design allows further shortening: each link of a resolution
chain (P→R, R→Q, …) can be shortened with its own flush. The cost is
extra round trips for long chains; the win is the availability property
erights opened the issue with — *"if vatB alone goes offline, … messages
from Alice in vatA to Charlie in vatC should still be delivered."*
Cap'n Proto's rule explicitly trades that away. Ridley's design tries
to keep it.

### 6.3 What they share

- Both rely on per-connection FIFO at the netlayer as the bedrock
  primitive.
- Both avoid WormholeOp and so settle for something weaker than full
  E-order.
- Both implement a *barrier* across resolution rather than trying to
  reorder implicitly with timestamps or sequence numbers.
- Both have a "move the buffer closer to the destination for better
  pipelining" alternative on the table (erights' §5.2 vatC-side embargo
  for Ridley; Cap'n Proto's existing receiver-side queuing).

## 7. Interrogating the `op:flush` design

This section pokes at the current proposal (§5.5) to get a concrete
sense of overhead, where it wins, and where the holes are. It is
deliberately critical; nothing here is a verdict.

### 7.1 Overhead in concrete scenarios

Notation: each scenario counts wire messages added by the flush
machinery and the latency in round trips before the system reaches
"shortened state" (Alice can send directly to the eventual settling
vat with FIFO preserved).

#### Scenario A: 3-vat shortening, no pipelined messages

Setup: Alice did `bob!x()` and is awaiting the result. She has not
sent any further messages on `p1`. Bob is ready to shorten because
his `p2` resolved to Carol's object.

Even though there is nothing to flush, the proposal flushes anyway
("Flushing must always occur as part of promise shortening, even if
Alice never sent a message to Bob.").

Wire cost added by flush:
- Bob → Alice: `op:flush` (1 msg)
- Alice → Bob: flush-done `op:deliver-only` (1 msg)
- = **2 extra messages, 1 extra A↔B RTT**, all overhead. Strictly waste
  in the common case where no messages are pipelined.

#### Scenario B: 3-vat shortening, with pipelined messages

Setup: same as A, but Alice has sent `z()` on `p1` and is about to
send `w()`. The messages are flowing A→B→C.

Wire cost added by flush:
- Bob → Alice: `op:flush` (1 msg)
- Alice → Bob: flush-done (1 msg)
- = **2 extra messages, 1 extra A↔B RTT**.

Pipelining loss: any application sends Alice issues during the flush
window plus the subsequent 3PH (~2 RTTs total) buffer locally at
Alice's `p'` rather than flowing to Carol. Cap'n Proto's embargo, by
contrast, would already have the new direct path open and could
queue at the receiver.

This is the only scenario where flush is doing useful work — and
even here, the extra A↔B RTT is purely serial with the 3PH.

#### Scenario C: 4-vat chain shortening

Setup: Alice → Bob → Carol → Derek. Each link could be shortened.
Per Ridley's diagram, each shortening step requires its own flush.

Wire cost (worst case, sequential shortenings):
- Flush B→A and back (2 msgs)
- 3PH B↔A↔C (3 msgs)
- Flush C→A and back (2 msgs)
- 3PH C↔A↔D (3 msgs)
- = **10 extra messages, 4 sequential RTTs** to reach fully shortened
  A→D state.

Plus: each of those flush-dones is sent on a different connection
(A↔B, then A↔C). Per-connection FIFO doesn't relate them, so the
ordering between the two flush dones requires the protocol's
sequencing — Ridley's diagram notes "the 'flush done' from Bob to
Carol is dependent on the 'flush done' from Alice to Carol", which
hints at a coordination requirement that the spec doesn't yet pin
down.

For an N-vat chain, this is **O(5(N−1))** messages and **O(2(N−1))**
sequential RTTs. Linear in chain length — a real cost.

Cap'n Proto avoids this entirely: chains are *never* shortened past
the first remote ref ("forward strictly to R"). Constant overhead
in chain length, but messages travel N hops forever.

#### Scenario D: many promises shortening at once

Setup: Alice has 100 promises hosted by Bob. Bob's outputs all
resolve more or less at the same time and Bob wants to shorten all
of them.

Wire cost: 200 flush messages (1 op:flush + 1 flush-done per
promise) before any 3PH starts.

The protocol has no batching primitive. Each shortening event is
independent. A worthwhile follow-up is a batched `op:flush-many` or
making `op:flush` carry a sequence of resolvers.

#### Scenario E: shortening with an idle Alice

Setup: Alice has the promise but hasn't sent anything for a long
time. Bob shortens.

Same as Scenario A: 2 messages of pure overhead. The "no messages to
flush" case is indistinguishable from "many messages to flush" from
Bob's vantage point, so the always-flush rule pessimizes the common
case.

### 7.2 Comparison of overhead vs Cap'n Proto

| Scenario | `op:flush` | Cap'n Proto embargo |
|---|---|---|
| 3-vat shortening, no pending sends | 2 msgs, +1 RTT serial with 3PH | 0 msgs (no embargo needed if no pending sends — receiver knows) |
| 3-vat shortening, with pending sends | 2 msgs, +1 RTT serial with 3PH; messages buffer at sender | 2 msgs (Disembargo loop), parallel with new path; messages buffer at receiver |
| 4-vat chain shortening | O(5N) msgs, O(2N) sequential RTTs | 0 shortening msgs (chain frozen); messages cost N hops forever |
| Concurrent multi-promise shortening | O(2K) msgs for K promises | O(2K) Disembargos but no protocol-level serialization |
| Pipelining during shortening | Lost (messages buffer at Alice) | Preserved (queued at receiver) |

The `op:flush` design generally costs *more* messages and *more*
serial latency per shortening event, in exchange for the availability
property that Cap'n Proto explicitly trades away.

### 7.3 Holes and unresolved issues

#### 7.3.1 Always-flush wastes work

The current proposal mandates a flush on every shortening, even when
Alice has not pipelined. In a system where shortening is common but
pipelining is rare, this is significant overhead. A "did I receive
any messages on this promise" hint from Bob's side could let Bob
skip the flush — but determining this from Bob's side is racy without
explicit signalling. A sequence-number scheme on pipelined messages
would let Bob say "I've seen up to seq N, do you confirm" and skip
the flush if Alice confirms; this trades the always-flush cost for
sequence-tracking state.

#### 7.3.2 Latency penalty is serial with 3PH

The flush dance is a full A↔B round trip *before* Bob can begin the
3PH. The 3PH itself is another ~1.5 RTTs. Total: ~2.5 RTTs to reach
shortened state. Cap'n Proto's embargo runs in parallel with the new
path being established, so it's effectively ~1 RTT.

erights' §5.2 alternative (move the embargo to vatC) addresses the
pipelining lost during the buffer window but does not address the
extra serial RTT — that is intrinsic to the resolver-initiated
design, because Bob has to wait for confirmation that Alice has
quiesced.

#### 7.3.3 Pipelining is lost during the buffer window

Messages Alice's application sends during the flush + 3PH window
buffer locally in `p'` rather than flowing toward the destination.
For ~2 RTTs of latency, Alice's outbound throughput on this promise
is zero on the wire.

The §5.2 alternative — receiver-side embargo at vatC — recovers most
of this. But Ridley deferred it as too complex.

#### 7.3.4 Concurrent resolution races

What happens if Bob has already sent the resolution message
(resolving `r` directly via op:deliver-only on the import) and *then*
sends `op:flush`? By A↔B FIFO, Alice receives the resolution first,
fulfills `r` with the resolved value, and `r` is no longer in
"resolver" state when `op:flush` arrives.

The spec's only treatment of this is "If the position is not in use,
the receiver MUST break flush-done-resolver." But "in use" is
ambiguous after fulfillment — the export-table position may still
hold a reference, just one that's been fulfilled. The spec needs
language that says either "MUST be unresolved" or "SHOULD be treated
as a no-op" or similar.

A more pernicious case: Bob sends `op:flush` and *concurrently*
sends a resolution (from a different turn of Bob's event loop).
Both are on the Bob→Alice wire. The resolution might pass `op:flush`
or vice versa depending on Bob's local turn ordering. Either order
needs a defined outcome.

#### 7.3.5 Multi-session resolver sharing

The spec says "replace the export-table entry at the same position
with `r'`". This is per-session. But Alice's resolver `r` is a
local object — Alice could have exported it in another session
(e.g., to a third party that also holds the promise). The swap only
affects Bob's session; from Dave's session, `r` is now fulfilled
with `p'`, and Dave's listener observes the resolution to a local
promise that Dave has no import for.

Concrete consequence: Dave's representation of "the promise"
resolves to something Dave can't reach. The spec doesn't address
multi-session resolver sharing, which is a real possibility in
networks where promises are passed around.

#### 7.3.6 Backpressure / unbounded buffer growth

Messages buffer in `p'` until the 3PH completes. There is no
protocol-level backpressure. Under partial failure (Bob slow, 3PH
stalled, Carol unreachable), Alice's `p'` queue grows without bound.
Cap'n Proto's receiver-side embargo has the same fundamental issue
but at least the messages have already been transmitted, so the
sender's heap isn't pinned.

A real implementation needs a back-pressure story (e.g., refuse new
sends after some threshold, or surface a "shortening in progress"
signal to the application).

#### 7.3.7 Multi-hop chain coordination is underspecified

The spec says "each shortening step that re-routes a promise across
a vat boundary MUST be preceded by its own `op:flush`." But the
ordering between flushes on different links is not pinned down.
Ridley's 4-vat diagram annotation — "the flush done from Bob to
Carol is dependent on the flush done from Alice to Carol" — hints
that there are inter-flush happens-before relationships that need
either explicit correlation or a more careful argument about why
local FIFO suffices.

If two intermediaries shorten concurrently, can a partial result
emerge where one chain link is short and the other is mid-flush?
What invariants hold during that window?

#### 7.3.8 Aborted flush mid-protocol

If Alice or Bob aborts the session between `op:flush` and the
completion of the 3PH, the spec needs to say what state Alice's
local `p'` is in. Options:
- Break `p'` with the session-abort reason.
- Treat the session abort as a regular promise-break and propagate
  through `p'` to all buffered messages.
- Distinguish "flush succeeded but 3PH aborted" from "flush itself
  aborted" and surface different errors.

The current spec is silent on all of this.

#### 7.3.9 Flush-done payload is unconstrained

The spec says Alice invokes `flush-done-resolver` with
`op:deliver-only` and "the args of the invocation are unconstrained
by this specification; the act of delivery is what conveys
completion."

Two consequences:
- Different implementations may put different things in the args,
  hurting interoperability in cases where Bob does want to read them.
- The flush-done channel could be repurposed by a malicious sender
  to deliver arbitrary messages to whatever Bob put behind the
  callback. That's mostly fine because Bob chose the callback, but
  a misimplementation could leak.

A canonical empty-args or canonical symbol like `'flush-done` would
reduce ambiguity.

#### 7.3.10 What if `r` was given to Alice via 3PH, not exported by Alice?

The spec specifies `target-resolver` as "in the receiver's export
table." But what if the promise was acquired by Alice via 3PH from
a fourth party? Alice may not have an export for the resolver — the
resolver may live elsewhere and Alice may be a transparent forwarder.

The proposal implicitly assumes the resolver was created by Alice's
op:deliver. Other ways promises can come into existence (op:listen
forwarding, 3PH, sturdy-ref handoff) may not fit this assumption.

### 7.4 Where flush genuinely wins

In fairness, there are real properties the design buys that
alternatives don't:

- **Availability after shortening.** Once shortened, Bob can go
  offline and Alice→Carol still works. Cap'n Proto can never offer
  this with its "forward strictly to R" rule.
- **No new ordering primitive.** Flush only relies on per-connection
  FIFO from the netlayer — no WormholeOp, no embargo IDs, no causal
  metadata.
- **Wire-visible.** The op is observable in the message stream, easy
  to debug, and not hidden in protocol internals.
- **Resolver-initiated fits the "Bob knows when he's ready" model.**
  Cap'n Proto's receiver-initiated approach requires the receiver
  to detect resolution before any party has committed to switching
  paths. Resolver-initiated is more aligned with how application
  code actually decides to forward results.

### 7.5 Summary of the case against (so far)

- The always-flush rule is wasteful in the no-pipelining common case
  and could be eliminated with a sequence-number protocol.
- The serial-with-3PH RTT is intrinsic to resolver-initiation and
  isn't fixed by the §5.2 vatC-side enhancement.
- Pipelining is lost during the buffer window; the §5.2 enhancement
  recovers most of it but adds complexity.
- Multi-hop chain coordination is underspecified; 4+ vat scenarios
  may have invariants the current spec text does not enforce.
- Multi-session resolver sharing, concurrent resolution races, and
  aborted-flush handling are all undefined.
- Backpressure is the application's problem, not the protocol's.

None of these are fatal. Several are addressable with relatively
small spec amendments. But the message-count and latency overhead is
real and growing in the multi-hop case, which is exactly the case
erights opens the issue with as the motivation.

## 8. Where things stand

- The group has *not* settled on a single ordering guarantee statement.
  erights' position — the useful FIFO is end-to-end reference FIFO,
  preserved across shortening — appears to be the strongest credible
  reading, and Ridley is designing toward it.
- erights has signaled willingness to revise his earlier preference for
  Waterken-style point-to-point FIFO over E-order if Ridley's approach
  works: "If it is doable simply enough, I might revise my retreat from
  E-order to fifo." But also: end-to-end reference FIFO with shortening
  is strictly weaker than full E-order and does **not** require
  WormholeOp; that remains a key simplification.
- The current proposal (#5.5) preserves FIFO via flush-on-every-shortening
  and avoids the dispatch ambiguity of #5.3. It needs implementation and
  test coverage; gibson042 raised dispatch concerns earlier that seem
  resolved by the inversion.
- Open: erights' alternative of putting the embargo at vatC (#5.2) for
  better pipelining. Ridley views the complexity as not worth it; not
  ruled out.
- Tribble's 4-party scenario and the Two Generals concern are
  acknowledged but not blocking.

## 9. Sources

### Primary thread
- [ocapn/ocapn#11 — Promise Shortening](https://github.com/ocapn/ocapn/issues/11)
- Most-cited comments:
  - [dtribble: 4-party scenario, 2023-03-31](https://github.com/ocapn/ocapn/issues/11#issuecomment-1492469923)
  - [erights: original 3-vat scenario from #236, 2026-03-11](https://github.com/ocapn/ocapn/issues/11#issuecomment-4035199258)
  - [erights: "the points I meant are sending vat and receiving object", 2026-03-11](https://github.com/ocapn/ocapn/issues/11#issuecomment-4036000000)
  - [erights: walk-through of E's `whenMoreSettled` solution, 2026-03-12](https://github.com/ocapn/ocapn/issues/11#issuecomment-4040680000)
  - [RidleyWrites: first `op:flush` proposal, 2026-03-12](https://github.com/ocapn/ocapn/issues/11#issuecomment-4049548223)
  - [zarutian: parallel discussion from Ouroboros chat, 2026-04-15](https://github.com/ocapn/ocapn/issues/11#issuecomment-4248843272)
  - [erights: vatC-side embargo for better pipelining](https://github.com/ocapn/ocapn/issues/11#issuecomment-4249000000)
  - [RidleyWrites: 4-party diagrams + flush-everywhere fix, 2026-04-22](https://github.com/ocapn/ocapn/issues/11#issuecomment-4280776681)
  - [RidleyWrites: dispatch problem with flush-everywhere, 2026-04-29](https://github.com/ocapn/ocapn/issues/11#issuecomment-4302069946)
  - [RidleyWrites: Bob-initiated flush proposal, 2026-04-29](https://github.com/ocapn/ocapn/issues/11#issuecomment-4302134692)

### Cross-references
- [ocapn/ocapn#236 — original discussion that migrated here](https://github.com/ocapn/ocapn/issues/236)
- [ocapn/ocapn#265 — Two Generals concern in 3PH](https://github.com/ocapn/ocapn/issues/265)
- [Cap'n Proto rpc.capnp — Tribble 4-way race documentation](https://github.com/capnproto/capnproto/blob/master/c%2B%2B/src/capnp/rpc.capnp)
- [erights.org: DeliverOp / `whenMoreResolved` animation](http://erights.org/elib/distrib/captp/DeliverOp.html)
- [erights.org: provideFor / 3PH gift-table buffering](https://erights.github.io/erights-org-website/elib/distrib/captp/provideFor.html#elems10)
- [erights.org: __order Miranda method](http://www.erights.org/javadoc/org/erights/e/elib/prim/MirandaMethods.html)
- Local: `notes/message-ordering.md` for surrounding terminology.

## 10. Brainstorming alternatives

### 10.1 `delivered-after` — opt-in invocation barriers (kumavis)

**Idea.** Add an optional `delivered-after` parameter to `op:deliver`
(and `op:deliver-only`) carrying a list of promise references — possibly
including handoff descriptors — that must resolve before the message is
*invoked*. The list does not affect *delivery*: messages still flow over
the wire under per-session FIFO, and subsequent messages on the same
connection are not blocked by an earlier message's `delivered-after`
list. Only the local invocation of *this* message waits.

```
<op:deliver to-desc           ; desc:export
            args              ; sequence
            answer-pos        ; positive integer | false
            resolve-me-desc   ; desc:import-object | desc:sig-envelope
            delivered-after>  ; sequence of promise refs (optional)
```

**Authorship and forwarding.** The `delivered-after` list is set once by
the original caller and is **never modified** by intermediate hops. As
the message is forwarded along a promise chain (e.g., during shortening,
or while a promise is still resolving), the field travels along
unchanged. The promise references *inside* the field are transformed
the same way as any other Passable Reference — a `desc:export` on the
sender side becomes a `desc:import-object` on the receiver, and if a
referenced promise needs to traverse a session boundary it triggers a
normal three-party handoff. This keeps the caller as the single source
of truth for the dependency set; no hop can silently weaken or
strengthen the constraint.

**Stance on the disagreement.** This proposal sits at row 2 of the table
in §3.5 (per-session FIFO is the protocol's contract) and gives the user
a way to reach into row 3 selectively. Library code or hot paths that
don't care about cross-reference ordering pay nothing; code that needs
end-to-end ordering states that requirement explicitly per-message.

**How it relates to flush.** Flush is a *runtime-imposed* barrier
inserted by the kernel at every shortening event to preserve a global
FIFO contract; `delivered-after` is a *user-imposed* barrier inserted by
application code to assert specific causal dependencies. They are not
mutually exclusive — one could imagine flush as a built-in special case
of `delivered-after` whose dependency list is generated automatically.

**Pros.**

- Pay-for-what-you-use. Baseline protocol stays cheap.
- Composable: users can express arbitrary causal dependencies, not only
  "after the previous message on the same promise." Useful for batch
  joins, cross-receiver dependencies, and effects beyond shortening.
- Implementable without any new protocol machinery beyond the parameter:
  the receiver already has all promise machinery needed to wait on
  resolution, and references inside the field use the existing Passable
  transformation (including 3PH) to reach the receiver.
- Surfaces ordering decisions in the wire format — easier to debug and
  reason about than implicit kernel embargoes.
- Caller-only authorship means dependencies are deterministic from the
  caller's perspective; intermediaries can't reorder semantics.

**Cons / open questions.**

- *Discoverability.* erights' core complaint about weak FIFO ("too hard
  to tell that you did not code correctly") still applies: library
  authors must remember to use it. Row-2 baseline + opt-in row-3 is
  semantically opt-in, and opt-in safety properties tend to be missed.
- *Failure semantics.* If a promise in `delivered-after` breaks rather
  than fulfilling, what happens to the waiting message? Most likely
  the message should reject with the breakage reason, but we have to
  pick. Also: what if `delivered-after` lists multiple promises and
  some fulfill while others break?
- *Forwarding semantics.* If a `delivered-after` promise itself
  forwards/shortens, does the wait correctly track all the way to
  settlement? In principle yes — that's how promises behave — but
  this means the receiver may end up waiting on a chain that traverses
  yet more vats, which has its own latency and failure-mode story.
- *Listen cost.* The receiver effectively needs to be told when each
  `delivered-after` reference resolves. If implemented via `op:listen`,
  that's an extra round trip per dependency in the worst case. If the
  reference is already locally hosted or already-resolved on arrival,
  no extra traffic is needed.
- *Receiver-side state.* Many deferred messages accumulate while waiting
  on slow dependencies. Need a flow-control or back-pressure story,
  especially under partial failure.

**Comparison to existing primitives.**

- Roughly equivalent to `Promise.all([...]).then(_ => method())` reified
  in the protocol so the wait happens at the receiver, not the sender.
  Saves a round trip relative to user-space `.then()`-chaining.
- Resembles capnp's "join" / dependency expressions and happens-before
  metadata in causal-broadcast systems, but per-message rather than
  per-stream.
- Conceptually adjacent to E's `whenMoreSettled`, but exposed to user
  code rather than meta to the protocol.

**Open follow-ups to discuss.**

- Could a user-space helper auto-include the previous send's promise on
  the same reference, giving free end-to-end reference FIFO without
  flush? (This basically reinvents per-reference sequencing inside the
  deliverAfter primitive — at the library level, not the protocol
  level.)
- Should `delivered-after` accept handoff descriptors as well as direct
  imports — i.e., "wait until this 3PH completes"? The proposal says
  yes; worth pinning down how a `desc:sig-envelope` resolves for the
  purposes of the wait.

### 10.2 Per-promise sequence numbers (alternative to flush)

**Idea.** Replace the flush dance with intrinsic per-message ordering.
Every pipelined `op:deliver` / `op:deliver-only` addressed to a
promise carries a sequence number set by the original sender. The
destination of the promise reorders by sequence before invoking. No
flush, no embargo, no synchronization event around shortening —
shortening becomes fully transparent.

```text
<op:deliver to-desc           ; desc:export | desc:answer | desc:promise
            args              ; sequence
            answer-pos        ; positive integer | false
            resolve-me-desc   ; desc:import-object | desc:import-promise
            seq>              ; positive integer | false
```

`seq` is per-(sender, target-promise) and monotonically increasing on
the sender side. `false` means "unordered" (sender does not request
sequencing, receiver invokes in delivery order — current behavior).

**Stance on the disagreement.** This is a different way to land on
row 3 of the table in §3.5: end-to-end reference FIFO across
shortening. The seq is per-(sender, target-promise) — i.e.,
per-(sender, logical-reference) — which is exactly what end-to-end
reference FIFO requires: messages sent on the same logical reference
arrive at the destination in send order, regardless of how the
wire-level reference identity changed during shortening.

**How it relates to flush.** Flush is a *per-shortening* coordination
event between sender and resolver. Per-promise seq is a *per-message*
tag that lets the destination reorder unilaterally. Where flush asks
"have I quiesced on the old path before I open the new one?", seq
asks "has the message I'm about to invoke had all its predecessors
arrive?" The first is a control-plane handshake; the second is a
data-plane invariant.

**How it relates to `delivered-after`.** They compose naturally. Seq
gives free per-promise FIFO; `delivered-after` gives optional
cross-promise dependencies. A receiver implementing both invokes a
message only when (a) all earlier seq messages on this promise have
been invoked AND (b) all `delivered-after` barriers have settled.

**Pros.**

- **Zero per-shortening overhead.** Shortening is transparent; no
  flush messages, no buffer window, no extra RTT.
- **Pipelining never blocked.** Messages flow as fast as the
  connections allow. Reordering happens at the destination, in the
  background.
- **O(1) per message regardless of chain length.** A 4-vat or 100-vat
  chain costs the same as a 3-vat chain. The flush approach is
  O(N) in chain length.
- **Eliminates several open issues from §7.3.** Always-flush waste,
  intrinsic serial RTT, multi-hop coordination ambiguity, and
  concurrent-resolution races all go away when the synchronization
  is "wait until the predecessor seq arrived" rather than "execute
  a flush dance."
- **Composable with multiple senders.** If Alice and Dave both
  pipeline on the same promise (via 3PH), each has their own seq
  space. Per-(sender, target) is robust to sharing.

**Cons / open questions.**

- *Per-message wire overhead.* A varint per pipelined message. Small
  but ubiquitous; flush's overhead is concentrated in bursts.
  Roughly: if you send K messages per shortening event, flush costs
  ~2 messages of overhead per event; seq costs ~K varints. Crossover
  is at K ≈ 2 messages per shortening event. Real workloads with
  many messages per shortening may favor flush; real workloads with
  many shortenings per few messages may favor seq.
- *Receiver-side state.* Per-promise "highest contiguous seq
  delivered" plus a reorder buffer. Bounded by network reorder
  window in the common case; unbounded under partial failure.
- *Sender-side state.* Per-promise next-seq counter. Discardable
  with the promise via existing GC mechanisms.
- *Stable promise identity.* The seq is per-promise, so the promise
  needs an identity that survives forwarding and shortening. OCapN
  already has this via `desc:promise` (3PH-aware promise reference);
  shortening preserves the logical promise identity even as the
  wire-level descriptor changes.
- *Failure mode for missing seq.* If seq=N is lost (e.g., session
  abort during forwarding), seq=N+1, N+2, … buffer indefinitely at
  the receiver. Need a timeout / break-on-gap mechanism. Standard
  fix: break the promise after a configurable gap-size or
  gap-duration.
- *Multi-sender semantics.* Per-(sender, promise) FIFO does not
  order messages from different senders relative to each other.
  This matches the usual ocap "messages from independent sources
  may interleave arbitrarily" expectation.
- *Backwards compatibility.* Adding a positional field changes the
  wire shape. Either bump the captp version or treat seq as
  optional / sentinel.
- *Promise resolution preserves seq tracking.* When a promise
  resolves to another promise, the receiver's seq state for the
  outer promise transfers to the inner. Implementation detail but
  worth pinning down.

**Comparison of overhead with flush, by scenario.**

| Scenario | `op:flush` | Per-promise seq |
|---|---|---|
| 3-vat shortening, no pending sends | 2 msgs, +1 RTT | 0 (no event at all) |
| 3-vat shortening, K pending sends | 2 msgs, +1 RTT, lose pipelining | K varints; pipelining preserved |
| 4-vat chain shortening | 10 msgs, 4 RTTs | per-message seq tags only |
| N-vat chain | O(5N) msgs, O(2N) RTTs | per-message seq tags only |
| Many promises shortening at once | 2K flush messages | per-message seq tags only |
| Idle Alice (no sends) | 2 msgs of pure overhead | 0 |

The crossover is unfavorable to flush in every multi-hop scenario
and in the common case of idle promises. The per-message overhead is
small enough that, in absolute terms, seq is likely cheaper across
realistic workloads.

**Comparison to Cap'n Proto.**

Cap'n Proto's embargo provides E-order (per-reference FIFO) via
sender-receiver coordination on each Resolve. Per-promise seq
provides per-(sender, target-promise) FIFO via per-message metadata.
The two cover overlapping but not identical territory. Per-promise
seq does not prevent the Tribble 4-way race for non-shortening
scenarios; it just makes shortening cheap. Cap'n Proto's
"forward-strictly-to-R" rule is independently necessary for chain
correctness if shortening is permitted.

**Failure-mode handling.**

Recommended approach for missing-seq under partial failure: when the
receiver has buffered seq > N for some configurable gap window
(e.g., 30 seconds or 1000 unfilled gaps), break the promise with a
"shortening gap" reason. The sender can detect this via existing
promise-broken propagation and re-establish.

**Key insight.**

The flush design treats shortening as a *protocol event* that
requires synchronization. Per-promise seq treats shortening as an
*invisible optimization* that the destination's invocation logic
handles transparently. This relocates the complexity from the
control plane to the data plane, where it can be amortized over
many messages instead of paid at every shortening.

**Status.** Speculative; not yet drafted as spec text. Worth
prototyping alongside the flush PR for empirical comparison.

### 10.3 Hybrid: per-pipe FIFO + `delivered-after` (lowest-overhead pragmatic option)

If §10.2 is the most coherent option and §5.5 (flush) is the
maximalist row-3 option, the *minimalist* option is to leave the
protocol contract at row 2 (per-session FIFO) and rely on
`delivered-after` (§10.1) for any stricter ordering the application
needs.

**Stance.** Embrace the disagreement. The protocol's contract is
what it is — per-CapTP-session FIFO. Promise shortening may
reorder. Document this explicitly in the spec. Provide
`delivered-after` for application code that needs more.

**When this is the right choice.**

- If most applications don't need cross-message ordering on a
  single promise (common in RPC-style code where each call is
  independent).
- If the implementation cost of either flush or seq is unacceptable
  in the near term.
- If the spec-process consensus is closer to Ridley's reading than
  erights' reading and we don't want to relitigate that disagreement
  to ship a v1.

**Pros.**

- Lowest protocol complexity. No new ops beyond `delivered-after`.
- Implementations stay simple; existing implementations (Goblins,
  Endo, etc.) need only add the optional `delivered-after` field.
- Application code that doesn't pipeline doesn't pay any cost.
- Future work can layer flush or seq on top without breaking
  compatibility.

**Cons.**

- Application authors must remember to use `delivered-after`. Misses
  are silent (out-of-order invocation).
- erights' "programming with 'almost always FIFO' is too hard"
  critique applies: the absence of strong default ordering is a
  footgun.
- The availability property erights motivates the issue with is not
  actually delivered by the protocol — it's only delivered for
  applications that correctly use `delivered-after`. Library code
  is uncertain.

### 10.4 Punt-back forwarding (kumavis exploration)

**Idea.** Rather than have Bob *forward* pipelined messages on a
shortened promise, Bob *bounces them back* to the original caller
("punts"), and the caller invokes them on her own directly to the
destination.

**Mechanism.** Adapted to the canonical 3-vat scenario:

1. Bob's `p2` resolves to Carol. Bob switches to "punt mode" for
   `p1`.
2. Bob sends Alice a notification: `p1` is now resolved to Carol's
   object N at vat Carol. (Includes whatever 3PH information Alice
   needs to establish A↔C if not already established.)
3. Any pipelined `op:deliver` / `op:deliver-only` for `p1` that
   arrives at Bob *after* Bob entered punt mode is bounced back to
   Alice as an `op:deliver-only` carrying the original message
   payload (or a recoverable identifier for it).
4. Alice receives the resolution, opens A↔C if needed, and queues
   future application sends locally pending the receipt of all
   bounces.
5. Alice receives bounces in original send order (B↔A FIFO of
   bounces is consistent with Bob's receive order, which is A↔B
   FIFO of original sends — so order is preserved).
6. Alice resends each bounced message to Carol over A↔C, then
   releases queued application sends to Carol in their original
   order.

**Does it solve intended ordering?**

By itself, **no**. Without sender-side serialization at Alice, this
breaks ordering as easily as no-flush:

- Alice sends `z()` to Bob at t=0.
- Bob's resolution notice arrives at Alice at t=1.
- Alice immediately sends `w()` directly to Carol at t=2.
- Bob bounces `z()` back to Alice at t=3.
- Alice resends `z()` to Carol at t=4.
- At Carol: `w()` arrives before `z()`. **Wrong order.**

To preserve order, Alice must *not* send any application messages
direct-to-Carol until all in-flight bounces have arrived. This
requires Alice to track an in-flight count per shortened promise
(or a "last bounce" sentinel from Bob), and to buffer application
sends until the count reaches zero.

So the precise answer is: **punt + sender-side serialization**
preserves per-(Alice, p1) FIFO at Carol. **Punt alone does not.**

That sender-side serialization is a flush by another name. It uses
no new wire op, but the same logical work is done — Alice quiesces
sends until she's certain the old path has drained. The "drain"
signal is "all bounces have arrived" instead of "flush-done has
arrived."

**Costs.**

| | `op:flush` | Punt |
|---|---|---|
| Per-shortening overhead, no pending sends | 2 msgs, +1 RTT | 1 msg (resolution only) |
| Per-shortening overhead, K pending sends | 2 msgs, +1 RTT, K forwards (B→C) | 1 msg + 2K bounce-and-resend (B→A→C) |
| Pipelined message cost | A→B→C (2 hops) | A→B→A→C (3 hops) |
| New op required | Yes (`op:flush`) | No (resolution and bounces are existing op shapes) |
| Sender-side state | Just `p'` | Per-promise in-flight count + local buffer |
| Pipelining preserved during shortening | No | No (Alice still buffers) |

For **K=0** pipelined messages, punt saves 1 message vs flush. For
**K≥2**, punt is more expensive on the wire (each pipelined
message traverses an extra hop). The crossover is at K=1, where
both cost roughly the same.

**Where punt's framing helps anyway.**

A few non-overhead arguments are worth noting:

- *No new opcode.* The protocol surface is unchanged; "bounce" can
  be expressed as a normal `op:deliver-only` whose args carry the
  original message. Easier to evolve.
- *Bob's role simplifies.* Bob is just a forwarder that may stop
  forwarding. There is no swap of export-table entries, no
  resolver-replacement, no flush-done callback. Just "I'm not
  going to do this; here, take it back."
- *Failure-mode alignment.* If Bob is going offline or running
  low on resources, "bounce and let Alice handle" is a graceful
  degradation. Flush requires Bob to be alive enough to complete
  a synchronization. Punt-as-failure-handling lets Bob bow out
  cleanly.
- *Per-(Alice, p1) ordering at Carol.* Bounces arrive at Alice in
  send order (FIFO of A↔B then B↔A); Alice resends to Carol in
  receive order (FIFO of A↔C). End-to-end FIFO from Alice to
  Carol is preserved *if* Alice serializes around the bounce
  window.

**Where punt is decisively worse.**

- *Doubles the wire cost of pipelined messages.* Each goes A→B
  (original) and B→A (bounce) before reaching Carol. For
  high-pipelining workloads, that's significant.
- *Sender-side complexity.* The discipline Alice must maintain to
  preserve ordering is real and silent — get it wrong and ordering
  breaks invisibly.
- *Answer-pos remapping.* A pipelined `op:deliver` had `answer-pos`
  in Bob's session; the resend uses Carol's session. Alice's
  runtime must rewrite the answer position. This is the same
  hazard as flush's swap, just relocated.
- *"Last bounce" detection.* Alice needs a definitive signal that
  all bounces have arrived. Either a count (Bob signals "I am
  bouncing N messages") or a sentinel from Bob (a final
  "no-more-bounces" message). Both are coordination Bob must
  maintain.

**Composes with per-promise seq (§10.2) — and that's interesting.**

If pipelined messages carry per-promise seq numbers (§10.2), punt
becomes much simpler:

- Bob bounces with seq attached.
- Carol reorders by seq regardless of arrival path.
- Alice does *not* need to serialize — she can send direct
  immediately upon receiving the resolution. New direct sends
  carry higher seq numbers; bounced sends carry lower seq numbers
  and will be reordered ahead of the new sends at Carol.

Under §10.2, punt becomes a clean way to drop forwarding state at
Bob without giving up ordering. Cost is still A→B→A→C for in-flight
messages, but ordering is intrinsic.

**When punt might be the right call.**

- *As a graceful-degradation path*, not a primary mechanism. Bob
  can punt when he wants to bow out (e.g., shutting down). Normal
  operation uses flush or seq.
- *In low-pipelining workloads* where K is usually 0 or 1.
  Application code that just resolves and reads (no further
  pipelining) wouldn't notice the bounce overhead because there's
  nothing to bounce.
- *Combined with §10.2 per-promise seq*, where the ordering
  property is intrinsic and punt is just a routing simplification.

**Holes.**

- *Multi-sender pipelining.* If Alice and Dave both pipeline on
  `p1` (via 3PH), Bob has to bounce to whichever vat sent the
  message. Multi-sender works but state grows.
- *Bouncing pipelined-on-bounce messages.* If Alice's bounce-resend
  to Carol itself races a Carol-side resolution (Carol shortens
  `p3` to Derek), the same bounce could happen again. Recursive
  bouncing, in principle bounded by chain length.
- *Failure during bounce.* If Bob crashes mid-bounce, in-flight
  messages on B→A are lost. Alice's count never converges. Need
  a timeout or break-on-abort.
- *Memory pressure on Bob.* If Bob is in punt mode and Alice is
  still sending pipelined messages, Bob has to hold them long
  enough to bounce them. No different from forwarding in steady
  state but worth pinning down.

### 10.5 Recommendation

If we want the strongest coherent guarantee with no per-event
overhead: **§10.2 per-promise seq**. This is the cleanest answer to
the design question and eliminates most of §7.3's open issues.

If we want the lowest-overhead pragmatic answer that ships
something today: **§10.3 hybrid with `delivered-after`**. Avoid
strengthening the protocol contract; let applications opt in.

The flush approach (§5.5) sits between these two and pays both
costs: protocol-level complexity *and* per-event overhead. Its only
real advantage is that it's the most concrete proposal currently on
the table — but if we're willing to prototype, seq is a better
target.

**On punt-back forwarding (§10.4).** The interesting finding from
the punt exploration is *negative*: punt by itself does not solve
ordering. Without sender-side serialization, the bounce-and-resend
pattern reorders just as easily as no-flush. Punt + sender-side
serialization re-derives flush in different mechanics. Punt + §10.2
seq is interesting as a graceful-degradation primitive (Bob can
unilaterally bow out of forwarding without breaking ordering), but
punt is not a viable primary ordering mechanism on its own.

