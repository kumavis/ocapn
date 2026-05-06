# Chapter 14 — Two Ways to Postpone Plans


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 123–130.

---

Chapter 14
Two Ways to Postpone Plans
Figure 14.1 shows the same statusHolder as deﬁned in E. Square brackets evaluate to an
immutable list containing the values of the subexpressions (the empty-list in the example).
Lists respond to the “ diverge()” message by returning a new mutable list whose initial
contents are a snapshot of the diverged list. Thus, myListeners is initialized to a new,
empty, mutable list, which acts much like an ArrayList.
The E code for statusHolder in Figure 14.1 retains the simplicity and hazards of the
sequential Java version. To address these hazards requires examining the underlying issues.
When the statusHolder—or any agent—is executing plan X and discovers the need to engage
in plan Y , in a sequential system, it has two simple alternatives of when to do Y :
Immediately: Postpone the rest of X, work on Y until complete, then go back to X.
Eventually: Postpone Y by putting it on a “to-do” list and work on it after X is complete.
The “immediate” option corresponds to conventional, sequential call-return control ﬂow
def makeStatusHolder (var myStatus ) {
def myListeners := [].diverge()
def statusHolder {
to addListener( newListener ) {
myListeners.push(newListener)
}
to getStatus() { return myStatus }
to setStatus( newStatus ) {
myStatus := newStatus
for listener in myListeners {
listener.statusChanged(newStatus)
}
}
}
return statusHolder
}
Figure 14.1 : The Sequential Listener Pattern in E. The statusHolder above still has the
same sequential hazards as its Java counterpart shown in Figure 13.1 (p. 98).
105

(or strict applicative-order evaluation), and is represented by the “ .” or immediate-call
operator, which delivers the message immediately. Above, statusHolder’s addListener
method tells myListeners to push the newListener immediately. When addListener
proceeds past this point, it may assume that all side eﬀects it requested are done.
For the statusHolder example, all of the sequential hazards (e.g., Nested Publication)
and many of the concurrent hazards (deadlock) occur because the statusChanged method
is also invoked immediately: the publisher’s plan is set aside to pursue the listener’s plan
(which might then abort, change the state further, etc.).
The “eventual” option corresponds to the human notion of a “to-do” list: the item
is queued for later execution. E provides direct support for this asynchronous messaging option, represented by the “ <-” or eventual-send operator. Using eventual-send, the
setStatus method can ensure that each listener will be notiﬁed of the changed status in
such a way that it does not interfere with the publisher’s current plan. To accomplish this
in E, the setStatus method becomes:
to setStatus( newStatus ) {
myStatus := newStatus
for listener in myListeners {
listener <- statusChanged(newStatus)
}
}
As a result of using eventual-send above, all of the sequential hazards are addressed. Errors,
new subscriptions, and additional status changes caused by listeners will all take place
after all notiﬁcations for a published event have been scheduled. Publishers’ plans and
subscribers’ plans are temporally isolated—so these plans may unfold with fewer unintended
interactions. For example, it can no longer matter whether myStatus is assigned before or
after the for-loop.
14.1 The Vat
This section describes how temporal isolation is achieved within a single thread of control.
The next section describes how it is achieved in the face of concurrency and distribution.
In E, an eventual-send creates and queues a pending delivery , which represents the
eventual delivery of a particular message to a particular object. Within a single thread
of control, E has both a normal execution stack for immediate call-return and a queue
containing all the pending deliveries. Execution proceeds by taking a pending-delivery from
the queue, delivering its message to its object, and processing all the resulting immediatecalls in conventional call-return order. This is called a turn. When a pending delivery
completes, the next one is dequeued, and so forth. This is the classic event-loop model, in
which all of the events are pending deliveries. Because each event’s turn runs to completion
before the next is serviced, they are temporally isolated.
Additional mechanisms to process results and exceptions from eventual-sends will be
discussed in Chapter 16.
The combination of a stack, a pending delivery queue, and the heap of objects they
operate on is called a vat, illustrated in Figure 14.2. Each E object lives in exactly one vat
and a vat may host many objects. Each vat lives on one machine at a time and a machine
may host many vats. The vat is also the minimum unit of persistence, migration, partial
106

Figure 14.2 : A Vat’s Thread Services a Stack and a Queue. An E vat consists of a heap
of objects and a thread of control. The stack and queue together record the
postponed plans the thread needs to process. An immediate-call pushes a
new frame on top of the stack, representing the delivery of a message ( arrow)
to a target object ( dot). An eventual-send enqueues a new pending delivery
on the right end of the queue. The thread proceeds from top to bottom and
then from left to right.
failure, resource control, preemptive termination/deallocation, and defense from denial of
service. We will return to some of these topics in subsequent chapters.
14.2 Communicating Event-Loops
We now consider the case where our account (including account manager and its statusHolder) runs in VatA on one machine, and our spreadsheet (including its listener) runs in
VatS on another machine.
In E, we distinguish several reference-states. A direct reference between two objects in
the same vat is a near reference.1 As we have seen, near references carry both immediatecalls and eventual-sends. Only eventual references may cross vat boundaries, so the spreadsheet (in VatS) holds an eventual reference to the statusHolder (in VatA), which in turn
holds an eventual reference to the spreadsheet’s listener (in VatS). Eventual references are
ﬁrst class—they can be passed as arguments, returned as results, and stored in data structures, just like near references. However, eventual references carry only eventual-sends,
not immediate-calls—an immediate-call on an eventual reference throws an exception. Our
statusHolder is compatible with this constraint, since it stores, retrieves, and eventual-sends
to its listeners, but never immediate-calls them. Figure 14.3 shows what happens when a
message is sent between vats.
When the statusHolder in VatA performs an eventual-send of the statusChanged message to the spreadsheet’s listener in VatS, VatA creates a pending delivery as before, recording the need to deliver this message to this listener. Pending deliveries need to be queued on
the pending delivery queue of the vat hosting the object that will receive the message—in
this case, VatS. VatA serializes the pending delivery onto an encrypted, order-preserving
byte stream read by VatS. Should it ever arrive at VatS, VatS will unserialize it and queue
it on its own pending delivery queue.
1 For brevity, we generally do not distinguish a near reference from the object it designates.
107

Figure 14.3 : An Eventually-Sent Message is Queued in its Target’s Vat. If the account
manager and the spreadsheet are in separate vats, when the account manager
tells the statusHolder that represents its balance to immediately update,
this
 transfers control to the statusHolder, which
 notes that its listeners
should eventually be notiﬁed. The message is
 sent to the spreadsheet’s
vat, which queues it on arrival and eventually
 delivers it to the listener,
which updates the display of the spreadsheet cell.
Since each vat runs concurrently with all other vats, turns in diﬀerent vats no longer have
actual temporal isolation. If VatS is otherwise idle, it may service this delivery, notifying the
spreadhseet’s listener of the new balance, while the original turn is still in progress in VatA.
But so what? These two turns can only execute simultaneously when they are in diﬀerent
vats. In this case, the spreadsheet cannot aﬀect the account manager’s turn-in-progress.
Because only eventual references span between vats, the spreadsheet can only aﬀect VatA by
eventual-sending to objects hosted by VatA. This cannot aﬀect any turn already in progress
in VatA—VatA only queues the pending delivery, and will service it sometime after the
current turn and turns for previously queued pending deliveries, complete.
Only near references provide one object synchronous access to another. Therefore an
object has synchronous access to state only within its own vat. Taken together, these rules
guarantee that a running turn—a sequential call-return program—has mutually exclusive
access to everything to which it has synchronous access. In the absence of real-time concerns,
this provides all the isolation that was achieved by temporal isolation in the single-threaded
case.
The net eﬀect is that a turn is E’s unit of operation. We can faithfully account for the
visible eﬀects of concurrency without any interleaving of the steps within a turn. Any actual
multi-vat computation is equivalent to some fully ordered interleaving of turns. 2 Because E
has no explicit locking constructs, computation within a turn can never block—it can only
2 An E turn may never terminate, which is hard to account for within this simple model of serializability.
There are formal models of asynchronous systems that can account for non-terminating events [ CL85].
Within the scope of this dissertation, we can safely ignore this issue.
The actual E system does provide synchronous ﬁle I/O operations. When these ﬁles are local, prompt,
and private to the vat accessing them, this does not violate turn isolation, but since ﬁles may be remote,
non-prompt, or shared, the availability of these synchronous I/O operations does violate the E model.
108

run, to completion or forever. A vat as a whole is either processing pending deliveries, or is
idle when there are no pending deliveries to service. Because computation never blocks, it
cannot deadlock. Other lost progress hazards are discussed in Section 16.3 on “Datalock.”
As with database transactions, the length of an E turn is not predetermined. It is
a tradeoﬀ left for the developer to decide. How the object graph is carved up into vats
and how computation is carved up into turns will determine which interleaving cases are
eliminated, and which must be handled explicitly by the programmer. For example, when
the spreadsheet was co-located with the statusHolder, the spreadsheet could, in a single turn,
immediate-call getStatus, initialize the spreadsheet cell with getStatus’s result, and then
immediate-call addListener to subscribe the cell, so that it will see exactly the updates
to its initial value. But when the spreadsheet can only eventual-send the getStatus and
addListener messages, they may be delivered to the statusHolder interleaved with other
messages. To relieve potentially remote clients of this burden, the statusHolder should send
an initial notiﬁcation to newly subscribed listeners:
to addListener( newListener ) {
myListeners.push(newListener)
newListener <- statusChanged(myStatus)
}
14.3 Issues with Event-loops
This architecture imposes some strong constraints on programming (e.g., no threads or
co-routines), which can impede certain useful patterns of plan cooperation. In particular,
recursive algorithms, such as recursive-descent parsers, must either a) happen entirely within
a single turn, b) be redesigned (e.g., as a table-driven parser), c) be transformed into an
analog of continuation-passing style shown in Section 18.2, or d) if it needs external nonprompt input (e.g., a stream from the user), be run in a dedicated vat. E programs have
used each of these approaches.
Thread-based coordination patterns can typically be adapted to vat granularity. For
example, rather than adding the complexity of a priority queue for pending deliveries,
diﬀerent vats would simply run at diﬀerent processor priorities. For example, if a userinteraction vat could proceed (has pending deliveries in its queue), it should; a helper
“background” vat (e.g., spelling check) should consume processor resources only if no userdirected action could proceed. A divide-and-conquer approach for multi-processing could
run a vat on each processor and divide the problem among them.
Symmetric multiprocessors, multi-cores, and hyperthreading provide hardware support
for cache coherency between processing units. Although it may still make sense to run
a separate vat on each processing unit, to make eﬃcient use of this hardware, we would
need to avoid the expense of serializing inter-vat messages. Can multiple vats on tightly
coupled processing units gain the performance advantages of shared memory without losing
the robustness advantages of large-grain isolated units of operation?
For this purpose, E implementations allow several vats to run in a single address space.
Between vats within the same address space, E provides a special purpose comm system,
the BootCommSystem, similar in semantics to Pluribus, but implemented by thread-safe
pointer manipulations rather than serialization. The BootCommSystem’s important optimization is simply that it passes data—any message argument accepted by the Data
guard—by pointer sharing rather than copying. Since data is transitively immutable, and
109

since a copy of data is indistinguishable from the original, this optimization is semantically
transparent. It enables large immutable structures to be cheaply shared.
Nevertheless, the event-loop approach may be unsuitable for some problems with ﬁnegrained parallelism that cannot easily be adapted to a message-passing hardware architecture. For example, we do not see how to adapt the optimization above to allow ﬁne-grained
sharing of updates to commonly addressable data.
14.4 Notes on Related Work
Lauer and Needham’s On the Duality of Operating System Structures [LN79] contrasts
“message-oriented systems” with “procedure-oriented systems.” Message-oriented systems
consist of separate process, not sharing any memory, and communicating only by means
of messages. The example model presented in their paper uses asynchronous messages.
Procedure-oriented systems consist of concurrently executing processes with shared access
to memory, using locking to exclude each other, in order to preserve the consistency of this
memory. The example model presented in their paper uses monitor locks [ Hoa74]. Their
“procedure-oriented systems” corresponds to the term “shared-state concurrency” as used
by Roy and Haridi [ RH04] and this dissertation.
Lauer and Needham’s “message-oriented systems” does not directly correspond to Roy
and Haridi’s “message-passing concurrency.” Lauer and Needham’s “message-oriented systems” includes an “ AwaitReply” operation by which a process as a whole can block, waiting
for a reply from a previously sent message. Although less obviously a blocking construct,
their “ WaitForMessage” operation takes as a parameter the list of ports to wait on (much
like Unix select). While the process is blocked waiting for a message to arrive on some
of these ports, it is unresponsive to messages on the other ports. By contrast, Roy and
Haridi’s “message-passing concurrency” includes no separate blocking constructs. A process
is “blocked” only when it is idle—when its incoming message queue is empty. To avoid confusion, this dissertation uses “event loop” for systems using non-blocking message-passing
concurrency.
Lauer and Needham explain various comparative engineering strengths and weaknesses
of message-oriented systems and procedure-oriented systems, but show (given some reasonable assumptions) that they are approximately equivalent. Further, they explain how
programs written in either style may be transformed to the other. This equivalence depends
on the ability of message-oriented programs to block their process awaiting some inputs,
leaving it insensitive to other inputs.
Examples of message-oriented systems with blocking constructs are Hoare’s Communicating Sequential Processes (CSP) [Hoa78], Milner’s “Communicating Concurrent Systems”
(CCS) [ Mil83, Mil89], the “Synchronous π Calculus” [ Mil99], and many systems derived
from them, such as Concurrent ML [ Rep99].
Examples of event loop systems, i.e., non-blocking message-oriented systems, include
Actors [HBS73, Hew77], libasync [ DZK+02, ZYD+03], and Twisted Python [ Lef03] covered
in Related Work Section 26.2. Although derived from Actors, the Erlang language [ Arm03]
covered in Related Work Section 24.2 is a message-passing system in Lauer and Needham’s
sense: a typical programming pattern is for a process to block waiting for a reply, and to
remain unresponsive to further requests while blocked.
As with the distinction between procedure-oriented systems and message-oriented sys110

tems, the distinction between (blocking) message-oriented systems and (non-blocking) event
loop systems is not always clear. In some ways, the distinction depends on whether certain
structures are best regarded as suspended computations or as objects awaiting invocation.
Transforming code to continuation-passing style [ Hew77, Ste78] converts suspended computations into objects. E’s use of this technique, explained in Section 18.2 is still non-blocking
because other objects remain responsive while continuation-like objects await their invocations.
In other ways, this distinction depends on whether we regard a change of state in reaction
to a message as having processed the message or as having buﬀered the message. The later
Actors work on “receptionists” [ Agh86] makes it convenient to buﬀer messages from some
sources while awaiting a response from other sources. Conditional buﬀering patterns can
simulate locking, and thus re-introduce the hazards of “simulated” deadlock.
Due to these issues, the Asynchronous π Calculus [ HT91] and Concurrent
logic/constraint programming languages [ Sha83, ST83, Sar93] can be classiﬁed as either
blocking or non-blocking message-based systems, depending on the level of abstraction at
which they are described.
111

112
