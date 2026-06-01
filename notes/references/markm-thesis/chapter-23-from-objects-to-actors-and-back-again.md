# Chapter 23 — From Objects to Actors and Back Again


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 183–186.

---

Chapter 23
From Objects to Actors and Back
Again
This chapter presents a brief history of E’s concurrency-control architecture. Here, the term
“we” indicates this dissertation’s author participated in a project involving other people.
Where this pronoun is used, all implied credit should be understood as shared with these
others.
23.1 Objects
The nature of computation provided within a single von Neumann machine is quite diﬀerent than the nature of computation provided by networks of such machines. Distributed
programs must deal with both. To reduce cases, it would seem attractive to create an
abstraction layer that can make these seem more similar. Distributed Shared Memory systems try to make the network seem more like a von Neumann machine. Object-oriented
programming started by trying to make a single computer seem more like a network.
. . . Smalltalk is a recursion on the notion of computer itself. Instead of
dividing “computer stuﬀ” into things each less strong than the whole—like
data structures, procedures, and functions which are the usual paraphernalia
of programming languages—each Smalltalk object is a recursion on the entire
possibilities of the computer. Thus its semantics are a bit like having thousands
and thousands of computers all hooked together by a very fast network.
—Alan Kay [ Kay93]
Smalltalk [ GK76] imported only the aspects of networks that made it easier to program
a single machine—its purpose was not to achieve network transparency. Problems that
could be avoided within a single machine—like inherent asynchrony, large latencies, and
partial failures—were avoided. The sequential subset of E has much in common with the
early Smalltalk: Smalltalk’s object references are like E’s near references and Smalltalk’s
message passing is like E’s immediate-call operator.
165

23.2 Actors
Inspired by the early Smalltalk, Hewitt created the Actors paradigm [ HBS73], whose goals
include full network transparency within all the constraints imposed by decentralization and
(in our terms) mutual defensiveness [ Hew85]. Actors supports this defensiveness explicitly
by use of object-capabilities. The connectivity rules we present in Section 9.2 are essentially
a restatement of Hewitt and Baker’s “locality laws” [ HB78].
Although Hewitt’s stated goals require the handling of partial failure, the actual Actors
model assumes this issue away and instead guarantees that all sent messages are eventually
delivered. The asynchronous-only subset of E is an Actors language: Actors’ references
are like E’s eventual references, and Actors’ message passing is much like E’s eventual-send
operator. Actors provides both dataﬂow postponement of plans by futures (like E’s promises
without pipelining or contagion) and control-ﬂow postponement by continuations (similar
in eﬀect to E’s when-catch).
The price of this uniformity is that all programs had to work in the face of network
problems. There was only one case to solve, but it was the hard case.
23.3 Vulcan
Inspired by Shapiro and Takeuchi [ ST83], the Vulcan project [ KTMB87] merged aspects of
Actors and concurrent logic/constraint programming [ Sha83, Sar93]. The pleasant properties of concurrent logic variables (much like futures or promises) taught us to emphasize
dataﬂow postponement and de-emphasize control-ﬂow postponement.
Vulcan was built on a concurrent logic base, and inherited from it the so-called “merge
problem” [ SM87] absent from pure Actors languages: Clients can only share access to a
stateful object by an explicitly pre-arranged merge networks. These merge networks provide
ordering properties similar to the tree-order subset of E-ORDER, but the object references
they provide were not ﬁrst-class. To address this problem, we created the “Channels”
abstraction [TMK+87], which preserved these ordering properties while providing ﬁrst-class
object references.
23.4 Joule
The Joule language [ TMHK95] is a capability-secure, massively-concurrent, distributed language that is one of the primary precursors to E. Joule merges insights from the Vulcan
project with the remaining virtues of Actors. Joule channels are similar to E’s promises
generalized to provide multicasting. Joule tanks are the unit of separate failure, persistence, migration, and resource management, and inspired E vats. E vats further deﬁne the
unit of sequentiality; E’s event-loop approach achieves much of Joule’s power with a more
familiar and easy to use computational model. Joule’s resource management is based on
abstractions from KeyKOS [ Har85]. E vats do not yet address this issue.
23.5 Promise Pipelining in Udanax Gold
Udanax Gold was a pre-web hypertext system with a rich interaction protocol between
clients and servers. To deal with network latencies, in the 1989 timeframe, we independently
166

reinvented an asymmetric form of promise pipelining as part of our protocol design [ Mil92,
SMTH91]. This was the ﬁrst attempt to adapt Joule channels to an object-based clientserver environment (it did not support peer-to-peer).
23.6 Original-E
The language now known as Original-E was the result of adding the concurrency concepts
from Joule to a sequential, capability-secure subset of Java. This eﬀort to identify such a
subset of Java had much in common with the J-Kernel and Joe-E projects brieﬂy explained
in sections 24.5 and 26.5. Original-E was the ﬁrst to successfully mix sequential immediatecall programming with asynchronous eventual-send programming. Original-E cryptographically secured the Joule-like network extension—something that had been planned for but
not actually realized in prior systems. Electric Communities, Inc. created Original-E,
and used it to build EC Habitats—a graphical, decentralized, secure, social virtual reality
system.
23.7 From Original-E to E
In Original-E, the co-existence of sequential and asynchronous programming was still rough.
E brought the invention of the distinct reference states and the transitions among them
explained in this dissertation. With these rules, E bridges the gap between the network-asmetaphor view of the early Smalltalk and the network-transparency ambitions of Actors. In
E, the local case is strictly easier than the network case, so the guarantees provided by near
references are a strict superset of the guarantees provided by other reference states. When
programming for known-local objects, a programmer can do it the easy way. Otherwise,
the programmer must address the inherent problems of networks. Once the programmer
has done so, the same code will painlessly also handle the local case without requiring any
further case analysis.
167

168
