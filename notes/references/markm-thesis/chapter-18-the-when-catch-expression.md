# Chapter 18 — The When-Catch Expression


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 147–154.

---

Chapter 18
The When-Catch Expression
The whenMoreResolved message can be used to register for notiﬁcation when a reference
resolves. Typically this message is used indrectly through the “when-catch” syntax. A
when-catch expression takes a promise, a “when” block to execute if the promise is fulﬁlled
(becomes near or far), and a “catch” block to execute if the promise is broken. This is
illustrated by the asyncAnd example in Figure 18.1.
The asyncAnd function takes a list of promises for booleans. It immediately returns a
reference representing the conjunction, which must eventually be true if all elements of the
list become true, or false or broken if any of them become false or broken. Using whencatch, asyncAnd can test these as they become available, so it can report a result as soon
as it has enough information.
If the list is empty, the conjunction is true right away. Otherwise, countDown remembers
how many true answers are needed before asyncAnd can conclude that the conjunction is
true. The “when-catch” expression is used to register a handler on each reference in the
list. The behavior of the handler is expressed in two parts: the block after the “ ->” handles
the normal case, and the catch-clause handles the exceptional case. Once answer resolves,
if it is near or far, the normal-case code is run. If it is broken, the catch-clause is run. Here,
if the normal case runs, answer is expected to be a boolean. By using a “when-catch,” the
“if” is postponed until asyncAnd has gathered enough information to know which way it
should branch.
Promise pipelining postpones plans eﬃciently, in a dataﬂow-like manner, delaying message delivery until a message’s recipient is known. The when-catch delays plans until the
information needed for control ﬂow is available.
Once asyncAnd registers all these handlers, it immediately returns result, a promise for
the conjunction of these answers. If they all resolve to true, asyncAnd eventually resolves
the already-returned promise to true. If it is notiﬁed that any resolve to false, asyncAnd
resolves this promise to false immediately. If any resolve to broken, asyncAnd breaks this
promise with the same exception. Asking a resolver to resolve an already-resolved promise
has no eﬀect, so if one of the answers is false and another is broken, the asyncAnd code
may resolve the promise to be either false or broken, depending on which handler happens
to be notiﬁed ﬁrst.
The snippet shown in Figure 18.2 illustrates using asyncAnd and when-catch to combine
independent validity checks in a toy application to resell goods from a supplier.
129

def asyncAnd (answers ) {
var countDown := answers.size()
if (countDown == 0) { return true }
def [ result , resolver ] := Ref.promise()
for answer in answers {
when (answer) -> {
if (answer) {
if ((countDown -= 1) == 0) { resolver.resolve(true) }
} else {
resolver.resolve(false)
}
} catch ex { resolver.smash(ex) }
}
return result
}
Figure 18.1 : Eventual Conjunction. The asynchAnd function eventually resolves the returned promise to be the conjunction of a list of promises for booleans.
Should all resolve to true, the returned promise will resolve to true. If any
resolve to false or broken, the returned promise will resolve to false or likewise
broken without waiting for further resolutions.
def allOk := asyncAnd([inventory <- isAvailable(partNo),
creditBureau <- verifyCredit(buyerData),
shipper <- canDeliver(...)])
when (allOk) -> {
if (allOk) {
def receipt := supplier <- buy(partNo, payment)
when (receipt) -> { ...
Figure 18.2 : Using Eventual Control Flow. In this toy purchase order example, we send
out several queries and then use asyncAnd so that we only buy the goods
once we’re satisﬁed with the answers.
130

def promiseAllFulfilled (answers ) {
var countDown := answers.size()
if (countDown == 0) { return answers }
def [ result , resolver ] := Ref.promise()
for answer in answers {
when (answer) -> {
if ((countDown -= 1) == 0) { resolver.resolve(answers) }
} catch ex { resolver.smash(ex) }
}
return result
}
Figure 18.3 : The Default Joiner. The when-catch expression provides a syntactic shorthand for using this joiner, which postpones plans until either all its inputs
are fulﬁlled or any of them break.
18.1 Eventual Control Flow
Concurrency control in E is often expressed by creating and using eventual-control-ﬂow
abstractions. The asyncAnd is an example of a user-deﬁned joiner —an abstraction for
waiting until several causal inputs are ready before signalling an output.
Eventual-sends delay delivery until a message’s recipient is known, but, by itself, it does
not provide full dataﬂow postponement; it does not also delay until arguments are resolved.
For example, if partNo is an unresolved promise, then
def receipt := supplier <- buy(partNo, payment)
may deliver the buy message to the supplier before partNo is resolved. If the supplier
requires a resolved partNo at the time of purchase, it may reject this buy request, and
receipt would become broken. To support stateful programming with minimal plan disruption, this is the right default, as full dataﬂow delays conﬂict with the need to deliver
successive messages sent on the same reference in fail-stop FIFO order.
Fortunately, either the purchaser or supplier can use a when-catch expression to express
such additional delays. To make this easier, the value of a when-catch expression is a
promise for the value that the handler-body will evaluate to. Further, if the catch-clause is
left out, it defaults to re-throwing the exception, thereby breaking this promise.
def receipt := when (partNo) -> { supplier <- buy(partNo, payment) }
is equivalent to
def receipt := when (partNo) -> {
supplier <- buy(partNo, payment)
} catch ex { throw(ex) }
is equivalent to
def [ receipt , r ] := Ref.promise()
when (partNo) -> {
r.resolve(supplier <- buy(partNo, payment))
} catch ex { r.smash(ex) }
131

Of course, sometimes we wish to delay an action until several relevant promises resolve.
Figures 18.1 and 18.2 show how to deﬁne and use joiner abstractions for this purpose.
Figure 18.3 shows E’s default joiner abstraction: Given a list of promises, if they all become
fulﬁlled (near or far), then promiseAllFulfilled will resolve its returned promise to this
same list. If any of the list’s elements become broken, then promiseAllFulfilled will
break its returned promise with the same exception. The when-catch expression provides
syntactic support for this joiner: If multiple expressions appear in the head of a when-catch
expression, these turn into a call to promiseAllFulfilled with a list of these expressions
as its argument.
def receipt := when (partNo, payment) -> {
supplier <- buy(partNo, payment)
}
is equivalent to
def receipt := when (promiseAllFulfilled([partNo, payment])) -> {
supplier <- buy(partNo, payment)
}
18.2 Manual Continuation-Passing Style
Section 14.3 mentions a common programming pattern that is particularly challenging for
non-blocking event-loops: a recursive descent parser that might block while waiting on
input, such as a command-line interpreter waiting for the user. There, we mention four
possible approaches. Here, we expand on the third of these approaches: manually transforming the program into an analog of continuation-passing style.
Conventional systems have the option of running this parser code in a thread, and
running other threads while this one is blocked. If the threading system is preemptive,
we’d have all the problems of shared-state concurrency previously explained. What about
non-preemptive threading systems, in which each thread operates as a co-routine?
An oft-cited expressiveness advantage of such co-routining is that it allows a plan to be
suspended mid-ﬂight while it is blocked waiting on some external input [ AHT+02], exactly
as we seem to need here. The typical implementation of a suspended co-routine is as
an inactive call-stack. To explain the semantics of setting a stack aside and resuming it
later, one imagines that the program is instead transformed into continuation-passing style
[Hew77, Ste78], where each call site is transformed to pass an extra continuation argument
representing the “rest of the computation.” (The continuation concept in the semantics
mirrors the implementation’s concept of the saved return address and frame pointer.) In
this transformation, the remaining work that would be done by the caller, and its caller,
etc., once the callee returns, is reiﬁed as a newly created continuation object—typically a
function of one parameter representing the value to be returned.
For example, let us say getint() might block waiting on input. We could then explain
def foo() { return bar(getint(), y()) }
by transforming it into continuation-passing style:
def foo(c1) {
getint(def c2(i) { y(def c3(j) { bar(i, j, c1) }) })
}
132

With this version, getint can suspend the rest of the parsing activity by simply storing its
continuation argument, and then enable other co-routines to be scheduled in the meantime.
When getint is ready to allow the parse to resume, it simply invokes the previously stored
continuation, rescheduling this co-routine. Even in a sequential system that provides no
built-in co-routining, programmers can still achieve the eﬀect by manually transforming
code as above; but the results are typically as unmaintainable as the above example would
suggest [ AHT+02, vBCB03]. Such violent transformations to code structure, in order to
accomodate the absence of built-in co-routining, have been termed stack ripping by Adya
et al. [AHT+02].
To account for exceptions, a continuation can be a two-method object rather than
a function. Say the two methods are resolve(result ) and smash(ex ). We would then
explain a return as the callee invoking its continuation’s resolve method. We would explain
throwing an exception as invoking the continuation’s smash method. All control-ﬂow then
becomes patterns of object creation and one-way message sending. If written out manually,
such explicit exception handling makes stack ripping that much worse.
E does not provide transparent co-routining within a vat, since this would disrupt a
caller’s plan assumptions. Between a call and a return, if the callee could suspend and
resume, any co-routine which may have been scheduled in the meantime could aﬀect vat
state. If this could happen during any call, then programmers would again need to face the
hazards of plan interleaving throughout their programs [ DZK+02].
Notice that co-routine interleaving would be much less hazardous if the return points of
all calls to possibly-suspending procedures had to be specially marked in the source text,
and if the return points of all calls to procedures containing such marks therefore also had
to be specially marked [ AHT+02].
def foo() { return bar(getint() ↗, y()) }
...foo()↗...
The programmer could then recognize these marks as the points in the program when other
vat-turns might interleave [ AHT+02]. Without such a mark-propagation rule, functional
composition would hide these interleaving points from callers. The “ ->” symbol following
the “ when” keyword eﬀectively serves as such a mark.
def foo() { return when (def i := getint()) -> { bar(i, y()) } }
...when (foo()) -> {...}
The handler it registers, to be called back when the promise is resolved, reiﬁes the desired
portion of the rest of the current procedure into an explicit object. Instead of a possiblysuspending procedure which eventually returns a result, we have a promise-returning procedure which eventually resolves this promise to that result. An eventually-sent message
implicitly carries a resolver, serving as a continuation, to which the outcome (result or
thrown exception) of delivering the message will be reported. Together, promises, resolvers,
eventual-sends, and the when-catch expression give the programmer the ability to spread a
plan over mutiple vat turns, a bit less conveniently but more ﬂexibly, while still remaining
explicit at every level of the call stack about where interleaving may and may not occur.
18.3 Notes on Related Work
Carl Hewitt’s Viewing Control Structures as Patterns of Passing Messages [Hew77] introduced the idea of reiﬁed continuations into programming languages, and the notion that
133

call-return patterns could be transparently re-written into continuation-passing style. Hewitt’s treatment was in an event-based massively concurrent system. In a sequential context,
Guy Steele’s “Rabbit” compiler for the Scheme language [ Ste78] was the ﬁrst to use this
transformation in a compiler, in order to reduce cases and generate higher performance
code.
Adya et al. ’s Cooperative Task Management Without Manual Stack Management
[AHT+02] expands the dichotomy between “multi-threaded” and “event-driven” programming into a ﬁner grained taxonomy involving ﬁve distinct dimensions. By “multi-threaded,”
they mean what is here termed “shared-state concurrency.” The two dimensions the paper
focuses on are the two most relevant to our present discussion: task management , which
they divide into cooperative, and preemptive, and stack management , which they divide into
manual and automatic. Multi-threaded programs use preemptive task management and
automatic stack management. Event-driven programs use cooperative task management
and manual stack management. Non-preemptive co-routine scheduling systems, which they
advocate, use cooperative task management and automatic stack management.
Their paper explains the danger of hiding interleaving points from callers, and proposes
a static marking rule similar in eﬀect to the “ ↗” annotation presented above. The paper
states explicitly that it is concerned with “stack management problems in conventional languages without elegant closures.” Although it is not clear how the authors would regard E,
we ﬁnd their taxonomy useful, and regard E as event-driven: with cooperative task management and manual stack management. Although E’s when-catch prevents stack ripping,
combining much of the syntactic convenience of co-routines with an explicit marking rule
as their paper suggests, it also reiﬁes these delayed results as ﬁrst class promises, which can
be stored in data structures, passed in messages, or eventually sent to, providing a level of
expressive power well beyond that available by co-routine scheduling.
Regarding the remaining dimensions of their taxonomy, E provides both synchronous
I/O and asynchronous I/O operations, though ideally we should remove synchronous I/O
from E. E provides no explicit conﬂict management, i.e., no explicit locking constructs, since,
as they observe, cooperative task management implicitly provides programmer-deﬁned
large-grain atomicity. Promises do serve as a form of conﬂict management, as they can
buﬀer messages until an object holding the resolver decides that it is now safe to release
them. Finally, E explicitly partitions all mutable state into separate vats, so that no two
threads of execution (vats) ever have synchronous access (near references) to shared state.
The “libasync” and “libasync-mp” libraries [ DZK+02] are event-driven libraries in C++.
Although C++ does not provide closures, these libraries use C++ templates to alleviate
the inconvenience of stack ripping. In these libraries, an asynchronous call takes an explicit
continuation-like callback as an argument, rather than returning a promise. Unlike E’s
multi-vat approach, the libasync-mp library extends libasync to make eﬃcient use of shared
memory multiprocessors. Rather than explicitly partition objects into vats, libasync-mp
aggregates events into colors. No two events of the same color will execute concurrently,
but an event of one color may execute on one processor while an event of a diﬀerent color
executes on a diﬀerent processor. In the absence of explicit coloring by the programmer,
all events carry the same default color. However, it seems that if the programmer does use
colors to obtain a speedup, it is the programmer’s responsibility to ensure, without resort
to locking constructs, that diﬀerently colored events do not interfere.
In the Joule language [ TMHK95], covered in Related Work Section 23.4, one receives
a response from a message by passing in a distributor object as an explicit callback and
134

holding onto the corresponding acceptor. Joule’s acceptor/distributor pair is much like E’s
promise/resolver pair. Joule provides a syntactic shorthand where the last argument can
be elided when the call expression is used in a syntactic context needing a value. This
case expands to explicit creation of an acceptor/distributor pair, adds the distributor to
the argument list, and uses the acceptor as the value of the expression as a whole. The
Oz language [ RH04] provides a similar shorthand for passing a logic variable as the last
argument. Although distinguished by convention, these last arguments are not otherwise
special.
The E eventual send also implicitly generates a promise/resolver pair to represent the
return result, with the resolver passed as a hidden argument in the message, and the promise
serving as the value of the send expression. However, in E, this is not just a shorthand; the
hidden resolver argument is indeed special in two ways. First, when the eventual send in
question is on a remote reference, the serialized message encodes a resolver to be created
in the receiving vat, so that messages sent to its promise in the sending vat are pipelined
to that destination. Second, if a partition prevents the message from being delivered or
acknowledged, the promise for its result is automatically broken. By contrast, if a resolver
is passed as a normal message argument, it remains where it is created, and only a remote
reference to that resolver is actually passed. Partition would cause a reactToLostClient
message to be delivered to that resolver, which resolvers by default ignore.
Twisted Python [ Lef03], covered in Related Work Section 26.2, is another event-driven
language, with cooperative task management and manual stack management. It makes
heavy use of Python’s support for closures to alleviate the inconvenience of stack ripping.
Its primary plan postponement abstraction manages callbacks by chaining them into multiturn sequences. Each callback in a chain consumes a value produced by its predecessor, and
each produces a value to be consumed by its successor. This approach resembles a nested
sequence of when-catch blocks without the syntactic nesting cost.
135

136
