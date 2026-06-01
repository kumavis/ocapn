# Chapter 11 — Conﬁnement


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 99–108.

---

Chapter 11
Conﬁnement
. . . a program can create a controlled environment within which another, possibly untrustworthy program, can be run safely. . . call the ﬁrst program a
customer and the second a service. . . . [the service] may leak, i.e., transmit
. . . the input data which the customer gives it. . . . We will call the problem of
constraining a service [from leaking data] the conﬁnement problem.
—Lampson [ Lam73]
Once upon a time, in the days before wireless, you (a human customer) could buy a box
containing a calculator (the service) from a manufacturer you might not trust. Although you
might worry whether the calculations were correct, you could at least enter your ﬁnancial
data conﬁdent that the calculator could not leak your secrets back to its manufacturer.
How did the box solve the conﬁnement problem? The air gap let you see that the box came
with no strings attached. When the only causation to worry about would be carried by
wires, the visible absence of wires emerging from the box—the isolation of the subgraph—is
adequate evidence of conﬁnement.
In this chapter, we use this same technique to achieve conﬁnement, substituting references for wires. To solve conﬁnement, assume that the manufacturer, Max, and customer,
Cassie, have mutual access to a [Factory, makeFactory] pair created by the code in Figure 11.1. Assume that Cassie relies on this pair of objects to behave according to this
code.1
The interface...guards... expression evaluates to a (trademark guard, stamp) pair
representing a new trademark, similar in purpose to an interface type. This syntax also
deﬁnes variables to hold these objects, here named Factory and FactoryStamp. We use the
FactoryStamp to mark instances of factory, and nothing else, as carrying this trademark.
We use the Factory guard in soft type declarations, like :Factory, to ensure that only
objects carrying this trademark may pass. This block of code evaluates to a [Factory,
makeFactory] pair. Only the makeFactory function of a pair can make objects, instances
of factory, which will pass the Factory guard of that pair. 2
1 Given mutual reliance in this pair, our same logic solves an important mutual defensiveness problem.
Max knows Cassie cannot “open the case”—cannot examine or modify his code.
2 Such trademarking can be implemented in DVH and in our model of object-capability computation
[Mor73a, MBTL87, TMHK95, Ree96], so object-capability systems which provide trademarking primitively
[WLH81, Har85, SSF99, YM03] are still within our model.
81

def [ Factory , makeFactory ] := {
interface Factory guards FactoryStamp {...}
def makeFactory (code :Data) :Factory {
def factory implements FactoryStamp {
to new( state ) {
return loader.load(code, state)
}
}
return factory
}
[Factory, makeFactory]
}
Figure 11.1 : Factory-based Conﬁnement. Creates a Factory guard and a makeFactory
function which will make conﬁned factories that pass this guard.
Max uses a makeFactory function to package his proprietary calculator program in a
box he sends to Cassie.
def calculatorFactory := makeFactory(" . . . code. . .")
cassie.acceptProduct(calculatorFactory)
In Figure 11.2 Cassie uses a :Factory declaration on the parameter of her acceptProduct
method to ensure that she receives only an instance of the factory deﬁnition. Inspection of
the factory code shows that a factory’s state contains only data and no other references—
no access to the world outside itself. Cassie may therefore use the factory to make as many
live calculators as she wants, conﬁdent that each calculator has only that access beyond
itself that Cassie authorizes. They cannot even talk to each other unless Cassie allows them
to.
With closed creation such as lambda evaluation, a new subject’s code and state both
come from the same parent. To solve the conﬁnement problem, we combine code from Max
with state from Cassie to give birth to a new calculator, and we enable Cassie to verify that
she is the only state-providing parent. This state is an example of Lampson’s “controlled
environment.” To Cassie, the calculator is a controlled subject —one Cassie knows is born
into an environment controlled by her. By contrast, should Max introduce Cassie to an
already instantiated calculation service, Cassie would not be able to tell whether it has
prior connectivity. (Extending our analogy, if Max oﬀers the calculation service from his
web site, no air gap would be visible to Cassie.) The calculation service would be an
uncontrolled subject to her.
We wish to reiterate that by “conﬁnement,” we refer to the overt subset of Lampson’s
problem, in which the customer accepts only code (“a program”) from the manufacturer
and instantiates it in a controlled environment. We do not propose to conﬁne information or
authority given to uncontrolled subjects. For those systems that claim, in eﬀect, to conﬁne
uncontrolled subjects, we should carefully examine whether they conﬁne authority or only
permission.
82

11.1 A Non-Discretionary Model
Capabilities are normally thought to be discretionary, and to be unable to enforce conﬁnement. Our conﬁnement logic relies on the non-discretionary nature of object-capabilities.
What does it mean for an access control system to be discretionary?
“Our discussion . . . rested on an unstated assumption: the principal that creates a ﬁle or other object in a computer system has unquestioned authority to
authorize access to it by other principals. . . . We may characterize this control
pattern as discretionary.” [emphasis in the original]
—Saltzer and Schroeder [ SS75]
Object-capability systems have no principals. A human user, together with his shell and
“home directory” of references, participates, in eﬀect, as just another subject. With the
substitution of “subject” for “principal,” we will use this classic deﬁnition of “discretionary.”
By this deﬁnition, object-capabilities are not discretionary. In our model, in DVH, and
in many actual capability system implementations, even if Alice creates Carol, Alice may
still only authorize Bob to access Carol if Alice has authority to access Bob. If capabilities
were discretionary, they would indeed be unable to enforce conﬁnement. To illustrate the
power of conﬁnement, we use it below to enforce the *-properties.
11.2 The *-Properties
Brieﬂy, the *-properties taken together allow subjects with lower (such as “secret”) clearance
to communicate to subjects with higher (such as “top secret”) clearance, but prohibit communication in the reverse direction [ PB96]. However, claims that capabilities cannot enforce
the *-properties continue [ KL86, Gon89, WBDF97, SJ03], citing [ Boe84] as their support.
To lay this matter to rest, we show how Cassie solves Boebert’s challenge problem—how
she provides a one way communication channel to subjects she doesn’t trust, say Q and
Bond, whom she considers to have secret and top secret clearance respectively. Can Cassie
prevent Boebert’s attack, in which Q and Bond use the rights Cassie provides to build a
reverse channel?
Completing our earlier conﬁnement example, Cassie accepts a calculator factory from
Max using the method shown in Figure 11.2.
Cassie creates two calculators to serve as Q and Bond. She builds a data diode by
deﬁning a writeDiode function, a readDiode function, and an assignable diode variable
they share. She gives Q and Bond access to each other only through the data diode. Applied
to Cassie’s arrangement, Boebert’s attack starts by observing that Q can send a capability
as an argument to writeDiode. A topology-only analysis of bounds on permissions (TP)
or authority (TA) supports Boebert’s case—the data diode might introduce this argument
to Bond. Only by examining the behavior of the data diode (BA) can we see the tighter
bounds it was built to enforce. It transmits data (here, integers) in only one direction
and capabilities in neither. (Q cannot even read what he just wrote.) Cassie relies on the
behavior of the factory and data diode abstractions to enforce the *-properties and prevent
Boebert’s attack. (See [ MYS03, SMRS04, SR05a] for further details.)
83

to acceptProduct( calcFactory :Factory) {
var diode :int := 0
def writeDiode (val ) { diode := val }
def readDiode () { return diode }
def q := calcFactory.new(["writeUp" => writeDiode, ...])
def bond := calcFactory.new(["readDown" => readDiode, ...])
...
}
Figure 11.2 : Cassie Checks Conﬁnement. Cassie’s acceptProduct method uses a
:Factory guard for accepting only conﬁned calculator factories from Max.
11.3 The Arena and Terms of Entry
Policies like the *-properties are generally assumed to govern a computer system as a whole,
to be enforced in collaboration with a human sys-admin or security oﬃcer. In a capability
system, this is a matter of initial conditions. If the owner of the system wishes such a policy
to govern the entire system, she can run such code when the system is ﬁrst generated, and
when new users join. But what happens once the system is already running? Let us say
Alice meets Bob, who is an uncontrolled subject to her. Alice can still enforce “additive”
policies on Bob, e.g., she can give him revocable access to Carol, and then revoke it. But
she cannot enforce a policy on Bob that requires removing prior rights from Bob, for that
would violate Bob’s security!
Instead, as we see in the example above, acting as Lampson’s “customer,” she sets
up an arena—Lampson’s “controlled environment”—with initial conditions she determines,
governed by her rules, and over which she is the sys-admin. If her rules can be enforced on
uncontrolled subjects, she can admit Bob onto her arena as a player. If her rules require the
players not to have some rights, she must set terms of entry. “Please leave your cellphones at
the door.” A prospective participant (Max) provides a player ( calcFactory) to represent
his interests within the arena, where this player can pass the security check at the gate
(here, :Factory). No rights were taken away from anyone; participation was voluntary.
The arena technique corresponds to meta-linguistic abstraction—an arena is a virtual
machine built within a virtual machine [ AS86, SS86]. The resulting system can be described
according to either level of abstraction—by the rules of the base level object-capability
platform or by the rules of the arena. The subjects built by the admitted factories are
also subjects within the arena. At the base level, we would say Q has permission to send
messages to writeDiode and authority to send integers to Bond. Shifting our frame of
reference to the arena level of description, we would say a data diode is a primitive part
of the arena’s protection state, and say Q has permission to send integers to Bond. Any
base level uncontrolled subjects admitted into the arena are devices of the arena—they have
mysterious connections to the arena’s external world.
When the only inputs to a problem are data (here, code), any system capable of universal
computation can solve any solvable problem, so questions of absolute possibility become
useless for comparisons. Conventional language comparisons face the same dilemma, and
language designers have learned to ask instead an engineering question: Is this a good
84

def q {
def gizmo (intFunc ) { ... intFunc(i) ... }
def [ writeUp2 , writeUp2Gate ] := makeMembrane(writeUp)
gizmo(writeUp2)
...
if (...) { writeUp2Gate.disable() }
...
}
Figure 11.3 : Unplanned Composition of Access Policies. Let us say that Max uses the
above text as the source code provided to the calcFactory that will build
Q. Q builds a gizmo to which he gives revocable access to the writeUp channel
which Cassie provides to him. At some later time, Q can then revoke the
gizmo’s access to this channel. Q’s policy—to limit gizmo’s access—depends
on the membrane abstraction, by which writeUp2 attenuates the authority
provided by writeUp. Cassie’s policy depends on the diode abstraction,
by which writeUp attenuates the authority provided by the diode variable.
Cassie and Max each express policies to defend their interests, and these
compose correctly without preplanning.
machine on which to build other machines? How well did we do on Boebert’s challenge?
The code admitted was neither inspected nor transformed. Each arena level subject was
also a base level subject. The behavior interposed by Cassie between the subjects was very
thin. Mostly, we reused the security properties of the base level object-capability platform
to build the security properties of our new arena level platform.
11.4 Composing Access Policies
When mutually defensive interests build a diversity of abstractions to express a diversity of
co-existing policies, how do these extensions interact?
Let us say that Q builds a gizmo that might have bugs, so Q makes a membrane to give
the gizmo revocable access to his writeDiode function, as shown in Figure 11.3. Q’s policy
relies on the behavior of his membrane but not necessarily on Cassie’s writeDiode function.
To Cassie, Q’s gizmo and membrane are part of Q’s subgraph and indistinguishable from Q.
Cassie’s policy relies on the behavior of her writeDiode function, but not on Q’s membrane.
They each do a partially behavioral analysis over the same graph, each from their own
subjective perspective. This scenario shows how diverse expressions of policy often compose
correctly even when none of the interested parties are aware this is happening.
11.5 The Limits of Decentralized Access Control
This dissertation mentions three forms of capability system: operating systems like DVH,
programming languages like the non-distributed subset of E, and cryptographic capability
protocols like Pluribus. The object-capability model we have presented applies only to the
ﬁrst two: operating systems and programming languages. Our model implicitly assumes a
85

mutually relied upon platform, which is therefore a central point of failure. In the absence
of this assumption, we are left only with cryptographic enforcement mechanisms. Cryptography by itself can only enforce weaker access control properties. In exchange, cryptography
enables us to build systems with no central points of failure.
Tamper detecting hardware with remote attestation, such as NGSCB and TPM [ A W04,
Tru02], seems to enable forms of distributed security beyond what cryptography alone
can provide. These mechanisms lower the risk of physically distributing a collection of
mutually reliant machines. However, if these machines rely on each other’s attestations,
then they each remain a central point of failure for the collection as a whole. Regarding
either robustness or security, such a collection of machines still forms a single logically
centralized platform. Between platforms unwilling to rely on each other’s attestations, we
again are left only with cryptography. By decentralized, we mean a distributed system with
no central points of failure.
11.5.1 Implications for Conﬁnement
Pluribus provides cryptographically protected inter-vat references and messages. Of course,
Pluribus cannot help any participant detect what protection mechanisms (languages, operating systems, etc.) are used internally by the platforms of the other participants, or what
causal access these other participants may have to each other. Pluribus provides only the
“by introduction” subset of the connectivity rules, since it deals only in messages. It cannot
account for object creation, so it cannot enable any participant to detect an air gap between
other participants. To each machine, all other machines are uncontrolled subjects.
Of course, any participant can claim their platform is running, for example, a trustworthy E system, and oﬀer an alleged loader over the network. Other participants may
choose which of these claims they are willing to rely on for what. In this way, the overall
E system consists of alleged object-capability islands sending messages to each other over
a cryptographic-capability sea.
For example, our discussion of conﬁnement assumed that Max and Cassie could both
rely on the same loader to provide loader isolation, and likewise with the [Factory,
makeFactory] pair built on this loader. So long as they both rely on a common platform, we may as well bundle such useful services with the platform. But in a decentralized
system, we need to be explicit about which platform’s loader is used, and who is willing
to rely on that platform for what. If Cassie is willing to rely on that loader’s platform to
provide loader isolation, and if Max is willing to submit his code to that loader, then they
can still solve the conﬁnement problem. But if Max wishes to keep his code secret, then he
would only send his code to a platform he is willing to rely on to keep this secret. If there
is no one platform that Cassie and Max are both willing to rely on, they can no longer
arrange for Cassie to use Max’s calculator code.
11.5.2 Implications for the *-Properties
The *-properties provide another illustration of cryptography’s limits. If Q, Bond, and
Cassie are three machines spread over the Internet, the only secure way for Cassie to distinguish Q from Bond is based on their knowledge of secrets. Therefore, if Q tells Bond
everything he knows, including all his private keys, then Bond can impersonate Q in every
way—Bond can be both Q and Bond. Knowledge consists only of bits. Between machines,
86

the Internet provides only a bit channel anyway. Between mutually defensive machines, it
is impossible to provide a bit channel that cannot transmit permissions, so Boebert’s attack
cannot be prevented—not by capabilities or by any other means. However, if Q and Bond
are objects running on platforms Cassie is willing to rely on, then Cassie can arrange their
separation in a manner she should also rely on.
Between mutually reliant hardware, on the one hand, and open networks protected only
by cryptography, on the other hand, there exists an intermediate option: Since bits received
on a particular physical wire must have been sent by a machine with access to that wire,
this authenticates these bits as having come from such a machine, without needing to rely
on that machine to behave correctly. The Client Utility [ KGRB01, KK02] ties the bits that
represent a capability to the channel over which the bits are received. If that channel is
authenticated by means other than a secret, such as a physical wire, then bits cannot be
used to transmit permission, since bits cannot transmit the ability to transmit on that wire.
11.5.3 Implications for Revocation
The caretaker provides another lesson on the limits of decentralized access control. If Alice,
Bob, and Carol are on three separate machines, and Alice wishes to instantiate a caretaker
to give Bob revocable access to Carol, Alice chooses where to instantiate this caretaker. By
default, she instantiates it in her own vat, in which case she can be conﬁdent in her ability
to revoke. But messages from Bob to Carol would then be routed through Alice’s machine.
Alternatively, she might use a loader exported by Carol’s vat in order to instantiate the
caretaker there. Alice already relies on Carol’s vat to prevent unauthorized access to Carol
by Bob, so Alice should also be willing to rely on Carol’s vat to host this caretaker. However,
if a network disconnect prevents Alice’s disable() message from reaching Alice’s gate on
Carol’s vat, then Bob’s authority fails to be revoked.
The object-capability model was originally created for single machine systems, where
a reference is a reliable conveyer of messages. Between machines separated by unreliable
networks, a reference can be at best a fail-stop conveyer of messages. When these messages
would exercise some authority, or when they would cause an increase in the authority of
some other object, then the failure to deliver a message is still a fail safe deviation from the
original object-capability model. However, when the message would cause a decrease in the
authority of some other object, than the failure to deliver such a message fails unsafe.
In Section 17.1, we see that a network partition would cause a
reactToLostClient(exception ) to be sent to Alice’s gate, to notify it that a
partition has occurred. To remain robust in the face of this hazard, Alice should change
her gate’s code to function as a “dead man’s switch” [ Cud99], so that it can react to her
absence:
def gate {
to enable() { enabled := true }
to disable() { enabled := false }
to reactToLostClient(ex ) { gate.disable() }
}
If Alice’s and Carol’s vats cannot communicate for longer than a built-in timeout period,
Carol’s vat will decide that a partition has occurred and notify Alice’s gate, which will then
auto-disable itself, preventing further access by Bob. Once the network heals, Section 17.1
explains how Alice can reestablish access to her gate. Alice can decide whether to re-enable
87

Bob’s access at that time. With this pattern, the timeout built into Pluribus is also the
limit on the length of time during which Bob may have inappropriate access. After this
delay, this pattern fails safe.
11.6 Notes on Related Work
The Gedanken language covered in Related Work Section 24.1 invented the “trademarking”
technique.
The factory mechanism presented in this chapter is a simpliﬁcation of the mechanisms
used to achieve conﬁnement in actual object-capability systems [ Key86, SSF99, SW00,
WT02, YM03]. Among the simpliﬁcations is that it is overly conservative: The only objects
admissable by Cassie’s entrance check ( :Factory) are instances of our factory code, which
are therefore transitively immutable. The calculator objects made by these factories derive
all their causal connectivity from Cassie.
The KeyKOS Factory [ Key86] and the EROS Constructor [ SSF99] both allow more
connectivity while remaining safe. These systems primitively provide a notion of a transitively read-only capability (“sensory” and “weak” capabilities, respectively), where an
object holding such a capability can observe state changes another can cause, but cannot
(using this capability) cause such state changes. In these systems, Max could make a calculator factory whose calculators interpret a program he can write. This allows Max to
upgrade the algorithms used by Cassie’s calculators, while still providing Cassie the assurance that the calculators cannot communicate back to Max. The KeyKOS Factory would
also allow Max to endow the factory with arbitrary capabilities as “holes,” to provide to
the new calculators in turn as part of their initial endownment. A factory would only pass
Cassie’s admission check if she approves of its holes. In KeyKOS and EROS, Cassie would
test whether the object from Max is a Factory/Contructor by testing whether it carries the
Factory brand [Har85]. Brands are essentially a rediscovery of Gedanken’s trademarking,
but with the restriction that an object can carry only one brand.
Verifying the EROS Conﬁnement Mechanism by Shapiro and Weber [ SW00] presents
the ﬁrst formal proof of overt conﬁnement in such systems.
The “*-properties” above combine the “*-property” and the “simple security property”
of the “Bell-La Padula” security model [ PB96]. Earl Boebert’s On the Inability of an
Unmodiﬁed Capability Machine to Enforce the *-property [Boe84] presents an arrangement
of capabilities set up as an example of how one might try to enforce the *-properties using
capabilities. He then demonstrates how this arrangement allows an attack which violates
the *-properties.
Responding to this challenge, Kain and Landwehr’s On Access Checking in Capability
Systems proposes several schemes to add identity-based access checks to capabilities to
prevent this attack [ KL86]. Li Gong’s A Secure Identity-based Capability System [Gon89]
explains a cryptographic protocol implementing distributed capabilities combined with such
an identity-based access check. The Secure Network Objects [vDABW96] covered brieﬂy in
Related Work Section 24.7 incorporates an identity check into their cryptographic capability
protocol. Boebert himself addressed these vulnerabilities with special hardware [ Boe03].
Vijay Saraswat and Radha Jagadeesan propose topological rules for conﬁning permissions
in object-capability systems, in order to address the vulnerabilities Boebert points out
[SJ03].
88

KeySAFE is a concrete and realistic design [ Raj89] for enforcing the *-properties on
KeyKOS, a pure object-capability operating system. The techniques presented in this chapter are an idealization of the relevant aspects of the KeySAFE design.
89

90
