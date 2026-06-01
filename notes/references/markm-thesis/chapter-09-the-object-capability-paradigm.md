# Chapter 9 — The Object-Capability Paradigm


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 81–92.

---

Chapter 9
The Object-Capability Paradigm
Matter tells space how to curve.
Space tells matter how to move.
—John Archibald Wheeler
In the object model of computation [ GK76, HBS73], there is no distinction between
subjects and objects. A non-primitive object, or instance, is a combination of code and
state, where state is a mutable collection of references to objects. The computational
system is the dynamic reference graph of objects. Objects—behaving according to their
code—interact by sending messages on references. Messages carry references as arguments,
thereby changing the connectivity of the reference graph.
The object-capability model uses the reference graph as the access graph, requiring that
objects can interact only by sending messages on references. To get from objects to objectcapabilities we need merely prohibit certain primitive abilities which are not part of the
object model anyway, but which the object model by itself doesn’t require us to prohibit—
such as forged pointers, direct access to another’s private state, and mutable static state
[KM88, Ree96, MMF00]. For example, C++ [ ES90], with its ability to cast integers into
pointers, is still within the object model but not the object-capability model. Smalltalk and
Java fall outside the object-capability model because their mutable static variables enable
objects to interact outside the reference graph.
Such mutable static state can be modeled as instance state, and thereby explained in
terms of the model presented in this chapter. In Chapter 10 we introduce an additional criterion, loader isolation, and explain how Java violates it. Conﬁnement, explained in Chapter 11, relies on loader isolation, and so cannot be realized in these languages. The Related
Work Section 26.5 on Joe-E explains restrictions adequate to turn Java into an objectcapability language, such as ensuring that all static variables are final (not assignable)
and initialized to hold only transitively immutable data. Except where stated otherwise,
further expository use of Java will assume this restriction.
Whereas the functionality of an object program depends only on the abilities provided by
its underlying system, the security of an object-capability program depends on underlying
inabilities as well. In a graph of defensive objects, one object’s correctness depends not only
on what the rules of the game say it can do, but also on what the rules say its potential
adversaries cannot do.
63

Model Term Capability OS Terms Object Language Terms
instance process, domain instance, closure
code non-kernel program lambda expression,
+ literal data class ﬁle, method table
state address space + c-list environment,
(capability list) instance variable frame
index virtual memory address, lexical name, variable oﬀset,
c-list index argument position
object creation, fork, instantiation, construction,
instantiation facet creation lambda evaluation
loader domain creator, exec eval, ClassLoader
T able 9.1: Capability / OS / Object corresponding concepts. The ﬁrst column lists the
names used here for various concepts common to all object-capability systems.
The second column lists names commonly used for these concepts in an operating system context, especially by capability-based operating systems. The
third column lists names commonly used for these concepts in a programming
language context.
9.1 The Object-Capability Model
The following model is an idealization of various object languages and object-capability
operating systems. All its access control abilities are present in DVH (Dennis and van
Horn’s Supervisor) and many other object-capability systems [ Lev84].1 Object-capability
systems diﬀer regarding concurrency control, storage management, equality, typing, and
the primitiveness of messages, so we avoid these issues in our model. Our model does
assume reusable references, so it may not ﬁt object-capability systems based on concurrent
logic/constraint programming [ MBTL87, KM88, RH04]. However, our examples may easily
be adapted to any object-capability system despite these diﬀerences. Table 9.1 shows how
the terms used here correspond to terms commonly used to describe programming languages
and operating systems.
The static state of the reference graph is composed of the following elements.
• An object is either a primitive or an instance. Later, we explain three kinds of primitives: data, devices, and loaders. Data is immutable.
• An instance is a combination of code and state. We say it is an instance of the
behavior described by its code. For example, in an operating system context, we say
a process is an instance of its program. In a lexically scoped lambda language, a
closure is an instance of its lambda expression. 2
1 Our object-capability model is essentially the untyped call-by-value lambda calculus with applicativeorder local side eﬀects and a restricted form of eval—the model Actors and Scheme are based on. This
correspondence of objects, lambda calculus, and capabilities was noticed several times by 1973 [ GK76,
HBS73, Mor73a], and investigated explicitly in [ TMHK95, Ree96].
2 To describe Java in these terms, we would say a class is an instance of its classﬁle, where the class’
initial state is provided by its ClassLoader. Given the Joe-E restrictions, we can also say that a Java object
is an instance of its class.
64

• An instance’s state is a mutable map from indexes to references. (Alternatively, as
in E, we can consider an instance’s state to be an immutable map from indexes to
references, and provide for mutability by introducing primitively mutable Slot objects.
Either model can be easily expressed in the other.) The state of a process is its address
space + c-list, providing a mapping from addresses to data and from c-list indexes to
references.3 The state of a closure is its captured environment, providing a mapping
from the names of its instance variables to their values.
• A reference provides access to an object, indivisibly combining designation of the
object, the permission to access it, and the means to access it. Our access diagrams
become Granovetter diagrams, where the permission arrows now depict references.
• A capability is a reference to non-data.
• Code is some form of data (such as source text, an abstract syntax tree, or compiled
instructions) used to describe an instance’s behavior to a loader, as explained in
Chapter 10. Code also contains literal data.
• Code describes how a receiving instance (or “self”) reacts to an incoming message.
• While an instance is reacting, its addressable references are those in the incoming
message, in the receiving instance’s state, and in the literal data of the receiving
instance’s code. The directly accessible objects are those designated by addressable
references. When Carol is directly accessible to Alice, we may also say that Alice
refers to , holds a reference to , or has direct access to Carol.
• An index is some form of data used by code to indicate which addressable reference
to use, or where in the receiving instance’s state to store an addressable reference.
Depending on the system, an index into state may be an instance variable name or
oﬀset, a virtual memory address, or a c-list index. An index into a message may be
an argument position, argument keyword, or parameter name.
We distinguish three kinds of primitive objects.
1. Data objects, such as the number 7. Access to these are knowledge limited rather
than permission limited. If Alice can ﬁgure out which integer she wants, whether 7 or
your private key, she can have it. Data provides only information, not access. Because
data is immutable, we need not distinguish between a reference to data and the data
itself. (In an operating system context, we model user-mode compute instructions as
data operations.)
2. Devices. For purposes of analysis we divide the world into a computational system
containing all objects of potential interest, and an external world. On the boundary
are primitive devices, causally connected to the external world by unexplained means.
A non-device object can only aﬀect the external world by sending a message to an
accessible output device. A non-device object can only be aﬀected by the external
world by receiving a message from an input device that has access to it.
3 A c-list index is analogous to a Unix ﬁle descriptor number. A c-list is a kernel-protected data structure
analogous to the Unix kernel’s per-process mapping from ﬁle descriptor numbers to ﬁle descriptors.
65

3. A loader makes new instances. Any object system must provide an object creation
primitive. We distinguish two forms: In closed creation, such as nested lambda evaluation, the code of the new instance is already included in the code of the program
creating this instance. A loader provides open creation, making new instances from
explicitly provided code and state, thereby extending an already-running system with
new behaviors. Chapter 10 explains how either closed creation or open creation can
be built from the other. Chapter 11 uses a loader to implement conﬁnement. The
remainder of this chapter uses only closed creation.
9.2 Reference Graph Dynamics
Mutation (assignment), object creation, and message passing dynamically change the reference graph’s connectivity. Let us examine all the ways in which Bob can come to hold
a reference to Carol. By mutation, Bob can drop references, or can change the index =>
reference map in his state; but mutation by itself does not enable him to acquire a reference.
This leaves object creation and message passing.
9.2.1 Connectivity by Initial Conditions
For purposes of analysis, there is always a ﬁrst instant of time. Bob might already refer to
Carol when our universe of discourse comes into existence.
9.2.2 Connectivity by Parenthood
Bob says: def carol {...}
If Bob already exists and Carol does not, then, if Bob creates Carol, at that moment
Bob is the only object that refers to Carol. From there, other objects can come to refer to
Carol only by inductive application of these connectivity rules. Parenthood may occur by
normal object instantiation, such as calling a constructor or evaluating a lambda expression,
or by loading code as explained in Chapter 10.
9.2.3 Connectivity by Endowment
Alice says: def bob {...carol...}
If Carol already exists and Bob does not, then, if there exists an Alice that already refers
to Carol, Alice can create Bob such that Bob is born already endowed with a reference to
Carol. Bob might be instantiated by lambda evaluation, in which case a variable carol
which is free within Bob might be bound to Carol within Bob’s creation context, as supplied
by Alice. Or Alice might instantiate Bob by calling a constructor, passing Carol as an
argument.4
4 The example of Smalltalk seems to argue that “by endowment” is not fundamental. Instead, Smalltalk
objects are initialized “by introduction” after they are created, by an explicit initialization message. The
price of this convention is that any of an object’s clients could re-initialize it. To write defensively consistent
objects in this style, every initialization method would have to check, in order to prevent re-initialization.
“By endowment” then reappears to compactly describe the level of abstraction where we can assume such
checking is pervasive.
66

Figure 9.1 : Introduction by Message Passing. In an object system, when Alice passes to
Bob the message foo(carol), she is both telling Bob about Carol and giving
Bob the ability to access Carol. In an object-capability system, if Bob and
Carol already exist and Bob does not already have access to Carol, the only
way he can obtain such access is if an introducer, such as Alice, passes a
message to him, thereby granting him that access. To be an introducer, Alice
must already have access to Bob and Carol.
9.2.4 Connectivity by Introduction
Alice says: bob.foo(carol)
If Bob and Carol already exist, and Bob does not already refer to Carol, then the only
way Bob can come to refer to Carol is if there exists an Alice that
• already refers to Carol,
• already refers to Bob, and
• decides to share with Bob her reference to Carol.
In object terms, if Alice has variables in her scope, bob and carol, that hold references
to Bob and Carol, then Alice may send a message to Bob containing a copy of her reference
to Carol as an argument. Unlike the cp example, and like the cat example, Alice does not
communicate the string "carol" to Bob. Bob does not know or care what name Alice’s
code uses to refer to Carol.
In the initial conditions of Figure 9.1, Bob and Carol are directly accessible to Alice.
When Alice sends Bob the message foo(carol), she is both accessing Bob and permitting
Bob to access Carol.
Alice can cause eﬀects on the world outside herself only by sending messages to objects
directly accessible to her (Bob), where she may include, at distinct argument indexes,
references to objects directly accessible to her (Carol). We model a call-return pattern as an
object creation and two messages [ Hew77, Ste78], as explained further in Section 18.2). For
example, Alice gains information from Bob by ﬁrst creating a continuation—a facet of herself
to receive this information, and then causing Bob (with a call carrying this continuation)
to cause her to be informed (with a return invoking this continuation).
Bob is aﬀected by the world outside himself only by the arrival of messages sent by
those with access to him. On arrival, the arguments of the message (Carol) become directly
accessible to Bob. Within the limits set by these rules, and by what Bob may feasibly know
or compute, Bob reacts to an incoming message only according to his code. All computation
happens only in reaction to messages.
67

9.2.5 Only Connectivity Begets Connectivity
By these rules, only connectivity begets connectivity —all access must derive from previous access. Two disjoint subgraphs cannot become connected, as no one can introduce
them. More interestingly, if two subgraphs are almost disjoint, they can only interact or
become further connected according to the decisions of those objects that bridge these two
subgraphs. Topology-based analysis of bounds on permission (TP) proceeds by graph reachability arguments. Overt causation, carried only by messages, ﬂows only along permitted
pathways, so we may again use reachability arguments to reason about bounds on authority
and causality (TA). The transparency of garbage collection relies on such arguments.
The object-capability model recognizes the security properties latent in the object
model. All the restrictions above are consistent with good object programming practice
even when security is of no concern.
9.3 Selective Revocation: Redell’s Caretaker Pattern
Redell’s caretaker [ Red74] is our ﬁrst example of an access abstraction. We present it to
demonstrate how capability programmers write programs that attenuate authority. Previous formal analyses have led some researchers to conclude that revocation is impossible
in capability systems [ CDM01]. On examination, we see that permissions-based analyses
would indeed arrive at this conclusion. The caretaker is but one example of this gap between the authority-based intuitions of capability practitioners and the permissions-based
analyses in the formal security literature.
Capabilities do not directly provide for revocation. When Alice says bob.foo(carol),
she gives Bob unconditional, full, and perpetual access to Carol. Given the purpose of
Alice’s message to Bob, such access may dangerously exceed least authority. In order to
practice POLA, Alice might need to somehow restrict the rights she grants to Bob. For
example, she might want to ensure she can revoke access at a later time. But in a capability
system, references themselves are the only representation of permission, and they provide
only unconditional, full, perpetual access to the objects they designate.
What is Alice to do? She can use (a slight simpliﬁcation of) Redell’s caretaker pattern
for revoking access. Rather than saying bob.foo(carol), Alice can use the makeCaretaker
function from Figure 9.2 to say instead:
def [ carol2 , carol2Gate ] := makeCaretaker(carol)
bob.foo(carol2)
The caretaker carol2 transparently forwards messages it receives to target’s value, but
only if enabled’s current value is true. The gate carol2Gate changes what enabled’s
current value is. Alice can later revoke the eﬀect of her grant to Bob by saying
carol2Gate.disable().
Within the scope where target and enabled are deﬁned, makeCaretaker deﬁnes two
objects, caretaker and gate, and returns them to its caller in a two element list. Alice
receives this pair, deﬁnes carol2 to be the new caretaker, and deﬁnes carol2Gate to be the
corresponding gate. Both objects use enabled freely, so they both share access to the same
assignable enabled variable (which is therefore a separate Slot bound to "&enabled").
What happens when Bob invokes carol2, thinking he is invoking the kind of thing Carol
is? An object deﬁnition contains “ to” clauses deﬁning methods followed by an optional
“match” clause deﬁning a matcher. If an incoming message (say x.add(3)) doesn’t match
68

def makeCaretaker (target ) {
var enabled := true
def caretaker {
match [ verb , args ] {
if (enabled) {
E.call(target, verb, args)
} else {
throw("disabled")
}
}
}
def gate {
to enable() { enabled := true }
to disable() { enabled := false }
}
return [caretaker, gate]
}
Figure 9.2 : Redell’s Caretaker Pattern. The code above shows, in E, a slightly simpliﬁed
form of Redell’s caretaker pattern. makeCaretaker makes three objects, a mutable Slot representing the current value of the enabled variable, a caretaker
which conditionally forwards messages to target’s value, and a gate which
will set enabled to false. It returns the caretaker and gate.
69

any of the methods, it is given to the matcher. The verb parameter is bound to the
message name ( "add") and the args to the argument list ( [3]). This allows messages
to be received generically without prior knowledge of their API, much like Smalltalk’s
doesNotUnderstand: or Java’s Proxy. Messages are sent generically using E.call(...),
much like Smalltalk’s perform:, Java’s “reﬂection,” or Scheme’s apply.
This caretaker provides a temporal restriction of authority. Similar patterns provide
other restrictions, such as ﬁltering forwarders that let only certain messages through.
Alice can use the caretaker pattern to protect against Bob’s misbehavior, but only
by relying on aspects of Carol’s behavior: for example, that Carol does not make herself
directly accessible to her clients. Alternatively, Alice could use the membrane pattern shown
in Figure 9.3 to protect against both Bob and Carol, separating them even if they both
strive to remain connected.
9.4 Analysis and Blind Spots
Given Redell’s existence proof in 1974, what are we to make of subsequent arguments that
revocation is impossible in capability systems? Of those who made this impossibility claim,
as far as we are aware, none pointed to a ﬂaw in Redell’s reasoning. The key is the diﬀerence
between permission and authority analysis. If we examine only permissions, we ﬁnd Bob
was never given permission to access Carol, so there was no access to Carol to be revoked!
Bob was given permission to access carol2, and he still has it. No permissions were revoked.
Karger and Herbert propose [ KH84] to give a security oﬃcer a list of all subjects who
are, in our terms, permitted to access Carol. This list will not include Bob’s access to Carol,
since this indirect access is represented only by the system’s protection state taken together
with the behavior of objects playing by the rules. Within their system, Alice, by restricting
the authority given to Bob, as she should, has inadvertently thwarted the security oﬃcer’s
ability to get a meaningful answer to his query. This leads to the following disconcerting
observation:
To render a permission-only analysis useless, a threat model need not include
either malice or accident; it need only include subjects following security best
practices.
Even in systems not designed to support access abstraction, many simple patterns happen naturally. Under Unix, Alice might provide a ﬁltering forwarder as a process reading a
socket Bob can write. The forwarder process would access Carol using Alice’s permissions.
Therefore, these blind spots are applicable to any system, if we mistakenly use permission
alone to reason about what subjects may do.
A topology-only bound on permission (TP) or authority (TA) would include the possibility of the caretaker giving Bob direct access to Carol—precisely what the caretaker was
constructed not to do. Only by reasoning about behaviors can Alice see that the caretaker
is a “smart reference.” Just as makePoint extends our vocabulary of data types, raising
the abstraction level at which we express solutions, so does makeCaretaker extend our vocabulary for expressing access control. Alice (or her programmer) should use topology-only
analysis for reasoning about objects outside her reliance set. But Alice also relies on some
objects, like the caretaker, because she has some conﬁdence she understands their actual
behavior.
70

def makeMembrane (target ) {
var enabled := true
def wrap (wrapped) {
if (Ref.isData(wrapped)) {
# Data provides only irrevocable knowledge, so don’t
# bother wrapping it.
return wrapped
}
def caretaker {
match [ verb , args ] {
if (enabled) {
def wrappedArgs := map(wrap, args)
wrap(E.call(wrapped, verb, wrappedArgs))
} else {
throw("disabled")
}
}
}
return caretaker
}
def gate {
to enable() { enabled := true }
to disable() { enabled := false }
}
return [wrap(target), gate]
}
Figure 9.3 : Membranes Form Compartments. The simple caretaker pattern shown previously is only safe for Alice to use when she may rely on Carol not to provide
Carol’s clients with direct access to herself. When Alice may not rely on Carol,
she can use the membrane pattern. A membrane additionally wraps each capability (non-data reference) passing in either direction in a caretaker, where
all these caretakers revoke together. By spreading in this way, the membrane
remains interposed between Bob and Carol. The simpliﬁed membrane code
shown here has the security properties we require, but is not yet practically
eﬃcient.
71

9.5 Access Abstraction
The object-capability model does not describe access control as a separate concern, to be
bolted on to computation organized by other means. Rather it is a model of modular
computation with no separate access control mechanisms. All its support for access control
is well enough motivated by the pursuit of abstraction and modularity. Parnas’ principle of
information hiding [ Par72] in eﬀect says our abstractions should hand out information only
on a need to know basis. POLA simply adds that authority should be handed out only on
a need to do basis [ Cro97]. Modularity and security each require both of these principles.
The object-capability paradigm, in the air by 1967 [ WN79, Fab74], and well established
by 1973 [ Red74, HBS73, Mor73a, WCC+74, WLH81], adds the observation that the abstraction mechanisms provided by the base model are not just for procedural, data, and
control abstractions, but also for access abstractions, such as Redell’s caretaker. (These are
“communications abstractions” in [ TMHK95].)
Access abstraction is pervasive in actual capability practice, including ﬁltering forwarders, unprivileged transparent remote messaging systems [ Don76, SJR86, vDABW96],
reference monitors [ Raj89], transfer, escrow, and trade of exclusive rights [ MKH+96,
MMF00, Clo06], and recent patterns like the Powerbox [ WT02, SM02]. Further, every
non-security-oriented abstraction that usefully encapsulates its internal state provides, in
eﬀect, restricted authority to aﬀect that internal state, as mediated by the logic of the abstraction. Defensively consistent abstractions guard the consistency of their state, providing
integrity controls along the lines suggested by Clark and Wilson [ CW87].
The platform is also a security-enforcing program, providing abstractions for controlling
access. When all code is either within the platform or considered untrusted, one can only
extend the expressiveness of a protection system by adding code to the platform, making
everyone fully vulnerable to its possible misbehavior. By contrast, only Alice relies on
the behavior of her caretaker, and only to limit authority ﬂowing between Bob and Carol.
The risks to everyone, even Alice, from its misbehavior are limited because the caretaker
itself has limited authority. Alice can often bound her risk even from bugs in her own
security-enforcing programs.
9.6 Notes on Related Work
Henry Levy’s book Capability-based Computer Systems [Lev84] provides an overview of
the early history of capability operating systems. (There is some coverage of hardware
support for capabilities, but nothing on capability languages or cryptographic capability
protocols.) While it is clear that these systems express similar perspectives on computation,
prior attempts to capture this commonality have left out crucial elements. Lampson’s
characterization of capabilities in Protection [Lam74] does not include the requirement that
Alice must have access to Bob in order to give Bob permission to access Carol. Although
this property was present in DVH and many other systems, it was not universal. For
example, Cal-TSS [ LS76] does not impose this requirement. As we will see in Chapter 11,
without this requirement, capabilities would be discretionary and unable to solve Lampson’s
conﬁnement problem [ Lam73].
Bishop and Snyder’s “take grant” framework [ BS79] does capture this requirement, but
elides the issue of how objects name which capabilities they employ, grant, and receive,
in order to keep them distinct. Eliding this issue was appropriate for their purpose: their
72

conservative topology-only analysis assumed that any object might do anything it was
permitted to do.
Hewitt’s Actors model of computation [ HBS73, Hew77], covered brieﬂy in Chapter 23,
does express a computational model of object-capability computation. Our connectivity
rules above are essentially a restatement of the “locality laws” of Hewitt and Baker [ HB78].
However, this expression of the capability model was coupled to the rest of Actors, which
had many other elements. As a result, the rest of the capability community, and those
seeking to understand the capability model, failed to be inﬂuenced by this crisp expression
of the model. This chapter was written to help repair this state of aﬀairs. In order to
capture the lore among capability practitioners, we adapted the relevant aspects of Hewitt
and Baker’s model and explained how it relates to the elements of capability operating
systems and languages.
73

74
