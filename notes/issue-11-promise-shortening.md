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
journey A→B→C, Charlie sees `w()` then `z()` — out of order. This violates
end-to-end FIFO between Alice and Charlie even though every individual
two-peer connection is FIFO.

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
demanded here is **vat-to-object FIFO**, end-to-end, surviving promise
shortening. That is strictly stronger than per-session FIFO and strictly
weaker than full E-order (which would also require WormholeOp for
cross-reference ordering on three-party handoffs).

### 3.4 Waterken comparison

Waterken (Tyler Close) is a useful reference point because erights, on the
Spritely thread, said he had retreated from E-order toward "Tyler's
Waterken point-to-point FIFO" — and yet here in #11 he's pushing for
something stronger than what Waterken actually delivers. The four rows
make the disagreement legible:

| Reading | Guarantee | Requires | Cost |
|---|---|---|---|
| Waterken (Tyler Close) | Per-HTTP-pipe FIFO between two peers | FIFO+reliable HTTP. **No protocol-level promise shortening** — introductions are URL-sharing, response promises resolve along the same pipe. | Cheap. No availability win from shortening. |
| Ridley's reading of OCapN | Per-CapTP-session FIFO | Same as Waterken in practice | Cheap. Admits that shortening reorders. |
| erights' reading of OCapN (#11) | Vat-to-object FIFO end-to-end across shortening | Flush/embargo around each shortening event | Moderate. Needs `op:flush` or equivalent. |
| Full E-order | Per-reference FIFO including across handoffs | WormholeOp + embargo + forward-strictly-to-R | Heaviest. |

Waterken can be row 1 cheaply because it sidesteps the shortening
optimization entirely: there is always one direct path between two peers,
so there's no race between an old and a new path. OCapN, by treating
shortening as a protocol-level feature, takes on the FIFO obligation that
Waterken can sidestep.

erights' position in this issue is row 3: Waterken-strength FIFO **plus**
shortening for the availability win, *without* the WormholeOp tax of full
E-order. Quoting his explicit framing: "vat-to-object fifo with promise
shortening, with or without the improved pipelining, has no need
whatsoever for WormholeOp." Row 3 is the sweet spot if it can be
implemented; Ridley's `op:flush` proposal is an attempt at exactly that.

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

## 6. Where things stand

- The group has *not* settled on a single ordering guarantee statement.
  erights' position — the only useful FIFO is end-to-end vat-to-object —
  appears to be the strongest credible reading, and Ridley is designing
  toward it.
- erights has signaled willingness to revise his earlier preference for
  Waterken-style point-to-point FIFO over E-order if Ridley's approach
  works: "If it is doable simply enough, I might revise my retreat from
  E-order to fifo." But also: vat-to-object FIFO with shortening is
  strictly weaker than E-order and does **not** require WormholeOp; that
  remains a key simplification.
- The current proposal (#5.5) preserves FIFO via flush-on-every-shortening
  and avoids the dispatch ambiguity of #5.3. It needs implementation and
  test coverage; gibson042 raised dispatch concerns earlier that seem
  resolved by the inversion.
- Open: erights' alternative of putting the embargo at vatC (#5.2) for
  better pipelining. Ridley views the complexity as not worth it; not
  ruled out.
- Tribble's 4-party scenario and the Two Generals concern are
  acknowledged but not blocking.

## 7. Sources

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

## 8. Brainstorming alternatives

### 8.1 `delivered-after` — opt-in invocation barriers (kumavis)

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

**Stance on the disagreement.** This proposal sits at row 2 of the table
in §3.4 (per-session FIFO is the protocol's contract) and gives the user
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
  resolution.
- Surfaces ordering decisions in the wire format — easier to debug and
  reason about than implicit kernel embargoes.

**Cons / open questions.**

- *Discoverability.* erights' core complaint about weak FIFO ("too hard
  to tell that you did not code correctly") still applies: library
  authors must remember to use it. Row-2 baseline + opt-in row-3 is
  semantically opt-in, and opt-in safety properties tend to be missed.
- *Pre-arrival problem in the shortening case.* For the canonical
  shortening race, Alice would want to send `w()` with
  `delivered-after = [pZ]` where pZ is the answer position of `z()`.
  But if `w()` arrives at Carol *before* `z()` does (the very race
  we're trying to fix), Carol has no record of pZ yet. The receiver
  needs a way to recognize a not-yet-seen promise reference and create
  a placeholder for it. Solvable — pZ has a globally-disambiguatable
  identity via the resolver descriptor — but it's extra machinery on
  the receiver.
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
- *Interaction with `op:listen`.* If `delivered-after` is implemented
  as "wait until `op:listen` reports resolution," the receiver may
  need to issue listens it wouldn't otherwise. Cost: an extra round
  trip per dependency in the worst case.
- *Can the user always express what they need?* If z is `op:deliver`,
  Alice has a promise (the answer position) to use. If z is
  `op:deliver-only`, Alice has no promise to wait on — she'd have to
  promote it to `op:deliver` just to get a handle. Possible
  alternative: synthesize a "completion" promise for `op:deliver-only`
  too, used only for ordering.

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

- Should `delivered-after` block delivery to the receiver, or only
  invocation at the receiver? (User's framing: only invocation. Worth
  confirming the receiver-buffer semantics.)
- Could a "default" mode auto-include the previous send's promise on
  the same target, giving free vat-to-object FIFO without flush? (This
  basically reinvents per-target sequencing inside the deliverAfter
  primitive.)
- Should `delivered-after` accept handoff descriptors as well as direct
  imports — i.e., "wait until this 3PH completes"? The user explicitly
  mentions handoffs.
- What's the receiver-side state cost? If many deferred messages
  accumulate, this is unbounded queue growth. Need a flow-control or
  back-pressure story, especially under partial failure.

