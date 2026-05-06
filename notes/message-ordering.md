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

### 1.4 E-ORDER (Tree Order with forks)

All of fail-stop FIFO, plus: when a reference is included as an
argument of an eventually-sent message, the reference is **forked**.
The receiver gets a fork of the reference, not the original. The
forked reference's authority is "post-X target" — only enabling
messages to be delivered after X (and any other prior sends on
the original reference) have already been delivered.

Visualizable as a Hasse diagram (thesis Figure 19.1).

> "The reference Bob receives from Alice has no more power in
> Bob's hands than it had in Alice's. The assumptions Alice needs
> to make for herself, for the sake of her own sanity, are
> assumptions that remain valid as she delegates to Bob." — markm
> thesis §19.3

**Where it shows up:** E (intra-vat); Cap'n Proto RPC (cross-vat,
enforced via embargo + "forward-strictly-to-R"); CapTP-of-E /
Pluribus (cross-vat, aspirational — depends on WormholeOp, which
is "Not yet implemented"); proposed for OCapN under
`op:flush` (Ridley) or per-promise sequence numbers (alternative
exploration in `notes/issue-11-promise-shortening.md`).

### 1.5 E-ORDER with joins (Partial Order)

E-ORDER plus joins: `E.join(a, b)` returns a promise whose
ordering constraints are the joins of the orders of `a` and `b`.
A message on the joined promise is delivered only after every
prior send on either input. This is what's needed for grant
matching and other distributed-equality patterns. (Thesis §19.5,
[erights `after-both.html`](http://erights.org/elib/equality/after-both.html).)

**Where it shows up:** E. Not commonly carried into other ocap
systems.

### 1.6 CAUSAL order

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

### 1.7 AGREED / total order

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
| Ordering | §1.4 + §1.5 E-ORDER with joins |
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
| Ordering | §1.4 E-ORDER aspirational; in current implementations the Lost Resolution Bug means a Far reference is downgraded to a Promise on 3-vat introduction |
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
| Ordering | §1.4 E-ORDER, enforced |
| Cross-network | Yes |
| Mutually defensive | Yes (security model inherited from CapTP-of-E) |
| Promise shortening | Yes, with constraints — embargo / disembargo serializes path switchover; "forward-strictly-to-R" rule prevents chain collapse past the first remote ref. Trades availability (R can't go offline without the chain breaking) for protocol simplicity |

The cleanest implementation in the family. From `rpc.capnp`:

> "Unless otherwise specified, messages must be delivered to the
> receiving application in the same order in which they were
> initiated by the sending application." — local mirror
> [`notes/references/capnproto-rpc.capnp`](./references/capnproto-rpc.capnp)

Implementation note: in C++, "E-ordering may be broken if
`CompletableFuture` completes immediately"; the impl uses
`kj::evalLater()` to defer all method calls into a later turn,
mirroring vat-turn semantics.

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

The proposed clarification is to upgrade OCapN's ordering
guarantee from §1.3 to §1.4 — fail-stop FIFO to E-ORDER — by
adopting a mechanism that preserves end-to-end reference FIFO
across shortening.

### 2.7 OCapN + `op:flush` (proposed)

| | |
|---|---|
| Ordering | §1.4 E-ORDER (end-to-end reference FIFO across shortening) |
| Cross-network | Yes |
| Mutually defensive | Yes (relies only on per-connection FIFO + existing 3PH security) |
| Promise shortening | Yes, with explicit per-shortening flush ceremony before the 3PH; preserves E-ORDER across shortening |

Ridley's current proposal in
[ocapn/ocapn#11](https://github.com/ocapn/ocapn/issues/11). See
[`notes/issue-11-promise-shortening.md`](./issue-11-promise-shortening.md)
and the prototype branch `claude/ocapn-op-flush-WNRFV`.

### 2.8 OCapN + per-promise sequence numbers (alternative proposal)

| | |
|---|---|
| Ordering | §1.4 E-ORDER (intrinsic) |
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

### 3.1 Authoritative definition

From [erights `passing-rules.html#lost-resolution`](http://erights.org/elib/equality/passing-rules.html#lost-resolution),
the original page documenting the bug:

> "In current implementations of E, a transmitted Far reference
> to Carol, sent by Alice to Bob, when Alice Bob and Carol reside
> in three separate vats, will be received instead as a promise
> for Carol that will eventually resolve into a Far reference to
> Carol. As a result, if Alice sends Bob a hashtable containing
> the reference to Carol as a key, the hashtable will fail to
> unserialize in Bob's vat. Although we know how to fix this
> problem, we may not fix it quickly due to other matters being
> higher priority."

The *resolution* that gets **lost** is the **resolved-ness** of
the reference: a Far (Settled) Carol-reference becomes a Promise
(Unresolved) on arrival at Bob. The named consequence in the
spec is that hashtables fail to unserialize, because hashtable
keys must be Settled.

This is a real, named, *implementation* bug. It is not a name
for the broader ordering race or for a forwarder being discarded.

### 3.2 Why it exists — the three-way conflict

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

### 3.3 markm's contemporary framing

In [Spritely "Conundrum: Message Ordering" post #9](https://community.spritely.institute/t/conundrum-message-ordering/28/9)
(local mirror:
`notes/references/spritely-conundrum-message-ordering-28-post9.html`),
markm uses the bug as part of his broader case for retreating
from end-to-end E-ORDER:

> "Prior to the 'Lost Resolution Bug', E-Order appears to be
> something delivered 'for free', falling out of the
> implementation naturally. We can jump up and down and say
> 'look at this thing we got at no extra cost!'"
>
> "This is indeed one of the considerations leading me to
> retreat to Tyler's Waterken point-to-point fifo."

So Lost Resolution is the historical moment that revealed
E-ORDER is **not** free in distributed implementations — it has
"uncomfortable edges which either must be programmed around or
be understood not to be exactly what we thought" (cwebber, in
the [cap-talk thread](https://groups.google.com/g/cap-talk/c/R5kc06XGqWs/m/WDraOqkQAgAJ)
linked from markm #9; local mirror
`notes/references/google-groups-cap-talk-R5kc06XGqWs-WDraOqkQAgAJ.html.gz`).

That motivates the view that something weaker (Waterken-style
point-to-point FIFO, plus user-level e-order-like affordances)
is the more pragmatic target.

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
Both stem from preserving E-ORDER across indirect reference
passing, but they manifest in different ways and admit different
fixes.

### 3.5 How the descendants address it

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
- **Mark Miller's contemporary view** (Spritely #8, #9): drop
  end-to-end E-ORDER in favor of point-to-point FIFO, with
  e-order recovered at the user level via "appropriate
  affordances and conventions."

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
- markm (Spritely thread #9) explicitly cites WormholeOp's cost
  as one reason to retreat from end-to-end E-ORDER to
  point-to-point FIFO with user-level affordances.

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

**E-ORDER.** Markm's name in the thesis for fail-stop FIFO with
forks (and joins). What this whole design space is trying to
land. See §1.4 and §1.5 above.

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

**End-to-end reference FIFO.** Messages sent on the *same
logical reference* (from the application's perspective) are
delivered in send order at the destination, even when the
wire-level reference identity changes during promise shortening.
This is the actual goal `op:flush` (and its alternatives) are
trying to deliver. Equivalent to E-ORDER (§1.4) for the
single-sender case.

**Causal order.** The general distributed-systems property: if
message m₁ causally precedes m₂ (e.g., the sender of m₂ had
observed m₁'s effects before sending m₂), then m₂ is delivered
after m₁. Stronger than per-pipe FIFO; weaker than total order.
End-to-end reference FIFO is one specific slice of causal order —
the slice along a single logical reference from a single sender.
Markm thesis §19.4 explicitly rejects full causal order as a
target for distributed ocap.
