# Design notes for `op:flush`

This is a non-normative companion to the [`op:flush`
specification](./CapTP%20Specification.md#op-flush). It captures
design alternatives and an interrogation of the current proposal.
Nothing here changes the wire format or the requirements in the
spec; this document exists so reviewers and implementers can see the
context and trade-offs the spec text is making.

The spec text in this branch implements the current latest form of
[Ridley's proposal](https://github.com/ocapn/ocapn/issues/11#issuecomment-4302134692)
in [ocapn/ocapn#11](https://github.com/ocapn/ocapn/issues/11): the
**Bob-initiated, sender-side-buffer** flush. The flush is sent by
the holder of the unresolved exported promise (Bob) to the holder of
the resolver (Alice). Alice swaps her export-table slot to a fresh
resolver `r'`, fulfills the original `r` with a new local promise
`p'` that buffers further sends, and notifies Bob of completion.

Two open questions hang over this design:

1. Is the buffer in the right place? An alternative due to erights
   would put the buffer at the destination vat (Carol), recovering
   pipelining lost during the shortening window.
2. What's the actual cost of this design across realistic scenarios,
   and where does it fall short of its goals?

Sections 1 and 2 below take each in turn.

---

## 1. Alternative buffer location: vatC-side embargo (erights)

Source: [Mark Miller in
ocapn/ocapn#11](https://github.com/ocapn/ocapn/issues/11#issuecomment-4248843272),
2026-04-15.

### 1.1 The current spec puts the buffer at Alice

After Alice swaps `r` for `r'` and fulfills the original resolver
with `p'`, any further sends from Alice's application code on the
original promise accumulate in `p'`, locally in vatA. They sit there
until the third-party handoff completes and `p'` is fulfilled with
the gift; only then do those buffered messages flow over the new
direct A↔C connection to Carol.

For the duration of the flush plus the 3PH (~2 round trips at
typical latencies), Alice has zero outbound throughput on this
promise. Pipelining is suspended.

### 1.2 erights' proposal: buffer at Carol

The alternative observes that the destination vat (Carol) already
participates in 3PH and can make the flush invisible to pipelining:

1. When Carol receives the deposit-gift from Bob, instead of just
   binding it locally and waiting, Carol creates a fresh
   promise/resolver pair `(p_embargo / r_embargo)` and sends both
   `r_embargo` and the gift's promise reference back to Alice as
   part of the handoff.
2. Alice's local representation of the promise (the resolver chain
   that the application talks to) immediately switches to send
   messages directly to Carol, addressed to the new
   `p_embargo`.
3. Those messages flow over the new A↔C connection straight away.
   Carol queues them locally on `p_embargo` (since `p_embargo` is
   unresolved).
4. When Bob signals via the 3PH that the embargo can be lifted,
   Carol resolves `r_embargo` to the actual destination object.
   The queued messages then flow into the destination in order.

erights frames this as a generalization of the existing 3PH
gift-table buffering already specified in CapTP-of-E (see
[`provideFor.html`](https://erights.github.io/erights-org-website/elib/distrib/captp/provideFor.html#elems10)).
When Bob asks Carol for a gift Alice has not yet deposited, Carol
already creates a promise for the eventual gift and resolves it
later. The shortening case "simply does not prohibit" the gift
sender and gift recipient from being the same vat.

### 1.3 Trade-offs

| | Current spec (Alice-side buffer) | erights' alternative (Carol-side buffer) |
|---|---|---|
| Pipelining during shortening | Suspended (~2 RTTs) | Preserved (messages in flight) |
| Sender-side memory | Grows with the buffer | Bounded — messages leave |
| Receiver-side memory | Unaffected | Grows with the queue |
| Implementation surface | Smaller — only Alice swaps | Larger — Carol grows new state machine |
| 3PH protocol changes | None | Carol now ships extra `r_embargo` per gift |
| Failure modes | Alice's `p'` orphans on session abort | Carol's queued messages need a break-on-abort path |

erights' framing of the cost: "more complicated, but IMO only mildly
so."

[Ridley's reaction](https://github.com/ocapn/ocapn/issues/11#issuecomment-4252000000):
"I think the implementation would require more complicated changes
to existing implementations than if the embargo resides in vatA.
I'm not convinced that the additional implementation challenges
would be worth it but will give it more thought."

### 1.4 Status

Not in the current spec. The spec text in this branch implements
the Alice-side buffer as Ridley proposed. The erights alternative
remains under discussion in the issue thread; if adopted, the spec
text would change in §`op:flush` step 3 (where the new local
promise `p'` is created) and the 3PH section would gain the
`r_embargo` mechanism. It would not change the `op:flush` wire
shape itself.

---

## 2. Interrogation of the current design

Concrete look at overhead, comparison to the alternative ordering
mechanism (Cap'n Proto's embargo), and the design holes that need
spec amendments before the proposal is testable end-to-end.

### 2.1 Overhead in concrete scenarios

Each scenario counts the wire messages added by the flush
machinery and the latency in round trips before the system reaches
"shortened state" — Alice can send directly to the eventual
settling vat with FIFO preserved.

#### Scenario A: 3-vat shortening, no pipelined messages

Setup: Alice did `bob!x()` and is awaiting the result. She has not
sent any further messages. Bob's `p2` resolved to Carol and Bob is
ready to shorten.

The proposal flushes anyway. From Ridley's writeup: "Flushing must
always occur as part of promise shortening, even if Alice never
sent a message to Bob."

Cost added by flush:
- Bob → Alice: `op:flush` (1 msg)
- Alice → Bob: flush-done (1 msg)
- = **2 extra messages, 1 extra A↔B RTT**, all overhead. Strict
  waste in the common case where no messages are pipelined.

#### Scenario B: 3-vat shortening, with pipelined messages

Same setup but Alice has sent `z()` and is about to send `w()`.

Cost added by flush:
- 2 extra messages (op:flush + flush-done)
- 1 extra A↔B RTT, **serial with the 3PH**

Pipelining loss: any application sends Alice issues during the
flush plus the subsequent 3PH (~2 RTTs total) buffer locally at
`p'` rather than flow toward Carol. erights' §1 alternative
recovers most of this.

#### Scenario C: 4-vat chain shortening

Setup: Alice → Bob → Carol → Derek. Each link could be shortened.
Per Ridley's diagram, each shortening step requires its own flush.

Worst case (sequential shortenings):
- Flush B↔A (2 msgs)
- 3PH B↔A↔C (3 msgs)
- Flush C↔A (2 msgs)
- 3PH C↔A↔D (3 msgs)
- = **10 extra messages, 4 sequential RTTs** to fully shorten A→D.

Plus: the two flush-dones travel on different connections (A↔B
then A↔C). Per-connection FIFO doesn't relate them. Ridley's
4-vat diagram annotation — "the flush done from Bob to Carol is
dependent on the flush done from Alice to Carol" — implies an
inter-flush happens-before relation that the spec text does not
yet pin down.

For an N-vat chain: **O(5(N−1)) messages, O(2(N−1)) sequential
RTTs**. Linear in chain length.

Cap'n Proto's "forward strictly to R" rule pays zero shortening
overhead in this case but messages travel N hops forever.

#### Scenario D: many promises shortening at once

Alice has K promises hosted by Bob. Bob shortens all of them.

Cost: 2K flush messages before any 3PH starts. The protocol has no
batching primitive. A worthwhile follow-up is a batched
`op:flush-many` or letting `op:flush` carry a sequence of resolvers.

#### Scenario E: shortening with an idle Alice

Alice has the promise but hasn't sent anything for a long time.
Bob shortens.

Identical to Scenario A: 2 messages of pure overhead. The "no
pending sends" case is indistinguishable from "many pending sends"
from Bob's vantage point, so the always-flush rule pessimizes the
common case.

### 2.2 Side-by-side overhead with Cap'n Proto's embargo

| Scenario | `op:flush` | Cap'n Proto embargo |
|---|---|---|
| 3-vat shortening, no pending sends | 2 msgs, +1 RTT serial with 3PH | 0 msgs (no embargo needed if no pending sends — receiver knows) |
| 3-vat shortening, with pending sends | 2 msgs, +1 RTT serial with 3PH; messages buffer at sender | 2 msgs (Disembargo loop), parallel with new path; messages buffer at receiver |
| 4-vat chain shortening | O(5N) msgs, O(2N) sequential RTTs | 0 shortening msgs (chain frozen); messages cost N hops forever |
| Concurrent multi-promise shortening | O(2K) msgs for K promises | O(2K) Disembargos but no protocol-level serialization with handoff |
| Pipelining during shortening | Lost (messages buffer at Alice) | Preserved (queued at receiver) |

The `op:flush` design generally costs *more* messages and *more*
serial latency per shortening event. In exchange, it buys the
availability property Cap'n Proto explicitly trades away — once
shortened, the intermediate vat can leave the network without
breaking Alice→Carol.

### 2.3 Holes and unresolved issues

#### 2.3.1 Always-flush wastes work

The current proposal mandates a flush on every shortening, even
when Alice has not pipelined. In a system where shortening is
common but pipelining is rare, this is significant overhead.

A sequence-number scheme on pipelined messages could let Bob
report "I've seen up to seq N" and Alice confirm "I sent at most
seq N"; equality could let both skip the flush. Trades the
always-flush cost for sequence-tracking state.

#### 2.3.2 The extra RTT is intrinsic to resolver-initiation

The flush dance is a full A↔B round trip *before* Bob can begin
the 3PH. The 3PH itself is another ~1.5 RTTs. Total: ~2.5 RTTs to
shortened state.

Cap'n Proto's embargo runs in parallel with new path establishment
and is effectively ~1 RTT. The §1 vatC-side alternative addresses
the pipelining-loss aspect but does not eliminate this serial RTT —
that's structurally tied to "Bob asks Alice to quiesce before Bob
proceeds."

#### 2.3.3 Pipelining is lost during the buffer window

Messages Alice's application sends during flush + 3PH (~2 RTTs)
buffer in `p'` rather than flow toward the destination. For that
window, Alice's outbound throughput on this promise is zero.

The §1 alternative recovers most of this and is the most directly
addressable performance issue.

#### 2.3.4 Concurrent resolution races

What if Bob has already sent a resolution message — invoking
Alice's resolver `r` directly via `op:deliver-only` — and *then*
sends `op:flush`? By A↔B FIFO, Alice receives the resolution
first, fulfills `r` with the resolved value, and `r` is no longer
in "resolver" state when `op:flush` arrives.

The spec says "If the position is not in use, break
flush-done-resolver." But "in use" is ambiguous after fulfillment.
The export-table position may still hold a (now-resolved)
reference. Spec needs to say either:
- the position MUST hold an unresolved resolver, or
- a flush against a resolved position is a no-op that immediately
  invokes flush-done-resolver, or
- some other unambiguous outcome.

A more pernicious case: Bob sends `op:flush` and *concurrently*
sends a resolution from a different turn. Both are on the Bob→Alice
wire. Either order needs a defined behavior.

#### 2.3.5 Multi-session resolver sharing

The spec says "replace the export-table entry at the same position
with `r'`." This is per-session. Alice's resolver `r` is a local
object — Alice may have exported it in another session, e.g., to a
third party that also holds the promise. The swap only affects
Bob's session. From Dave's session, `r` is now fulfilled with `p'`,
and Dave's listener observes the resolution to a local promise that
Dave has no import for.

Concrete consequence: Dave's representation of "the promise" can
resolve to something Dave can't reach. The spec doesn't address
multi-session sharing of resolvers, which is a real possibility in
networks where promises are passed around.

#### 2.3.6 No backpressure for the local buffer

Messages buffer in `p'` until 3PH completes. There is no
protocol-level backpressure. Under partial failure (Bob slow, 3PH
stalled, Carol unreachable), Alice's `p'` queue grows without
bound.

Cap'n Proto's receiver-side embargo has the same fundamental
issue, but the messages have already been transmitted, so the
sender's heap isn't pinned.

A real implementation needs a back-pressure story (e.g., refuse
new sends after a threshold, or surface a "shortening in progress"
signal to the application). The spec is silent.

#### 2.3.7 Multi-hop chain coordination is underspecified

The spec says "each shortening step that re-routes a promise
across a vat boundary MUST be preceded by its own `op:flush`." But
the ordering between flushes on different links is not pinned
down.

Ridley's 4-vat diagram annotation — "the flush done from Bob to
Carol is dependent on the flush done from Alice to Carol" — hints
that there are inter-flush happens-before relationships that need
either explicit correlation or a careful argument about why
local FIFO suffices. The spec text in this branch does not provide
either.

If two intermediaries shorten concurrently, what invariants hold
during the partial-shortening window?

#### 2.3.8 Aborted flush mid-protocol

If Alice or Bob aborts the session between `op:flush` and 3PH
completion, the spec does not say what state Alice's local `p'` is
in. Options:
- Break `p'` with the session-abort reason.
- Treat the abort as a regular promise-break and propagate through
  `p'` to all buffered messages.
- Distinguish "flush succeeded but 3PH aborted" from "flush itself
  aborted" and surface different errors.

Currently silent.

#### 2.3.9 Flush-done payload is unconstrained

The spec says the flush-done invocation's "args of the invocation
are unconstrained by this specification; the act of delivery is
what conveys completion."

Two consequences:
- Different implementations may put different things in the args,
  hurting interoperability if Bob ever wants to read them.
- A canonical empty-args or canonical symbol like `'flush-done`
  would reduce ambiguity.

#### 2.3.10 What if `r` was given to Alice via 3PH, not exported by Alice?

`target-resolver` is specified as "in the receiver's export table."
But what if Alice acquired the promise via 3PH from a fourth party?
Alice may not have exported the resolver — the resolver may live
elsewhere with Alice as a transparent forwarder.

The proposal implicitly assumes the typical flow where Alice's
op:deliver created the resolver. Other origins (op:listen
forwarding, 3PH inheritance, sturdy-ref handoff) may not fit.

### 2.4 Where the design genuinely wins

In fairness:

- **Availability after shortening.** Once shortened, Bob can go
  offline and Alice→Carol still works. Cap'n Proto can never
  offer this with its "forward strictly to R" rule. This is
  erights' opening motivation in the issue thread.
- **No new ordering primitive.** Flush only relies on
  per-connection FIFO from the netlayer — no WormholeOp, no
  embargo IDs, no causal metadata.
- **Wire-visible.** The op is observable in the message stream,
  easy to debug, not hidden in protocol internals.
- **Resolver-initiated fits the "Bob knows when he's ready"
  model.** Cap'n Proto's receiver-initiated approach requires the
  receiver to detect resolution before any party has committed to
  switching paths. Resolver-initiation is more aligned with how
  application code actually decides to forward results.

### 2.5 Summary of the case against (so far)

- The always-flush rule is wasteful in the no-pipelining common
  case and could be eliminated with a sequence-number protocol.
- The serial-with-3PH RTT is intrinsic to resolver-initiation and
  is not fixed by the §1 vatC-side enhancement.
- Pipelining is lost during the buffer window; the §1 enhancement
  recovers most of it but adds complexity.
- Multi-hop chain coordination is underspecified; 4+ vat scenarios
  may have invariants the current spec text does not enforce.
- Multi-session resolver sharing, concurrent resolution races, and
  aborted-flush handling are all undefined.
- Backpressure is the application's problem, not the protocol's.

None of these are fatal. Several are addressable with relatively
small spec amendments. But the message-count and latency overhead
is real and grows linearly in the multi-hop case — exactly the
case that motivates the design.

---

## 3. References

- [ocapn/ocapn#11 — Promise Shortening](https://github.com/ocapn/ocapn/issues/11)
- [Ridley's Bob-initiated proposal (current latest)](https://github.com/ocapn/ocapn/issues/11#issuecomment-4302134692)
- [erights' vatC-side embargo alternative](https://github.com/ocapn/ocapn/issues/11#issuecomment-4248843272)
- [`provideFor.html` — gift-table buffering precedent](https://erights.github.io/erights-org-website/elib/distrib/captp/provideFor.html#elems10)
- [Cap'n Proto `rpc.capnp` — embargo / Disembargo / Tribble 4-way race](https://github.com/capnproto/capnproto/blob/master/c%2B%2B/src/capnp/rpc.capnp)
