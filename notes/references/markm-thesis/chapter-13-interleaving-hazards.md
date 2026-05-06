# Chapter 13 — Interleaving Hazards


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 115–122.

---

Chapter 13
Interleaving Hazards
13.1 Sequential Interleaving Hazards
Throughout this part, we will examine diﬀerent forms of the listener pattern [ Eng97]. The
Java code shown in Figure 13.1 is representative of the basic sequential listener pattern. 1
In it, a statusHolder object is used to coordinate a changing status between publishers
and subscribers. A subscriber can ask for the current status of a statusHolder by calling
getStatus, or can subscribe to receive notiﬁcations when the status changes by calling
addListener with a listener object. A publisher changes the status in a statusHolder
by calling setStatus with the new value. This in turn will call statusChanged on all
subscribed listeners. In this way, publishers can communicate status updates to subscribers
without knowing of each individual subscriber.
We can use this pattern to coordinate several loosely coupled plans. For example, in
a simple application, a bank account manager publishes an account balance to an analysis
spreadsheet and a ﬁnancial application. Deposits and withdrawals cause a new balance to
be published. The spreadsheet adds a listener that will update the display to show the
current balance. The ﬁnance application adds a listener to begin trading activities when
the balance falls below some threshold. Although these clients interact cooperatively, they
know very little about each other.
Even under sequential and cooperative conditions, this pattern creates plan interference
hazards:
Aborting the wrong plan: A listener that throws an exception prevents some other listeners from being notiﬁed of the new status and possibly aborts the publisher’s plan.
In the above example, the spreadsheet’s inability to display the new balance should
not impact either the ﬁnance application or the bank account manager.
Nested subscription: The actions of a listener could cause a new listener to be subscribed.
For example, to bring a lowered balance back up, the ﬁnance application might initiate
a stock trade operation, which adds its own listener. Whether that new listener sees
the current event depends on how updating the myListeners collection aﬀects an
iteration in progress.
1 The listener pattern [ Eng97] is similar to the observer pattern [ GHJV94]. However, the analysis which
follows would be quite diﬀerent if we were starting from the observer pattern.
97

public class StatusHolder {
private Object myStatus ;
private final ArrayList<Listener> myListeners
= new ArrayList();
public StatusHolder(Object status ) {
myStatus = status;
}
public void addListener(Listener newListener ) {
myListeners.add(newListener);
}
public Object getStatus() {
return myStatus;
}
public void setStatus(Object newStatus ) {
myStatus = newStatus;
for (Listener listener : myListeners) {
listener.statusChanged(newStatus);
}
}
}
Figure 13.1 : The Sequential Listener Pattern in Java. Subscribers subscribe listeners by
calling addListener. Publishers publish a new status by calling setStatus,
causing all subscribed listeners to be notiﬁed of the new status.
98

acctMgr.withdraw(100)
statusHolder.setStatus(3900)
myStatus := 3900
financeListener.statusChanged(3900)
acctMgr.deposit(1000)
statusHolder.setStatus(4900)
myStatus := 4900
financeListener.statusChanged(4900)
cellViewer.statusChanged(4900)
... display "$4900" in spreadsheet cell ...
cellViewer.statusChanged(3900)
... display "$3900" in spreadsheet cell ...
Figure 13.2 : Anatomy of a Nested Publication Bug. An account manager uses a StatusHolder to publish the account balance. The subscribers are: 1) a ﬁnance
application, which reacts to the balance falling below $4000 by depositing
$1000, and 2) a spreadsheet, which will display each successive balance in a
spreadsheet cell. When $100 is withdrawn, each is notiﬁed of the new $3900
balance. In reaction, the ﬁnance listener deposits $1000, causing each to be
notiﬁed of the $4900 balance. $4900 is adequate, so the ﬁnance application
ignores the nested notiﬁcation. The spreadsheet displays $4900. The outer
notiﬁcation of the ﬁnance listener completes, so the spreadsheet is notiﬁed of
the $3900 balance, which it displays. The last assignment to myStatus was
4900, but the last update of the spreadsheet displays “$3900.”
99

Nested publication: Similarly, a listener may cause a publisher to publish a new status,
possibly unknowingly due to aliasing. In the example shown in Figure 13.2, the
invocation of setStatus notiﬁes the ﬁnance application, which deposits money into
the account. A new update to the balance is published and an inner invocation of
setStatus notiﬁes all listeners of the new balance. After that inner invocation returns,
the outer invocation of setStatus continues notifying listeners of the older, predeposit balance. Some of the listeners would receive the notiﬁcations out of order . As
a result, the spreadsheet might leave the display showing the wrong balance, or worse,
the ﬁnance application might initiate transactions based on incorrect information.
The nested publication hazard is striking because it reveals that problems typically associated with concurrency may arise even in a simple sequential example. This is why we draw
attention to plans, rather than programs or processes. The statusHolder, by running each
subscriber’s plan during a step of a publisher’s plan, has provoked plan interference: these
largely independent plans now interact in surprising ways, creating numerous new cases
that are diﬃcult to identify, prevent, or test. Although these hazards are real, experience
suggests that programmers can usually ﬁnd ways to avoid them in sequential programs
under cooperative conditions.
13.2 Why Not Shared-State Concurrency?
With genuine concurrency, interacting plans unfold in parallel. To manipulate state and preserve consistency, a plan needs to ensure others are not manipulating that same state at the
same time. This section explores the plan coordination problem in the context of the conventional shared-state concurrency-control paradigm [ RH04], also known as shared-memory
multi-threading. We present several attempts at a conventionally thread-safe statusHolder—
searching for one that prevents its clients from interfering without preventing them from
cooperating.
In the absence of real-time concerns, we can analyze concurrency without thinking
about genuine parallelism. Instead, we can model the eﬀects of concurrency as the nondeterministic interleaving of atomic units of operation. We can roughly characterize a
concurrency-control paradigm with the answers to two questions:
Serializability: What are the coarsest-grain units of operation, such that we can account
for all visible eﬀects of concurrency as equivalent to some fully ordered interleaving
of these units [ IBM68]? For shared-state concurrency, this unit is generally no larger
than a memory access, instruction, or system call—which is often ﬁner than the
“primitives” provided by our programming languages [ Boe05]. For databases, this
unit is the transaction.
Mutual exclusion: What mechanisms can eliminate the possibility of some interleavings,
so as to preclude the hazards associated with them? For shared-state concurrency,
the two dominant answers are monitors [ Hoa74, Han93] and rendezvous [ Hoa78]. For
distributed programming, many systems restrict the orders in which messages may be
delivered [ BJ87, Ami95, Lam98].
Java is loosely in the monitor tradition. Ada, Concurrent ML [ Rep99], and the synchronous
π-calculus [ Mil99] are loosely in the rendezvous tradition. With minor adjustments, the
following comments apply to both.
100

Figure 13.3 : Thread-safety is Surprisingly Hard. A correct program must both remain
consistent and continue to make progress. The sequence above represents
our search for a statusHolder which supports both well:
 The sequential
statusHolder.
 The sequential statusHolder in a multi-threaded environment.
 The fully synchronized statusHolder.
 Placing the for-loop outside
the synchronized block.
 Spawning a new thread per listener notiﬁcation.
Using communicating event-loops.
 is safer than
 since it also avoids
the sequential interleaving hazards.
13.3 Preserving Consistency
On Figure 13.3,
 represents the sequential statusHolder of Figure 13.1 executing in a sequential environment. If we place our sequential statusHolder into a concurrent environment
, publishers or subscribers may call it from diﬀerent threads. The resulting interleaving of
operations might, for example, mutate the myListeners list while the for-loop is in progress.
Adding the “ synchronized” keyword to all methods would cause the statusHolder to
resemble a monitor
 . This fully synchronized statusHolder eliminates exactly those cases
where multiple plans interleave within the statusHolder. It is as good at preserving its own
consistency as our original sequential statusHolder was.
However, it is generally recommended that Java programmers avoid this fully synchronized pattern because it is prone to deadlock [ Eng97]. Although each listener is called from
some publisher’s thread, its purpose may be to contribute to a plan unfolding in its subscriber’s thread. To defend itself against such concurrent entry, the objects at this boundary
may themselves be synchronized. If a statusChanged notiﬁcation gets blocked here, waiting
on that subscriber’s thread, it blocks the statusHolder, as well as any other objects whose
locks are held by that publisher’s thread. If the subscriber’s thread is itself waiting on one
of these objects, we have a classic deadly embrace.
Although we have eliminated interleavings that lead to inconsistency, some of the interleavings we eliminated were necessary to make progress.
13.4 Avoiding Deadlock
To avoid this problem, Englander recommends [ Eng97] changing the setStatus method
to clone the listeners list within the synchronized block, and then to exit the block before
entering the for-loop (Figure 13.3,
 ), as shown in Figure 13.4. This pattern avoids holding
a lock during notiﬁcation and thus avoids the obvious deadlock described above between a
publisher and a subscriber. It does not avoid the underlying hazard, however, because the
101

public void setStatus(Object newStatus ) {
ArrayList<Listener> listeners ;
synchronized (this) {
myStatus = newStatus;
listeners = (ArrayList<Listener>)myListeners.clone();
}
for (Listener listener : listeners) {
listener.statusChanged(newStatus);
}
}
Figure 13.4 : A First Attempt at Deadlock Avoidance. A recommended technique for
avoiding deadlock when using the Listener pattern is to copy the listeners
list within the synchronized block, and then to notify these listeners after
execution has exited the synchronized block.
publisher may hold other locks.
For example, if the account manager holds a lock on the bank account during a withdrawal, a deposit attempt by the ﬁnance application thread may result in an equivalent
deadlock, with the account manager waiting for the notiﬁcation of the ﬁnance application
to complete, and the ﬁnance application waiting for the account to unlock. The result is
that all the associated objects are locked and other subscribers will never hear about this
update. Thus, the underlying hazard remains.
In this approach, some interleavings needed for progress are still eliminated, and as we
will see, some newly-allowed interleavings lead to inconsistency.
13.5 Race Conditions
The approach in Figure 13.4 has a consistency hazard: if setStatus is called from two
threads, the order in which they update myStatus will be the order they enter the synchronized block above. However, the for-loop notifying listeners of a later status may race
ahead of one that will notify them of an earlier status. As a result, even a single subscriber
may see updates out of order, so the spreadsheet may leave the display showing the wrong
balance, even in the absence of any nested publication.
It is possible to adjust for these remaining problems. The style recommended for some
rendezvous-based languages, like Concurrent ML and the π-calculus, corresponds to spawning a separate thread to perform each notiﬁcation (Figure 13.3,
 ). This avoids using
the producer’s thread to notify the subscribers and thus avoids the deadlock hazard—it
allows all interleavings needed for progress. However, this style still suﬀers from the same
race condition hazards and so still fails to eliminate the hazardous interleavings. We could
compensate for this by adding a counter to the statusHolder and to the notiﬁcation API,
and by modifying the logic of all listeners to reorder notiﬁcations. But a formerly trivial
pattern has now exploded into a case-analysis mineﬁeld. Actual systems contain thousands
of patterns more complex than the statusHolder. Some of these will suﬀer from less obvious
mineﬁelds [ RH04, Lee06, Ous96].
102

This is “Multi-Threaded Hell.” As your application evolves, or as diﬀerent
programmers encounter the sporadic and non-reproducible corruption or deadlock bugs, they will add or remove locks around diﬀerent data structures, causing
your code base to veer back and forth . . . , erring ﬁrst on the side of more deadlocking, and then on the side of more corruption. This kind of thrashing is bad
for the quality of the code, bad for the forward progress of the project, and bad
for morale.
—An experience report from the development of Mojo Nation [ WO01]
13.6 Notes on Related Work
Edward A. Lee’s The Problem with Threads [Lee06] explains the same hazards explained in
this chapter, and then presents a variety of computational models which are free of these
hazards.
John Ousterhout’s talk Why Threads are a Bad Idea (For Most Purposes) [Ous96]
explains several of the hazards of threads, and explains why event loops better serve many
of the purposes for which threads are currently employed.
There is an ongoing controvery over whether threads or events are more suitable for
high performance. SEDA: An Architecture for Well-Conditioned, Scalable Internet Services
[WCB01] presents a high performance architecture using events. Eric Brewer, one of the
co-authors of this paper, then went on to co-author Why Events Are a Bad Idea (for HighConcurrency Servers) [vBCB03] which argues the opposite case. However, the focus of both
of these papers is performance rather than correctness or robustness.
103

104
