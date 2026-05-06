# Chapter 22 — Macro Patterns of Robustness


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 177–182.

---

Chapter 22
Macro Patterns of Robustness
22.1 Nested Platforms Follow the Spawning Tree
The nesting of subsystems within each other corresponds to a spawning tree. The platform
of each system creates the initial population of subsystems within it, and endows each with
their initial portion of the authority granted to this system as a whole. The organization
decides what Alan’s responsibilities are, and its administrators conﬁgure Alan’s initial authorities accordingly. Doug uses CapDesk to endow CapMail with access to his SMTP
server by static conﬁguration. CapMail’s main() grants this access to its imported SMTP
module. A lambda expression with a free variable “ carol” evaluates to a closure whose
binding for “ carol” is provided by its creation context.
As we nest platforms, we accumulate the platform risk explained in Section 5.2 and in
Shockley and Schell’s TCB Subsets for Incremental Evaluation [SS87]. This layering has
the hierarchic structure that Herbert Simon explains as common to many kinds of complex
systems [ Sim62]. Mostly static approaches to POLA, such as policy ﬁles, may succeed at
mirroring this structure.
22.2 Subcontracting Forms Dynamic Networks of Authority
Among already instantiated components, we see a network of subcontracting relationships
whose topology dynamically changes as components make requests of each other. Barb ﬁnds
she needs to collaborate with Alan; or Doug selects calc.xls in an open ﬁle dialog box; or
object A passes a reference to object C as an argument in a message to object B. In all these
cases, by following capability discipline, the least authority a provider needs to perform a
request can often be painlessly conveyed along with the designations such requests must
already carry. The least adjustments needed to the topology of the access graph are often
identical to the adjustments made anyway to the reference graph.
22.3 Legacy Limits POLA, But Can be Managed Incrementally
Among the subsystems within each system, we must engineer for a peaceful co-existence of
legacy and non-legacy components. Only such co-existence enables non-legacy systems to be
adopted incrementally. For legacy components, POLA can and must be practiced without
159

modifying them—Polaris restricts the authority available to calc.xls without modifying
the spreadsheet, Excel, or Windows XP. However, we can only impose POLA on the legacy
component. We cannot enable that component to further practice POLA with the portion
of its authority it grants to others, or to sub-components of itself. Following initial adoption,
as we replace individual legacy components, we incrementally increase our safety.
22.4 Nested POLA Multiplicatively Reduces Attack Surface
The gray shown within the non-legacy boxes we did not zoom into—such as the “ ~alan”
row—represents our abstract claim that exposure was further reduced by practicing POLA
within these boxes. This claim can now be explained by the ﬁne structure shown in the
non-legacy boxes we did zoom into—such as the “ ~doug” box. Whatever fraction of the
attack surface we removed at each level by practicing POLA, these eﬀects compose to
create a multiplicative reduction in our overall exposure. Secure languages used according
to capability discipline can extend POLA to a much ﬁner grain than is normally sought.
By spanning a large enough range of scales, the remaining attack surface resembles the area
of a fractal shape which has been recursively hollowed out [ Man83]. Although we do not
yet know how to quantify these issues, we hope any future quantitative analysis of what is
practically achievable will take this structure into account.
22.5 Let “Knows About” Shape “Access To”
To build useful and usable systems, software engineers build sparse-but-capable dynamic
structures of knowledge. The systems most successful at supporting these structures—such
as object, lambda, and concurrent logic languages—exhibit a curious similarity in their
logic of designation. Patterns of abstraction and modularity divide knowledge, and then
use these designators to compose divided knowledge to useful eﬀect. Software engineering
discipline judges these patterns partially by their support for the principle of information
hiding—by the sparseness of the knowledge structures they build from these designators.
To build useful, usable, and robust general purpose systems, we must leverage these
impressive successes to provide correspondingly sparse-but-capable dynamic structures of
authority. Only authority structures aligned with these knowledge structures can both
provide authority needed for use while narrowly limiting the excess of authority available
for abuse. To structure authority in this way, we need “merely” make a natural change to
our foundations, and a corresponding natural change to our software engineering discipline.
Capability discipline judges patterns as well by their support for the principle of least
authority—by the sparseness of the authority structures they build from these permissions.
Not only is this change needed for safety, it also increases the modularity needed to provide
ever greater functionality.
An object-capability language can extend this structuring of authority down to ﬁner
granularities, and therefore across more scales, than seems practical by other means. We
have presented a proof-of-concept system—consisting of E, CapDesk, and Polaris—together
with a geometric argument, that explains an integrated approach for using such foundations to build general purpose systems that are simultaneously safer, more functional, more
modular, and more usable than is normally thought possible.
160

22.6 Notes on Related Work
The Computer Security Technology Planning Study volumes I and II [ NBF+80], also known
as “The Anderson Report,” explains why any security analysis should divide systems into
the “reference validation mechanism,” i.e., the platform which enforces the system’s access
control rules, and those programs executing on the platform, only able to perform those
accesses allowed by the reference validation mechanism. The report emphasizes that all
programs exempt from these access checks must be considered part of the reference validation mechanism, and stresses the need to keep this set very small, because of the great risks
that follow from ﬂaws in the platform. The concept of “Trusted Computing Base” (TCB)
from the Department of Defense’s Trusted Computer System Evaluation Criteria [oD85],
also known as “The Orange Book,” derives from these observations.
The Anderson Report and the Orange Book phrase their distinctions abstractly enough
that they can be applied to multiple levels of abstraction. In A Provably Secure Operating
System: The System, Its Applications, and Proofs [NBF+80], Neumann et al. explain
their architecture in terms of carefully layered abstraction levels, analyzing this layering of
mechanisms from multiple perspectives.
Shockley and Schell explain the notion of multiple layered platforms as “TCB subsets”
[SS87], and the hierarchical accumulation of platform risk. Tinto divides reliance into
“primitivity,” reﬂecting this multi-level reliance on platform, and “dependence,” reﬂecting
reliance among the modules co-existing on the same platform [ Tin92].
Scale-free Geometry in OO Programs [PNFB05] presents measurements of the distribution of incoming and outgoing degree (number of references) among objects in snapshots of
Java heaps. These measurements indicate that object connectivity is statistically fractal.
Their results are both stronger and weaker than needed to support the argument made in
this chapter. These results are stronger than we need, because the argument made here
does not require the sparseness of connectivity at diﬀerent scales to be statistically uniform; it requires only the existence of signiﬁcant sparseness across multiple scales, and that
this spareness has the hierarchic nesting structure explained by Simon’s Architecture of
Complexity [Sim62]. These results are weaker than we need, because a snapshot of actual
connectivity reﬂects only what would be current permissions (the “CP” in Table 8.1 (p. 60))
if object-capability programs have similar statistical properties, whereas we are concerned
with the structure of potential authority.
Connectivity-based Garbage Collection [HDH03] examines statically calculated conservative bounds on potential connectivity (BP). They show that connected clusters of objects
tend to become garbage together, and that even statically calculated conservative bounds
on potential connectivity can provide adequate clustering information to aid garbage collection. This provides some support for the hypothesis that statically understandable bounds
on potential authority (BA) are usefully clustered as well, although we should expect them
to be less clustered than potential permission.
161

162

Part V
Related Work
163
