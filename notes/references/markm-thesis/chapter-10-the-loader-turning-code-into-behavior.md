# Chapter 10 — The Loader: Turning Code Into Behavior


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 93–98.

---

Chapter 10
The Loader: Turning Code Into
Behavior
Closed creation, such as nested lambda evaluation or constructor calls, naturally provides for
the creation of new instances running old code. How does new code enter an already running
system? The answers provided by diﬀerent object-capability systems diﬀer in many details,
but an idealization of their underlying logic is captured by the loader abstraction we present
here—essentially a restricted form of Scheme’s eval. We deﬁne a safety criterion, loader
isolation, which enables a loader’s client to withhold permissions from the new instance. In
Chapter 11, we rely on loader isolation to enforce conﬁnement.
10.1 Closed Creation is Adequate
Our object-capability model deﬁnes an instance as combining code and state, where code
is data describing the instance’s behavior, and state provides a mutable map from indexes
to references. We can model open creation as a loader, an object whose load method takes
these two ingredients as arguments and returns the new instance they describe.
In programming language terms, this corresponds to a restricted form of Scheme’s eval
function, in which the ﬁrst argument is a lambda expression and the second argument is a
lexical environment providing mappings for all the free variables in the lambda expression.
With only a closed creation primitive, one can write a loader as an interpreter for the
language in which its code argument is expressed. In E, one might follow the pattern shown
in Figure 10.1.
Unlike many interpretive deﬁnitions of eval, this one stops at object boundaries. When
Alice’s interpreter attempts to interpret a call to Bob, Bob is as encapsulated from Alice’s
interpreter as he would be from Alice, so Alice’s interpreter uses E.call(...) to “reﬂectively” send the message to Bob. Likewise, Alice’s interpreter is as encapsulated from her
own clients as Alice would be, so Alice’s interpreter uses match to “reﬂectively” accept any
incoming message.
10.2 Open Creation is Adequate
Now that we understand what a loader does, we can use a loader to model closed creation
primitives, such as nested lambda evaluation. Figure 10.2 shows how to transform nested
75

def loader {
to load( code :Data, state ) {
def instance {
match [ verb , args ] {
... # the interpreter goes here
}
}
return instance
}
}
Figure 10.1 : Closed Creation is Adequate. We can use nested object deﬁnitions to create a
new object whose code-following behavior is provided by an interpreter. The
interpreter has access to the verb and args of the message to react to, and
the code and state of the instance whose reaction it needs to emulate. A
loader which follows this pattern and interprets using only these four variables
provides loader isolation . The service it provides obeys the object-creation
connectivity rules.
def makeCaretaker (target ) {
var enabled := true
def caretaker := loader.load("def caretaker {...}",
["target" => target,
"&enabled" => &enabled,
"E" => E,
"throw" => throw])
def gate := loader.load("def gate {...}",
["&enabled" => &enabled,
"true" => true,
"false" => false])
return [caretaker, gate]
}
Figure 10.2 : Open Creation is Adequate. This transform of Figure 9.2 (p. 69) shows how a
loader can model nested lambda evaluation. The loader makes a new instance
behaving according to the code as endowed with the state. The state provides
a mapping for all the code’s instance variable names. The loader returns the
only reference to the new instance. Transforming recursively would unnest
all object deﬁnitions.
76

object deﬁnitions into loader calls. For each assignable instance variable, this transformation
passes its Slot object, in order to preserve and make explicit the shared state relationships
between objects in the same scope. Applying this transformation recursively would unnest
all object deﬁnitions.
Of course, at least one of these forms of creation must be provided primitively. Many
object-capability languages and operating systems actually provide primitives for both forms
of creation. For example, in DVH, the open process creation primitive takes as arguments an
address space and a c-list. The address space contains both code and that portion of state
mapping from addresses to data. The c-list is the remaining portion of state mapping from
c-list indexes to capabilities. DVH also provides a closed creation primitive by which an
already-running process can create a “protected procedure,” a new capability representing
a new entry point into that process. All the code and state used by the protected procedure
is already contained in the code and state of its parent process. These new entry points are
facets of their process. Other object-capability operating systems [ Har85, SSF99] provide
analogous pairs of open process-creation and closed facet-creation primitives.
10.3 Loader Isolation
For eﬃciency, primitively provided loaders hand the code to some lower level interpreter
for faster execution. For example, an operating system’s loader loads machine instructions,
and arranges for these to be interpreted directly by the hardware. A loader must ensure
that the behavior of the new instance is limited by the rules of our model, no matter what
the code might attempt to express to the contrary. Operating systems ensure this using
hardware protection. Programming languages might use code veriﬁcation and/or trusted
compilers. The behavior of a primitively loaded instance must not exceed what would have
been possible of an interpretive instance created by the loader in Figure 10.1.
If a loader obeys loader isolation , it is an object creation primitive satisfying the connectivity constraints of Section 9.2. The “by parenthood” constraint implies that the loader
returns to its caller the only reference to the new instance. The “by endowment” constraint
implies that the state argument provides all the instance’s initial state. In programming
language terms, state provides mappings for all the variable names used freely in the code.
All linking happens only by virtue of these mappings. When a loader obeys loader isolation,
Alice can use it to load code she doesn’t understand and is unwilling to rely on. Alice is
assured that the new instance only has that access Alice grants. Alice can withhold any
permission from the new instance merely by not providing it.
A common way in which systems violate loader isolation is by honoring magic names .
By magic name , we mean a name used in the code which is magically mapped to some
source of authority not appearing in the state. For the interpretive loader of Figure 10.1 to
violate loader isolation, it must use these magic names freely itself, in order to behave as
an instance having access to these values. When a loader honors magic names, Alice has
no ability to withhold this access from the new instance. This violation will be more or
less problematic according to the authority accessible by magic. If this authority cannot be
withheld, what sort of mischief does it enable?
The E loader does honor a few magic names, but the associated values provide no
authority. In Figure 10.2, the loader calls need not actually include “ E”, “ throw”, “ true”,
or “false”, as the loader will resolve these magic names to their well known values, none of
77

which provide authority. Although this violates our model and should be ﬁxed, it is mostly
harmless. The E loader also considers itself mostly harmless, and provides magic access to
itself.1
To model Java’s ClassLoader in these terms, we would say that the ClassLoader class
corresponds to the “loader” of our model, and that loading proceeds in two steps. First,
Alice creates a new ClassLoader, providing “state” as logic mapping import names to other
classes. Alice then uses this ClassLoader to load classﬁles. Each resulting class is an
instance of this classﬁle as endowed by its ClassLoader’s state. By considering a Java class
to correspond to an “instance” in our model, we would then model Java’s mutable static
variables as instance variables of this class object. Modeled in this way, mutable static
variables by themselves do not disqualify Java from being considered an object-capability
language.
We can now say why Java is not an object-capability language. 2 The import mapping
that Alice provides cannot override some magic system class names, and some of these
system classes provide authority. Some of the accessible values are not harmless. (See
Related Work Section 24.5 on the J-Kernel for an extended discussion.) Similar remarks
apply to Scheme, Oz, ML, and Smalltalk. Eﬀorts to make object-capability variants of
these languages are covered in related work sections on the J-Kernel (Section 24.5), Joe-E
(Section 26.5), W7 (Section 24.4), Oz-E (Section 26.3), Emily (Section 26.6), and Tweak
Islands (Section 26.8). These eﬀorts can be understood partially in terms of how they
achieve loader isolation on these platforms.
10.4 Notes on Related Work
The Lisp 1.5 Programmer’s Manual [M+62] presents a lisp meta-interpreter as mutually
recursive eval and apply functions, where eval takes an S-Expression representing an
expression to be evaluated, and an association list representing an environment.
Reﬂection and Semantics in lisp [Smi84] explains how meta-interpreters diﬀer from each
other according to which features of the language they “absorb” and which they “reify.” For
example, the lisp 1.5 meta-interpreter absorbs sequential and stacking execution, because
the sequencing and stacking of the language being interpreted is implicitly provided by the
sequencing and stacking of the language doing the interpreting. By contrast, the lisp 1.5
meta-interpreter reiﬁes scoping, since it explicitly represents binding environments and
variable lookup.
Structure and Interpretation of Computer Programs [AS86] presents several metainterpreters for Scheme, a lexically-scoped lisp-like language with true encapsulated lexical
closures. The ﬁrst of these uses mutually recursive eval and apply functions in the spirit of
the lisp 1.5 meta-interpreter. Successive meta-interpreters reify successively more aspects
of the language, making the execution model yet more explicit.
The interpretive loader shown in Figure 10.1 derives from the meta-interpreters shown
1 The deﬁnition of loader isolation presented here is also too strict to allow E’s trademarking, explained in
Section 6.3, but we believe this conﬂict is again mostly harmless for reasons beyond the scope of this dissertation. Although we use both loader isolation and trademarking, this dissertation does not use trademarking
within loaded code, and so does not depend on the resolution to this conﬂict.
2 This observation does not constitute a criticism of Java’s designers. Java’s security architecture [ Gon99],
by design, does not attempt to provide object-capability security. Rather, it is to their credit that Java comes
so tantalizingly close to satisfying these goals anyway.
78

in Meta Interpreters for Real [SS86]. These meta-interpreters eﬀectively absorb apply, so
that interpreted code can interact with non-interpreted code, with neither being aware of
whether the other is being interpreted.
Whereas lisp’s eval and DVH’s process creation primitive take the actual code as
arguments, other loaders generally take a name to be looked up to ﬁnd this code. Unix
exec is an example of an operating system loader that takes a ﬁlename as argument, and
obtains the code by reading the ﬁle. Programming language loaders allow the delayed
linking and loading of modules. Program Fragments, Linking, and Modularization [Car97]
analyzes the semantics of linking, and the conditions under which the linking of separately
compiled modules should be expected to be type safe.
Generally, name-based loaders are name-centric [ Ell96], i.e., they assume a globally
shared namespace. For exec, this is the ﬁle system. Programming languages, even those
otherwise careful to avoid global variable names, generally assume a global namespace
of modules. Java may be the ﬁrst programming language with a name-based loader to
demonstrate that all global namespaces can be avoided [ LY96, QGC00]. A Java module is
a class, whose identity is uniquely deﬁned by a pair of a ﬁrst-class anonymous ClassLoader
object and a fully qualiﬁed name. The fully qualiﬁed name functions as a key-centric name
path [ Ell96, EFL+99], whose traversal is rooted in the local namespace of its ClassLoader.
A Java programmer can deﬁne new ClassLoaders, and each ClassLoader can deﬁne its own
behavior for obtaining the actual code from a fully qualiﬁed class name. The J-Kernel
covered in Related Work Section 24.5 makes use of this ﬂexibility.
Popek and Goldberg’s Formal Requirements for Virtualizable Third Generation Architectures [PG74] explains the conditions needed for a hardware architecture to be cleanly
virtualizable. First, they divide the instruction set into privileged and non-privileged instructions. For an instruction to be considered privileged, it must trap if executed in user
mode, so that it can be emulated by a virtual machine monitor. Then they separately
divide instructions into innocuous and sensitive. Sensitive instructions are further divided
into control sensitive and behavior sensitive, though an instruction can be sensitive in both
ways. Control sensitive instructions can cause an eﬀect outside the program’s addressable
space—its address space and its normal register set. Behavior sensitive instructions are
those which can be aﬀected by state outside the program’s addressable space, i.e., it enables the program to sense external state, such as an instruction for reading the clock. An
architecture is considered to be cleanly virtualizable if all sensitive instructions are privileged, i.e., if all non-privileged instructions are innocuous. An example which makes their
distinctions clear is an instruction which does something when executed in privileged mode,
but acts as a noop, rather than trapping, when executed in user mode. Since it doesn’t
trap, it is a non-privileged instruction. Since its behavior depends on the privilege bit,
it is a behavior sensitive instruction. A machine with such an instruction is not cleanly
virtualizable.
Their notion of cleanly virtualizable corresponds to our notion of loader isolation. Innocuous instructions only allow local computation and manipulation of one’s own state.
Sensitive instructions provide authority. The privilege bit allows a virtual machine monitor or operating system kernel to deny to the loaded code the authority that privileged
instructions would provide. The monitor or kernel can provide what authority it chooses
according to how it reacts to trapped privileged instructions. Non-privileged sensitive instructions are magic names violating loader isolation. The authority they provide may only
be denied by ﬁltering, translating, or interpreting loaded code, in order to prevent or control
79

the execution of such instructions.
Given a cleanly virtualizable machine, a virtual machine monitor responds to traps by
emulating an isolated copy of the physical machine. By contrast, an operating system kernel responds to certain traps as system calls, creating a virtual machine whose privileged
instructions are system calls, which are generally quite diﬀerent from the privileged instructions of the physical machine. Here again, loader isolation issues arise. Unix’s many system
calls provide magic names, by which the loaded program has causal connectivity beyond
that provided by exec’s caller. By contrast, the system calls provided by KeyKOS [ Har85],
EROS [ SSF99], and Coyotos [ SDN+04] are like E’s E.call(...) and E.send(...). They
enable the program to invoke objects it already has direct access to (by virtue of capabilities
held in protected memory as that program’s c-list), but provide no other authority. Such
system calls do not violate loader isolation. A program only able to execute such system
calls and innocuous instructions may still only aﬀect the world outside itself according to
the capabilities it acquires.
80
