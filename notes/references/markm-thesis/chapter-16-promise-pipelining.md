# Chapter 16 — Promise Pipelining


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 135–140.

---

Chapter 16
Promise Pipelining
The eventual-send examples so far were carefully selected to be evaluated only for their
eﬀects, with no use made of the value of these expressions. This chapter discusses the
handling of return results and exceptions produced by eventual-sends.
16.1 Promises
As discussed previously, eventual-sends queue a pending delivery and complete immediately.
The return value from an eventual-send operation is called a promise for the eventual result.
The promise is not a near reference for the result of the eventual-send because the eventualsend cannot have happened yet, i.e., it will happen in a later turn. Instead, the promise
is an eventual-reference for the result. A pending delivery, in addition to the message
and reference to the target object, includes a resolver for the promise, which provides the
right to choose what the promise designates. When the turn spawned by the eventual-send
completes, its vat reports the outcome to the resolver, resolving the promise so that the
promise eventually becomes a reference designating that outcome, called the resolution.
Once resolved, the promise is equivalent to its resolution. Thus, if it resolves to an
eventual-reference for an object in another vat, then the promise becomes that eventual
reference. If it resolves to an object that can be passed by copy between vats, then it
becomes a near-reference to that object.
Because the promise starts out as an eventual reference, messages can be eventuallysent to it even before it is resolved. Messages sent to the promise cannot be delivered until
the promise is resolved, so they are buﬀered in FIFO order within the promise. Once the
promise is resolved, these messages are forwarded, in order, to its resolution.
16.2 Pipelining
Since an object can eventual-send to the promises resulting from previous eventual-sends,
functional composition is straightforward. If Alice in VatA executes
def r3 := (bob <- x()) <- z(dave <- y())
or equivalently
def r1 := bob <- x()
def r2 := dave <- y()
def r3 := r1 <- z(r2)
117

Figure 16.1 : Promise Pipelining. The three messages in def r3 := (bob <- x()) <-
z(dave <- y()) are streamed out together, with no round trip. Each message box “rides” on the reference it is sent on. References bob and dave
are shown with solid arrowheads, indicating that their target is known. The
others are promises, whose open arrowheads represent their resolvers, which
provide the right to choose their promises’ value.
and bob and dave refer to objects on VatB, then all three requests are serialized and streamed
out to VatB immediately and the turn in VatA continues without blocking. By contrast, in
a conventional RPC system, the calling thread would only proceed after multiple network
round trips.
Figure 16.1 depicts an unresolved reference as an arrow stretching between its promiseend, the tail held by r1, and its resolver, the open arrowhead within the pending delivery
sent to VatB. Messages sent on a reference always ﬂow towards its destination and so “move”
as close to the arrowhead as possible. While the pending delivery for x() is in transit to
VatB, so is the resolver for r1, so we send the z(r2) message there as well. As VatB
unserializes these three requests, it queues the ﬁrst two in its local to-do list, since their
target is known and local. It sends the third, z(r2), on a local promise that will be resolved
by the outcome of x(), carrying as an argument a local promise for the outcome of y().
If the resolution of r1 is local to VatB, then as soon as x() is done, z(r2) is immediately
queued on VatB’s to-do list and may well be serviced before VatA learns of r1’s resolution. If
r1 is on VatA, then z(r2) is streamed back towards VatA just behind the message informing
VatA of r1’s resolution. If r1 is on yet a third vat, then z(r2) is forwarded to that vat.
Across geographic distances, latency is already the dominant performance consideration. As hardware improves, processing will become faster and cheaper, buﬀers larger, and
bandwidth greater, with limits still many orders of magnitude away. But latency will remain limited by the speed of light. Pipes between ﬁxed endpoints can be made wider but
not shorter. Promise pipelining reduces the impact of latency on remote communication.
Performance analysis of this type of protocol can be found in Bogle’s “Batched Futures”
[BL94]; the promise pipelining protocol is approximately a symmetric generalization of it.
16.3 Datalock
Promise chaining allows some plans, like z(r2), to be postponed pending the resolution
of previous plans. We introduce other ways to postpone plans below. Using only the
118

? var flag := true
# value: true
? def epimenides () { return flag <- not() }
# value: <epimenides>
? flag := epimenides <- run()
# value: <Promise>
Figure 16.2 : Datalock. These three expressions together assign to flag a promise for the
result of sending not() to the resolution of this very promise. This creates
the illustrated circular dependency, in which the not() message is forever
buﬀered in the promise which only not()’s delivery could resolve.
primitives introduced so far, it is possible to create circular data dependencies which, like
deadlock, are a form of lost-progress bug. We call this kind of bug datalock. For example,
the epimenides function deﬁned in Figure 16.2 returns a promise for the boolean opposite of
flag. If flag is assigned to the result of invoking epimenides eventually, datalock occurs:
the promise stored in flag will never resolve, and any messages eventually-sent to it will
never be delivered.
In the current turn, a pending-delivery of epimenides <- run() is queued, and a
promise for its result is immediately assigned to flag. In a later turn when epimenides
is invoked, it eventual-sends a not() message to the promise in flag, and then resolves
the flag promise to the new promise for the result of the not() sent to that same flag
promise. The datalock is created, not because a promise is resolved to another promise
(which is acceptable and common), but because computing the eventual resolution of flag
requires already knowing it.
Although the E model trades one form of lost-progress bug for another, it is still more
robust. As above, datalock bugs primarily represent circular dependencies in the computation, which manifest reproducibly like normal program bugs. This avoids the signiﬁcant
non-determinism, non-reproducibility, and resulting debugging diﬃculty of deadlock bugs.
Anecdotally, in many years of programming in E and E-like languages and a body of experience spread over perhaps 60 programmers and two substantial distributed systems, we
know of only two datalock bugs. Perhaps others went undetected, but these projects did
not spend the agonizing time chasing deadlock bugs that projects of their nature normally
must spend. Further analysis is needed to understand why datalock bugs seem to be so
rare.
16.4 Explicit Promises
Besides the implicit creation of promise-resolver pairs by eventual-sending, E provides a
primitive to create these pairs explicitly. In the following code
def [ p , r ] := Ref.promise()
119

p and r are bound to the promise and resolver of a new promise/resolver pair. Explicit
promise creation gives us yet greater ﬂexibility to postpone plans until other conditions
occur. The promise, p, can be handed out and used just as any other eventual reference.
All messages eventually-sent to p are queued in the promise. An object with access to r can
wait until some condition occurs before resolving p and allowing these pending messages to
proceed, as the asyncAnd example in Figure 18.1 (p. 130) will demonstrate.
Like the caretaker of Section 9.3, promises provide temporal control of authority, but
in the opposite direction. The caretaker’s control facet (the gate) can be used to terminate
the authority provided by its use facet (the caretaker). By contrast, the promise’s control
facet (the resolver) can be used to delay the granting of the authority provided by its use
facet (the promise).
16.5 Broken Promise Contagion
Because eventual-sends are executed in a later turn, an exception raised by one can no
longer signal an exception and abort the plan of its “caller.” Instead, the vat executing
the turn for the eventual send catches any exception that terminates that turn and breaks
the promise by resolving the promise to a broken reference containing that exception. Any
immediate-call or eventual-send to a broken reference breaks the result with the broken
reference’s exception. Speciﬁcally, an immediate-call to a broken reference would throw the
exception, terminating control ﬂow. An eventual-send to a broken reference would break
the eventual-send’s promise with the broken reference’s exception. As with the original
exception, this would not terminate control ﬂow, but does aﬀect plans dependent on the
resulting value.
E’s split between control-ﬂow exceptions and dataﬂow exceptions was inspired by signaling and non-signaling NaNs in ﬂoating point [ Zus41, IoEE85, Kah96]. Like non-signaling
NaNs, broken promise contagion does not hinder pipelining. Following sections discuss how
additional sources of failure in distributed systems cause broken references, and how E
handles them while preserving defensive consistency.
16.6 Notes on Related Work
The notion of a delayed reference in software seems to originate with the dataﬂow architectures of Richard Karp and Raymond Miller [ KM66] and Rodriguez [ Rod67]. Bredt’s survey
[Bre73] covers this and related early work. In our terms, pure dataﬂow models provide for
parallelism but not for concurrency control. These pure models are constrained to provide
the conﬂuence property: the value computed is insensitive to the order in which intermediate computations happen. Conﬂuent models show how to use concurrency for speedup
while keeping the semantics concurrency-free. These notions migrated into pure lisp as
“promises” through the works of Friedman and Wise, for both lazy evaluation [ FW76a] and
eager evaluation [ FW76b].
Baker and Hewitt’s “futures”’ [ BH77] adapt pure lisp’s promises to the Actors context,
which can express concurrency control. Futures are references to values that have not
been computed yet, where a separate “process” is spawned to compute this value. Actors
futures were adapted by Halstead for Multilisp, a parallel Scheme [ Hal85]. All these forms
of delayed reference made no provision for representing exceptions. An attempt to use
120

a delayed reference before it was computed would block, rather than pipeline. Delayed
references were spawned only by lazily or eagerly evaluating an expression. There was no
resolver-like reiﬁcation of the right to determine what value the delayed reference resolves
to. Multilisp uses shared-state concurrency, and so uses locking to prevent conﬂicts on
shared data structures.
Concurrent logic [ Sha83] and constraint [ Sar93] programming languages use logic variables as delayed references. In these languages, an unannotated logic variable provides both
a delayed right to use a future value, and the right to determine (by uniﬁcation) what this
future value is. Diﬀerent languages of this ilk provide various annotations to distinguish
these two roles. Concurrent Prolog’s read-only annotation (indicated by “?”) creates a
read-only capability to the logic variable [ Sha83]. A uniﬁcation which would equate it with
a value (a non-variable) would block waiting for it to be bound. Vijay Saraswat’s ask/tell
framework [ Sar93] distinguishes uniﬁcations which “ask” what the current bindings entail
vs. uniﬁcations which “tell” the binding what constraints they must now entail. Both of
these eﬀorts inspired the stricter separation of these rights in the Joule language [ TMHK95],
covered in Related Work Section 23.4. E derives its separation of promise from resolver from
Joule’s channels.
The promise pipelining technique was ﬁrst invented by Liskov and Shrira [ LS88] and
independently re-invented as part of the Udanax Gold system mentioned in Related Work
Section 23.5. These ideas were then signiﬁcantly improved by Bogle [ BL94]. These are
asymmetric client-server systems. In other ways, the techniques used in Bogle’s protocol
quite closely resemble some of the techniques used in Pluribus.
In 1941, Konrad Zuse introduced a NaN-like undeﬁned value as part of the ﬂoating
point pipeline of one of the world’s earliest computers, the Z3 [ Zus41]. Zuse was awarded
a patent on pipelining in 1949 [ Zus49]. According to the CDC 6600 manual [ Con67], its
NaN-like “indeﬁnite” value was optionally contagious through further operations. However,
Kahan’s Lecture Notes on the Status of the IEEE Standard 754 for Binary Floating Point
Arithmetic [Kah96], which credits Zuse’s “undeﬁned” as the source of the NaN idea, claims
that Zuse’s “undeﬁned” and the CDC 6600’s “indeﬁnite” values were not non-signalling.
Kahan credits the non-signalling NaN to the IEEE ﬂoating point standard [ IoEE85].
121

122
