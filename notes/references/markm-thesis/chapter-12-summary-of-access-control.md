# Chapter 12 — Summary of Access Control


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 109–114.

---

Chapter 12
Summary of Access Control
Just as we should not expect a base programming language to provide us all the data types
we need for computation, we should not expect a base protection system to provide us all
the elements we need to directly express access control policies. Both issues deserve the
same kind of answer: We use the base to build abstractions, extending the vocabulary we
use to express our solutions. In evaluating an access control model, one must examine how
well it supports the extension of its own expressiveness by abstraction and composition.
Security in computational systems emerges from the interaction between primitive protection mechanisms and the behavior of security-enforcing programs. As we have shown,
such programs are able to enforce restrictions on more general, untrusted programs by
building on and abstracting more primitive protection mechanisms. To our knowledge, the
object-capability model is the only protection model whose semantics can be readily expressed in programming language terms: approximately, lambda calculus with local side
eﬀects. This provides the necessary common semantic framework for reasoning about permission and program behavior together. Because security-enforcing programs are often
simple, the required program analysis should frequently prove tractable, provided these
programs are built on eﬀective primitives. 1
By recognizing how program behavior contributes to access control, we establish a semantic basis for extensible protection. Diverse and mutually defensive interests can each
build abstractions to express their plans regarding new object types, new applications, new
requirements, and each other, and these plans can co-exist and compose. This extensibility
is well outside the scope of purely topological access graph analyses.
Analyses based on the potential evolution of access graphs are conservative approximations. A successful veriﬁcation that demonstrates the enforcement of a policy using only
the access graph (as in [ SW00]) is robust, in the sense that it holds without regard to the
behavior of programs. Veriﬁcation failures are not robust—they may indicate a failure in
the protection model, but they can also result from what might be called “failures of excess
conservatism”—failures in which the policy is enforceable but the veriﬁcation model has
been simpliﬁed in a way that prevents successful veriﬁcation.
We have shown by example how object-capability practitioners set tight bounds on
1 Since these words were ﬁrst written, Fred Spiessens, Yves Jaradin, and Peter Van Roy have built the
SCOLL system, explained in Related Work Section 26.4. SCOLL derives partially behavioral bounds on
authority (BA) along the lines we have suggested. SCOLL has indeed found it tractable to reason about the
bounds on authority created by several security-enforcing programs including the caretaker and *-properties
patterns we have presented.
91

authority by building abstractions and reasoning about their behavior, using conceptual
tools similar to those used by object programmers to reason about any abstraction. We
have shown, using only techniques easily implementable in Dennis and van Horn’s 1965
Supervisor [ DH65], how actual object-capability systems have used abstraction to solve
problems that analyses using only protection state have “proven” impossible for capabilities.
The object-capability paradigm, with its pervasive, ﬁne-grained, and extensible support
for the principle of least authority, enables mutually defensive plans to cooperate more
intimately while being less vulnerable to each other.
92

Part III
Concurrency Control
93



Overview of Concurrency Control
Access control by itself cannot explain how to maintain consistency in the face of concurrency. Traditional concurrency control is concerned with consistency, but only under
cooperative assumptions. For defensive consistency, we must take a fresh look. We illustrate many of our points with a simple example, a “statusHolder” object implementing the
listener pattern. We use the listener pattern as an example of coordinating loosely coupled
plans. This part proceeds as follows.
Interleaving Hazards introduces the statusHolder and examines its hazards, ﬁrst, in a
sequential environment. It then presents several attempts at building a conventionally
thread-safe statusHolder in Java and the ways each suﬀers from plan interference.
Two W ays to Postpone Plans shows a statusHolder written in E and explains E’s
eventual-send operator, ﬁrst, in the context of a single thread of control. It then
explains how the statusHolder with this operator handles concurrency and distribution under cooperative conditions.
Protection from Misbehavior examines how the plans coordinated by our statusHolder
are and are not vulnerable to each other.
Promise Pipelining introduces promises for the results of eventually-sent messages,
shows how pipelining helps programs tolerate latency, and how broken promise contagion lets programs handle eventually-thrown exceptions.
Partial F ailure shows how statusHolder’s clients can regain access following a partition
or crash and explains the issues involved in reestablishing distributed consistency.
The When-Catch explains how to turn dataﬂow back into control-ﬂow.
Delivering Messages in E-ORDER explains a message delivery order strong enough
to enforce a useful access control restriction among objects, but weak enough to be
enforceable among the machines hosting these objects.
95

96
