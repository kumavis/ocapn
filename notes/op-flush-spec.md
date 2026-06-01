# `op:flush` — Draft Spec Text

Proposed CapTP operation for preserving end-to-end reference FIFO across
promise shortening, as proposed by [@RidleyWrites][ridley] on
[ocapn/ocapn#11][issue-11].

This document is **draft spec text** suitable for review and potential
incorporation into [`draft-specifications/CapTP Specification.md`][ocapn-captp];
it does not document the surrounding rationale (see
[`notes/issue-11-promise-shortening.md`][notes-issue11] and
[`notes/message-ordering.md`][notes-msgord] for that).

Sources transcribed:

- [Comment 2026-04-29 — original proposal][flush-proposal]
- [Comment 2026-05-13 — addendum][flush-update]

---

## [`op:flush`](#op-flush)

The `op:flush` operation is sent by the would-be shortener of a promise to
the peer that holds the corresponding resolver. It is the first step of a
shortening third-party handoff: it drains any application messages already
in flight on the old, longer path before the handoff swings the path onto
its shorter replacement, and it hands the sender a fresh resolver to target
the handoff at.

The `op:flush` message is:

```text
<op:flush to-desc           ; desc:export
          answer-pos        ; positive integer
          resolve-me-desc>  ; desc:import-object | desc:import-promise
```

### Three-party scenario

The proposal is framed in terms of three vats: **Alice**, **Bob**, and
**Carol**. The roles, in the original wording from the
[flush proposal comment][flush-proposal]:

- **Alice** holds a resolver `r`, which she uses to resolve a promise `p1`.
  Alice has previously exported `r` to Bob.
- **Bob** holds the corresponding `desc:export` reference to Alice's `r`,
  and is ready to shorten the promise by performing a third-party handoff
  that resolves the chain into Carol's vat.
- **Carol** is the vat hosting the target the handoff resolves into.

Bob is the *sender* of `op:flush`. Alice is the *receiver* of `op:flush`.

### Sending (Bob's side)

`op:flush` MUST be sent before, and not concurrently with, the
corresponding shortening third-party handoff. That is, Bob MUST wait for
the response on `resolve-me-desc` / `answer-pos` to arrive before sending
the [`deposit-gift`][deposit-gift] / `desc:handoff-give` pair that performs
the shortening handoff.

#### `to-desc`

A [`desc:export`][desc-export] referencing Alice's resolver `r`. This is
the resolver Bob would otherwise resolve directly with the new
post-shortening reference; instead, `op:flush` asks Alice to hand back a
*fresh* resolver, exported separately, that the handoff will target in
place of `r`.

#### `answer-pos`

A unique answer position, in the same sense as
[`op:deliver`'s `answer-pos`][op-deliver]: a positive integer at which Bob
creates a local promise to receive the flush response. This MAY be `false`
when no pipelining on the response is desired.

#### `resolve-me-desc`

A [`desc:import-object`][desc-import-object] or
[`desc:import-promise`][desc-import-promise] that Alice will use to
deliver the flush response. The single response value is the new
`desc:import-object` for Alice's newly-exported resolver `r'`.

In the original proposal, the resolve target is described as "a fresh
resolver of [Bob's] own to receive the answer."

### Receiving (Alice's side)

When `op:flush` arrives at the resolver designated by `to-desc`, Alice
MUST:

1.  Mint a fresh local promise/resolver pair `p'` / `r'`.
2.  Fulfill the original resolver `r` with `p'`. This causes any further
    application-level sends on `p1` — which until now were leaving Alice's
    vat addressed at Bob — to be buffered locally inside Alice's vat,
    queued at `p'`.
3.  Export `r'` at a **new** export-table position (i.e., not the position
    previously occupied by `r`). The new position is reported back through
    the flush response.
4.  Deliver the flush response. This MUST contain `r'` as a
    `desc:import-object` (the receiver of the response will import `r'`
    into their import table) and is delivered both through
    `resolve-me-desc` and as the resolution of the promise at `answer-pos`,
    in the usual `op:deliver`-style manner.
5.  Treat `op:flush` as carrying an implicit garbage-collection signal for
    the original resolver `r`. The export-table slot previously occupied by
    `r` MAY be released as if Bob had sent an
    [`op:gc-export`][op-gc-export] for that slot at the same time; Bob MUST
    NOT continue to address messages at `r` after sending `op:flush`.

> The original draft of the proposal had Alice re-use the same
> export-table position for `r'` (replacing `r` in place). The
> [addendum][flush-update] amends this: Alice exports `r'` at a *new*
> position and reports it back through the flush response. This avoids
> introducing new semantics for replacement of an export-table entry. The
> addendum also notes that `op:flush` "could also be considered an
> implicit GC message for the original resolver `r`."

### Use within a shortening third-party handoff

`op:flush` is intended to be used immediately before a
[third-party handoff][3ph] that resolves `r` into Carol's vat. The full
sequence:

1.  Bob sends `op:flush` to Alice, targeting Alice's `r`. Bob creates a
    local promise at `answer-pos` to receive the response, and provides
    `resolve-me-desc` for the same response.

2.  Alice performs the receive steps above: she mints `p'`/`r'`, fulfills
    `r` with `p'`, exports `r'` at a new export-table position, and sends
    the flush response carrying `desc:import-object` for `r'` back to Bob.

3.  Bob waits for the flush response. When it arrives, per-CapTP-session
    FIFO between Alice and Bob guarantees that every message Alice had
    already sent on the Alice↔Bob session — including any messages
    pipelined on `p1` that Bob was about to forward toward Carol — has
    already been received at Bob.

4.  Bob now performs a normal third-party handoff of his promise `p2`
    (the promise representing the new, post-shortening target in Carol's
    vat), but targets `r'` (the fresh resolver returned by the flush)
    rather than the original `r`. This consists of:

    -   Sending [`deposit-gift`][deposit-gift] to Carol's bootstrap object
        on the Bob↔Carol session, with the gift being `p2`.
    -   Constructing and sending a `desc:handoff-give` referencing the same
        gift, to be delivered to Alice via Bob's onward forwarding of
        Alice's pipelined messages, *or* sent directly to Alice on the
        Alice↔Bob session.

    Because the Bob↔Carol session is FIFO, Carol cannot receive
    `deposit-gift` until she has already received every forwarded
    Alice-message that came through Bob. Carol's view of those messages
    therefore precedes the gift, which is what makes the eventual onward
    delivery (after Alice's withdrawal completes) FIFO-preserving.

5.  Alice processes the incoming `desc:handoff-give` by following the
    standard [receiver-side handoff procedure][3ph-receiver]: she
    establishes (or reuses) a CapTP session to Carol and sends
    [`withdraw-gift`][withdraw-gift] to Carol's bootstrap object,
    addressed at `r'`. The promise Alice creates for the withdrawal —
    here called `p''` — eventually resolves to the deposited gift on
    Carol's side.

6.  `r'` is then resolved with `p''`. `p'` (which Alice had earlier
    fulfilled `r` with, step 2 above) consequently resolves transitively
    onto Carol's gift, and the messages Alice buffered locally at `p'`
    during the flush window drain to Carol over the Alice↔Carol session in
    their original send order.

### Composition over longer chains

In the four-party (and `n`-party) case, the same protocol composes. Each
intermediate peer that wishes to remove itself from a chain sends
`op:flush` to the peer immediately upstream of it and waits for the flush
response before initiating its own third-party handoff. Local buffering at
each upstream peer ensures that no application-visible message races the
path switchover at any link of the chain.

### Notes

-   `op:flush` MUST be sent for every shortening of a remote promise,
    even when the shortener has not observed any application traffic on
    that promise. The shortener has no general way to determine whether
    the holder has pipelined messages through it.

-   `op:flush` is unrelated to (and not used for) local resolution events
    in which a promise resolves to a value or to a reference within the
    shortener's own vat. It is specific to *cross-session* path
    shortening.

-   The flush response simultaneously serves three purposes: (a) it is
    the drain signal that confirms all in-flight messages on the
    Alice→Bob direction of the Alice↔Bob session have been received;
    (b) it carries the new resolver `r'` that the subsequent third-party
    handoff will target; and (c) it implicitly retires the original
    resolver `r` from the export table.

<!-- Link references -->

[3ph]: ../draft-specifications/CapTP%20Specification.md#third-party-handoffs
[3ph-receiver]: ../draft-specifications/CapTP%20Specification.md#handoffs-from-the-receivers-perspective
[deposit-gift]: ../draft-specifications/CapTP%20Specification.md#deposit-gift-method
[desc-export]: ../draft-specifications/CapTP%20Specification.md#desc-export
[desc-import-object]: ../draft-specifications/CapTP%20Specification.md#desc-import-object
[desc-import-promise]: ../draft-specifications/CapTP%20Specification.md#desc-import-promise
[flush-proposal]: https://github.com/ocapn/ocapn/issues/11#issuecomment-4344960376
[flush-update]: https://github.com/ocapn/ocapn/issues/11#issuecomment-4442041860
[issue-11]: https://github.com/ocapn/ocapn/issues/11
[notes-issue11]: ./issue-11-promise-shortening.md
[notes-msgord]: ./message-ordering.md
[ocapn-captp]: ../draft-specifications/CapTP%20Specification.md
[op-deliver]: ../draft-specifications/CapTP%20Specification.md#op-deliver
[op-gc-export]: ../draft-specifications/CapTP%20Specification.md#op-gc-export
[ridley]: https://github.com/RidleyWrites
[withdraw-gift]: ../draft-specifications/CapTP%20Specification.md#withdraw-gift-method
