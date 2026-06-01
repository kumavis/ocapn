# Chapter 7 — A Taste of Pluribus


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 67–74.

---

Chapter 7
A Taste of Pluribus
7.1 Pointer Safety
Within a single address space, references are typically implemented as memory addresses.
So-called “dynamic type safety” consists largely of pointer safety, enforced by safe-language
techniques made popular by Java, but going back to lisp 1.5. Safe pointers are unforgeable.
Distributed object protocols [ Don76, HRB+87, Vin97, WR W96, BNOW94, vDABW96,
LS83] stretch the reference graph between address spaces. Can pointer safety be preserved
over the network?
A reference provides a kind of communication channel between objects, conveying messages from client to provider. We can explain the attributes of pointer safety in terms of
security properties often desired of other communication channels: integrity (no tampering),
conﬁdentiality (no spying), unforgeability (authorization), and unspoofability (authentication). Java references have all these attributes; C++ pointers have none.
Integrity The message Alice sent on an Alice-to-Bob reference must be the message Bob
receives. In an object context, we generalize this requirement to include both the data
and the references carried by the message. Both must arrive unaltered.
Conﬁdentiality Only Bob receives the message that Alice sent.
Unforgeability Even if Bob knows Carol’s memory address, Bob cannot synthesize a new
reference to Carol. Without a genuine reference to Carol, Bob cannot deliver messages
to Carol.
Unspoofability Even if Charlie knows Carol’s memory address, he cannot cause Bob’s
reference-to-Carol to deliver messages to him rather than Carol.
This chapter explains how Pluribus, E’s distributed object protocol, enforces pointer
safety among objects residing on mutually defensive platforms. (See [ Don76, TMvR86,
SJR86, vDABW96, Clo04c] for similar systems.) Unsurprisingly, since pointer safety resembles the attributes of so-called “secure socket layer” protocols like SSL and TLS [ DA99],
we build on such a protocol and let it do most of the hard work. Because of diﬀerences
in our authentication requirements, we avoid SSL’s vulnerability to certiﬁcate authorities.
Pluribus relies on the standard cryptographic assumptions that large random numbers are
not feasibly guessable, and that well-accepted algorithms are immune to feasible cryptanalysis. Like SSL, Pluribus does not protect against denial of service or traﬃc analysis.
49

Figure 7.1 : Distributed Introduction. At the distributed-object level of abstraction, Alice
has a remote reference to Bob. At a lower level of abstraction, Alice has a
reference to b1, VatA’s local proxy for Bob. When Alice passes Bob a reference
to Carol
 , she is actually passing b1 a reference to c1, which b1 serializes
into the network message
 . VatB unserializes to obtain its own c2 proxy for
Carol
 , which it includes in the message sent to Bob
 .
We present here a simpliﬁed form of Pluribus which ignores concurrency issues. Pointer
equality places further requirements on unforgeability and unspoofability which we disregard
here, but return to brieﬂy in Section 19.5.
7.2 Distributed Objects
Objects are aggregated into units called vats. Each E object exists in exactly one vat. We
speak of an object being hosted by its vat. A vat typically hosts many objects. A vat is a
platform for the objects it hosts, and so is a central point of failure for them. Similarly, each
vat runs on one machine platform at a time, but a machine may host many vats. A good
ﬁrst approximation is to think of a vat as a process full of objects—an address space full of
objects plus a thread of control. Unlike a typical operating system process, a vat persists
(that is, its state is saved to persistent storage periodically in case its process crashes). A
process running a vat is an incarnation of a vat. The vat maintains its identity and state as
it passes serially through a sequence of incarnations. We revisit persistence in Section 17.4.
To enable objects in separate vats to send messages to each other, we must bridge
from the world of address-space-based programming language technology to the world of
network communication protocols. Our ﬁrst step is conventional: each vat contains a
communication system allowing it to make connections to, and accept connections from,
other vats. Each vat’s communication system contains proxy objects [ Sha86] shown as half
circles in Figure 7.1. When an object in a vat holds a remote reference to an object in a
diﬀerent vat, it actually holds a reference to a local proxy, which is the local representative
of the remote object. When proxy (b1) is sent a local message
 , b1 serializes the message
arguments (c1) into a packet which it sends out as a network message
 . When VatB
receives the network message, it unserializes it into a message local to VatB, initiating a
50

handshake with remote vats ( VatC) as necessary to create the needed proxies (c2)
 . The
unserialized message is ﬁnally delivered to Bob
 .
The description so far applies equally well to many distributed object systems, such
as CORBA [ Vin97] and RMI [ WR W96], that provide pointer safety only among mutually
reliant processes on mutually reliant machines. This is true even when these systems use
SSL as their transport layer. An SSL-like transport helps, but a bit more is needed.
7.3 Distributed Pointer Safety
On creation, each vat generates a public/private key pair. The ﬁngerprint of the vat’s public
key is its vat identity, or VatID. What does the VatID identify? The VatID can only be
said to designate any vat which knows and uses the corresponding private key apparently
according to the protocol.
We care ﬁrst about inductive correctness. Assuming secure references from Alice to
Carol and from Alice to Bob, how does Pluribus deliver to Bob a similarly secure reference
from Bob to Carol? Alice can talk to Carol only because VatA can talk to VatC. If there
are any inter-vat references between objects on VatA and VatC, then there must be exactly
one bidirectional SSL-like data pipe between these vats. All references between this pair of
vats are multiplexed over this pipe. Our initial state implies the existence of an SSL-like
pipe between VatA and VatC and one between VatA and VatB.
When VatC ﬁrst exported across the vat boundary a reference to Carol, VatC generated
an unguessable randomly chosen number to represent Carol. We call this a Swiss number ,
since it has the knowledge-grants-access logic popularly attributed to Swiss bank account
numbers. Like a safe pointer, if you do not know an unguessable secret, you can only come
to know it if someone who knows it and can talk to you chooses to tell it to you. (The
“sparse capabilities” of Amoeba [ TMvR86] are based on this same observation.) When
VatA ﬁrst received this reference, VatA thereby came to know VatC’s VatID, VatC’s search
path, and Carol’s Swiss number. A search path is a list of TCP/IP location hints to seed
the search for a vat that can authenticate against this ﬁngerprint [ Clo04b].
When Alice sends Bob a reference to Carol, VatA tells VatB this same triple: VatC’s
VatID, VatC’s search path, and Carol’s Swiss number. In order to obtain its own remote
reference to Carol, VatB uses the search path to contact candidate VatCs. It asks each
alleged VatC for its public key which it veriﬁes against VatC’s VatID. The handshake logic
proceeds along the lines of SSL: VatC proves her knowledge of the corresponding private
key, then Diﬃe-Hellman key agreement leads to a shared session key for the duration of
the inter-vat connection. 1 Only once an authenticated, secure data pipe is set up between
them does VatB reveal Carol’s Swiss number to VatC. Later, when Bob sends a message to
Carol over this reference, c2 serializes it and sends it to VatC, asking VatC to deliver it to
the object associated with Carol’s Swiss number.
This covers the inductive case, where the security of new online connections leverages
the presumed security of existing online connections. What of the base case?
1 VatB does not delay the delivery of the foo message to Bob until VatC is found. Rather, it ﬁrst makes
c2 as a remote promise for Carol, and proceeds to send the message to Bob with c2 as the argument. Should
a valid VatC be found, this promise will resolve to a far reference. Promises and far references are explained
in Chapter 16.
51

7.4 Bootstrapping Initial Connectivity
A newly launched VatC has no online connections. An (adequately authorized) object on
VatC with access to Carol can ask VatC for a “ captp://...” URI string encoding the same
triple used above: VatC’s VatID, VatC’s search path, and Carol’s Swiss number. It can then
write this string on out-of-band media such as the screen or a ﬁle. This string then needs
to be conveyed securely to some location where an (adequately authorized) object in VatA
can read it, such as Alice.
For example, the human operator of VatC might read the URI from his screen over
the phone to the human operator of VatA, who might type it into a prompt feeding Alice.
Or perhaps the string is sent by PGP email. For initial connectivity, the responsibility
for conveying these strings securely must reside with external agents. Pluribus, like all
cryptographic systems, must bootstrap their secure deployment by conveying cryptographic
information over prior media.
Once Alice has this URI string, she can request a corresponding online reference, setting
in motion the same search and handshake logic explained above. These URI strings are a
form of “oﬄine capability.” Provided that they are conveyed securely, they satisfy all the
pointer safety requirements. Section 17.3 explains how oﬄine capabilities can also be used
to reestablish connectivity following a partition.
7.5 No Central Points of Failure
A reference is an arrow, and an arrow has two ends. There is an imposter problem in each
direction. The VatID ensures that the vat Bob is speaking to is the one hosting the object
Alice meant to introduce him to—making spooﬁng infeasible. The Swiss number ensures
that the entity permitted to speak to Carol is the one Alice chose to enable to do so—
making forging infeasible. Since Bob does not care what name Alice uses for Carol, pointer
safety requires no external naming authorities. By using key-centric designation, we avoid
widely shared namespaces of name-centric systems, and the centralized vulnerabilities they
create [ Ell96, EFL+99, Clo04a, Sti05, Fro03].
Pluribus enforces inter-vat pointer safety so that objects can rely on it between vats
and therefore between machines. Even if VatB is run on a corrupted operating system or
tampered hardware, or if it runs its objects in an unsafe language like C++, Alice could
still view it as a set of colluding objects running on a properly functioning vat. If Betty,
another C++ object in VatB, steals Bob’s reference to Carol, from Alice’s perspective this
is equivalent to Bob colluding with Betty.
A misbehaving vat can misuse any of the remote references given to any of the objects
it hosts, but no more. This is also true of a colluding set of objects running on a correct
vat. If Alice’s programmer wishes to defend against VatB’s possible misbehavior, she can
model VatB as a monolithic composite, and all its externally accessible objects (such as Bob
and Betty) as facets of this composite. Alice’s programmer can, without loss of generality,
reason as if she is suspicious only of objects.
Alternatively, if Alice relies on Bob, then Alice also relies on VatB since Bob relies on
VatB. Anything which relies on Alice therefore also relies on VatA and VatB. Such multi-vat
vulnerability relationships will be many and varied. Pluribus supports mutual defensiveness
between vats, not because we think inter-vat vulnerabilities can always be avoided, but in
order to enable distributed application designers to choose their vulnerabilities.
52

Diﬀerent participants in the reference graph will aggregate it diﬀerently according to
their own subjective ignorance or suspicions, as we have seen, or merely their lack of interest
in making ﬁner distinctions. The reference graph supports the economy of aggregation and
the necessary subjectivity in deciding how to aggregate.
7.6 Notes on Related Work
Programming Languages for Distributed Computing Systems [BST89] is a survey touching on over two hundred distributed programming languages, including many distributed
object languages. One of the earliest of these is also the most closely related: Hewitt’s
Actors, covered in Chapter 23, provides for transparently distributed asynchronous object
computation.
The Actors “worker” is analogous to our “vat,” and provides a communicating eventloop concurrency control model with many of the properties we explain in Part III. The
Actors model provides the object-capability security we explain in Part II. The stated goals
of Actors [ Hew85] would seem to demand that Actors be distributed by a cryptographic protocol with the security properties of Pluribus. However, we are unaware of any distributed
Actors design or implementation that has done so.
The cryptographic distributed capability protocols related to Pluribus include DCCS,
explained in Related Work Section 25.3, Amoeba (Section 25.4), Sansom’s protocol for securely distributing Mach (Section 25.5), DEC SRC’s Secure Network Objects (Section 24.7),
HP’s Client Utility (Section 25.6), The Web Calculus (Section 26.1), and the Twisted
Python Perspective Broker (Section 26.2).
53

54

Part II
Access Control
55
