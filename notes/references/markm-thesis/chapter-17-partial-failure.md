# Chapter 17 — Partial Failure


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 141–146.

---

Chapter 17
Partial Failure
Not all exceptional conditions are caused by program behavior. Networks suﬀer outages,
partitioning one part of the network from another. Machines fail: sometimes in a transient
fashion, rolling back to a previous stable state; sometimes permanently, making the objects
they host forever inaccessible. From a machine that is unable to reach a remote object, it
is generally impossible to tell which failure is occurring or which messages were lost.
Distributed programs need to be able to react to these conditions so that surviving components can continue to provide valuable and correct—though possibly degraded—service
while other components are inaccessible. If these components may change state while out of
contact, they must recover distributed consistency when they reconnect. There is no single
best strategy for maintaining consistency in the face of partitions and merges; the appropriate strategy will depend on the semantics of the components. A general purpose framework
should provide simple mechanisms adequate to express a great variety of strategies. Group
membership and similar systems [ BJ87, Ami95, Lam98] provide one form of such a general framework, with strengths and weaknesses in comparison with E. Here, we explain
E’s framework. We provide a brief comparison with mechanisms like group membership in
Section 25.1.
E’s support for partial failure starts by extending the semantics of our reference states.
Figure 17.1 shows the full state transition diagram among these states. This diagram uses
David Harel’s statechart notation [ Har88b], which combines node-arc diagrams and socalled Venn diagrams (both of which, Harel points out, were invented by Euler). On our
diagram, each bold oval represents a singleton set, containing only its named state. Each
rounded rectangle represents the set of states it spatially contains, providing a taxonomy.
A transition arrow from set X to set Y says that any of the states in set X may make the
indicated transition to any of the states in set Y . For example, given our taxonomy, when
we say “An unresolved reference may resolve to a resolved reference.” this is shorthand for
“A local promise or a remote promise may resolve to a near, far, or broken reference.”
In addition to the concepts developed in previous chapters, we have added the possibility of a vat-crossing reference—a remote promise or a far reference—getting broken by
a partition. A partition between a pair of vats eventually breaks all references that cross
between these vats, creating eventual common knowledge of the loss of connection. A partition simultaneously breaks all references crossing in a given direction between two vats. The
sender of messages that were still in transit cannot know which were actually received and
which were lost. Later messages will only be delivered by a reference if all earlier messages
sent on that same reference were already delivered. This fail-stop FIFO delivery order
123

Figure 17.1 : Reference States and Transitions. A resolved reference’s target is known.
Near references are resolved and local; they carry both immediate-calls and
eventual-sends. Promises and vat-crossing references are eventual; they carry
only eventual-sends. Broken references carry neither. Promises may resolve
to near, far or broken. Partitions break vat-crossing references.
relieves the sender from needing to wait for earlier messages to be acknowledged before
sending later dependent messages. 1
On our state-transition diagram, we see that “near” and “broken” are terminal states.
Even after a partition heals, all references broken by that partition stay broken.
In our listener example, if a partition separates the account’s vat from the spreadsheet’s
vat, the statusHolder’s reference to the spreadsheet’s listener will eventually be broken
with a partition-exception. Of the statusChanged messages sent by the statusHolder, this
reference will deliver them reliably in FIFO order until it fails. Once it fails to deliver
a message, it will never deliver any further messages and will eventually become visibly
broken.
A consequence of these semantics is that defensive consistency is preserved across partition and reconnect. A defensively consistent program that makes no provisions for partition
remains defensively consistent. A statusChanged notiﬁcation sent to a broken listener reference is harmlessly discarded.
17.1 Handling Loss of a Provider
To explicitly manage failure of a reference, an object registers a handler to be eventually
notiﬁed when that reference becomes broken. For the statusHolder to clean up broken
listener references, it must register a handler on each one.
to addListener( newListener ) {
myListeners.push(newListener)
newListener <- statusChanged(myStatus)
def handler ( ) { remove(myListeners, newListener) }
newListener <- whenBroken(handler)
}
1 The message delivery order E enforces, E-ORDER, is explained in Chapter 19. E-ORDER is stronger
than fail-stop FIFO, but fail-stop FIFO is adequate for all points we make in this chapter.
124

The whenBroken message is one of a handful of universally understood messages that all
objects respond to by default. 2 Of these, the following messages are for interacting with a
reference itself, as distinct from interacting only with the object designated by a reference.
whenBroken(handler ) When sent on a reference, this message registers its argument,
handler, to be notiﬁed when this reference breaks.
whenMoreResolved(handler ) When sent on a reference, this message is normally used so
that one can react when the reference is ﬁrst resolved. We explain this in Chapter 18.
reactToLostClient(exception ) When a vat-crossing reference breaks, it sends this
message to its target object, to notify it that some of its clients may no longer be
able to reach it. In addition to the explanation here, see also the example in Section 11.5.3.
Near references and local promises make no special case for these messages—they merely
deliver them to their targets. Objects by default respond to a whenBroken message by
ignoring it, because they are not broken. So, in our single-vat scenario, when all these
references are near, the additional code above has no eﬀect. A broken reference, on the
other hand, responds by eventual-sending a notiﬁcation to the handler, as if by the following
code:
to whenBroken(handler ) { handler <- run(thisBrokenRef) }
When a local promise gets broken, all its messages are forwarded to the broken reference;
when the whenBroken message is delivered, the broken reference will notify the handler.
A vat-crossing reference notiﬁes these handlers if it becomes broken, whether by partition
or resolution. In order to be able to send these notiﬁcations during partition, a vat-crossing
reference registers the handler argument of a whenBroken message at the tail end of the
reference, within the sending vat . If the sending vat is told that one of these references has
resolved, it re-sends equivalent whenBroken messages to this resolution. If the sending vat
decides that a partition has occurred (perhaps because the internal keep-alive timeout has
been exceeded), it breaks all outgoing references and notiﬁes all registered handlers.
For all the reasons previously explained, the notiﬁcation behavior built into E’s references only eventual-sends notiﬁcations to handlers. Until the above handler reacts, the
statusHolder will continue to harmlessly use the broken reference to the spreadsheet’s listener. Contingency concerns can thus be separated from normal operation.
17.2 Handling Loss of a Client
But what of the spreadsheet? We have ensured that it will receive statusChanged notiﬁcations in order, and that it will not miss any in the middle of a sequence. But, during
a partition, its display may become arbitrarily stale. Technically, this introduces no new
consistency hazards because the data may be stale anyway due to notiﬁcation latencies.
Nonetheless, the spreadsheet may wish to provide a visual indication that the displayed
value may now be more stale than usual, since it is now out of contact with the authoritative
source. To make this convenient, when a reference is broken by partition, it eventual-sends
a reactToLostClient message to its target, notifying it that at least one of its clients may
2 In Java, the methods deﬁned in java.lang.Object are similarly universal.
125

no longer be able to send messages to it. By default, objects ignore reactToLostClient
messages. The spreadsheet could override the default behavior:
to reactToLostClient(exception ) { . . . update display. . . }
Thus, when a vat-crossing reference is severed by partition, notiﬁcations are eventually-sent
to handlers at both ends of the reference. This explains how connectivity is safely severed
by partition and how objects on either side can react if they wish. Objects also need to
regain connectivity following a partition. For this purpose, we revisit the oﬄine capabilities
introduced in Section 7.4.
17.3 Oﬄine Capabilities
An oﬄine capability in E has two forms: a “ captp://...” URI string and an encapsulated
SturdyRef object. Both are pass-by-copy and can be passed between vats even when the vat
of the designated object is inaccessible. Oﬄine capabilities do not directly convey messages
to their target. To establish or reestablish access to the target, one makes a new reference
from an oﬄine capability. Doing so initiates a new attempt to connect to the target vat
and immediately returns a promise for the resulting inter-vat reference. If the connection
attempt fails, this promise is eventually broken.
In E, typically most inter-vat connectivity is only by references. When these break,
applications on either end should not try to recover the detailed state of all the plans in
progress between these vats. Instead, they should typically spawn a new fresh structure from
the small number of oﬄine capabilities from which this complex structure was originally
spawned. As part of this respawning process, the two sides may need to explicitly reconcile
in order to reestablish distributed consistency.
In our listener example, the statusHolder should not hold oﬄine capabilities to listeners
and should not try to reconnect to them. This would put the burden on the wrong party.
A better design would have a listener hold an oﬄine capability to the statusHolder. The
listener’s reactToLostClient method would be enhanced to attempt to reconnect to the
statusHolder and to resubscribe the listener on the promise for the reconnected statusHolder.
But perhaps the spreadsheet application originally encountered this statusHolder by
navigating from an earlier object representing a collection of accounts, creating and subscribing a spreadsheet cell for each. While the vats were out of contact, not only may this
statusHolder have changed, the collection may have changed so that this statusHolder is
no longer relevant. In this case, a better design would be for the spreadsheet to maintain
an oﬄine capability only to the collection as a whole. When reconciling, it should navigate
afresh, in order to ﬁnd the statusHolders to which it should now subscribe.
The separation of references from oﬄine capabilities encourages programming patterns
that separate reconciliation concerns from normal operations.
17.4 Persistence
For an object that is designated only by references, the hosting vat can tell when it is no
longer reachable and can garbage collect it. 3 Once one makes an oﬄine capability to a given
3 E’s distributed garbage collection protocol does not currently collect unreachable inter-vat reference
cycles. See [ Bej96] for a GC algorithm able to collect such cycles among mutually defensive machines.
126

object, its hosting vat can no longer determine when it is unreachable. Instead, this vat
must retain the association between this object and its Swiss number until its obligation to
honor this oﬄine capability expires.
The operations for making an oﬄine capability provide three options for ending this
obligation: It can expire at a chosen future date, giving the association a time-to-live. It
can expire when explicitly cancelled, making the association revocable. And it can expire
when the hosting vat incarnation crashes, making the association transient. An association
which is not transient is durable. Here, we examine only the transient vs. durable option.
A vat can be either ephemeral or persistent. An ephemeral vat exists only until it
terminates or crashes; so for these, the transient vs. durable option above is irrelevant. A
persistent vat periodically checkpoints, saving its persistent state to non-volatile storage.
A vat checkpoints only between turns when its stack is empty. A crash terminates a vatincarnation, rolling it back to its last checkpoint. Reviving the vat from checkpoint creates
a new incarnation of the same vat. A persistent vat lives through a sequence of incarnations.
With the possibility of crash admitted into E’s computational model, we can allow programs
to cause crashes, so they can preemptively terminate a vat or abort an incarnation.
The persistent state of a vat is determined by traversal from persistent roots. This state
includes the vat’s public/private key pair, so later incarnations can authenticate. It also
includes all unexpired durable Swiss number associations and state reached by traversal
from there. As this traversal proceeds, when it reaches an oﬄine capability, the oﬄine
capability itself is saved but is not traversed to its target. When the traversal reaches a
vat-crossing reference, a broken reference is saved instead and the reference is again not
traversed. Should this vat be revived from this checkpoint, old vat-crossing references will
be revived as broken references. A crash partitions a vat from all others. Following a revival,
only oﬄine capabilities in either direction enable it to become reconnected.
17.5 Notes on Related Work
Atkinson and Buneman’s Types and Persistence in Database Programming Languages
[AB87] surveys early work in persistent programming languages. The ﬁrst orthogonally
persistent languages are Smalltalk-80 [ GR83] and PS-Algol [ ACC82].
KeyKOS [Har85] is an early orthogonally persistent operating systems. KeyKOS is not
distributed. Each checkpoint is a globally consistent snapshot of the entire system image.
Nevertheless, after a crash, it still must cope with consistency issues regarding devices.
E’s separation of disconnection concerns from reconnection concerns derives directly from
KeyKOS’s handling of access to devices [ Key81, Lan92].
KeyKOS provides access to devices by device capabilities and device creator capabilities.
A user-level device driver interacts with a device using only a device capability. A revived
user-level device driver blindly continues executing the plan it was in the midst of when
last checkpointed, assuming that the device’s state is as it was then. However, this is
harmless. On revival from a checkpoint, all device capabilities are revived in a permanently
invalidated state, just as a partition in E permanently breaks all vat-crossing references.
When the device driver notices that its device capability is invalid, it asks the device creator
capability to give it a new device capability, much like an E program will ask an oﬀ-line
capability for a new reference. The plan for reconnection must determine the device’s
current state, in order to reestablish consistency between the device and its driver. The
127

plan for using the device via the device capability may then safely assume that the device’s
state follows from its own manipulations. Its ability to use that device capability lasts only
so long as these assumptions remain valid.
128
