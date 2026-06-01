# Chapter 21 — The Fractal Nature of Authority


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 167–176.

---

Chapter 21
The Fractal Nature of Authority
The access matrix model [ Lam74, GD72] has proven to be one of the most durable abstractions for reasoning about access control in computational systems. An access matrix,
such as Level 1 of Figure 21.2, provides a snapshot of the access relationships of a particular system. It shows the rights (the ﬁlled-in cells) that active entities (or “subjects,”
assigned to the rows) have with respect to protected resources (or “objects,” assigned to
the columns). While not designed for reasoning about authority, we adapt the access matrix model to show how the consistent application of POLA across levels can signiﬁcantly
reduce the ability of attackers to exploit vulnerabilities. We show how POLA applied at the
four major layers of abstraction—from humans in an organization down to individual objects within a programming language—can achieve a multiplicative reduction in a system’s
overall vulnerability.
The access matrix is normally used to depict only current permissions. Since we wish
to reason about our overall exposure to attack, we use access matrices to depict potential
authority. When we wish to speak speciﬁcally about the structure of permissions, we will
instead use access diagrams in which permissions are shown as arcs of the graph.
Howard, Pincus and Wing [ HPW03] have introduced the notion of an attack surface as a
way to measure, in a qualitative manner, the relative security of various computer systems.
This multi-dimensional metric attempts to capture the notion that system security depends
not only on the number of speciﬁc bugs found, but also on a system’s “process and data
resources” and the actions that can be executed on these resources. These resources can
serve as either targets or enablers depending on the nature of the attack. Attackers gain
control over the resources through communication channels and protocols; access rights
place constraints on which resources can be accessed over these channels.
They deﬁne the attack surface of a system to be the sum of the system’s attack opportunities. An attack is a means of exploiting a vulnerability. Attack opportunities are
exploitable vulnerabilities in the system weighted by some notion of how exploitable the
vulnerability is. By treating exploitability not just as a measure of the likelihood of a particular exploit occurring, but as a measure of the extent of damage that can occur from a
successful attack, we can gain insight into the role least authority can play in reducing a
system’s attack surface.
We can use the area of the cells within the access matrix to visualize, in abstract,
the attack surface of a system. Imagine that the heights of the rows were resized to be
proportional to the likelihood that each actor could be corrupted or confused into enabling
an attack, as shown in Figure 21.1. Imagine that the widths of the columns were resized to
149

Figure 21.1 : Attack Surface Area Measures Risk. In an access matrix, each row represents
an active entity (“subject”) that is given rights, shown as ﬁlled-in cells, to
access various resources (“objects” or “assets”), assigned to columns. To
measure risk, make each row height be the probability that its subject is
corruptible, each column width the damage that could be caused by abusing
that resource, and ﬁll in a cell when its subject has authority over its resource.
be proportional to the damage an attacker with authority to that asset could cause. Our
overall attack surface may, therefore, be approximated as the overall ﬁlled-in area of the
access matrix. We do not show such resizing, as the knowledge needed to quantify these
issues is largely inaccessible.
By taking this perspective and combining it with Simon’s insight that complex systems
are typically organized into nested layers of abstractions, we can now show how applying
POLA to each level can multiplicatively reduce the attack surface of a system. We show
how the same nesting of levels of abstraction, used to organize system functionality, can be
used to organize the authority needed to provide that functionality.
We now take a tour through four major levels of composition of an example system:
1. Among the people within an organization
2. Among the applications launched by a person from their desktop
3. Among the modules within an application
4. Among individual language-level objects
Within this structure, we show how to practice POLA painlessly at each level, and how
these separate practices compose to reduce the overall attack surface.
Some common themes will emerge in diﬀerent guises at each level:
• The relatively static nesting of subsystems
• The dynamic subcontracting networks within each subsystem
• The co-existence of legacy and non-legacy components
• The limits placed on POLA by platform risk and by legacy code
150

Figure 21.2 : Barb’s Situation. Conventional access control systems are only built to restrict access at one level of composition, such as between accounts under an
operating system. The large black rectangle in Level 2a is not a printing error. Since Barb runs programs under her account in a conventional manner,
all the assets entrusted to Barb are at risk to the misbehavior of any of her
programs. All are central points of failure for Barb. The distinction between
gray and black areas will be explained in Section 22.4.
21.1 Human-Granularity POLA in an Organization
When an organization is small, when there is little at stake, or when all an organization’s
employees are perfectly incorruptible and non-confusable, the internal distribution of excess authority creates few vulnerabilities. Otherwise, organizations practice separation of
responsibilities, need to know, and POLA to limit their exposure.
The box labeled “Level 1” in Figure 21.2 uses the access matrix to visualize how conventional operating systems support POLA within a human organization. Alan (the “ ~alan”
account) is given authority to access all of Alan’s stuﬀ, and likewise with Barb and Doug.
In addition, because Barb and Alan are collaborating, Barb gives Alan authority to access
some of her stuﬀ. The organization should give Alan those authorities needed for him to
carry out his responsibilities. This can happen in both a hierarchical manner (an administrator determining which of the organization’s assets are included in “Alan’s stuﬀ”) and
a decentralized manner (by Barb, when she needs to collaborate with Alan on something)
[AB95]. If an attacker confuses Alan into revealing his password, the assets the attacker
can then abuse are limited to those entrusted to Alan. While better training or screening
may reduce the likelihood of an attack succeeding, limits on available authority reduce the
damage a successful attack can cause.
To the traditional access matrix visualization, we have added a row representing the
platform, and a column, labeled /etc/passwd, which stands for resources which are eﬀectively part of the platform.
151

21.2 Application-Granularity POLA on the Desktop
With the exception of such platform risk, organizations have wrestled with these issues
since long before computers. Operating system support for access control evolved largely in
order to provide support for the resulting organizational practices [ MS88]. Unfortunately,
conventional support for these practices was based on a simplifying assumption that left
us exposed to viruses, worms, Trojan horses, spyware, and the litany of problems that
currently infest our networks. The simplifying assumption? When Barb runs a program to
accomplish some goal, such as by launching calc.xls, an Excel spreadsheet, conventional
systems assume the program is a perfectly faithful extension of Barb’s intent. But Barb
didn’t write Excel or calc.xls.
Zooming in on Level 1 brings us to Level 2a (Figure 21.2), showing the conventional
distribution of authority among the programs Barb runs—they are all given all of Barb’s
authority. If Excel is corruptible or confusable—if it contains a bug allowing an attacker
to subvert its logic for the attacker’s purposes, then anything Excel may do, the attacker
can do. The attacker can abuse all of Barb’s authority—sending itself to her friends and
deleting her ﬁles—even if her operating system, her administrator, and Barb herself are
operating ﬂawlessly. Since all the assets entrusted to Barb are exposed to exploitable ﬂaws
in any program she runs, all her programs are central points of failure for her, and for all
assets entrusted to her. If Barb enables macros, even her documents, like calc.xls, would
be a central point of failure for her. How can Barb reduce her exposure to the programs
she runs?
Good organizational principles apply at many scales of organization. If the limited
distribution of authority we saw in Level 1 is a good idea, can we adopt it at this level as
well?
Level 2b (Figure 21.3) is at the same “scale” as Level 2a, but depicts Doug’s situation rather than Barb’s. Like Barb, Doug launches various applications interactively from
his desktop. Unlike Barb, let us say Doug runs his desktop and these applications in
such a way as to reduce his exposure to their misbehavior. One possibility would be
that Doug runs a non-conventional operating system that supports ﬁner-grained POLA
[DH65, Har85, SSF99]. In this chapter, we explore a surprising alternative—the use of
language-based security mechanisms such as those provided by E. We will explain how
Doug uses CapDesk and Polaris to reduce his exposure while still running on a conventional
operating system. But ﬁrst, it behooves us to be clear about the limits of this approach. In
our story, we combine the functionality of CapDesk and Polaris, though they are not yet
actually integrated. (Integrating CapDesk’s protection with that provided by an appropriate secure operating system would yield yet further reductions in exposure, but these are
beyond the scope of this dissertation.)
CapDesk [ SM02] is a capability-secure distributed desktop written in E, for running
caplets—applications written in E to be run under CapDesk. CapDesk is the user’s graphical
shell, turning a user-interface action into a request to a caplet, carrying a reference saying
what object the caplet should operate on. As with the cat example in Section 3.2, these
requests also convey the permission to operate on this object. For legacy applications like
Excel, CapDesk delegates their launching to Polaris [ SKYM04]. Like cp, Excel needs to run
with all the authority of its user’s account. Polaris creates and administers separate user
accounts for this purpose, each of which starts with little authority. CapDesk has Polaris
launch Excel in one of these accounts, and dynamically grant to this account the needed
152

Figure 21.3 : Doug’s Situation. Doug uses CapDesk and Polaris to reduce the damage
his programs may cause to the assets entrusted to him. Polaris restricts
authority one more level to protect against legacy applications. CapDesk,
together with caplets written in E, enables restrictions on authority at every
level of composition down to individual objects.
153

portion of the actual user’s authority.
CapDesk is the program Doug uses to subdivide his authority among these applications.
To do this job, CapDesk’s least authority is all of Doug’s authority. Doug launches CapDesk
as a conventional application in his account, thereby granting it all of his authority. Doug
is no less exposed to a ﬂaw in CapDesk than Barb is to a ﬂaw in each application she runs.
CapDesk is part of Doug’s platform, and is therefore a central point of failure for Doug; but
the programs launched by CapDesk are not.
CapDesk does not aﬀect Doug’s vulnerability to Barb. Doug is no more or less exposed
to an action taken by Barb, or one of her applications, than he was before. If the base
operating system does not protect his interests from actions taken in other accounts, then
the whole system is a central point of failure for him. Without a base operating system
that provides foundational protection, no signiﬁcant reduction of exposure by other means
is possible. So, let us assume that the base operating system does provide eﬀective peraccount protection. For any legacy programs that Doug installs or runs in the conventional
manner—outside the CapDesk framework—Doug is no less exposed than he was before. All
such programs remain central points of failure for him. If the “ ~doug” account is corrupted
by this route, again, CapDesk’s protections are for naught.
However, if the integrity of “ ~doug” survives these threats, Doug can protect the assets
entrusted to him from the programs he runs by using CapDesk + Polaris to grant them
least authority. This granting must be done in a usable fashion—unusable security won’t
be used, and security which isn’t used doesn’t protect anyone. As with cat, the key to
usable POLA is to bundle authority with designation [ Yee02, Yee04]. To use Excel to edit
calc.xls, Doug must somehow designate this ﬁle as the one he wishes to edit. This may
happen by double-clicking on the ﬁle, by selecting it in an open ﬁle dialog box, or by dragand-drop. The least authority Excel needs includes the authority to edit this one ﬁle, but
typically not any other interesting authorities. Polaris runs each legacy application in a
separate account which initially has little authority. Doug’s act of designation dynamically
grants Excel’s account the authority to edit this one ﬁle. Polaris users regularly run with
macros enabled, since they no longer live in fear of their documents.
21.3 Module-Granularity POLA Within a Caplet
Were we to zoom into Doug’s legacy Excel box, we’d ﬁnd that there is no further reduction
of authority within Excel. All the authority granted to Excel as a whole is accessible to
all the modules of which Excel is built, and to the macros in the spreadsheets it runs.
Each is a central point of failure for all. Should the math library’s sqrt function wish to
overwrite calc.xls, nothing will prevent it. At this next smaller scale we’d ﬁnd the same
full-authority picture depicted in Level 2a.
Caplets running under CapDesk do better. The DarpaBrowser is a web browser caplet,
able to use a potentially malicious plug-in as a renderer. Although this is an actual example,
the DarpaBrowser is “actual” only as a proof of concept whose security properties have
been reviewed [ WT02]—not yet as a practical browser. We will instead zoom in to the
hypothetical email client caplet, CapMail. All the points we make about CapMail are
also true for the DarpaBrowser, but the email client makes a better expository example.
Of the programs regularly run by normal users—as opposed to system administrators or
programmers—the email client is the worst case we’ve identiﬁed. Its least authority includes
154

Figure 21.4 : Level 4: Object-granularity POLA. In the object paradigm, objects only obtain access to each other dynamically, on an as-needed basis, by the passing
of references. By removing other causal pathways, permission follows designation. By building frameworks and adopting programming styles at each
level of composition that leverages these properties, authority structures can
also be made to follow knowledge structures.
a dangerous combination of authorities. Doug would grant some of these authorities—like
access to an SMTP server—by static conﬁguration, rather than dynamically during each
use.
When Doug decides to grant CapMail these authorities, he is deciding to rely on the
authors of CapMail not to abuse them. However, the authors of CapMail didn’t write every
line of code in CapMail—they reused various reusable libraries written by others. CapMail
should not grant its math library the authority needed to read your address book and send
viruses to your friends.
Zooming in on the bottom row of Level 2b brings us to Level 3. A caplet has a startup
module that is the equivalent of the C or Java programmer’s main() function. CapDesk
grants to this startup module all the authority it grants to CapMail as a whole. If CapMail is written well, this startup module should do essentially nothing but import the top
level modules constituting the bulk of CapMail’s logic, and grant each module only that
portion of CapMail’s authority that it needs during initialization. This startup module is
CapMail’s platform—its logic brings about this further subdivision of initial authority, so
all the authority granted to CapMail as a whole is vulnerable to this one module.
When a CapMail user launches an executable caplet attachment, CapMail could ask
CapDesk to launch it, in which case the attachment would only be given the authority the
user grants by explicit actions. CapMail users would no longer need to fear executable
attachments. (The DarpaBrowser already demonstrates equivalent functionality for downloaded caplets.)
21.4 Object-Granularity POLA
At Level 3, we again see the co-existence of boxes representing legacy and non-legacy.
For legacy modules, we’ve been using a methodology we call “taming” to give us some
conﬁdence, under some circumstances, that a module doesn’t exceed its proper authority
[SM02, WT02]. Again, for these legacy boxes, we can achieve no further reduction of
exposure within the box. Zooming in on a legacy box would again give a picture like Level
2a. Zooming in on a non-legacy box gives us our ﬁnest scale application of these principles—
at the granularity of individual programming language objects (Figure 21.4). These are the
155

indivisible particles, if you will, from whose logic our levels 2 and 3 were built.
21.5 Object-Capability Discipline
Good software engineering Capability discipline
Responsibility driven design Authority driven design
Omit needless coupling Omit needless vulnerability
assert(..) preconditions Validate inputs
Information hiding Principle of Least Authority
Designation, need to know Permission, need to do
Lexical naming No global namespaces
Avoid global variables Forbid mutable static state
Procedural, data, control, . . . . . . and access abstractions
Patterns and frameworks Patterns of safe cooperation
Say what you mean Mean only what you say
T able 21.1: Security as Extreme Modularity. On the left we list various well known tenets
of good object-oriented software engineering practice. On the right, we list
corresponding tenets of good capability discipline. In all cases, the capabilityoriented tenet is an extreme form of its object-oriented counterpart. Anecdotal
reports of those with experience at capability discipline is that they ﬁnd it a
useful practice even when security is of no concern, since it leads to more
modular systems.
Knowing the rules of chess is distinct from knowing how to play chess. The practice
of using these rules well to write robust and secure code is known as capability discipline.
Some of the tenets of capability discipline are listed in Table 21.1. Capability discipline is
mostly just an extreme form of good modular software engineering practice. Of the people
who have learned capability discipline, several have independently noticed that they ﬁnd
themselves following capability discipline even when writing programs for which security is
of no concern. They ﬁnd that it consistently leads to more robust, modular, maintainable,
and composable code.
This completes the reductionist portion of our tour. We have seen many issues reappear
at each level of composition. Let us zoom back out and see what picture emerges.
21.6 Notes on Related Work
Howard, Pincus and Wing’s Measuring Relative Attack Surfaces [HPW03] introduced the
spatial “measure” of a system’s vulnerability that inspired the analysis presented in this
chapter.
Ka-Ping Yee’s User Interaction Design for Secure Systems [Yee02] and Aligning Security
and Usability [Yee04] presents many principles of secure user interface design. He explains
how the user’s acts of designation, such as selecting a ﬁlename in an open ﬁle dialog box,
can also be used to convey narrow least authority.
156

A Capability Based Client: The DarpaBrowser by Marc Stiegler and Mark S. Miller
[SM02] summarizes our work on E, CapDesk, and the DarpaBrowser. CapDesk and the
DarpaBrowser implemented eight of Yee’s ten principles of secure usability [ Yee02].
David Wagner and E. Dean Tribble’s A Security Analysis of the Combex DarpaBrowser
Architecture [WT02] reports on the many vulnerabilities they found in our work, and explains the implications of these vulnerabilities.
Polaris: Virus Safe Computing for Windows XP [SKYM04] explains how some of the
principles demonstrated by CapDesk are being applied to limit the authority of legacy applications running on a legacy operating system, without modifying either the applications
or the operating system.
157

158
