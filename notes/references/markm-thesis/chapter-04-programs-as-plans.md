# Chapter 4 — Programs as Plans


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 41–46.

---

Chapter 4
Programs as Plans
In the human world, when you plan for yourself, you make assumptions about future situations in which your plan will unfold. Occasionally, someone else’s plan may interfere with
yours, invalidating the assumptions on which your plan is based. To plan successfully, you
need some sense of which assumptions are usually safe from such disruption. But you do
not need to anticipate every possible contingency. If someone does something you did not
expect, you will probably be better able to ﬁgure out how to cope at that time anyway.
When programmers write programs, they express plans for machines to execute. To
formulate such plans, programmers must also make assumptions. When separately formulated plans are composed, conﬂicting assumptions can cause the run-time situation to
become inconsistent with a given plan’s assumptions, corrupting its continued execution.
Such corrupted executions likely violate assumptions on which other programs depend, potentially spreading corruption throughout a system. To program successfully, programmers
use abstraction and modularity mechanisms to limit (usually implicitly) which assumptions
must be made, and to structure these assumptions so they are more likely to mesh without
conﬂict. Beyond these assumptions, correct programs must handle all remaining relevant
contingencies. The case analysis burden this requires must be kept reasonable, or robust
programming becomes impractical.
4.1 Using Objects to Organize Assumptions
We describe the tenets of conventional object programming practice in terms of decomposition, encapsulation, abstraction, and composition. We describe how programmers use each
of these steps to organize assumptions.
4.1.1 Decomposition
When faced with the need to write a program providing complex functionality, programmers must subdivide the problem into manageable units. Emerging from the spaghetti-code
software crisis of the 1960s [ Dij72], programmers learned to practice hierarchical decomposition [ Wir71, Mil76], dividing each task into subtasks. To oversimplify a bit, each node in
this decomposition tree was represented by a procedure which achieves its task partially by
contracting out subtasks to the procedures it calls. Programmers would seek task divisions
where the responsibilities of each procedure was clear, simple and separate.
23

With hierarchical decomposition, programmers could organize assumptions about which
procedure was supposed to achieve which purpose. But there remained the issue of what
resources each could employ in order to accomplish its purpose. Diﬀerent procedures might
manipulate common data in conﬂicting ways—the manipulations performed by one might
disrupt the assumptions of another. So long as access to common data was undisciplined,
assumptions about how the data was to be manipulated were spread throughout the code,
and could easily conﬂict.
4.1.2 Encapsulation
To avoid conﬂicting assumptions about data manipulation, programmers learned to package
code and data together into modules and abstract data types [ Par72, LZ74, LSA77]. For
uniformity, let us refer to instances of abstract data types as objects. The code of each object
still manipulates data, but the data it manipulates is now private to that object. When
writing the code of such an object—when formulating a plan for how it will use its data to
accomplish its purpose—the programmer may now assume that this data is not also being
manipulated by other potentially conﬂicting plans. This discipline enables programmers to
create systems in which a massive number of plans can make use of a massive number of
resources without needing to resolve a massive number of conﬂicting assumptions. Each
object is responsible for performing a specialized job; the data required to perform the job
is encapsulated within the object [ WBM03].
4.1.3 Abstraction
When programmers carve the functionality of a system into subtasks using only hierarchical
decomposition, each provider serves only the speciﬁc concrete purpose needed to contribute
to its one client. Instead, programmers learned to create opportunities for reuse and polymorphism [ DN66, Mey87, Mey88, GHJV94, WBM03].1 For reuse, a provider serves an
abstract purpose (the classic example is a LIFO stack) that multiple clients can employ
for multiple concrete purposes (such as parsing or reverse Polish arithmetic). The abstract
purpose is represented by an interface or type, in which the message names ( push and pop)
indicate the abstract purpose they serve. For polymorphism, multiple concrete providers
can implement the same abstract service in diﬀerent concrete ways (indexing into an array
or consing onto a linked list).
An interface designed to serve the needs of only one client will not help reuse. An interface that exposes implementation details will not help polymorphism. A well designed
interface serves as an abstraction boundary , simultaneously abstracting over the multiple
concrete reasons why a client may wish to employ this service and the multiple concrete
means by which a provider may implement this service. The interface represents the relatively thin and stable assumptions by which clients and providers coordinate their plans.
It provides the “what” (stack) that insulates the multiple “why”s of client plans (parsing,
reverse Polish arithmetic) from the multiple “how”s of provider plans (array, cons), and vice
versa, so they are freer to evolve separately without disrupting each other’s assumptions.
1 In this dissertation, we use the term “polymorphism” as it is used in the object programming literature:
for late binding of message to method, allowing for runtime substitutability of diﬀerent implementations of
the same interface. For the concept ML programmers call “polymorphism” we use the term “parameterized
types.”
24

Figure 4.1 : Composition Creates New Relationships. When Alice says bob.foo(carol),
she is Bob’s client, Bob is her provider, and Carol is an argument parameterizing Alice’s request. By passing this reference, Alice also composes Bob
and Carol, enabling Bob to be Carol’s client. Alice makes this request so that
Bob, in interacting with Carol to serve some purpose of Bob’s, will thereby
serve some other purpose of Alice’s.
Once programmers have designed the abstraction boundaries needed to carve up the
required functionality, their remaining planning problems are comparatively well separated.
Since abstract interfaces stand between client objects and provider objects, these objects
also stand between abstract interfaces. As provider, each object’s plan must be designed to
contribute not to its client’s concrete plans, but to the abstraction of these plans represented
by the interface it is charged with implementing. As client, each object’s plan should be
based not on the concrete behavior of its providers, but only on the abstraction of their
behavior represented by the provider interfaces it assumes.
4.1.4 Composition
Abstraction boundaries help separate concerns, giving composition its power.
The use of abstraction boundaries explained above motivates only relatively static clientprovider subcontracting networks. In a static reference graph, the payoﬀ from reuse would
still be clear: Parsing is very diﬀerent from reverse Polish arithmetic, so their reuse of common stack code provides a real design beneﬁt. But polymorphism would be uninteresting:
Since our example stack implementations all implement the same interface contract, they
are semantically identical and diﬀer only in eﬃciency. If all polymorphism were like our
stacks, polymorphism would be a detail rather than a major tool of good object design. If
the choice of provider were based only on eﬃciency, this decision would best be made at
design time anyway, which would not require any runtime late binding mechanism. To understand the power of polymorphism, we must see beyond static “client-provider” reasoning
when describing how objects use each other’s services.
Figure 4.1 depicts the basic step of object computation: the message send [ GK76,
HBS73, Hew77]. (To encourage anthropomorphism, we use human names for objects.)
When focusing on the foo message as requesting some service Bob provides, we may speak
of Bob as a provider, Alice as Bob’s client, and Carol as an argument, contributing meaning
to the foo request. By making this request, Alice also gives Bob access to Carol—the ability
to request whatever service Carol provides. When focusing on this aspect, we may speak
of Carol as provider, Bob as Carol’s client, and Alice as their introducer. In this latter
perspective, Alice uses the foo message to compose Bob and Carol—to set up and give
25

meaning to the client/provider relationship between Bob and Carol. This relationship has
one meaning to Bob and a diﬀerent meaning to Alice. To make this concrete, let us examine
some examples.
Higher Order F unctions Alice asks Bob to sort a list, and Carol is the comparison routine Alice wants Bob to use. As Carol’s client, Bob is perfectly happy to use whatever
comparison Carol represents. Alice chooses a comparison routine based on how she
wishes the list to be sorted.
Redirecting Output Alice asks Bob to print himself onto the output stream she provides.
As client of this stream, Bob cares only that it provides the operations he uses to render
himself. Only Alice cares where it goes, or if it computes a hash of the text rather
than going anywhere.
Visiting an Expression Tree Bob is the abstract syntax tree of an expression. Alice asks
Bob to send his components to Carol as visitor [ GHJV94]. Only Alice cares whether
Carol reacts by evaluating Bob as an arithmetic expression or by pretty printing Bob.
Regarding Bob’s purposes as client, so long as Carol implements the interface Bob
assumes of an argument of a foo message, Bob typically does not care which Carol is
chosen. He will simply proceed to make use of Carol’s services in the same way regardless.
The choice of Carol typically doesn’t aﬀect Bob, it aﬀects Alice. Alice chooses a Carol so
that Bob’s use of Carol’s services for Bob’s purposes serves some other purpose of Alice’s
[Tri93]. The abstraction boundary between Bob and Carol gives Alice this ﬂexibility. The
abstraction boundary between Alice and Bob insulates the design of Bob’s purposes from
needing to know about Alice’s purposes.
Above, we speak as if the notion of “program as plan” applies only at the granularity
of individual objects. But such microscopic plans are rarely interesting. To understand
patterns of composition, for purposes of description, we aggregate objects into composites.
This aggregation is subjective: diﬀerent aggregations are appropriate for diﬀerent descriptive purposes. The interactions between disjoint composites are much like the interactions
among individual objects and are subject to many of the same design rules.
Section 6.2 gives a simple example of a composite. The example plans in parts II and III
consist of small object patterns. Part IV examines plan coordination across several scales
of composition.
4.2 Notes on Related Work
Programs were viewed as plans quite early. The ﬁrst high level non-von Neumann programming language is Konrad Zuse’s Plankalk¨ ul language [ Zus59], invented circa 1946, to
run on one of the world’s earliest computers, Zuse’s Z3 [ Zus41]. Plankalk¨ ul means “plan
calculator.”
Herbert Simon’s The Architecture of Complexity [Sim62] explains how “nearly decomposable” hierarchies organize complexity across a broad range of natural and artiﬁcial systems. Modularity in Development and Evolution [SW04] gives a good overview of how
modularity in biology contributes to evolvability. The “Structured Programming” movement in software engineering [ Wir71, Mil76] applies similar insights for similar purposes:
26

by minimizing the dependencies between modules, each module is freer to “evolve” without
disrupting the functioning of other modules.
David Parnas’ On the Criteria to be Used in Decomposing Systems into Modules [Par72]
explains why systems decomposed along data manipulation lines often hide complexity
better than systems decomposed along chronological plan-sequence lines. The extensive
literature on abstract data types (introduced by Liskov [ LZ74]) shows how programming
languages have leveraged these observations.
Of the extensive literature on object-oriented design principles, Bertrand Meyer’s ObjectOriented Software Construction [Mey88] and Wirfs-Brock and McKean’s Object Design—
Roles, Responsibilities and Collaborations [WBM03] are particulary insightful. Design Patterns, Elements Of Reusable Object-Oriented Software [GHJV94] spawned a further extensive literature capturing, classifying, and analyzing particular arrangements making use of
these object design principles.
Abadi and Lamport’s Conjoining Speciﬁcations [AL95] distinguishes the correctness
issues which arise when decomposing a system into specialized components vs. those which
arise when composing a system from reusable components.
Our explanation of object programming owes a debt to the plan-coordination literature
in economics. Our explanation of encapsulation derives in part from Friedrich Hayek’s explanation of the plan-separation function of property rights [ Hay37, Hay45, MD88]. Division
of the society’s resources among the active entities enables the decentralized formulation of
plans, based on mostly non-conﬂicting assumptions about what resources will be at each
plan’s disposal.
Our explanation of abstraction boundaries derives in part from Ludwig Lachman’s explanations of the plan coordinating function of institutions [ Lac56, TM06]. The concept
of “post oﬃce” stands between all the reasons why people may want to mail a letter and
all the means by which delivery services may convey letters to their destinations. The abstraction boundary both separates these plans from one another’s details, and it provides
for interactions so they can usefully coordinate.
Our explanation of composition derives in part from Mark Granovetter’s visual explanations of social connectivity dynamics [ Gra73, MMF00], where new relationships form as
people introduce people they know to each other. With Granovetter’s permission, we refer
to Figure 4.1 and similar diagrams as “Granovetter diagrams.”
27

28
