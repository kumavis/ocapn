# Chapter 25 — Other Related Work


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 191–194.

---

Chapter 25
Other Related Work
25.1 Group Membership
There is an extensive body of work on group membership systems [ BJ87, Ami95] and
(broadly speaking) similar systems such as Paxos [ Lam98]. These systems provide a diﬀerent
form of general-purpose framework for dealing with partial failure: they support closer
approximations of common knowledge than does E, but at the price of weaker support for
defensive consistency and scalability. These frameworks better support the tightly-coupled
composition of separate plan-strands into a virtual single overall plan. E’s mechanisms
better support the loosely-coupled composition of networks of independent but cooperative
plans.
For example, when a set of distributed components forms an application that provides a
single logical service to all their collective clients, and when multiple separated components
may each change state while out of contact with the others, we have a partition-aware
application [OBDMS98, SM03], providing a form of fault-tolerant replication. The clients
of such an application see a close approximation of a single stateful object that is highly
available under partition. Some mechanisms like group membership shine at supporting
this model under mutually reliant and even Byzantine fault conditions [ CL02].
E itself provides nothing comparable. The patterns of fault-tolerant replication we have
built to date are all forms of primary-copy replication, with a single stationary authoritative
host. E supports these patterns quite well, and they compose well with simple E objects
that are unaware they are interacting with a replica. An area of future research is to see how
well partition-aware applications can be programmed in E and how well they can compose
with others.
25.2 Croquet and TeaTime
The Croquet project [ Ree05] has many of the same goals as the EC Habitats project mentioned in Section 23.6: to create a graphical, decentralized, secure, user-extensible, social
virtual reality system spread across mutually defensive machines. Regarding E, the salient
diﬀerences are that Croquet is built on Smalltalk extended onto the network by TeaTime,
which is based on Namos [ Ree78] and Paxos [ Lam98], in order to replicate state among
multiple mutually reliant machines. Neither EC Habitats nor Croquet have yet achieved
secure user-extensible behavior. At Electric Communities, we withheld user-extensibility
173

until we could support it securely; the company failed before then. As of this writing,
Croquet is insecurely user-extensible. It will be interesting to see how they alter Paxos to
work between mutually defensive machines.
As of this writing, Croquet is using the “Simpliﬁed TeaTime” of the Hedgehog architecture [ SRRK05], perhaps as an interim measure. Hedgehog is based on Tweak Islands,
which we cover brieﬂy in Related Work Section 26.8.
25.3 DCCS
Jed Donnelley’s “DCCS” [ Don76] is the ﬁrst to realize and explain how the capability model
may be cryptographically stretched between mutually defensive machines in a decentralized manner, why this preserves many of the useful properties of single-machine capability
operating systems, and why the network service that accomplishes this needs no special
privileges. Although E and Pluribus were both engineered so that Pluribus could likewise
be implemented by unprivileged E code, this has not yet happened.
Because of DCCS’s early date—preceding the publication of public key cryptography—
its use of cryptography was somewhat crude by modern standards. Donnelley’s later work
[Don79] repairs these problems, and is in some ways arguably more secure than Pluribus.
As explained in Section 11.5, the security properties enforceable within a single machine (or
mutually reliant machines) are stronger than the security properties enforceable between
mutually defensive machines by cryptographic means. Like E, Donnelley’s “DCCS” was a
distributed capability system capable of these stronger properties within each machine.
25.4 Amoeba
The “sparse capabilities” of the inﬂuential Amoeba distributed operating system [ TMvR86]
used unguessable numbers to represent capabilities both between machines and within each
machine. This limits the properties enforceable within each machine to those properties
that are enforceable between mutually defensive machines.
25.5 Secure Distributed Mach
Mach is an object-capability operating system based on ports with separate send and receive
rights. Sansom’s Extending a Capability Based System into a Network Environment [SJR86]
presents a cryptographic capability protocol for transparently stretching Mach’s ports over
the network. This work reiterates Donnelley’s observation that the network-handling code
needs no special privilege.
25.6 Client Utility
The Client Utility [ KGRB01, KK02] was based on “split capabilities” [ KGRB03]. Split
capabilities have interesting similarities and diﬀerences from object-capabilities, which are
well beyond the scope of this summary. The Client Utility resembles a distributed operating system more than a distributed programming language: its “objects,” or clients
were processes that could be expressed in any language. However, it ran portably on top
of other operating systems, with the possibility of intercepting system calls when run on
174

host operating systems where this was possible. Clients invoked each other’s services by
asynchronous messages. These messages would pass through the Client Utility “core,” another process serving as the shared platform for a group of clients on the same machine.
From a distribution and a security perspective, a core and its set of clients, called a ”logical
machine”, is analogous to an E vat and the set of objects it hosts.
Like many distributed capability systems, starting with DCCS and including E, the
Client Utility’s semantics and security were transparently stretched over the network by
proxies, which were further unprivileged domains, running in each logical machine, forwarding requests over the network to unprivileged clients providing network services to
their logical machine.
In recent years, E has learned much from the Client Utility architecture. In particular,
E’s three-vat introduction protocol, which enforces the E-ORDER explained in Chapter 19,
is an adaptation of the proposed (but unimplemented) Client Utility introduction protocol.
175

176
