# Chapter 8 — Bounding Access Rights


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 75–80.

---

Chapter 8
Bounding Access Rights
Access control systems must be evaluated in part on how well they enable one to distribute
the access rights needed for cooperation, while simultaneously limiting the propagation of
rights which would create vulnerabilities. Analysis to date assumes access is controlled only
by manipulating a system’s protection state—the topology of the permission arcs that form
the access graph. Because of the limitations of this analysis, capability systems have been
“proven” unable to enforce some basic policies: selective revocation, conﬁnement, and the
*-properties (explained in subsequent chapters).
In practice, programmers build access abstractions—programs that help control access,
extending the kinds of access control that can be expressed. Working in Dennis and van
Horn’s original capability model, we show how abstractions were used in actual capability
systems to enforce the above policies. These simple, often tractable programs limit the
rights of arbitrarily complex, untrusted programs. When analysis includes the possibility of
access abstractions, the original capability model is shown to be stronger than is commonly
supposed.
Whether to enable cooperation or to limit vulnerability, we care about authority rather
than permissions. Permissions determine what actions an individual program may perform
on objects it can directly access. Authority describes the eﬀects that a program may cause
on objects it can access, either directly by permission, or indirectly by permitted interactions
with other programs. To understand authority, we must reason about the interaction of
program behavior and the arrangement of permissions. Dennis and van Horn’s 1965 paper,
Programming Semantics for Multiprogrammed Computations [DH65] clearly suggests both
the need and a basis for a uniﬁed semantic view of permissions and program behavior.
However, the security literature has reasoned about bounds on authority based only on
the potential evolution of the topology of the access graph. This assumes all programs are
hostile. While conservatively safe, this approach omits consideration of security-enforcing
programs. In practice, programmers express and implement security policy partially by
manipulating permissions and partially by writing programs. The omission of this practice
from theoretical analysis has resulted in false negatives—mistaken infeasibility results—
diverting attention from the possibility that an eﬀective access control model has existed
since 1965.
In this part, we oﬀer a new look at the original capability model proposed by Dennis and van Horn [ DH65]—here called object-capabilities. Our emphasis—which was also
their emphasis—is on expressing policy by using abstraction to extend the expressiveness
of object-capabilities. Using abstraction, object-capability practitioners have solved prob57

Figure 8.1 : Access Diagrams Depict Protection State. Here, Alice has direct access to
/etc/passwd, so she has permission to invoke any of its operations. She
accesses the object, invoking its write() operation.
lems like selective revocation (withdrawing previously granted rights), overt 1 conﬁnement
(cooperatively isolating an untrusted subsystem), and the *-properties (enabling one-way
communication between clearance levels). We show the logic of these solutions, using only
functionality available in Dennis and van Horn’s 1965 Supervisor [ DH65], hereafter referred
to as “DVH.” In the process, we show that many policies that have been “proven” impossible
are in fact straightforward.
8.1 Permission and Authority
When discussing any access control model, we must carefully distinguish between permission and authority. Our distinction between these is adapted from Bishop and Snyders
distinction between de jure and de facto information transfer [ BS79]. However, we are
concerned here with leakage of access rights rather than leakage of information.
A direct access right to an object gives a subject the permission to invoke the behavior
of that object [ Lam74]. In Figure 8.1 Alice has direct access to /etc/passwd, so she has
permission to invoke any of its operations. She accesses the object, invoking its write()
operation.
By subject we mean the ﬁnest-grain unit of computation on a given system that may
be given distinct direct access rights. Depending on the system, this could be anything
from: all processes run by a given user account, all processes running a given program, an
individual process, all instances of a given class, or an individual instance. To encourage
anthropomorphism we use human names for subjects.
By object, we mean the ﬁnest-grain unit to which separate direct access rights may be
provided, such as a ﬁle, a memory page, or another subject, depending on the system.
Without loss of generality, we model restricted access to an object, such as read-only access
to /etc/passwd, as simple access to another object whose behavior embodies the restriction,
such as access to the read-only facet of /etc/passwd which responds only to queries.
Alice can directly write /etc/passwd by calling write() when the system’s protection
state says she has adequate permission. In Figure 8.2, Bob, who does not have permission,
can indirectly write /etc/passwd so long as Alice writes there any text Bob requests her to.
When Alice and Bob arrange this relying only on the “legal” overt rules of the system, we
say Alice is providing Bob with an indirect access right to write /etc/passwd, that she is
acting as his proxy, and that Bob thereby has authority to write it. Bob’s authority derives
1 Semantic models, speciﬁcations, and correct programs deal only in overt causation. Since this dissertation examines only models, not implementations, we ignore covert and side channels. In this dissertation,
except where noted, the “overt” qualiﬁer should be assumed.
58

Figure 8.2 : Authority is the Ability to Cause Eﬀects. If 1) Bob has permission to talk
to Alice, 2) Alice has permission to write /etc/passwd, and 3) Alice chooses
to write there any text Bob asks her to, then Bob has authority to write
/etc/passwd.
from the structure of permissions (Alice’s write permission, Bob’s permission to talk to
Alice), and from the behavior of subjects and objects on permitted causal pathways (Alice’s
proxying behavior). The thin black arrows in our access diagrams depict permissions. The
ﬁlled-in portion of access matrices depict authority.
The protection state of a system is the structure of permissions at some instant in time,
i.e., the topology of the access graph [ Lam74]. Whether Bob currently has permission to
access /etc/passwd depends, by deﬁnition, only on the current topology of permissions,
i.e., on whether this permission is in the set of current permissions (CP), shown in Table 8.1.
Whether Bob eventually gains permission (EP) depends on this topology and on the state
and behavior of all subjects and objects that might cause Bob to be granted permission.
We cannot generally predict if Bob will gain this permission, but conservative bounds can
give us a reliable “no” or “maybe.”
From a given system’s update rules —rules governing permission to alter permissions—
one might be able to calculate a bound on possible future permission topologies by reasoning
only from the current topology. 2 This corresponds to Bishop and Snyder’s “potential de
jure analysis” [ BS79], and gives us a topology-only bound on permissions (TP). With more
knowledge, one can set tighter bounds. By taking into account the state and behavior of
some subjects and objects in our reliance set, we may calculate a tighter partially behavioral
bound on permissions (BP).
Bob’s eventual authority to write /etc/passwd (EA) depends on the topology of permissions, and on the state and behavior of all subjects and objects on permitted causal
pathways between Bob and /etc/passwd. One can derive a bound on possible overt causality by reasoning only from the current topology of permissions. This corresponds to Bishop
and Snyder’s “potential de facto analysis” [ BS79], and gives us a topology-only bound on
authority (TA). Likewise, by taking into account some of the state and behavior in our
reliance set, we may calculate a tighter partially behavioral bound on authority (BA).
Systems have many levels of abstraction. At any moment our frame of reference is a
boundary between a platform that creates rules and the subjects hosted on that platform,
restricted to play by those rules. By deﬁnition, a platform manipulates only permissions.
Subjects extend the expressiveness of a platform by building abstractions whose behaviors
2 The Harrison Ruzzo Ullman paper [ HRU75] is often misunderstood to say this calculation is never
decidable. HRU actually says it is possible (indeed, depressingly easy) to design a set of update rules which
are undecidable. At least three protection systems have been shown to be decidably safe [ JLS76, SW00,
MPSV00].
59

CP Current Permissions trivial unsafe
EP Eventual Permissions intractable unsafe
BP Behavior-based bound on EP interesting unsafe
TP Topology-based bound on EP easy unsafe
EA Eventual Authority intractable safe
BA Behavior-based bound on EA interesting safe
TA Topology-based bound on EA easy safe
CP ⊆ EP ⊆ BP ⊆ T P
EP ⊆ EA
BP ⊆ BA
T P ⊆ T A
EA ⊆ BA ⊆ T A
T able 8.1: Bounds on Access Rights. Let us say a policy under consideration should be
adopted if it would never allow Bob to access Carol. Given the current set
of permission arcs, CP, it is trivial to check whether Bob may directly access
Carol. But permissions-based analyses are unsafe, since they won’t reveal the
possibility of Bob obtaining indirect access. To decide, we’d need to know if
Bob would eventually gain authority to access Carol, i.e., whether Bob →Carol
would be in the resulting EA.
It is intractible to calculate EA itself since it depends on program behavior.
Fortunately, the absence of Bob →Carol from a tractable superset of EA, such
as TA or BA, implies its absence from EA. If we consult a superset that is too
large, such as TA, we’ll reject as dangerous too many policies that are actually
acceptable. BA is both safe and useful: It will never say a policy is acceptable
when it is not, and when a policy is acceptable, it will often let us know. Among
these choices, BA is the smallest safe tractable set.
60

express further kinds of limits on the authority provided to others. Taking this behavior
into account, one can calculate usefully tighter bounds on authority. As our description
ascends levels of abstraction [ NBF+80], the authority manipulated by the extensions of one
level becomes the permissions manipulated by the primitives of the next higher platform.
Permission is relative to a frame of reference. Authority is invariant. Section 11.3 and
Part IV present examples of such shifts in descriptive level.
It is unclear whether Saltzer and Schroeder’s Principle of Least Privilege [SS75] is best
interpreted as “least permission” or “least authority.” As we will see, there is an enormous
diﬀerence between the two.
8.2 Notes on Related Work
Saltzer and Schroeder’s The Protection of Information in Computer Systems [SS75] is a
wonder of clear writing and careful analysis. The design rules and criteria they propose for
the engineering of secure systems remain the yardstick of reference when discussing pros
and cons of security architectures.
Lampson’s Protection [Lam74] introduced the access matrix as a means of comparing
and contrasting access control systems. Lampson’s paper is often misinterpreted as claiming
that the only diﬀerence between Access Control Lists and Capabilities is whether the access
matrix is organized by rows or columns. Lampson’s paper actually points out several ways
in which these systems have diﬀerent protection properties. Lampson’s model was subsequently elaborated upon in Graham and Denning’s Protection — Principles and Practice
[GD72].
Harrison, Ruzzo, and Ullman’s On Protection in Operating Systems [HRU75] is not
in any way speciﬁc to operating systems, but rather applies to any access control system
that can be described in terms of Lampson’s access matrix. It emphasizes the importance
of an access control system’s update rules , the rules governing permission to change the
permissions in the matrix. This paper shows that some update rules make the calculation
of (in our terms) a topology-only bound on potential permission (TP) undecidable.
Bishop and Snyder’s The Transfer of Information and Authority in a Protection System
[BS79] was the ﬁrst to see beyond permission-based analysis. Their “potential de facto”
analysis showed that overt information transfer could be tractably bounded in capability
systems. This approach inspired our notion of authority.
Fred Spiessens, Yves Jaradin, and Peter Van Roy have developed the SCOLL tool
[SMRS04, SR05a], covered in Related Work Section 26.4, which builds on and extends
Bishop and Snyder’s “take grant” framework to derive partially behavioral bounds on potential authority (BA).
61

62
