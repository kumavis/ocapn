# Chapter 20 — Composing Complex Systems


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 165–166.

---

Chapter 20
Composing Complex Systems
In this part, we examine the practice of least authority at four major layers of abstraction—
from humans in an organization down to individual objects within a programming language.
We explain the special role of languages—such as E—which support object-granularity least
authority and defensive consistency.
In order to build systems that are both functional and robust, we ﬁrst provide programmers with foundations that combine designation with permission. We then need to provide
the tools, practices, and design patterns that enable them to align knowledge and authority.
20.1 The Fractal Locality of Knowledge
We can identify two main places where acts of designation occur: users designate actions
through the user interface, and objects designate actions by sending requests to other objects. In both places, developers already have extensive experience with supporting acts of
designation. User-interface designers have developed a rich set of user-interface widgets and
practices to support designation by users [ Yee04]. Likewise, programmers have developed a
rich tool set of languages, patterns, and practices to support designation between objects.
What the object model and object-capability model have in common is a logic that
explains how computational decisions dynamically determine the structure of knowledge in
our systems—the topology of the “knows-about” relationship. The division of knowledge
into separate objects that cooperate through sending requests creates a natural sparseness of
knowledge within a system. The object-capability model recognizes that this same sparseness of knowledge, created in pursuit of good modular design, can be harnessed to protect
objects from one another. Objects that do not know about one another directly or indirectly, and consequently have no way to interact with each other, cannot cause each other
harm. By combining designation with permission, the logic of the object-capability model
explains how computational decisions dynamically determine the structure of authority in
our systems—the topology of the “access to” relationship.
Herbert Simon argues that a hierarchic nesting of subsystems is common across many
types of complex systems [ Sim62]. “Hierarchy,” he argues, “is one of the central structural
schemes that the architecture of complexity uses.” For example, in biology, organisms are
composed of organs, which are composed of tissues, which are composed of cells. This
chapter describes software systems in terms of four major layers of abstraction: at the
organizational level systems are composed of users; at the user level, systems are composed
147

of applications; at the application level, systems are composed of modules; at the module
level, systems are composed of objects.
As Simon notes, the nesting of subsystems helps bring about a sparseness of knowledge
between subsystems. Each subsystem operates (nearly) independently of the detailed processes going on within other subsystems; components within each level communicate much
more frequently than they do across levels. For example, my liver and my kidneys in some
sense know about each other; they use chemical signals to communicate with one another.
Similarly, you and I may know about each other, using verbal signals to communicate and
collaborate with one another. On the other hand we would be quite surprised to see my
liver talk to your kidneys.
While the nesting of subsystems into layers is quite common in complex systems, it
provides a rather static view of the knowledge relationship between layers. In contrast,
within layers we see a much more dynamic process. Within layers of abstraction, computation is largely organized as a dynamic subcontracting network. Subcontracting organizes
requests for services among clients and providers. Abstraction boundaries between clients
and providers help to further reduce the knows-about relationship within systems; they
enable separation of concerns at the local level [ TM06]. Abstraction boundaries allow the
concerns of the client (why request a particular service) to be separated from the concerns
of the provider (how the service will be implemented). Abstraction boundaries, by hiding
implementation details, allow clients to ignore distractions and focus on their remaining
concerns. Similarly, abstraction boundaries protect clients from unwanted details; by denying the provider authority that is not needed to do its job, the client does not need to worry
as much about the provider’s intent. Even if the intent is to cause harm, the scope of harm
is limited.
Friedrich Hayek has argued that the division of knowledge and authority through
dynamic subcontracting relationships is common across many types of complex systems
[Hay37, Hay45, Hay64]. In particular, Hayek has argued that the system of specialization
and exchange that generates the division of labor in the economy is best understood as
creating a division of knowledge where clients and providers coordinate their plans based
on local knowledge. Diverse plans, Hayek argues, can be coordinated only based on local
knowledge; no one entity possesses the knowledge needed to coordinate all agents’ plans.
Similarly no one entity has the knowledge required to allocate authority within computer
systems according to the principle of least authority. To do this eﬀectively, the entity would
need to understand the duties of every single abstraction of the system, at every level of
composition. Without understanding the duties of each component, it is impossible to understand what would be the least authority needed for it to carry out these duties. “Least”
and “duties” can only be understood locally.
148
