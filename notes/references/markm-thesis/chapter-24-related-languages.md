# Chapter 24 — Related Languages


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 187–190.

---

Chapter 24
Related Languages
24.1 Gedanken
James Morris’ 1973 paper, Protection in Programming Languages [Mor73a], presents
Reynolds’ Gedanken language [ Rey70] as (in our terms) an object-capability language.
Gedanken is a dynamically-typed Algol-60 derivative with ﬁrst-class lexical closures. Morris
explains the correspondence of Gedanken’s concepts with those of Dennis and van Horn’s
Supervisor [ DH65]. Curiously, Dennis and van Horn credit some elements of the Burroughs
B5000 architecture as having inspired the capability concept. The B5000 was a languagedirected architecture, designed to run Algol-60. Algol-60 is closely tied to the lambda
calculus, and Gedanken even more so.
As far as we are aware, Morris’ paper is the ﬁrst to propose the two rights ampliﬁcations
abstractions used by E: The trademarking explained in Section 6.3, and sealer-unsealer
pairs [MMF00, Sti04]. Morris’ Types Are Not Sets [Mor73b] explains the rationale for using
trademarks as types in programming languages. Trademarking provides security properties
similar to public key signatures. Sealer-unsealer pairs provide security properties similar
to public key encryption [ MBTL87]. Public key cryptography had not yet been publicly
invented.
Actors derives partly from Morris’ work on Gedanken.
24.2 Erlang
Joe Armstrong’s Making Reliable Distributed Systems in the Presence of Software Errors
[Arm03] explains the design and rationale for the Erlang language. Erlang has many similarities with E. Erlang is a dynamically type safe distributed language, inspired by Actors,
and based on communicating asynchronous messages between encapsulated processes. It
was designed for writing systems that remain reliable despite software errors. Erlang has
been in commercial use at Ericsson as the basis for their highly reliable (ﬁve nines) telephone
switching products. This represents an empirical demonstration of robustness well beyond
anything we have accomplished. One particular notable accomplishment of Erlang—well
beyond anything in E but needed for E to achieve its goals—is Erlang’s support for robustly
upgrading code in a running system.
Although Erlang was inspired by Actors, a common programming pattern in Erlang is
for a process to block waiting for a reply to a previous request. While blocked, the process
169

is not responsive to other requests. This is like the “message-oriented systems” of Lauer
and Needham [ LN79] rather than the non-blocking event loops of E.
Although Erlang is not engineered to provide robustness against malice, it seems to be
an object-capability language. Erlang processes are encapsulated objects and processIds
are unforgeable capabilities, providing the right to send messages to a process. The rules by
which processIds are transmitted and acquired seem to be precisely object-capability rules.
Most importantly, the language has no global scope. Each process has its own separate
state.
Unfortunately, a process has only one processId, so the common convention is for making
a request and receiving a reply is for the client to include its own processId in the message
as a reply port. This gives the provider the authority, not only to reply to the client, but
to invoke the client. It is not clear how to repair this convention within the overall Erlang
framework.
24.3 Argus
Liskov and Scheiﬂer’s Argus system [ LS83] is a distributed programming language, based on
Liskov’s earlier abstract data type language, CLU [ LSA77], for writing reliable distributed
programs. For purposes of this summary, we will ignore distinctions between abstract data
types and objects.
The main new ideas Argus brings to CLU are “guardians” and “actions.” Like E’s vat,
Argus objects are aggregated into guardians. Each guardian runs on one machine at a time.
Again like E’s vats, guardians persist, so the long lived state of a distributed Argus system
is the committed states of its guardians. Like E’s turns, computational steps are aggregated
into actions. Each action is an atomic transaction, and computation as a whole is equivalent
to a serializable sequence of actions. When one object invokes another, it can do so within
the same action (like E’s immediate call), or it can cause the recipient to be invoked in
a new action (like E’s eventual send). Like E’s persistence, the only states committed to
stable storage are states between actions.
Unlike E’s turns, Argus actions could, and generally did, span guardians. The Argus
infrastructure therefore primitively provided distributed atomic transactions, implemented
by a two-phase commit protocol. This provides expressiveness and ﬂexibility well beyond
that provided by E’s vat-local turn mechanism: Coordinated state changes of distributed
state could be expressed, and would either be committed as a whole or aborted as a whole.
However, distributed atomicity necessarily comes at a price: If the network partitions during
the protocol’s window of vulnerability, some guardians could be unable to determine whether
an action committed or aborted until the partition healed. Any local state aﬀected by such
an action would be inaccessible during this period, and any other action that touches
this state would get stuck as well. By contrast, since E provides only vat-local atomicity,
distributed E applications remain non-blocking and responsive during partitions.
The Argus protocol design assumes mutually reliant machines. To extend an Argus-like
system between mutually defensive machines would require a distributed atomic committment protocol resistent to malicious participants.
170

24.4 W7
The Scheme Language [ KCR98], by virtue of its Actors ancestry, its close ties to the lambda
calculus, and its minimalism, already comes very close to being an object-capability language. Jonathan Rees’ thesis, A Security Kernel Based on the Lambda-Calculus [Ree96],
explains well the rationale for the object-capability model of protection, and how closely it
already corresponds to Scheme’s computational model. Rees then explains W7, his Scheme
derivative, which is a full object-capability language. The diﬀerences between Scheme and
W7 are chieﬂy 1) eliminating global namespaces, 2) eliminating forms of eval which violate loader isolation, such as Scheme’s one argument load function, and 3) adding Morris’
trademarking and sealer-unsealer pairs.
24.5 J-Kernel
The Java language, by virtue of its memory safety, strong encapsulation, and load-time
veriﬁcation, is tantalizingly close to being an object-capability language. Unfortunately,
Java provides objects with two forms of statically accessible authority: authority to aﬀect
the outside world (e.g., by static native methods that do I/O) and authority to aﬀect other
objects (e.g., by assigning to static variables or by mutating statically accessible objects).
Original-E (Section 23.6) and Joe-E (Section 26.5) attempt to turn Java into an objectgranularity realization of the object-capability model, where the “object” of the objectcapability model corresponds one-to-one with the “object” of the programming language.
They forbid statically accessible authority, including mutable static state.
The J-Kernel [ vECC+99] demonstrates another way to reconcile Java with the objectcapability model. The J-Kernel’s designers explicitly reject the goal of providing objectgranularity protection. Rather, because they wish to bundle resource controls with capability protections, their protection model starts with a unit they call a “domain,” which
is similar in many ways to E’s vat. By the J-Kernel’s architecture, the “object” of the
object-capability model corresponds, not to a Java object, but to a J-Kernel domain. A
domain consists of a ClassLoader, all the classes loaded by that ClassLoader, and all the
instances of those classes. Like E’s vat, computation within a domain proceeds within
threads local to that domain. Like E’s BootCommSystem, explained brieﬂy in Section 14.3,
communication between domains proceeds by sending messages over a distributed object
protocol customized to take advantage of the shared address space. The J-Kernel adapted
RMI [ WR W96], Java’s distributed object protocol.
They consider only inter-domain references to be capabilities. Although the rules governing objects, references, and messages within a domain so closely resemble the rules of
an object-capability system, they explicitly argue against making use of this fact. Legacy
Java code violates object-capability design rules, so this stance allows J-Kernel domains to
use some of this legacy code.
In Java itself, two classes that import java.lang.System could communicate by assigning to and reading System’s static in, out, and err variables. To provide approximately the
loader isolation we explain in Section 10.3, the J-Kernel ClassLoader subclassed the Java
ClassLoader class in order to prevent importation of dangerous system classes by magic
name. With this hole closed, the “object creation” of the object-capability model corresponds properly to creating a new J-Kernel ClassLoader endowed with an import resolution
table.
171

Unfortunately, this ClassLoader ﬂexibility conﬂicted with Java’s own security architecture. Starting with Java 1.2, ClassLoaders can no longer override the importing of system
classes. The J-Kernel no longer runs. Short of inspecting and/or modifying classﬁles prior
to loading them, it seems it cannot be ﬁxed.
24.6 Emerald
The Emerald programming language [ HRB+87] is a transparently distributed object language with many similarities to E. In Emerald, object references are capabilities. Emerald’s
predecessor, Eden, was also an object-capability language. Experience with Eden identiﬁed the inadequacy of permission bits as a technique for distinguishing diﬀerent authorities
to the same object [ Bla85], and identiﬁed the need to support ﬁrst-class facets. Like E,
Emerald objects are instantiated by nested lambda instantiation, rather than classes or
prototypes.
As far as we have been able to determine, Emerald’s distributed object protocol assumes mutually reliant hardware, forming in our terms a single logical shared platform that
is physically distributed. Emerald provides a call-by-move argument passing mode, which
would seem problematic even under this mutual reliance assumption: If the network partitions during the protocol’s inescapable window of vulnerability, during the partition, the
object being moved would either exist on both sides, on neither side, or be indeterminate
on at least one side.
24.7 Secure Network Objects
Emerald inspired the Network Objects work [BNOW94], done at Digital Equipment Corporation’s System Research Center, providing mostly transparent distribution for Modula-3
objects. Like Emerald, Network Objects preserved pointer safety only between mutually
reliant machines. However, it led to the system described in Secure Network Objects system
[vDABW96], which provided distributed pointer safety between mutually defensive machines, using cryptographic techniques much like Pluribus. Even though Secure Network
Objects paid a complexity price for working around the export controls of the time, the
system is still quite simple, well crafted, and clearly explained.
172
