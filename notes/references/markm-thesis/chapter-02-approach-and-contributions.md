# Chapter 2 — Approach and Contributions


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 23–32.

---

Chapter 2
Approach and Contributions
This chapter provides a preview of topics developed in the rest of the dissertation, with
forward references to chapters where each is explained. At the end of those chapters are
summaries of related work. Further related work appears in Part V.
2.1 Unattenuated Composition
Figure 2.1 : Unattenuated Composition.
In an object system (Figure 2.1), when object Alice says bob.foo(carol), she invokes
object Bob, passing as argument a reference to object Carol. By passing this reference,
Alice composes Bob with Carol, so that their interaction will serve some purpose of Alice’s.
The argument reference enables Bob to interact with Carol.
By restricting inter-object causality to ﬂow only by messages sent on references, Bob’s
authority is limited according to the references he comes to hold. If Bob cannot interact
with Carol unless he holds a reference to Carol, then the reference graph from the programming language literature is the access graph from the access control literature. When
references can only be transmitted and acquired by the rules of the object programming
model, this results in the object-capability model of secure computation. This model has
been represented by concrete designs for over forty years, but previous attempts to state
the model abstractly have left out crucial elements. A contribution of Chapter 9 is to
present a single model, abstract enough to describe both prior object-capability languages
and operating systems, and concrete enough to describe authority-manipulating behavior.
Alice’s purpose requires Bob and Carol to interact in certain ways. Even within the
object-capability restrictions, this reference provides Bob unattenuated authority to access
5

Carol: It gives Bob a perpetual and unconditional ability to invoke Carol’s public operations. This may allow interactions well beyond those that serve Alice’s purposes, including
interactions harmful to Alice’s interests. If Alice could enable just those interactions needed
for her purposes, then, if things go awry, the damage that follows might be usefully isolated
and limited.
This dissertation explores several mechanisms by which the authority Alice provides
to Bob may be attenuated. Some of these mechanisms simply restate established practice
of object-capability access control. A contribution of Chapter 3 and Part III is to view
concurrency control issues in terms of attenuating authority as well, and to provide a uniﬁed
architecture for attenuating authority, in which both access control and concurrency control
concerns may be addressed together.
2.2 Attenuating Authority
Figure 2.2 : Attenuating Authority.
In practice, programmers control access partially by manipulating the access graph, and
partially by writing programs whose behavior attenuates the authority that ﬂows through
them. In Figure 2.2, Alice attenuates Bob’s authority to Carol by interposing an access
abstraction. In this case, the access abstraction consists of objects which forward some
messages from Bob to Carol, where Alice controls this message-forwarding behavior. The
access abstractions presented in Part II are idealizations drawn from existing prior systems.
We are unaware of previous systematic presentations on the topic of access abstraction
mechanisms and patterns.
The prior access control literature does not provide a satisfying account of how the
behavior of such unprivileged programs contributes to the expression of access control policy.
A contribution of Chapter 8 is to distinguish between “permission” and “authority,” to
develop a taxonomy of computable bounds on eventual permission and authority, and to
explain why “partially behavioral bounds on eventual authority”—the “BA” of Table 8.1
(p. 60)—is needed to reason about many simple access abstractions.
2.3 Distributed Access Control
E objects are aggregated into persistent process-like units called vats (Figure 2.3). Inter-vat
messages are conveyed by E’s cryptographic distributed capability protocol, Pluribus, which
6

Figure 2.3 : Distributed Access Control.
ensures that distributed object references are unforgeable and unspoofable.
Chapter 7 presents a simpliﬁed form of Pluribus. None of the access control properties
provided by Pluribus are novel. Protocols like Pluribus transparently extend the reference
graph across machines, while cryptographically enforcing some of the properties of the
object-capability access control model. Section 11.5 explains several aspects of the objectcapability model that cannot be enforced between mutually suspicious machines on open
networks. Our overall system consists of object-capability islands sending messages to each
other over a cryptographic capability sea. A contribution of this section is to introduce a
uniﬁed account of access control in such a mixed system.
E has two forms of invocation. The “ .” in our ﬁrst two diagrams is the conventional
“immediate-call” operator. The “ <-” in Figure 2.3 is the “eventual-send” operator. Their
diﬀerences bring us to concurrency control.
2.4 Distributed Concurrency Control
E’s concurrency control is based on communicating event loops. Each vat has a heap of
objects, a call-return stack, a queue of pending deliveries, and a single thread of control.
An immediate-call pushes a new stack frame, transferring control there. An eventual-send
enqueues a new pending delivery—a pair of a message and the target object to deliver it
to—on the pending delivery queue of the vat hosting the target. A vat’s thread is a loop,
dequeueing the next pending delivery and invoking the target with the message. Each of
these invocations spawns a turn, which runs to completion as a conventional sequential
program, changing vat state and enqueuing new pending deliveries. All user-level code runs
in these turns, including all state access and modiﬁcation.
A key contribution of this dissertation is a system of reference states, transition rules,
and message delivery properties associated with each state, as represented by Figure 2.4
and presented in Part III. This system isolates turns to support deadlock-free consistency
(Chapters 14), reiﬁes delayed outcomes to support dataﬂow patterns (Chapters 16), and
propagates delayed problem reports to support application-level handling of and recovery
from distributed failures (Chapter 17).
7

Figure 2.4 : Distributed Concurrency Control.
A near reference is the form of reference familiar from conventional sequential nondistributed object programming. A near reference is a local reference to a resolved
target. In other words, a near reference starts and ends in the same vat, and it
knows which target object it should deliver messages to. A near reference conveys
both immediate-calls and eventual-sends, providing full authority to invoke its target.
Only near references convey immediate-calls, so objects in one vat may not immediatecall objects in another vat. Thus, each turn implicitly has mutually exclusive access to
all state to which it has synchronous access. No explicit locks are needed or allowed.
A far reference is a vat-crossing reference to a resolved target. So long as its target’s
vat is reachable, a far reference conveys eventual-sends to its target. A far reference
thereby provides only the authority to enqueue pending deliveries in its target’s vat’s
queue, to be delivered to its target in separate isolated turns. An eventual-send is
non-blocking—the sender cannot block its vat’s thread waiting for a response. Thus,
conventional deadlocks cannot occur.
A promise is a reference to the result of an eventual-send, i.e., an eventually-send immediately returns a promise for the result of the turn in which this message will be
delivered. Until this turn occurs, the value of this result remains unresolved, and messages eventually-sent to the promise are buﬀered in the promise. A promise can also be
created explicitly, providing its creator the authority to determine its resolution. The
creator may thereby control the buﬀering and release of messages eventually-sent by
a sender to that promise. Promises are a form of delayed reference, supporting some
of the concurrency control patterns associated with dataﬂow, actors, and concurrent
logic programming.
A broken reference occurs as a result of a problem. If a turn terminates by throwing an
exception, that breaks the promise for the turn’s result. A partial failure—a network
disconnect or crash—will break vat-crossing references. Once a reference is broken, it
stays broken. Inter-vat connectivity can be regained using oﬀ-line capabilities.
An oﬀ-line capability (unshown) provides persistent access to the object it designates—
it allows one to obtain a new reference to this object. One form of oﬀ-line capability, a
URI string, can be transferred over out-of-band media in order to securely bootstrap
initial connectivity.
8

For most purposes, programmers need be concerned about only two cases. When a
reference is statically known to be near, their code may immediate-call it without concern
for partial failure. When they don’t statically know whether a reference is near or not, their
code should eventual-send to it, and cope if a broken reference reports that the message may
not have been delivered. Since near references provide a strict superset of the guarantees
provided by the other reference states, code prepared for the vat-crossing case will be
compatible with the local case without further case analysis. The “ <-” of the eventualsend expression, and the “ ->” of the when-catch syntax explained in Chapter 18, alert
programmers of the locations in their code where interleavings and partial failure concerns
arise.
2.5 Promise Pipelining
Machines grow faster and memories grow larger. But the speed of light is constant and
New York is not getting any closer to Tokyo. As hardware continues to improve, the
latency barrier between distant machines will increasingly dominate the performance of
distributed computation. When distributed computational steps require unnecessary round
trips, compositions of these steps can cause unnecessary cascading sequences of round trips.
Figure 2.5 : Promise Pipelining.
Related prior work shows how, in asymmetric client-server systems, distributed functional composition can use promise pipelining (Figure 2.5) to avoid cascading round trips.
In Chapter 16, we show how to extend this technique to symmetric peer-to-peer systems.
2.6 Delivering Messages in E-ORDER
Various distributed systems provide useful constraints on message delivery orders, reducing
the cases programmers must face. In Chapter 19, we show how FIFO and weaker orders
fail to enforce a needed access control restriction: FIFO allows Bob to access Carol earlier
than Alice expects. By the conventional taxonomy, CAUSAL order is the next stronger
order. If enforced, it would safeguard Alice’s expectations. However, CAUSAL order is
too strong to be enforceable, purely by cryptographic means, between mutually suspicious
machines.
A contribution of Chapter 19 is to present E-ORDER, deﬁned as a further attenuation
of the authority provided by a passed reference. When Alice passes Bob a reference to
9

Figure 2.6 : Delivering Messages in E-ORDER.
Carol, this reference provides Bob only the authority to cause messages to be delivered
to Carol after prior messages already sent by Alice on this reference have been delivered.
E-ORDER is suﬃciently strong to enforce the restriction Alice needs, and suﬃciently weak
to be cryptographically enforceable among mutually suspicious machines.
2.7 Emergent Robustness
Part V takes us on a tour of some applications built on these foundations, demonstrating how
these principles enhance overall robustness. This part explains the synergy that results from
attenuating authority simultaneously at multiple layers of abstraction. Figure 2.7 sketches
a visualization of the attack surface of the system we describe. The ﬁlled-in areas represent
the vulnerabilities produced by the distribution of authority. Each level is an expansion of
part of the level above. By attenuating authority at multiple scales simultaneously, overall
vulnerability resembles the surface area of a fractal that has been recursively hollowed out.
10

Figure 2.7 : Emergent Robustness.
11

12

Part I
The Software Composition
Problem
13
