# Endo meeting — message ordering

**Date:** Wednesday, 6 May 2026  

Edited transcript: this transcript in some cases heavily rephrases sentences for clarity, at the risk of misstating claims. For direct quotes, see the Endo meeting video recording.

---

**Kris Kowal**: This is the Endo meeting on Wednesday, May 6th of 2026. Today’s topic is message ordering. kumavis, do you want to kick it off?

**kumavis:** Sure. I have questions about message ordering in distributed object-capability systems. It’s a sprawling topic with a lot of history, so I’ll try to keep it focused. I’m bringing it up because there’s been discussion in OCapN that our current message ordering guarantees are underspecified or confusing, and I’m trying to wrap my head around what a reasonable guarantee is and what we can do without stronger guarantees. For OCapN, as I understand it, we currently have point-to-point FIFO, per session.

**Mark S. Miller:** “Point-to-point” is a term I introduced to express the FIFO ordering I had in mind—and unfortunately I chose exactly the wrong term, which caused a lot of confusion. What I meant is still *end-to-end* in the sense that it’s not just FIFO between vats when vat A is sending messages through vat B to vat C because of an unshortened promise chain. The traditional network notion of point-to-point, which I missed, is just FIFO between A and B and then separately FIFO between B and C, which is not a useful ordering constraint for application code.

What I really meant was effectively *object to object*—from sending object to receiving object. Because of how runtimes work within a vat, that effectively means **source vat to target object** FIFO. That FIFO must be maintained no matter what happens with things like dynamic promise shortening.

**kumavis:** I noticed you said vat-to-object instead of vat-to-reference. Are we distinguishing ordering for promises—FIFO for messages delivered to promises versus a separate FIFO for messages sent to objects, even if the promise resolves to that object? If we’re only ordering for the object and we don’t yet know the promise has resolved, how would we do that?

**Mark S. Miller:** You’re right; thanks for catching it—I was still speaking imprecisely. The guarantee is for messages sent **by a vat on a given reference** (references including promises).

**kumavis:** References inclusive of promises, right?

**Mark S. Miller:** Right. Both remotables and remote promises are inter-vat references (capabilities). If you have a promise, successive messages sent on that same promise must be delivered to whatever the fulfillment eventually is. All messages sent on that promise must arrive in the order they were sent, to that eventual fulfillment. If several promises eventually share the same fulfillment, FIFO is still **per promise**; there doesn’t need to be inter-promise coordination just because they fulfill to the same target.

For remotable references (OCapN Targets), the nice thing is the eq-requirement (reference equality): they have to be canonical anyway. There’s no dynamic shortening; something isn’t a remotable reference until it’s already as short as possible (no intermediaries), so you get sender-to-target FIFO simply as a consequence of vat-to-vat ordering, with no intermediate vats. All the complexity comes from promises, and yes, it’s per promise, with respect to messages delivered to the target.

**kumavis:** I think we have FIFO-to-Reference in OCapN, and Ridley is still suggesting that’s confusing.

**Mark S. Miller:** We do *not* have it “to references” in the sense you might think, because when a promise shortens it’s still, to the application programmer, **the same promise**. You don’t get to evade the FIFO guarantee by shortening; if you did, the FIFO guarantee would be useless to the application programmer.

**kumavis:** I see—on the caller side they are sending to this promise, but (behind the scenes on their client somewhere between calls) that promise has been shortened to a different promise and you could get a different FIFO ordering than they expect.

**Mark S. Miller:** I’d say it’s not a different promise but a **different path**. At the level of application code it’s the same promise; it’s just taking a different path now.

**kumavis:** Okay—thats my primary question answered. I have a few more.

**Mark S. Miller:** On message ordering or other topics? 

**kumavis:** On message ordering. Sorry if this is a silly one: the “lost resolution  bug” comes up a lot in reference to ordering, but the name sounds like a resolution was *lost*. Is that what the bug is?

**Mark S. Miller:** In the days of E it was called the “lost resolution” bug in a setting where an **E promise could turn into its target**—once fulfilled, the promise *became* the target. None of the modern ocap systems are trying to do that; for all of them the promise stays a promise and the fulfillment is distinct. So “lost resolution” isn’t really the right name anymore, but the underlying issue still exists if you try to implement **e-order**.

**Kris Kowal:** Would we call it *wandering* resolution?

**Mark S. Miller:** There’s a joke there that I’m missing.

**Kris Kowal:** I don’t know what it means.

**kumavis:** “Loss” sounds like something was dropped—that a promise failed to resolve.

**Mark S. Miller:** It’s the other way around. More useful is how it shows up in a modern system: Alice holds a remotable reference to Carol (a remote presence locally). Alice sends message **X** on that reference; **X** hasn’t arrived yet. Alice then sends Bob **her reference to Carol**; because it’s remotable it must show up in Bob’s vat as a remotable reference—canonically short—and be delivered to Bob.

If we want **e-ordering**, then when Bob sends message **Y** to Carol on that reference, **Y** must be delivered **after X**. *That* requirement is what made **Wormhole op** the solution—and it’s still a fine name in a modern setting.

We can’t pause **Y** until something happens on the A–C link in a way that makes the **A–B** session stall on A–C traffic overall—and we don’t want that. Bob may send other messages to Carol on that remotable for other reasons; those must stay FIFO with each other, so we can’t delay **Y** without delaying all of Bob’s other Carol traffic. Likewise we can’t delay Alice’s message to Bob that carries the Carol reference until **X** lands at Carol, because that would stall Alice’s *other* messages to Bob.

So the **Wormhole op** solution in a session-based protocol is messy: when vat A sends to vat B and the payload includes a reference to C **for which there is still unacknowledged A→C traffic**, A **bundles an encrypted form of that outstanding A→C traffic** into the message to B so B can forward it together with **Y**, and C can process it as if from A (signed/encrypted from A, with duplicate suppression as usual). That was the single-session-key story; with certificates it’s cleaner via **certificate chains**: the chain for **Y** would include (in encrypted form) the unacknowledged certificates A had sent to C at the time A sent Bob the Carol reference.

My response to that complexity is: **don’t standardize e-ordering**—it’s too hard. Back off to the weaker FIFO I had been calling “point-to-point” just to *name* something less onerous than e-order. Concretely, we **allow Y from Bob to Carol to arrive before X from Alice to Carol**.

**Mark S. Miller:** Chip, I saw you raising your physical hand?

**Chip Morningstar:** When you say “less onerous,” there’s onerous in terms of implementation complexity and maintainability, onerous in terms of performance, and onerous in terms of burden on the application developer to get things straight. E-order was meant to improve the *last* of those at the cost of the first two. Where does this new take come down on that tradeoff?

**Mark S. Miller:** Exactly the right question. E-order still makes life much easier for the application programmer. Retreating to FIFO **does** put more burden on them—in ways that are hard to test for. It’s a retreat from the best application programmer experience consistent with all the other constraints. Here, the **cost of implementing e-order**—especially across networks, languages, and everything the standard must accomodate—plus having to standardize some form of **wormhole op**, flipped the cost–benefit for me: I’m willing to move burden back to the application programmer. I’m **not** willing to retreat from what I’ll call **end-to-end FIFO** (per reference)—I’m just avoiding the confusing “point-to-point” wording. It’s still FIFO, not e-ordering.

**kumavis:** “End-to-end” is more intuitive to me; you still mean it **per reference**, right?

**Mark S. Miller:** That’s correct.

**kumavis:** Is **Waterken**-style ordering what we mean—point-to-point in the sense of session-to-session, client-to-client, direct-connection FIFO?

**Mark S. Miller:** In Waterken there were effectively **no sessions**, or equivalently **exactly one immortal session** between a pair of vats—like E in that regard, though not quite: I think there was a way for a session to *explicitly* end itself, but if a machine partitions or crashes forever, Waterken still treats it as a slow machine waiting for its vats to come back online.

**kumavis:** For **ordering**, the guarantee OCapN gives today, as I understand it, is similar to Waterken’s.

**Mark S. Miller:** Waterken had **no promise shortening**. If OCapN didn’t shorten promises, then “point-to-point” in the sense of local **vat-to-vat FIFO** would be enough to get what I’ll call **end-to-end reference FIFO**. Vat-to-vat FIFO would implicitly give you end-to-end reference FIFO in the absence of shortening, as in Waterken.

I think promises **must** shorten: Once its clear that messages on a promise-chain go to **vat C** even though **vat B** had been the immediary, it should at least be the case that after quesence, that if **vat B** goes offline, it does not further affect communication A->C. Because practically vats go offline a lot, and the cost of never shortening promises is too high (for availability).

**kumavis:** If the OCapN guarantee is **end-to-end FIFO per reference**, isn’t that very close to **e-order**?

**Mark S. Miller:** No. E-order adds the requirement that caused all the implementation pain. You can have end-to-end reference FIFO **without** wormhole op—Ridley’s line of proposal does that; no wormhole op there.

The distinction: suppose Alice first sends **X** to Carol, then sends **W** to Bob carrying the remotable reference to Carol; Bob receives it and sends **Y** to Carol on that reference. Under **e-ordering**, **Y** **cannot** be delivered to Carol until **X** has been delivered to Carol. *That* constraint really does ease application reasoning—but it is **hard on the implementer** and it is **not** implied by end-to-end reference FIFO alone.

There’s additional complexity from last meeting that I still haven’t fully digested: **session termination in the middle of a handoff** and how that affects what gets handed off. That has more implications for achieving end-to-end reference FIFO than I’ve fully accounted for here—I’ll leave it at that for now.
