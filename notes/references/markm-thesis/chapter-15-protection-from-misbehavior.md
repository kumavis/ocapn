# Chapter 15 — Protection from Misbehavior


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 131–134.

---

Chapter 15
Protection from Misbehavior
15.1 Can’t Just Avoid Threads by Convention
When using a language that supports shared-state concurrency, one can choose to avoid it
and adopt the event-loop style instead. Indeed, several Java libraries, such as A WT, were
initially designed to be thread-safe, and were then redesigned around event-loops. Using
event-loops, one can easily write a Java class equivalent to our makeStatusHolder. Under
cooperative assumptions, it is indeed adequate to avoid shared-state concurrency merely by
careful convention.
Such avoidance-by-convention is even adequate for inter-vat defensive consistency. Even
if remote clients of the statusHolder spawn threads in their own vat, they can still only
eventual-send messages to the statusHolder. These messages are queued and eventually
delivered in the statusHolder’s vat thread, insulating it from concern with the internal
concurrency decisions of remote vats. For this case, statusHolder relies on its platform only
to prohibit inter-vat immediate calls.
However, for object-granularity defensive consistency, it is inadequate to avoid threads
merely by convention. A defensively consistent statusHolder must assume that its local
clients might spawn threads if they can, and might then immediate-call it from one of
these threads. As we have shown, defensive consistency in the face of multi-threading is
unreasonably diﬃcult. To relieve statusHolder’s programmer of this burden, statusHolder’s
reliance set must prevent local clients from spawning threads.
E simply prevents all spawning of threads within the same vat. Each local E vat implementation is the platform for the objects it hosts, and therefore part of their reliance set.
These objects can validly rely on their local E platform to prevent multi-threading.
15.2 Reify Distinctions in Authority as Distinct Objects
Our statusHolder itself is now defensively consistent, but is it a good abstraction for the
account manager to rely on to build its own defensively consistent plans? In our example
scenario, we have been assuming that the account manager acts only as a publisher and that
the ﬁnance application and spreadsheet act only as subscribers. However, either subscriber
could invoke the setStatus method. If the ﬁnance application calls setStatus with a
bogus balance, the spreadsheet will dutifully render it.
This problem brings us back to access control. The statusHolder, by bundling two
113

def makeStatusPair (var myStatus ) {
def myListeners := [].diverge()
def statusGetter {
to addListener( newListener ) {
myListeners.push(newListener)
newListener <- statusChanged(myStatus)
}
to getStatus() { return myStatus }
}
def statusSetter {
to setStatus( newStatus ) {
myStatus := newStatus
for listener in myListeners {
listener <- statusChanged(newStatus)
}
}
}
return [statusGetter, statusSetter]
}
Figure 15.1 : Reify Distinctions in Authority as Distinct Objects. The earlier
statusHolder provides both the authority to be informed about the current status (whether by query or notiﬁcation) and the authority to update
the status. This encourages patterns which enable supposed subscribers to
publish and supposed publishers to subscribe. By representing each coherent
bundle of authority with a separate object providing only that authority, we
can easily enable supposed publishers only to publish and enable supposed
subscribers only to subscribe.
114

kinds of authority into one object, encouraged patterns where both kinds of authority
were provided to objects that only needed one. This can be addressed by grouping these
methods into separate objects, each of which represents a sensible bundle of authority, as
shown by the deﬁnition of makeStatusPair in Figure 15.1. The account manager can use
makeStatusPair as follows:
def [ sGetter , sSetter ] := makeStatusPair(33)
The call to makeStatusPair on the right side makes four objects—a Slot representing the
myStatus variable, a mutable myListeners list, a statusGetter, and a statusSetter.
The last two each share access to the ﬁrst two. The call to makeStatusPair returns a list
holding these last two objects. The left side pattern-matches this list, binding sGetter to
the new statusGetter, and binding sSetter to the new statusSetter.
The account manager can now keep the new statusSetter for itself and give the spreadsheet and the ﬁnance application access only to the new statusGetter. More generally, we
may now describe publishers as those with access to statusSetter and subscribers as those
with access to statusGetter. The account manager can now provide consistent balance
reports to its clients because it has denied them the possibility of corrupting this service.
This example shows how POLA helps support defensive consistency. We wish to provide
objects the authority needed to carry out their proper duties—publishers gotta publish—
but little more. By not granting its subscribers the authority to publish a bogus balance,
the account manager no longer needs to worry about what would happen if they did.
This discipline helps us compose plans so as to allow well-intentioned plans to successfully
cooperate, while minimizing the kinds of plan interference they must defend against.
15.3 Notes on Related Work
Roy and Haridi’s textbook Concepts, Techniques, and Models of Computer Programming
[RH04] compare and contrast several models of concurrency, including shared-state concurrency, message passing concurrency (much like our communicating event loops), and
declarative concurrency. These are all presented using the Oz language. We have borrowed
much terminology and conceptual framing from their book. The Related Work Section 26.3
explains how the derived Oz-E project will attempt to retain both message passing and
declarative concurrency while still suppressing shared state concurrency, in order to support defensive consistency.
The phrase “reify distinctions in authority as distinct objects” derives from E. Dean
Tribble [Tri98]. Our understanding of this principle largely derives from studying the interfaces designed at Key Logic, Inc. [ Key81].
115

116
