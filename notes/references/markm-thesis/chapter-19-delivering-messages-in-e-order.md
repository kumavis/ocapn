# Chapter 19 — Delivering Messages in E-ORDER


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 155–164.

---

Chapter 19
Delivering Messages in E-ORDER
19.1 E-ORDER Includes Fail-Stop FIFO
Among messages successively sent on a single reference using the eventual send operator, E
guarantees fully order-preserving delivery, or fail-stop FIFO. All messages are delivered in
the order sent unless and until a partition breaks the reference. Once the reference breaks,
no further messages are delivered. Therefore, if a particular message does get delivered, E
guarantees that all messages sent earlier on the same reference were already delivered.
As a result, once Alice has sent the message x() to Carol, Alice should think of the
reference she is now holding as a reference to “post-x() Carol,” i.e., the Carol that has
already seen x(). This is true even though Carol has not yet seen x() and may never see
x(). Although Carol hasn’t seen x() yet, using this reference Alice no longer has any ability
to deliver a message to Carol before Carol sees x().
(Note: If Alice and Carol are in the same Vat and Alice has a near reference to Carol,
Alice can still immediately call Carol and deliver a message before messages which were
eventually sent earlier.)
19.2 FIFO is Too Weak
The above ordering guarantee is quite useful for Alice—it allows the Alice-to-Carol protocol
to be naively stateful. However, fail-stop FIFO by itself is too weak. As explained above,
after Alice sends x() on her reference to Carol, this reference represents, to her, only the
ability to talk to the Carol that has already received x(). In the simpliﬁed Pluribus protocol
explained in Chapter 7, if Alice sends that reference to Bob in message y(carol), and Bob
uses that reference to send message w() to Carol, the happenstance of variable network
delays may result in w() being delivered before x(). The reference as handed to Bob gave
Bob a dangerous possibility—of delivering a message w() ahead of x()—that was beyond
Alice’s notion of the reference’s meaning. Why is this possibility dangerous?
As an example, suppose that Carol is a collection, the x() is an update message that
deletes an entry from the collection, and that w() is a query message. Alice knows that if
she sends queries following an update, then the queries, if they are delivered, will only be
delivered after the updates. However, if she sends Bob y(carol) in order to delegate some
of this querying activity to Bob, within a system providing only fail-stop FIFO, Bob’s query
may be delivered before Alice’s update, and retrieve from Carol the entry Alice assumed
137

Figure 19.1 : Forks in E-ORDER. By placing messages on references in the order they
are sent, and by placing reference-forks according to when the reference was
eventually-sent as an argument, we obtain a Hasse diagram [ Ski90] of the
resulting constraints on message delivery order. Since both o() and x() are
next to Carol, either may be delivered next. Once a message is delivered, we
erase it and simplify the diagram accordingly. Once x() is delivered, then
both z() and w() would be next to Carol, and so would be eligible to be
delivered.
was inaccessible. Even under cooperative assumptions, this is dangerous.
19.3 Forks in E-ORDER
Instead, when a reference is included as an argument of an eventually sent message (as
Alice’s reference to Carol is included in message y(carol)), we say the reference is forked.
Bob does not get the reference Alice sent, but a fork of this reference. When a fork occurs
between two sending events, we diagram the fork-position on the reference between these
two messages. In Figure 19.1, Alice sends, in sequence, x(), y(carol), and z(). Bob
reacts to the y(carol) message by eventual-sending w() to the arriving argument, and by
eventual-sending o() on a reference he already had to Carol.
To enforce E-ORDER, VatA must not communicate to VatB the permission to access
Carol herself. VatA must communicate only a permission to communicate to a post- x()
Carol, i,e., VatA must send a cryptographic encoding of a post- x() fork of the Carol reference
that provides the recipient no feasible way to access Carol too early. (The actual protocol is
an adaptation of the introduction-by-shortening protocol originally proposed for the Client
Utility Architecture [ KGRB01].)
By following these diagramming rules, we visualize (approximately as a Hasse diagram
[Ski90, HP97]) the partial ordering guarantees E provides. The tree of messages connected
by a reference topology is the partial order itself.
138

As of any diagrammed state, the messages that may be delivered to Carol are those
that have no messages ahead of them in the Hasse diagram. Here, these are only messages
x() and o(). Once x() is delivered, we erase it and simplify the diagram. This results in
both w() and z() becoming adjacent to Carol, and so becoming candidates to be delivered
next. Either choice is consistent with the speciﬁcation.
With these rules, the reference Bob receives from Alice has no more power in Bob’s
hands than it had in Alice’s. The assumptions Alice needs to make for herself, for the sake
of her own sanity, are assumptions that remain valid as she delegates to Bob.
Note that the Hasse-diagram topology is in the speciﬁcation only, not in the implementation. The implementation is free to deliver messages to Carol in any full order consistent
with the speciﬁed partial order. It can therefore collapse partial orders to full orders whenever convenient, consistent with these constraints.
19.4 CAUSAL Order is Too Strong
CAUSAL order would provide all the guarantees listed above and more. In our example
scenario, it would also guarantee that o() is delivered to Carol only after x(), since Bob
sent o() in reaction to y(), and y() was causally after x(). If E enforced CAUSAL or
stronger orders [ BJ87, Ami95], programmers would only need to handle a smaller number
of cases. E doesn’t provide CAUSAL order because we don’t know how to enforce it among
mutually defensive machines.
In the example, VatB already had access to Carol by virtue of the reference held in
Bob’s c2 variable. A message eventually-sent by VatB on this reference already had the
possibility of being delivered to Carol ahead of Alice’s x() message. Enforcing CAUSAL
order would require, in the case where VatB sends o() on c2 in reaction to the arrival of
y(), that o() must then be delivered only after x(). In order to enforce CAUSAL order
on a possibly misbehaving VatB, somehow, the arrival of y(carol) from VatA would have
to preclude this previously present possibility. In the absence of mutually-reliant hardware
[ST94], this seems diﬃcult.
By contrast, E-ORDER only requires restricting the new possibilities the newly arriving reference-to-Carol provides to VatB, rather than the removal of previously present
possibilities.
19.5 Joins in E-ORDER
E has no eventual equality primitive. Rather, it has an immediate equality primitive, “ ==”,
which can only be applied to resolved references. Using this primitive, eventual equality
can be programmed in E as yet another joiner pattern, as shown in Figure 19.2. Given two
references, the join function gives us a promise for the one object they (hopefully) both
designate. If both references do eventually come to designate the same object, join fulﬁlls
this promise, creating a join in the message-ordering constraints.
Given a and b, then def c := join(a, b) deﬁnes c as a promise for the one object
they both designate. We may immediately start sending messages on c, conﬁdent that these
messages will only get delivered if this promise is fulﬁlled. If either a or b eventually break,
or if then both eventually resolve to refer to diﬀerent objects, then the promise for their join
will eventually be broken. In this case, all messages sent to it will be discarded using the
139

def join (left , right ) {
return when (left,right) -> {
if (left == right) { left } else { throw("unequal") }
}
}
Figure 19.2 : Eventual Equality as Join. The join function returns a promise for the
object that both left and right will designate. If left and right both
eventually designate the same object, then the returned promise will become
a resolved reference to that object. If not, then this promise will be broken
by an alleged explanation of what went wrong. Messages sent on this promise
will not be delivered until after all messages that had been sent on left and
right prior to the join have already been delivered to this object.
usual broken promise contagion rules. Because join returns the promise for the result of a
when-catch, all messages sent to this promise are buﬀered locally, in the vat where join was
called, rather than being pipelined to their expected destination. This avoids speculatively
revealing messages to a vat before determining whether that vat should have access to that
message.
The c promise is a fork of a and a fork of b. Given the sequence of actions shown
in Figure 19.3 if a and b are independent references to the same object, and assuming no
partition occurs, then:
• u() and v() may be delivered in any order.
• w() may only be delivered after u() is delivered.
• x() may only be delivered after u() is delivered, as implied by “ c is a fork of a after
u()”.
• x() may only be delivered after v() is delivered, as implied by “ c is a fork of b after
v()”.
• y() may only be delivered after v() is delivered.
• w(), x(), and y() may be delivered in any order.
• All these messages are delivered at most once.
If a and b do not designate the same object, then all the above statements hold except that
x() must not be delivered. In addition, c must eventually resolve to broken.
Should a partition occur, all the above statements continue to hold anyway, but not in
the obvious way. For example, should v() be lost in a partition, never to be delivered, then
x() and y() must never be delivered, and both b and c must eventually become broken, as
implied by “ c is a fork of b after v()”.
140

a <- u()
b <- v()
def c := join(a, b)
a <- w()
c <- x()
b <- y()
Figure 19.3 : Joins in E-ORDER. A join returns a single reference that is a join of the
forks of each of its arguments. A message sent on the joined reference may
only be delivered after all messages that were already sent ahead of these
fork points. Once u() and v() are delivered and erased, if they have the
same target, then the diagram simpliﬁes so that x() would be eligible to be
delivered next. If they have diﬀerent targets, then x() will never be eligible.
19.6 Fairness
Our ordering constraints above deﬁne when a message is eligible to be delivered next. Of all
the messages eligible to be delivered to any of the objects hosted by a given vat, E-ORDER
allows any to be delivered next. However, once a message is eligible, it must eventually be
delivered or dropped. It may only be dropped as a result of a partition, whose consequences
have already been explained. By eventually, we do not mean that there must be a future
time at which this delivery will occur, since an inﬁnite turn can prevent that. Rather,
we deﬁne E-ORDER to preclude the possibility that an inﬁnite number of other eligible
messages will be chosen ahead of a message that is already eligible. This deﬁnition of
fairness is an adaptation of Clinger’s deﬁnition in terms of unbounded non-determinism
[Cli81].
19.7 Notes on Related Work
Lamports’s happened before relationship in Time, Clocks, and the Ordering of Events in a
Distributed System [Lam78] and Hewitt and Baker’s ordering laws in Actors and Continuous Functionals [HB78] (further debugged and reﬁned by Clinger’s Foundations of Actor
Semantics [Cli81]) represent contemporaneous discoveries of similar adaptations of special
relativity’s partial causal order of events [ Sch62] to describe the order of events in distributed systems. For both, the overall partial order comes from combining two weaker
orders, and then taking the transitive closure of the combination. The role played by Hewitt and Baker’s “actor” is the same as Lamport’s “process” and E’s “vat.” Using Hewitt
and Baker’s terminology, the two orders are the “activation order” and the “arrival order.”
141

The arrival order is the linear sequence of events within an actor (process/vat). Each
event depends on the actor’s current state, and leaves the actor in a new state, so each
event happens before all succeeding events in the same actor. The activation order says
that the event from which actor Alice sent message foo happens before the event in which
that message is delivered to actor Bob. The closure of these two orders taken together is
the partial causal order of events in a distributed system. When all inter-actor causality of
possible interest is modeled as occuring by such messages, then one event can only inﬂuence
another if the ﬁrst happens before the second.
This partial causal order is descriptive: it describes any physically realizable system
of computation. In the taxonomy of distributed system message delivery orders, in the
absence of further constraints, this would be termed UNORDERED, UNRELIABLE . It
is UNORDERED because the only ordering constraint between when a message is sent
and when it is delivered is that it cannot be delivered before it is sent— happened before
cycles are assumed impossible. It is UNRELIABLE because sent messages may not be
delivered. However, it is assumed that delivered messages were sent. (Here, we will further
assume that a sent message is delivered at most once.)
CAUSAL and stronger orders are usually explained in the context of reliable muticast
and group communications systems. Ken Birman’s Reliable Distributed Systems [Bir05]
examines in detail the ﬁeld of Group Membership protocols and the hierarchy of message
delivery orders these systems generally provide. A more formal survey can be found in
Group Communication Speciﬁcations: A Comprehensive Study [VCKD99]. D´ efago and
Urb´ an’sTotal Order Broadcast and Multicast Algorithms: Taxonomy and Survey presents a
taxonomy of systems providing AGREED and stronger orders in the context of multicast
communication systems, including but not limited to group communications systems.
Although usually presented in the context of multicast, these various message delivery
orders can be used to describe unicast systems, such as that presented in this dissertation.
In the unicast context, CAUSAL order guarantees that if the event sending m1 happens
before the event sending m2, and if both are delivered, then the event in which m1 is delivered
happens before the event in which m2 is delivered. When m1 and m2 are delivered to the
same actor, this is directly prescriptive: it says that m1 must actually arrive ﬁrst at the
recipient. This arrival event must appear ﬁrst in the recipient’s arrival order. When they
are delivered to diﬀerent actors, this constraint is only indirectly prescriptive: it adds an
ordering constraint to the happens before relationship, which must remain acyclic as we
take the closure.
Protocols for CAUSAL and stronger orders are cooperative. Participating machines
are mutually reliant on each other to operate according to the protocol. Smith and Tygar’s
Security and Privacy for Partial Order Time [ST94] examines the security hazards that
result when dishonest machines undetectably violate CAUSAL order by violating the protocol designed to provide CAUSAL order. They examine the issues involved in designing
a purely cryptographic protocol for enforcing CAUSAL order, including their own previous attempts. They conclude that tamper-resistant mutually-reliant hardware is needed,
and then show how to use such hardware to enforce CAUSAL order among machines
constrained to communicate only through such hardware.
Conventional FIFO order can be deﬁned in terms of pairs of actors (processes/vats): If
Alice sends m1 and then m2 to Bob, so that the sending of m1 happens before the sending
of m2 in Alice’s local arrival order , and if both are delivered to Bob, then the delivery of m1
must happen before the delivery of m2. Otherwise, no additional constraints are imposed.
142

This construction is stronger than FIFO order as provided by TCP [ Pos81], since TCP
only provides FIFO order separately within each communications channel. Rather than
requiring m1 and m2 merely to be sent by the same Actor, TCP additionally requires that
they be sent on the same channel. We can visualize the channel as carrying a linear chain
of messages which have been sent but not yet delivered. Sending adds to the tail end of the
chain. Only the message at the head is eligible to be delivered next. If an actor receives
from multiple chains, then, except for possible fairness issues [ Cli81], the order in which
their messages are interleaved is not further constrained.
Once we introduce channels, we can then deﬁne fail-stop as the guarantee that a message
sent later on a channel will only be delivered if all messages sent earlier on the same channel
will eventually be delivered. Without perfect foresight, the only way to ensure that they
will be delivered is if they were delivered, so fail-stop will normally imply at least FIFO
order. Fail-stop channels are like degenerate two-party group views [ Ami95], and channel
failure reports are like group-view membership messages.
An end of a TCP channel is not normally considered to be transmissable between machines, so the issue of multiple machines sending on the same channel does not arise. For
references, this issue does arise. Shapiro and Takeuchi’s Object Oriented Programming in
Concurrent Prolog [ST83] was the ﬁrst to explore the tree-order subset of E-ORDER. An
object reference to Carol was modeled as an incomplete list of logic variables. Alice sent x()
to Carol by unifying the tail of the list with a pair of the x() message and a new unbound
variable representing the new list tail. The sender would then hold onto this new list tail
as the new reference to post- x() Carol. However, this replacement was manual and error
prone: only the individual logic variables were ﬁrst class, not the references deﬁned by this
pattern of replacement. Alice and Bob could not usefully share a logic variable as a means
to communicate with Carol, since whoever uses it ﬁrst uses it up, preventing its use by the
other.
Using Shapiro and Mierowsky’s Fair, Biased, and Self-Balancing Merge Operators:
Their Speciﬁcation and Implementation in Concurrent Prolog [SM87], when Alice wishes
to send Bob a reference to Carol, she sends a merge() message to Carol, corresponding to
the fork points shown in Figure 19.1. She then sends the new variable representing this
merged-in reference to Bob. However, these references were still not ﬁrst-class, as they could
only be shared by explicit merging. Tribble et al. ’s Channels: A Generalization of Streams
[TMK+87], explained brieﬂy in Related Work Section 23.3, repaired these diﬃculties, and
removed the need for the manual tail-replacement and merge messages.
Process calculi such as the π calculus [ Mil99] provide elegant frameworks for specifying
and reasoning about many of the properties of message-passing systems. However, so far as
we are aware, none has succeeded in specifying fairness. Benjamin Pierce’s “Pict” language
[PT00] does provide fairness, but the speciﬁcation of fairness is not captured in the π
calculus description of the language.
Concurrent Prolog [ SM87], Actors [ Cli81], and E-ORDER all specify fairness. Fairness
is necessary for E programs to satisfy the liveness requirement we state in Section 5.7 as
“Defensive progress up to resource exhaustion.” The qualiﬁer “up to resource exhaustion”
acknowledges that fairness does not prevent denial of service attacks. Fairness helps guarantee only that other clients cannot slow service to a given client down to zero. These
other clients can still cause service to get arbitrarily close to zero, preventing progress for
all practical purposes. Christian Scheideler’s Towards a Paradigm for Robust Distributed
Algorithms and Data Structures [Sch06], covered in Related Work Section 26.7, presents an
143

approach for resisting denial of service attacks within E-like systems.
144

Part IV
Emergent Robustness
145
