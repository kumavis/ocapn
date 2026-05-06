# Chapter 1 — Introduction


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 19–22.

---

Chapter 1
Introduction
When separately written programs are composed so that they may cooperate, they may instead destructively interfere in unanticipated ways. These hazards limit the scale and functionality of the software systems we can successfully compose. This dissertation presents
a framework—a computational model and a set of design rules—for enabling those interactions between components needed for the cooperation we intend, while minimizing the
hazards of destructive interference.
Most of the progress to date on the composition problem has been made in the context
of sequential, single-machine programming among benign components. Within this limited
context, object programming supports composition well. This dissertation explains and
builds on this success, showing how to extend the object paradigm to support robust composition of concurrent and potentially malicious components distributed over potentially
malicious machines. We present E, a distributed, persistent, secure programming language,
and CapDesk, a virus-safe desktop built in E, as embodiments of the techniques we explain.
As Alan Kay has suggested [ Kay98], our explanation of the power of object programming
will focus not on the objects themselves, but on the reference graph that connects them. In
the object model of computation, an object can aﬀect the world outside itself only by sending
messages to objects it holds references to. 1 The references that an object may come to hold
thereby limit what eﬀects it may cause. Our extensions to the object paradigm leverage
this observation. References become the sole conveyers of (overt) inter-object causality,
yielding the object-capability model of access control (Chapter 9), able to support certain
patterns of composition among potentially malicious objects. We extend the reference graph
cryptographically between potentially mutually malicious machines, yielding a distributed
cryptographic capability system (Chapter 7).
A particularly vexing set of problems in distributed systems are the issues of partial
failure (spontaneous disconnection and crashes). The most novel contribution of this dis1 To explain call-return control ﬂow purely in terms of sending messages, we often speak as if all programs
are transformed to continuation-passing style before execution. This explains a call as a send carrying a
(normally hidden) extra continuation argument reifying the “rest of the computation” to happen after this
call returns. This corresponds approximately to the implementation concept of pushing a return address on
the stack. The callee’s returning is explained as sending the returned value to this continuation. This is
discussed further in Section 18.2.
Those familiar with ML or Algol68 may ﬁnd our use of the term “reference” confusing. By “reference” we
mean “object reference” or “protected pointer,” i.e., the arrows that one draws when diagramming a data
structure to show which objects “point at” which other objects. Our “references” have nothing to do with
enabling mutability.
1

sertation is the deﬁnition of a state transition semantics for distributed references that
supports deferred communication, failure notiﬁcation, and reconnection while preserving
useful limits on causal transmission. We deﬁne a set of reference states, i.e., states that
a reference may be in, and a set of associated transition rules, where the causal transmission properties provided by a reference depend on its state (Chapter 17). The resulting
access-control and concurrency-control discipline helps us cope with the following pressing
problems:
• Excessive authority which invites abuse (such as viruses and spyware),
• Inconsistency caused by interleaving (concurrency),
• Deadlock (though other forms of lost progress hazards remain),
• Inter-machine latency, and
• Partial failure (disconnects and crashes).
Some prior means of addressing these problems are similar to those presented in this
dissertation. However, these prior solutions have not been composed successfully into a
framework for simultaneously addressing these problems. Our comparative success at realizing an integrated solution is due to two observations:
1. Both access control and concurrency control are about enabling the causality needed
for the inter-object cooperation we intend, while seeking to prevent those interactions
which might cause destructive interference. In access control, we seek to distribute
those access rights needed for the job at hand, while limiting the distribution of access
rights that would enable mischief. In concurrency control, we seek to enable those
interleavings needed for continued progress, while preventing those interleavings that
would cause inconsistency.
2. References are already the natural means for enabling inter-object causality, so a
natural and powerful means of limiting inter-object causality is to restrict the causal
transmission properties provided by references.
We show how the consistent application of these principles, simultaneously, at multiple
scales of composition, results in a multiplicative reduction in overall systemic vulnerability
to plan interference.
1.1 Organization of this Dissertation
Part I explains the Software Composition Problem , and how object programming already
helps address it under local, sequential, and benign conditions. We introduce those compositional forms of component robustness needed to extend the object paradigm beyond
these limits. We introduce a subset of the E language, and a simpliﬁed form of Pluribus,
E’s distributed object protocol. The rest of the dissertation uses E examples to illustrate
how to achieve some of these forms of robustness.
Part II, Access Control, explores the consequences of limiting inter-object (overt) causality to occur solely by means of messages sent on references. By explaining the role of access
2

abstractions, we demonstrate that the resulting access control model is more expressive
than much of the prior literature would suggest. In this part, we extend our attention to
potentially malicious components, though still in a sequential and local context.
Part III, Concurrency Control, extends our ambitions to distributed systems. Separate
machines proceed concurrently, interact across barriers of large latencies and partial failure,
and encounter each other’s misbehavior. Each of these successive problems motivates a
further elaboration of our reference states and transition rules, until we have the complete
picture, shown in Figure 17.1 (p. 124).
The above parts provide a micro analysis of compositional robustness, in which small
code examples illustrate the interaction of individual objects, references, and messages. By
themselves they demonstrate only increased robustness “in the small.”
Part IV, Emergent Robustness , takes us on a macro tour through CapDesk, a proof
of concept system built in E. It explains how the potential damage caused by bugs or
malice are often kept from propagating along the reference graph. By examining patterns
of susceptibility to plan interference across diﬀerent scales of composition, we come to
understand the degree of robustness practically achievable “in the large,” as well as the
remaining limits to this robustness.
Part V discusses Related Work, including how these reference-state rules bridge the gap
between the network-as-metaphor view of the early Smalltalk and the network-transparency
ambitions of Actors. In addition, many chapters end with notes on related work speciﬁc to
that chapter.
3

4
