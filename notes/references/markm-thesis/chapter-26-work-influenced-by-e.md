# Chapter 26 — Work Inﬂuenced by E


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 195–200.

---

Chapter 26
Work Inﬂuenced by E
26.1 The Web-Calculus
The Web-Calculus [ Clo04c] brings to web URLs the following simultaneous properties:
• The cryptographic capability properties of E’s oﬄine capabilities—both authenticating the target and authorizing access to it.
• Promise pipelining of eventually-POSTed requests with results.
• The properties recommended by the REST model of web programming [ Fie00].
REST attributes the success of the web largely to certain loose-coupling properties
of “http://. . . ” URLs, which are well beyond the scope of this dissertation. See
[Fie00, Clo04c] for more.
As a language-neutral protocol compatible and composable with existing web standards,
the Web-Calculus is well-positioned to achieve widespread adoption. We expect to build a
bridge between E’s references and Web-Calculus URLs.
26.2 Twisted Python
Twisted Python is a library and a set of conventions for distributed programming in Python,
based on E’s model of communicating event-loops, promise pipelining, and cryptographic
capability security [ Lef03]. Like Actors, it considers control-ﬂow postponement (like chaining when blocks in E) to be the more fundamental mechanism, and dataﬂow postponement
(by promise pipelining) as secondary. Twisted Python provides a built-in joiner abstraction
similar to the promiseAllFulfilled shown in Figure 18.3 (p. 131).
Twisted provides protection only at the granularity of communicating Python processes.
As with the J-Kernel, because legacy Python code violates capability design rules, this large
protection granularity allows programmers to use legacy code within each process.
26.3 Oz-E
Like Vulcan, the Oz language [ RH04] descends from both Actors and concurrent
logic/constraint programming. From its concurrent logic/constraint ancestry, Oz inherits
177

logic variables which provide dataﬂow postponement much like E’s promises. The primary form of parallelism in Oz is “declarative concurrency”: If a computation uses no
non-declarative primitives like assignment, then it can spawn parallel threads at ﬁne grain,
sharing an address space, without any visible eﬀects of concurrency. By the terminology
used in this dissertation, “declarative concurrency” is therefore not a form of concurrency
at all, but rather a form of parallelism. It provides a convenient way to use parallel hardware to run a computation faster. But since the eﬀects of declarative parallelism are not
observable, such a computation as a whole is still a single unit of operation. So-called
declarative concurrency cannot express the concurrency issues needed to interact with an
ongoing concurrent world.
The other recommended form of parallelism in Oz is “message passing concurrency,”
which is approximately the same as our communicating event-loops. To support imperative
programming within an event-loop, Oz provides Cells, much like E’s Slots or ML’s Refs.
Unfortunately, by providing both shared-memory spawning of threads and mutable Cells,
Oz thereby enables shared-state concurrency, though Oz programming practice discourages
its use.
Oz-E [ SR05b] is a successor to Oz designed to support the object-capability model at
Oz’s object-granularity. Like E, Oz-E is being designed to provide protection within a
process by safe language techniques, and to provide protection among mutually defensive
machines using a cryptographic capability protocol. In order to support defensive consistency, Oz-E will suppress Oz’s shared-state concurrency. To support both declarative
parallelism and message-passing concurrency while suppressing shared-state concurrency,
Oz-E will tag each Cell with its creating thread. Attempting to access a Cell from any
other thread will cause an exception to be thrown. Properly declaratively parallel programs
will not encounter this error since they use no Cells. Proper message-passing concurrent programs will not encounter this error, since all Cells are accessed only from their event-loop’s
thread.
26.4 SCOLL
SCOLL [SMRS04, SR05a] is not a programming language, but rather a description language,
based on Datalog, for statically reasoning about authority relationships in object-capability
systems. In SCOLL, one describes a tractable abstraction of the behavior of various objects,
such as the caretaker or data diodes we have presented in Part II. These abstractions must
be safely conservative: all actions the object might take must fall within the described
behavior, but the described behavior can include possibilities beyond what the object might
actually do. SCOLL then calculates bounds on possible authority, based on a form of Bishop
and Snyder’s take-grant logic for reasoning about “potential de facto information transfer”
[BS79] elaborated to take into account the described limits on object behaviors.
Patterns like our caretaker and data diode have been described in the SCOLL language,
and SCOLL has computed the resulting authority relationships. The caretaker was particularly challenging for two reasons: 1) The disable() action causes a non-monotonic
decrease in authority, whereas the take-grant framework naturally reasons only about the
limits of monotonically increasing authority. 2) Unlike the membrane, the extent of authority revoked by the caretaker depends in subtle ways on Carol’s behavior. If Carol returns
Dave to Bob, then after Alice revokes Bob’s access to Carol, Bob might still have access to
178

Dave, and thereby might still have all the authority such access implies.
We hope to see SCOLL grow into a static safety checker that can be incorporated into
future object-capability languages, much as static type checkers are incorporated into many
languages today. Type declarations are also conservative abstractions of actual behavior.
Both kinds of static description provide programmers a useful design language prior to
writing the program itself. Both kinds of static checkers ensure that certain problems—
message-not-understood errors and excess authority errors, respectively—do not happen at
runtime. The price of static checking is that some programs that are actually safe will be
rejected, leading to a loss of expressive power. Whether this price is worth paying depends
on the importance of preventing these errors. Message-not-understood errors not caught
until runtime would still fail safe. Without some separate description of intended limits
of authority, like SCOLL, excess authority errors are not detectable either statically or at
runtime. Should they occur, they would not fail safe. The case for static authority checking
would seem to be much stronger than the case for static type checking.
26.5 Joe-E
The Joe-E language [ MW06] is a subset of the Java language which forms an objectgranularity object-capability language. Of the features removed from Java to make Joe-E,
like mutable static state, most were removed with no interesting loss of expressive power.
For example, if a class would have had static state, one can write an inner class instead,
in which this state is part of its creating object. Beyond prohibiting violations of objectcapability rules, Joe-E also prohibits elements of Java that egregiously endanger capability
discipline, like shared-state concurrency. Joe-E is currently a purely sequential language,
though it would be straightforward to add a library supporting communicating event-loops.
Unlike the J-Kernel (Section 24.5), Joe-E does not seek compatibility with existing
legacy Java code. It is not imagined that much existing Java code happens to fall within the
Joe-E subset. Rather, Joe-E subsets Java in order to be compatible with legacy Java tools:
integrated development environments, debuggers, proﬁlers, refactoring browsers, compilers,
virtual machines, etc. The Joe-E loader enforces the Joe-E restrictions merely by testing
and refusing to load any Java code that falls outside the Joe-E subset. Any Java code that
passes these tests is also Joe-E code, and is loaded as is. Because the Joe-E loader does no
transformation on the code it accepts, any Joe-E program is a Java program with the same
meaning. All existing Java tools apply to this code without modiﬁcation.
The ﬁrst attempt at a Joe-E loader, by Chip Morningstar, worked by subclassing Java’s
ClassLoader and applying further tests to classﬁles. The Joe-E veriﬁcation rules were
thereby added to the JVM bytecode veriﬁcation rules. Had this worked, we would have
said that Joe-E deﬁnes a subset of the JVM rather than a subset of Java. The Java
language has stricter rules than the JVM. Java compilers must prohibit many cases that
JVM bytecode veriﬁers do not. The Joe-E architects, Adrian Mettler and David Wagner,
realized that many of these cases must also be prohibited by Joe-E. Therefore, Joe-E code
is submitted as Java source, not bytecode, and the Joe-E veriﬁer builds on a Java compiler.
Joe-E does not provide a user-extensible auditing framework. Rather, the Joe-E library
provides a few interface types which trigger auditing checks built into the Joe-E veriﬁer. For
example, the Joe-E Incapable type (meaning “without capabilities”) is much like E’s Data
guard/auditor. If a Joe-E class declares that it implements Incapable, the Joe-E loader
179

statically veriﬁes that all its instance variables are final and can hold only Incapables.
All Incapables are therefore transitively immutable.
The most novel aspect of the Joe-E project is the abstraction of authority the authors
use to reason about security. In this dissertation, we deﬁne authority as the ability to
overtly cause eﬀects. Unfortunately, causation is surprisingly tricky to reason about. Let
us say Alice builds a caretaker that will only pass messages that contain a secret number
Bob does not know and cannot guess. In this situation, Bob does not have authority to
access Carol. But if Bob’s interaction with Dave gives Bob enough knowledge that he can
feasibly guess the number, then Dave has granted Bob authority to access Carol.
The Joe-E programmer reasons about authority more simply, using the conservative
assumption that anyone might already know anything—as if secrets were not possible.
Therefore, in the initial conditions above, a Joe-E programmer would assume Bob already
has this authority, since he might already know this number. Data gained from Dave cannot
give Bob any authority beyond what we assume he already has. Curiously, this abstraction
prevents reasoning about conﬁdentiality or cryptography.
The Joe-E veriﬁer also runs as an Eclipse plugin, marking Java code that violates JoeE’s additional rules. When hovering over these markups, an explanation of the violation
pops up, helping people learn incrementally what object-capability programming is about.
26.6 Emily
The Emily language [ Sti06] is an object-capability subset of OCaml. As with the W7 and
Joe-E eﬀorts, Emily diﬀers from OCaml mainly by removing static sources of authority.
Emily modules cannot import system modules that magically provide I/O calls, and Emily
modules cannot deﬁne top level variables that hold mutable state. Beyond that, the Emily
eﬀort is in a very early and ﬂuid stage, so it may be premature to go into much detail.
A discovery from the Emily exercise is the tension between object-capability programming and purely static type checking. For example, it seems impossible to translate the
membrane of Figure 9.3 (p. 71) or the meta-interpretive loader of Figure 10.1 (p. 76) into
OCaml or Emily. Although Java is mostly-statically typed, Java does not suﬀer from the
same loss of expressive power. Java programs use so-called “reﬂection” to mix static typing
and dynamic typing as needed. (Joe-E does not yet oﬀer a form of reﬂection, but there is
no reason in principle why this should be diﬃcult.)
26.7 Subjects
Christian Scheideler’s Towards a Paradigm for Robust Distributed Algorithms and Data
Structures [Sch06] extends an E-like framework with explicit resource controls, to support
the creation of highly decentralized applications that are robust against even distributed
denial of service attacks. In this framework, a highly available service is represented by
the equivalent of a routing proxy on an intermediate vat, whose clients know its stationary
network location. It forwards messages to any one of a number of dynamically replicating
service-providing vats, which accept traﬃc only from their proxies. When Alice composes
Bob and Carol, Alice also decides how much bandwidth capacity she grants to Bob to communicate with Carol. When bandwidth is scarce, Carol’s proxy will throttle any bandwidth
usage by Bob exceeding his allotment.
180

26.8 Tweak Islands
Tweak is a derivative of Squeak (an open-source Smalltalk) designed to better support enduser programming by direct manipulation. Croquet uses Tweak to provide user-extensibility
of Croquet objects. The distributed concurrency ideas in Tweak Islands [ SRRK05] mix
ideas from E and TeaTime [ Ree05]. An Island is a vat-like aggregate of objects, where
computation within an Island services a queue of pending deliveries sequentially and deterministically. Immediate calls happen only between objects within the same Island. Only
FarRefs and promises can span between Islands. Promise pipelining and broken promise
contagion are in development, but not yet available.
The unary “ future” message is used like the E eventual send operator, “ <-”, and means
approximately the same thing: this message should be delivered at some future event in
the recipient’s event sequence. Unlike E, Islands also provides a parameterized form of this
operator, e.g., “ future: 100 ”, where the numeric argument says when, in the Island’s
future virtual time, this message should be delivered. Messages sent later can be delivered
before messages sent earlier, simply by specifying an earlier delivery time. The pending
delivery queue is therefore a priority queue sorted by requested delivery time. This notion
of virtual time is provided in support of soft real time deadline scheduling, in order to
maintain interactive responsiveness.
The only source of non-determinism is deciding on queue order. This corresponds to
Actors’ “arrival order non-determinism.” Once queue order is decided, all computation
within an Island proceeds deterministically from there. The most interesting aspect of
Islands is that they use this determinism for fault-tolerant replication of an Island. Among
all replicas of an Island, at any moment there is a master which resolves arrival-order races
to decide on queue order. This master tells all replica Islands this queue order, so they can
all locally compute the same future Island states and outgoing messages.
181

182
