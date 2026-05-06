# Chapter 27 — Conclusions and Future Work


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 201–204.

---

Chapter 27
Conclusions and Future Work
The dynamic reference graph is the fabric of object computation. Objects interact by
sending messages on references. Messages carry argument references, composing recipients
with arguments, enabling them to interact. An object composes other objects so that their
interactions will serve its purposes. Whether through accident or malice, their interaction
may cause damage instead. To compose robust systems, we must enable desired behavior
while minimizing damage from misbehavior, so we design patterns of defensive consistency
and dynamic least authority.
By restricting objects to interact only by sending messages on references, the reference
graph becomes an access graph supporting ﬁne-grained dynamic least authority. By stretching the graph cryptographically between machines, the reference graph provides decentralized access control with no central points of failure. By controlling when references deliver
messages, the reference graph forms communicating event-loops, supporting defensive consistency without deadlocks. By allowing remote references to visibly break, event-loops can
be distributed and handle disconnects and crashes.
Most viruses abuse authority that they need not have been given in the ﬁrst place. By
following these principles simultaneously at multiple scales of composition, from human
organizations down to individual objects, we painlessly provide components the authority
they need to use while limiting the authority available for abuse. Systems constructed by
these principles would be mostly immune to viruses and other malware.
27.1 Contributions
This dissertation makes seven primary contributions:
• The object-capability model , a new model of secure computation that is abstract
enough to describe both prior object-capability languages and operating systems, and
concrete enough to describe authority-manipulating behavior.
• A novel approach to concurrency control in terms of attenuating authority, including
a uniﬁed architecture in which both access control and concurrency control concerns
may be addressed together.
• A clearly framed distinction between “permission” and “authority.” We develop a
taxonomy of computable bounds on eventual permission and authority, enabling us
183

to reason about many simple access abstractions. Using this framework, we provide
a uniﬁed account of access control and authority in distributed systems consisting of
object-capability islands sending messages to each other over a cryptographic capability sea.
• A system of reference states, transition rules, and message delivery properties associated with each state, that reify partial failures in a manner that permits robust
application-level recovery. In E, these are coupled to language constructs that enable
programmers to anticipate and handle distributed plan failures at the syntactic locus
where a dependency on remote behavior is introduced. These same syntactic constructs alert the programmer of the loci where interleavings of execution may occur.
• A generalization of prior work on promise pipelining from asymmetric client-server
systems to symmetric peer-to-peer systems. Promises enable explicit expression of
dataﬂow in distributed computation. Promise pipelining enables this computational
structure to be exploited without cascading round trips.
• An adaptation of non-signaling errors to the propagation of broken references, allowing
programmers to consistently defer handling of reference failure when direct defense is
inappropriate, and to compose chains of data-dependent computation whose reference
failure propagation has a sensible semantics. By providing a coherent error reporting
behavior for promise pipelines, this mechanism provides a manageable foundation for
recovery from delayed errors in distributed dataﬂow computations.
• Finally, we introduce E-ORDER, a message delivery ordering constraint that achieves
an enforceable middle ground between CAUSAL and FIFO message orderings. The
resulting ordering is strong enough to prevent adversaries from exploiting race conditions to obtain inappropriate access, but weak enough to be enforceable. We show
how the delivery ordering may be deﬁned in terms of an attenuation of the authority
provided by passed references. This allows us to reason about the eﬀects of messaging
within our uniﬁed model of concurrency and access control.
Several programming systems described in Chapter 26 have adopted (in varying subsets)
each of the contributions noted above by borrowing elements from the E system. Twisted
Python, in particular, is reported to be in use in more than 50 real-world applications at
the time of this writing.
27.2 Future Work
The work presented here suggests several directions for future work. One intriguing challenge is to determine how one might combine the high availability supported by group
membership systems [ BJ87, Ami95] with the support for mutual suspicion and scalability
provided by the E model. The two models take very diﬀerent approaches to security and
robustness, but are potentially complementary.
The auditor framework sketched in Section 6.3 provides a user-extensible system for
code veriﬁcation, wherein diﬀerent auditors can check and certify that a provider’s code
conforms to user-speciﬁed safety properties, without disclosing the code of the provider to
the party checking the certiﬁcation. It is an open research question to determine how this
184

mechanism is most eﬀectively applied, and to explore the limits of the properties that it is
able to check.
Spiessens et al. ’s SCOLL framework for static expression of authority constraints, and
static checking of program behaviors against these constraints [ SMRS04, SR05a], might
usefully be integrated into E, perhaps in a fashion analogous to the integration of type
declarations and checking in languages today. If SCOLL’s logic can be expressed within
E’s auditing framework, this would allow user-level experimentation, extension, and coexistence of such checking frameworks outside the language deﬁnition.
27.3 Continuing Eﬀorts
Any dissertation necessarily reﬂects the state of an ongoing project at a particular point
in time. There is a vibrant community that has been building on and extending the E
language and its runtime system. Interested readers may wish to explore the E web site,
which can be found at www.erights.org.
185

186
