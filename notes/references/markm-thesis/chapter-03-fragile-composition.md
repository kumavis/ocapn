# Chapter 3 — Fragile Composition


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 33–40.

---

Chapter 3
Fragile Composition
Why is it currently so hard to build large-scale robust software systems? Within today’s
dominant paradigms of composition, programmers are faced with a dilemma, which we
illustrate as the diagonal on Figure 3.1. At upper left, the price of enabling cooperative
interaction is that destructive interference is enabled as well. In reaction to the resulting
hazards, various mechanisms have been introduced into programming languages and operating systems to express and enforce perimeters that more safely separate components.
Naively applied, they also prevent cooperative interaction. Manifestations of this dilemma
appear in both access control (Figure 3.2) and concurrency control (Figures 3.3 and 13.3).
Strategies for dealing with these are the subjects of Part II and Part III of this dissertation.
As language and system designers, our goal is to help programmers move into the upper
right corner, where the interactions needed for cooperation are enabled while minimizing
the extent to which problematic interactions are thereby also enabled.
By enabling interaction , we mean to examine which subjects can cause what eﬀects on
what objects when. Conventional access control reasoning examines which subjects can
cause what eﬀects on what objects, but is mostly unconcerned with temporal issues of
when these eﬀects may be caused. (More precisely: is unconcerned with the interleaving
constraints needed to maintain consistency.) Conventional concurrency control reasoning is
concerned with temporal issues (again, in terms of controlling interleaving) of what eﬀects
might be caused on what objects when, but is mostly unconcerned with what subjects might
Figure 3.1 : Purposes and Hazards. In conventional systems, the price of enabling components to cooperate is that hazardous interactions are enabled as well. To
compose eﬀectively, we must ﬁnd ways to enable those interactions needed for
the composition’s purposes while minimizing the degree to which hazardous
interactions are thereby also enabled.
15

be able to cause these eﬀects. In this way, these two forms of reasoning are orthogonal
projections of richer underlying issues of interaction control.
3.1 Excess Authority: The Gateway to Abuse
Software systems today are vulnerable to attack. This widespread vulnerability can be
traced in large part to the excess authority we routinely grant programs [ Kar03]. In these
systems, virtually every program a user launches is granted the user’s full authority, even
a simple game program like Solitaire. While users need broad authority to accomplish
their various goals, this authority greatly exceeds what any particular program needs to
accomplish its task. All widely-deployed operating systems today—including Windows,
UNIX variants, Macintosh, and PalmOS—work on this principle.
When you run Solitaire, it only needs adequate CPU time and memory space, the
authority to draw in its window, to receive the UI events you direct at it, and to write into
a ﬁle you specify in order to save your score. The Principle of Least Authority (POLA)1
recommends that you grant each program only the authority it needs to do its job [ MS03].
If you had granted Solitaire only this limited authority, a corrupted Solitaire might be
annoying, but not a threat; it may prevent you from playing the game or lie about your
score. Instead, under conventional systems, it runs with all of your authority. It can delete
any ﬁle you can. It can scan your email for interesting tidbits and sell them on eBay to the
highest bidder. It can install a back door and use your computer to forward spam. While
Solitaire itself probably doesn’t abuse its excess authority, it could. If an exploitable bug
in Solitaire enables an attacker to gain control of it, the attacker can do anything the user
running Solitaire is authorized to do.
If Solitaire only needs such limited authority, why does it get all of your authority?
Well, what other choice do you have? Figure 3.2 shows your choices. On the one hand,
you can run Solitaire as an application. Running it as an application allows you to use all
the rich functionality and integration that current application frameworks have been built
to support, but at the price of trusting it with all your authority. On the other hand, you
can run it as an applet, granting it virtually no authority, but then it becomes isolated and
mostly useless. A Solitaire applet could not even save its score into a ﬁle you specify.
Sandboxing provides a middle ground between granting a program the user’s full authority and granting it no authority. Some approaches to sandboxing [ GMPS97, Gon99, PS01]
enable you to conﬁgure a static set of authorities (as might be represented in a policy ﬁle)
to be granted to the program when it is launched. The problem is that you often do not
know in advance what authorities the program actually needs: the least authority needed
by the program changes as execution progresses [ Sch03].
In order to successfully practice POLA, we need to take a diﬀerent approach. Rather
than trading security for functionality, we need to limit potential abuse without interfering
with potential use. How far out might we move on the horizontal axis without loss of
functionality or usability? Least authority, by deﬁnition, includes adequate authority to
get the job done. Providing authority that is adequate means providing it in the right
amount and at the right time. The key to putting POLA into practice lies in the dynamic
allocation of authority; we must provide the right amount of authority just-in-time, not
1 POLA is related to Saltzer and Schroeder’s Principle of Least Privilege [SS75]. However, it is not clear
precisely what they meant by “privilege.” Section 8.1 explains what we mean by “authority.”
16

Figure 3.2 : Functionality vs. Security? Conventional access control systems force a tradeoﬀ between statically granting a program enough authority to do anything
it might need to do versus denying it authority it could use to cause harm.
By granting authority dynamically as part of the request, we can provide just
that authority needed for that request. Since “least authority” includes adequate authority, least authority is as high on the vertical axis as needed for
the requested functionality. The horizontal line with the question mark represents the design question: How much safety may we achieve without loss of
functionality?
excess authority just-in-case.
3.2 How Much Authority is Adequate?
How do we know how much authority a program actually needs? Surprisingly, the answer
depends on architectural choices not normally thought to be related to security—the logic
of designation. Consider two Unix shell commands for copying a ﬁle. In the following
example, they both perform the same task, copying the ﬁle foo.txt into bar.txt, yet they
follow very diﬀerent logics of designation in order to do so. The result is that the least
authority each needs to perform this task diﬀers signiﬁcantly.
Consider how cp performs its task:
$ cp foo.txt bar.txt
Your shell passes to the cp program the two strings "foo.txt" and "bar.txt". The cp
program uses these strings to determine which ﬁles it should copy.
By contrast consider how cat performs its task:
$ cat < foo.txt > bar.txt
Your shell uses these strings to determine which ﬁles you mean to designate. Once these
names are resolved, your shell passes direct access to the ﬁles to cat, as open ﬁle descriptors.
The cat program uses these descriptors to perform the copy.
Now consider the least authority that each one needs to perform its task.
With cp, you tell it which ﬁles to copy by passing it strings. By these strings, you mean
particular ﬁles in your ﬁle system, to be resolved using your namespace of ﬁles. In order for
cp to open the ﬁles you name, it must already have the authority to use your namespace,
and it must already have the authority to read and write any ﬁle you might name. Given
17

this way of using names, cp’s least authority still includes all of your authority to the ﬁle
system. The least authority it needs is so broad as to make achieving either security or
reliability hopeless.
With cat, you tell it which ﬁles to copy by passing it the desired (read or write) access
to those two speciﬁc ﬁles. Like the cp example, you still use names in your namespace to
say which ﬁles you wish to have cat copy, but these names get evaluated in your namespace
prior to being passed to cat. By passing cat ﬁle descriptors rather than strings to convert
to descriptors, we reduce the authority it needs to do its job. Its least authority is what
you’d expect—the right to read your foo.txt and the right to write your bar.txt. It needs
no further access to your ﬁle system.
Currently under Unix, both cp and cat, like Solitaire, run with all your authority. But
the least authority they require to copy a ﬁle diﬀers substantially. Today’s widely deployed
systems use both styles of designation. They grant permission to open named ﬁles on a peruser basis, creating dangerous pools of excess authority. These same systems dynamically
grant an individual process access to a resolved ﬁle descriptor on a per-invocation basis.
Ironically, only their support for the “ cp” style is explained as their access control system.
Shells supporting narrow least authority [ Sea05] diﬀer from conventional systems more by
the elimination of the “ cp” style than by the elaboration of the “ cat” style.
Following Carl Ellison’s usage [ Ell96], we refer to the “ cp” style of designation as “namecentric” and the “ cat” style as “key-centric.” In name-centric systems, names are generally
assumed to be human readable, like the ﬁlenames in our cp example or DNS names in Ellison’s. Name-centric systems pass names to communicate designations, requiring a shared
namespace. In key-centric systems, keys are opaque and unambiguous, like the ﬁle descriptors in our cat example or cryptographic keys in Ellison’s. Key-centric systems pass keys
to communicate designations. In key-centric systems, names are bound to keys in namespaces local to each participant, such as the user’s ﬁle system in our example. We return
to Ellison’s distinction in the related work section at the end of this chapter.
Programming languages based on lexical naming [ Chu41] and references (including object [ GK76, HBS73], lambda [ KCR98, Mil84], and concurrent logic [ Sha83, Sar93, RH04]
languages) generally follow the key-centric style, combining designation and access as suggested by the cat example above. Names are evaluated in their caller’s namespace to a
value, such as a reference to an object, which is then passed as an argument to the callee.
The callee doesn’t know or care what the caller’s name for this reference is. By passing this
reference as a particular argument of a particular call, the caller both tells the callee what
object it wishes the callee to interact with as part of this request, and provides the callee
the ability to interact with this object. The changes to these languages needed to support
least authority consist more of eliminating their support for the name-centric designation
rather than elaborating their support for the key-centric designation. Besides E, in related
work (Part V), we visit several other examples of such languages.
3.3 Shared-State Concurrency is Diﬃcult
The diagonal on Figure 3.3 reﬂects common anecdotal experience when programming in the
dominant concurrency control discipline: shared-state concurrency [ RH04] (also described
as shared memory multi-threading with ﬁne grained locking). Correct programs must both
avoid deadlock and preserve their own consistency. Within the shared-state concurrency
18

Figure 3.3 : Progress vs. Consistency? In the presence of concurrency, correct programs
must prevent those interleavings which threaten consistency while allowing all
those needed for progress. In practice, the conventional approach of making
components “thread-safe” forces a tradeoﬀ between conﬁdence that consistency is maintained versus conﬁdence that progress will continue. The eventloop style allows both requirements to be met with conﬁdence.
control discipline, it is certainly possible to write such thread-safe programs, and there are
many beautiful small examples of such programs. However, the more common experience,
especially when composing large systems, is that this discipline forces programmers to make
a tradeoﬀ between bad choices [ RH04, Lee06, Ous96].
For a programmer to be conﬁdent that a program’s consistency is preserved, the program
must lock often enough to exclude all interleavings which threaten consistency. It is often
diﬃcult to be conﬁdent that such programs are deadlock-free. In a program stingy enough
with locking to be conﬁdent that it is deadlock-free, it is often diﬃcult to be conﬁdent in its
continued consistency. Errors in this style of programming have provided fertile ground for
demonstrating the value of static checking [ EA03]. To understand this dilemma, Part III
ﬁrst presents the StatusHolder, a composable abstraction that is properly considered trivial among sequential object programmers. It then attempts, by successive reﬁnement, to
develop a thread-safe StatusHolder that is robustly composable under shared-state concurrency. Figure 13.3 (p. 101) shows the results of our exploration.
We will argue that an alternative discipline, communicating event loops [ HBS73, Agh86,
DZK+02, ZYD+03], provides a framework in which programmers can straightforwardly
write programs that are both consistency-preserving and deadlock-free. Although well
known and at least as old as shared-state concurrency, communicating event-loops have
received a minute fraction of the linguistic support which has been invested in shared-state
concurrency. We hope the present work helps repair this imbalance.
3.4 Why a Uniﬁed Approach?
Even if access control and concurrency control are distinct projections of more general issues
of interaction control, by itself this does not establish the need to address the more general
issues in a uniﬁed way. Indeed, if all interaction control sub-problems can be cast either as
pure access control problems or pure concurrency control problems, then keeping these two
forms of reasoning separate would constitute a better separation of concerns.
We close Part III on page 137 with a counter-example to such separation: the rationale
for E’s default distributed message delivery order, which we call E-ORDER. There is a
conventional spectrum of distributed message delivery order guarantees. This spectrum
19

includes the consecutive sequence: UNORDERED ≤ FIFO ≤ CAUSAL ≤ AGREED
[Ami95, Bir05]. Unfortunately, CAUSAL and stronger orders are too strong to be enforced
among mutually defensive machines; FIFO and weaker orders allow a race condition which
violates a desirable access control property. E-ORDER, which is stronger than FIFO and
weaker than CAUSAL (FIFO ≤ E-ORDER ≤ CAUSAL), satisﬁes all our constraints
simultaneously. We arrived at this design choice only by thinking of access control issues and
concurrency control issues together, in terms of using references to control the propagation
of causality through the reference graph.
3.5 Notes on Related Work on Designation
This distinction between the two styles of designation explained above has intriguing parallels in the philosophy literature contrasting two perspectives on naming. In Naming and
Necessity [Kri80], Saul Kripke reacts against Bertrand Russell’s suggestion that names be
regarded as “compact descriptions,” arguing instead that names should be regarded as “rigid
designators.” Russell’s “compact descriptions” are similar in some ways to the widely shared
names of name-centric systems. Kripke’s “rigid designators” are similar in some ways to
the keys of key-centric systems. In other ways, Kripke’s rigid designators are like the local
names which are bound to keys. Kripke’s causal account of how designations come to be
shared is based on acts of pointing and communication, which have intriguing analogs to
our notions of object creation, invocation, and argument passing.
Although it has long been understood that capabilities bundle designation with permission [ Lev84], Norm Hardy’s The Confused Deputy [Har88a] was the ﬁrst to explain why
these need to be bundled, and to point out other dangers that follow from their separation—
dangers beyond the excess authority hazards explained above.
Carl Ellison’s Establishing Identity Without Certiﬁcation Authorities [Ell96] contrasts
these two naming philosophies as applied to the Internet as a whole. He shows how the
Domain Name System and conventional uses of X509 certiﬁcates are name-centric: These
systems attempt to create an Internet-wide shared hierarchical namespace of human meaningful names, like a conventional ﬁle system writ large. He contrasts this with key-centric
systems like SDSI/SPKI [ EFL+99], in which opaque cryptographic keys are the only globally meaningful designators, and all use of human readable names is rooted in the local
naming environment of the entity employing the name. SDSI/SPKI is an oﬄine certiﬁcatebased system. As with ﬁle systems or DNS names, human readable names are actually
naming paths, for traversing paths through a graph starting at some root. However, in
key-centric systems like SDSI/SPKI, the root at which this traversal starts is each participant’s own local namespace. The Client Utility architecture covered in Related Work
Section 25.6 included an online protocol that also used locally rooted path-based names.
In these key-centric systems, as in our cat example, humans use human readable names to
securely designate.
Marc Stiegler’s An Introduction to Petname Systems [Sti05] explains phishing as the
inverse problem: How may designations be communicated to humans as human readable
names, in a manner resistant to both forgery and mimicry? Our vulnerabilities to phishing
are due to the name-centric nature of the Domain Name System. Stiegler explains Tyler
Close’s realization that petname systems extend key-centric systems in a phishing resistant
fashion. The local namespace of most key-centric systems provides a many-to-one map20

ping of names to keys. The inverse problem requires mapping keys back to names. The
local namespaces of petname systems provide this backwards mapping. Close’s “Petname
tool” [ Clo04a] and Ka-Ping Yee’s “Passpet” are browser extensions for phishing resistant
browsing. Stiegler’s own CapDesk [ WT02, SM02] and Polaris [ SKYM04], which we explain
brieﬂy in Part IV, use petnames for secure window labeling of conﬁned applications.
Global namespaces create intractable political problems. Froomkin’s Toward a Critical
Theory of Cyberspace [Fro03] examines some of the politics surrounding ICANN. In a world
using key-centric rather than name-centric systems, these intractable political problems
would be replaced with tractable technical problems.
21

22
