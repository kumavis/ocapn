# Chapter 5 — Forms of Robustness


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 47–56.

---

Chapter 5
Forms of Robustness
Under what conditions will a correct program behave correctly? A program is a mathematical object; its correctness is a mathematical question. As engineers, we care about what
transpires when a program is run. We must examine the bridge from abstract correctness
to desired behavior. If this bridge rests on ﬂimsy assumptions, correctness is inadequate for
robustness. This chapter distinguishes forms of correctness based on the structure of these
assumptions, and examines how each contributes to robustness.
Although this chapter adapts some concepts from the formal correctness literature, we
are concerned here more with conventional software engineering quality issues. A program
is correct when it “meets its speciﬁcation,” i.e., when it does what it is supposed to do.
Formal correctness demands formal speciﬁcation. However, even after decades of research
and development on formal speciﬁcation languages, the practical reality today is that most
speciﬁcations are informal, and many are not even written down [ DLP79]. Nevertheless, programmers informally reason about the correctness of their programs all the time, and with
some success [ Gut04]. The formal correctness literature helps explain how programmers
do so, and how they may do better: by applying informal (and psychologically plausible)
adaptations of these formal techiniques. We close this chapter (in Section 5.8) with some
thoughts on related areas in formal correctness.
5.1 Vulnerability Relationships
What does the following C program do? Is it correct? What would this mean?
static int count = 0;
int incr () { return count += 1; }
When we say that a program P is correct, we normally mean that we have a speciﬁcation
in mind (whether written down or not), and that P behaves according to that speciﬁcation.
There are some implicit caveats in that assertion. For example, P cannot behave at all
unless it is run on a machine; if the machine operates incorrectly, P on that machine may
behave in ways that deviate from its speciﬁcation. We do not consider this to be a bug
in P, because P’s correct behavior is implicitly allowed to depend on its machine’s correct
behavior. If P’s correct behavior is allowed to depend on another component R’s correct
behavior, we will say that P relies upon R [Tin92, Sta85, AL93, AL95, CC96]. We will refer
to the set of all elements on which P relies as P’s reliance set.
29

5.2 Platform Risk
Systems are built in many layers of abstraction. For purposes of analysis, at any moment
we must pick a frame of reference—a boundary between a platform (such as a language or
operating system kernel) enforcing rules of permissible action, and the set of all possible
programs running on that platform, assumed able to act only in permitted ways [ And72,
NBF+80, SS87]. By program we refer only to code running on that platform, whose behavior
is controlled by the platform’s rules. We implicitly allow all programs running on a platform
to assume their platform is correct—their platform is in their reliance set [ Tin92]. For incr,
the natural frame of reference is to choose the C language as the platform, requiring correct
behavior only if the C implementation behaves correctly. The relevant universe of programs
consists of that code whose interactions with incr are governed by the rules of C, which is
to say, all other C programs which might be linked together and run in the same address
space as incr.
Given a set of objects, anything within the reliance sets of all of them is a central point
of failure for that set. A platform is a central point of failure for the set of all possible
programs running on that platform. 1
In a traditional timesharing context, or in a conventional centrally-administered system
of accounts within a company, the platform includes the operating system kernel, the administrator accounts, and the administrators. The platform provides the mechanisms used
to limit the authority of the other players, so all the authority it manages is vulnerable
to the corruption or confusion of the platform itself. The platform is, therefore, a central
point of failure for all the systems running on that platform. While much can be done to
reduce the likelihood of an exploitable ﬂaw in the platform—primarily by making it smaller
and cleaner—ultimately, any centralized system will continue to have this Achilles heel of
potential full vulnerability.
As we will see, distributed systems can support full decentralization. Each portion
rests on a platform to which it is fully vulnerable, but diﬀerent portions rest on diﬀerent
platforms. A fully decentralized system may have no central points of failure, such as a
common administrator.
5.3 Conventional Correctness
Besides the platform, what else can cause incr to behave incorrectly?
What if other C code in the same address space overwrites count’s storage or incr’s
instructions? What if a concurrently executing thread overwrites incr’s stack frame? Such
behavior will cause incr to behave incorrectly, but this does not mean incr itself is incorrect. Because one piece of C code can do nothing to defend itself against such “friendly
ﬁre,” we must allow all C code the assumption that all other C code in its address space is
correct (or at least meets some broad correctness criteria).
The semantics of such fragility is often captured by introducing an undeﬁned state. For
1 As commonly used, the term “Trusted Computing Base” (TCB) sometimes means “reliance set,”
sometimes “platform,” and sometimes the set of central points of failure for all the objects running on a
given platform, i.e., the intersection of their reliance sets. “Rely” is deﬁned in terms of the objective situation
(P is vulnerable to R), and so avoids confusions engendered by the word “trust.”
While our focus here is on correctness and consistency, a similar “reliance” analysis could be applied to
other program properties, such as promptness [ Har85].
30

public class Counter {
private int count = 0;
public int incr () {
return count += 1;
}
}
Figure 5.1 : A Cooperatively Correct Counter in Java. If the purpose of a counter is to
report to its clients how many times it has been invoked, then the hazards presented by an instance of this Counter class are 1) that its count may overﬂow,
or 2) that it may be called from multiple threads. If all clients of a counter
carefully avoid these hazards, then that counter will correctly serve its purpose
for each of them.
example, if any C code stores through a bad pointer, the eﬀects are undeﬁned, which is
to say, the language speciﬁcation then allows anything to happen. Corruption potentially
spreads through the whole program instantly, totally, and undetectably. If incr misbehaves
as a result, we would say the bug is in the other C code, not in incr or in the C language
implementation. Because there is no isolation within the universe deﬁned by the C language,
no robustness is possible. Everything is fully vulnerable to accident or malice by anything
else within its universe. Each is a central point of failure for all. Correct code can only be
expected to behave correctly when all other code in its address space is also correct.
5.4 Cooperative Correctness
Memory-safe languages do better. The corresponding Java code in Figure 5.1 isn’t vulnerable to the above non-local problems. However, in Java, as in C, addition may overﬂow.
We could make it correct by revising incr’s speciﬁcation to reﬂect what it actually does
in these languages: modular addition adjusted for two’s complement. Such a speciﬁcation
accurately describes what incr does, but not what it is for. To understand how programmers will use it, we examine purposes and hazards. The programmer of incr, merely by
the names chosen, is clearly suggesting the purpose of counting how many times incr has
been called. Of course, no code running on ﬁnite hardware can serve this purpose in all
cases. Our understanding of incr as serving a purpose must therefore be qualiﬁed by its
hazards, the cases under which we may no longer assume it will serve this purpose, such as
if it is called too many times, or if it is called from two threads that might interleave. 2
In this case, these hazards deﬁne preconditions [ Hoa69, Mey92], since incr’s clients
can choose not to call it too many times, and to always call it from the same thread. Both
preconditions are an obligation that all of its clients must obey in order for incr to correctly
serve its purpose for any of them. We say incr is cooperatively correct since it must serve
each of its clients correctly only under the assumption that all of its clients obey incr’s
preconditions. The continued proper functioning of any of incr’s clients is vulnerable to
incr’s misbehavior. Since this misbehavior can be induced by any of incr’s other clients,
2 Of course, diﬀerent programmers may use incr for diﬀerent purposes, and diﬀerent purposes will imply
diﬀerent hazards.
31

they are also vulnerable to each other’s misbehavior.
When client objects request service from provider objects, their continued proper functioning is often vulnerable to their provider’s misbehavior. When providers are also vulnerable to their clients, corruption is potentially contagious over the reachable graph in both
directions, severely limiting the scale of systems we can successfully compose. Fortunately,
memory-safe languages with encapsulation make practical a higher standard of robustness.
5.5 Defensive Correctness
If a user browsing pages from a webserver were able to cause it to display incorrect pages
to other users, we would likely consider it a bug in the webserver—we expect it to remain
correct regardless of the client’s behavior. We call this property defensive correctness : a
program P is defensively correct if it continues to provide correct behavior to well behaved
clients despite arbitrary behavior on the part of its other clients. Before this deﬁnition can
be useful, we need to pin down what we mean by “arbitrary” behavior.
We deﬁne Q’s authority as the set of eﬀects Q could cause. With regard to P’s correctness, Q’s relevant authority is bounded by the assumption that everything in P’s reliance set
is correct, since P is allowed this assumption. For example, if a user could cause a webserver
to show the wrong page to other browsers by replacing a ﬁle through an operating system
exploit, then the underlying operating system would be incorrect, not the webserver. We
say that P protects against Q if P remains correct despite any of the eﬀects in Q’s relevant
authority, that is, despite any possible actions by Q, assuming the correctness of P’s reliance
set.
Now we can speak more precisely about defensive correctness. The “arbitrary behavior”
mentioned earlier is the combined relevant authority of an object’s clients. P is defensively
correct if it is cooperatively correct and protects against all of its clients. The focus is on
clients in particular in order to enable the composition of correct components into larger
correct systems. If P relies on R, then P also relies on all of R’s other clients unless R is
defensively correct. If R does not protect against its other clients, P cannot prevent them
from interfering with its own plan. By not relying on its clients, R enables them to avoid
relying on each other.
5.6 Defensive Consistency
Correctness can be divided into consistency (safety) and progress (liveness). An object that
is vulnerable to denial-of-service by its clients may nevertheless be defensively consistent .
Given that all the objects it relies on themselves remain consistent, a defensively consistent
object will never give incorrect service to well-behaved clients, but it may be prevented from
giving them any service. While a defensively correct object is invulnerable to its clients, a
defensively consistent object is merely incorruptible by its clients.
Diﬀerent properties are feasible at diﬀerent granularities. Many conventional operating
systems attempt to provide support for protecting users from each other’s misbehavior. Because programs are normally run with their user’s full authority, all software run under the
same account is mutually reliant: Since each is granted the authority to corrupt the others via underlying components on which they all rely, they cannot usefully protect against
such “friendly ﬁre.” As with our earlier C example, they are each a central point of fail32

public class Counter {
private int count = 0;
public synchronized int incr () {
if ((count + 1) < 0) {
throw ...;
}
return count += 1;
}
}
Figure 5.2 : A Defensively Consistent Counter in Java. Instances of this counter either
correctly serve their purpose—reporting how many times incr was called—or
they fail safe.
ure for all. 3 Some operating system designs [ DH65] support process-granularity defensive
consistency. Others, by providing principled controls over computational resource rights
[Har85, SSF99], support process-granularity resistance to denial of service attacks. Among
machines distributed over today’s Internet, cryptographic protocols help support defensive
consistency, but defensive progress, and hence defensive correctness, remains infeasible.
Because they enforce some isolation of access to memory, memory-safe languages can
aspire to object-granularity defensive consistency. In E, as in most of these, fundamental operations implicitly allocate memory, rendering object-granularity defensive progress
unattainable. For example, any “proof” that an ML function terminates with a correct
answer is subject to the implicit caveat “given enough memory,” which is a condition that
any other ML function in that same address space can cause to be false.
Similarly, within E’s architecture, object-granularity defensive correctness is impossible.
E objects are aggregated into process-like units called vats, explained in Chapter 7 and
Section 14.1. Like a process, a vat is the minimum granularity to which resource controls
could be practically enforced. With respect to progress, all objects within the same vat
are mutually reliant. In many situations, defensive consistency is adequate—a potential
adversary often has more to gain from corruption than denial of service. This is especially
so in iterated relationships, since corruption may misdirect plans but go undetected, while
loss of progress is quite noticeable.
When a system is composed of defensively consistent abstractions, to a good approximation, corruption is contagious only upstream, from providers to clients [ Tin92].
5.7 A Practical Standard for Defensive Programming
Programmers use programming standards as conventions to organize background
assumptions—those things we generally assume to be true, and endeavor to make true,
unless stated otherwise. Programming standards should compose well: It should be easier
to compose systems that meet a given standard when relying on subsystems built to meet
this same standard. This is true for each of the forms of robustness above. For example,
3 In Part IV we explain Polaris, an unconventional way to use conventional operating systems to provide
greater security.
33

it is easier to compose defensively correct systems if one can build on defensively correct
components.
By convention, unless stated otherwise, E and its libraries are engineered to achieve and
support the following forms of robustness. The examples and mechanisms presented in this
dissertation should be judged by this standard as well.
Object-granularity defensive consistency both within a vat and when interacting with
potentially misbehaving remote vats.
Least authority The disciplines of defensive consistency and POLA are mutually supportive. Reducing the authority held by an object’s clients reduces the number of
actions it may take, and thereby helps reduce the number of cases that the object
must protect against in order to remain consistent. A concrete example appears in
Chapter 15. Defensive consistency itself helps reduce authority, since otherwise, each
of an object’s clients has the authority to corrupt any of the object’s other clients.
Defensive progress up to resource exhaustion, where we include non-termination,
such as an inﬁnite loop, as a form of resource exhaustion. Protocols that achieve
only defensive progress up to resource exhaustion are normally regarded as satisfying
a meaningful liveness requirement. Whether this standard is usefully stricter than
cooperative progress we leave to the judgement of the reader.
F ail safe When a component is unable to fulﬁll its purpose, it must prevent normal progress
on control-ﬂow paths that assumed its success.
F ail stop When possible, a failed component should stop and notify interested parties that
it has failed, so they can attempt to cope. The halting problem prevents us from doing
this in general. Although timeouts can make fail-safe into fail-stop, they must be used
rarely and with care, as they also non-deterministically cause some slow successes to
fail-stop.
Figure 5.2 (p. 33) shows one way to write a Counter class in Java that lives up to
this standard, but only if we regard integer overﬂow as a kind of resource exhaustion. In
order to regard it as defensively consistent, we regard exceptional control ﬂow and process
termination as forms of non-progress rather than incorrect service. This perspective places
a consistency burden on callers: If they make a call while their own state invariants are
violated, they must ensure that exceptions thrown by the callee leave reachable state in a
consistent form. They can do so either by abandoning or repairing bad state.
Much bad state will automatically be abandoned by becoming unreachable as the exception propagates. For the remainder, the caller either can repair bad state (for example,
using a try/finally block) or, (when this is too dangerous or diﬃcult) can convert exceptional control ﬂow into process termination, forcibly abandoning bad state. In E, the
appropriate unit of termination is the vat incarnation rather than the process. As we will
see in Section 17.4, terminating an incarnation of a persistent vat is similar to a transaction
abort—it causes the vat to roll back to a previous assumed-good state.
Full defensive correctness is infeasible in E even between directly communicating vats.
An area for future research is to investigate whether per-client intermediate vats can guard
an encapsulated shared vat in order to practically resist denial of service attacks [ Sch06].
34

Fault tolerant systems are often built from fail-stop components combined with redundancy or restart [ Gra86, Arm03]. “Tweak Islands” [ SRRK05], covered in Related Work
Section 26.8, combines an E-like model with fault tolerant replication in order to provide
high availability.
For some systems, continued progress, even at the cost of inconsistency, is more important than maintaining consistency at the cost of progress. We may loosely characterize
these two needs as best-eﬀort vs. fail-safe. For yet others, the price of full correctness
is worth paying, as neither consistency nor progress may be sacriﬁced. E is designed to
support fail-safe engineering. For these other purposes, E is inappropriate.
5.8 Notes on Related Work
Cliﬀ Jones’ The Early Search for Tractable Ways of Reasoning about Programs [Jon03] is a
clear and readable history of formal veriﬁcation, mostly of sequential imperative programs,
up to 1990. This history makes clear the seminal contribution of Hoare’s An Axiomatic
Basis for Computer Programming [Hoa69]. In the Floyd-Hoare proof technique, program
statements are annotated with preconditions and postconditions. The basic proof step is
to show that, if the preconditions hold before the statement is executed, then the postconditions will hold after the statement is executed. Compositions are correct when the
postconditions of all immediate antecedents of a statement imply that statement’s preconditions.
In this sense, Hoare’s preconditions formalize the assumptions each statement may rely
on, and its postconditions formalize the speciﬁcation it must meet under the assumption
that its preconditions were met. Hoare’s compositional rule formalizes conventional correctness (or, at best, cooperative correctness): when analyzing the correctness of a particular
statement, one assumes that all antecedent statements met their speciﬁcations—that if their
preconditions were met, then they met their postconditions.
Dijkstra’s A Discipline of Programming [Dij76], by introducing “weakest preconditions,”
extended Floyd-Hoare logic to deal with liveness as well as safety issues. In the correctness
literature, a thrown exception is generally treated as a safety issue, rather than a loss of
liveness. Therefore, this dissertation uses the terminology of consistency vs. progress, so
that we may regard a thrown exception as a loss of progress without causing confusion.
The precondition/postcondition notion was extended by Stark to “rely/guarantee,” for
reasoning about shared-state concurrency [ Sta85]. We borrow the term “rely” from him.
It was separately extended by Jones [ Jon83] and Abadi and Lamport [ AL93, AL95] to
“assumption/commitment,” for reasoning about message-passing concurrency. These two
extensions were generalized and uniﬁed by Cau and Collette into a compositional technique
for reasoning about both kinds of concurrency [ CC96]. An area of future work is to explore
how these various extensions relate to the concurrency work presented in this dissertation.
Abadi and Lamport’s Composing Speciﬁcations [AL93] explicitly states the assumption
we have termed “conventional correctness,” to whit: “The fundamental problem of composing speciﬁcations is to prove that a composite system satisﬁes its speciﬁcation if all its
components satisfy their speciﬁcation.” The paper proceeds to show how to handle the
resulting circular proof obligations. Although defensive consistency helps decouple speciﬁcations, these techniques are still relevant, so long as there may be reliance cycles.
Mario Tinto’s The Design and Evaluation of INFOSEC Systems: The Computer Secu35

rity Contribution to the Composition Discussion [Tin92] introduced the concept we have
termed “rely” as “depends on.” Tinto’s admonition to avoid “circular dependencies,” i.e.,
circular reliance relationships, implies but is stronger than our notion of defensive consistency. The two are alike only when the client-provider graph is acyclic. Tinto’s “primitivity”
corresponds to our notion of platform risk, which we both assume is acyclic. Acyclic reliance
relationships would avoid the need to resolve cyclic proof obligations.
Both Hoare and Dijkstra show preconditions and postconditions applied mainly at statement granularity. Liskov and Guttag’s Abstraction and Speciﬁcation in Program Developement [LG86] shows the synergy between this form of reasoning and the abstraction provided
by abstract data types. Bertrand Meyer’s Applying “Design by Contract” [Mey88, Mey92]
shows the further synergy when applied to object interfaces designed for reuse and polymorphism. The preconditions, postconditions, and invariants of Meyer’s contracts are predicates
written in the programming language, to be checked at runtime, sacriﬁcing static checkability to gain expressive power. Soft types [ CF91] and higher-order contracts [ FF02] extend
this technique.
When all the preconditions of an interface contract can be successfully checked at runtime, defensive consistency can often be achieved simply by considering these checks to
be non-optional parts of the program’s logic for doing input validation , rejecting (with a
thrown exception) all inputs that otherwise would have caused a precondition violation. If
clients cannot cause a precondition violation, then the provider’s obligations to meet its
postconditions is not conditional on its client’s behavior. Note that the resulting robustness
exceeds defensive consistency, since a defensively consistent provider may give incorrect
service to ill behaved clients.
The “arbitrary behaviors” we are concerned about, since they include both accident
and malice, are conventionally classiﬁed as “Byzantine faults” [ LSP82]. However, we avoid
that terminology because it is invariably associated with the problem of Byzantine fault
tolerance: How to use redundant, unreliable, and possibly malicious replicas to do a single
well-characterized job reliably [ LSP82, CL02]. If all one’s eggs are in one basket, one
should employ multiple guards to watch that basket and each other, so that an adequate
number of honest guards can mask the misbehaviors of the other guards. This reduces the
likelihood that any eggs will be lost. By contrast, the forms of defensiveness explained in
this dissertation help isolate Byzantine faults, reducing the likelihood that all eggs will be
lost. The two approaches are complementary. Ideally, robust systems should employ both.
We return to this topic brieﬂy in Related Work Sections 25.1, 25.2, and 26.8.
Defensive correctness and defensive consistency have been practiced within several communities, such as Key Logic, Inc., where much of our modern understanding of these practices originates. However, so far as we are aware, these communities explained only the
designs of systems built according to these design rules [ Har85, Lan92, Raj89, Key86],
while these design rules themselves remained unwritten lore.
We chose the term “defensive” as homage to the widespread notion of “defensive programming.” Defensive programming includes design heuristics for minimizing dependencies
and for using assertions to check assumptions at runtime. However, we have been unable to
ﬁnd any crisp statement of design rules for characterizing kinds of defensive programming.
Even without crisp design rules, pervasive practice of such ad hoc defensiveness helps systems fail fast following an accidental inconsistency. Jim Gray’s Why Do Computers Stop
and What Can Be Done About It? [Gra86] explains how to leverage such fail-fast components for robustness against software bugs. However, it is unclear how much protection
36

such ad hoc defensiveness provides against malicious inconsistencies.
To give a more plausible account of how programmers informally reason about conformance to informal (and often inarticulate) speciﬁcations, we have divided speciﬁcations
into purposes and hazards. Our notion of purpose derives from Daniel Dennett’s notion of
intent in The Intentional Stance [Den87]. As Dennett emphasizes, an artifact’s purpose is
not an objective property, but rather, a descriptive stance employed by observers for their
own purposes, and so on. Sex provides an example of how hazards depend on purposes:
When the purpose of sex is pleasure, pregnancy may be regarded as a hazard. To that
person’s genes, the purpose of sex is reproduction and condoms are a hazard. Their plans
conﬂict, not because of inconsistent assumptions, but because of conﬂicting intents.
37

38
