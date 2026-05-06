# Chapter 6 — A Taste of E


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 57–66.

---

Chapter 6
A Taste of E
Like most “new” languages, little about E is actually novel. Most of its elements are drawn
from prior language designs. The speciﬁc novel contribution of this dissertation is the state
transition semantics explained in Part III and shown in Figure 17.1 (p. 124). The value of
this contribution lies in its integration with other language features, so it is important to
present a cohesive framework. In this dissertation, E serves as that framework.
This chapter brieﬂy explains a subset of E as a conventional sequential object language.
This dissertation will introduce other aspects of E as they become relevant. For a more
complete explanation of E, see [ Sti04].
6.1 From Functions to Objects
Object computation can be understood as the sum of three elements [ GK76, HBS73]:
Objects == Lambda Abstraction + Message Dispatch + Local Side Eﬀects
The remaining feature often thought to be deﬁning of object-oriented programming is
inheritance [Weg87]. Though we do not view inheritance as a fundamental ingredient of object computation, its widespread use in object-oriented programming practice motivates its
inclusion in E. However, E’s reconciliation of inheritance with capability security principles
[Mil04] is beyond our present scope.
6.1.1 Lambda Abstraction
The call-by-value lambda calculus [ Plo75] is a pure theory of nested function deﬁnition
and application. Figure 6.1 shows nested function deﬁnition, which E shares with all lexically scoped lambda languages including ALGOL60 [ NBB+63], Scheme [ KCR98], and ML
[Mil84]. The call to makeAddr returns a function, an instance of the adder function definition expression, that adds 3 to its argument. Church originally thought about this as
substitution—return an adder function in which x has been replaced by 3 [Chu41]. Unfortunately, this simple perspective makes it awkward to explain side eﬀects. An alternative
perspective is to consider a function, such as that held in the addThree variable, to be a
combination of code describing behavior (the static code for adder), and state (the runtime
bindings for its free variables). 1 x in adder is a free variable in that adder uses x, but the
1 Smalltalk refers to this pair as “behavior” and “state” [ GK76]. Actors refers to this pair as “script”
and “acquaintances” [ HBS73].
39

def makeAddr (x ) {
def adder (y ) {
return x + y
}
return adder
}
? def addThree := makeAddr(3)
# value: <adder>
? addThree(5)
# value: 8
Figure 6.1 : Lexically Nested Function Deﬁnition. makeAddr deﬁnes and returns an addr
function, an instance of the adder code appearing in its function deﬁnition
expression. The instance variables of each adder are the variables used freely
in its code (here, x), which must therefore be bound in its creation context.
corresponding deﬁnition of x is from adder’s creation context. These are commonly referred
to as instance variables .
6.1.2 Adding Message Dispatch
The most visible diﬀerence between a function and an object is that a function’s behavior
is written to satisfy just one kind of request, and all calls on that function are forms of that
one request. By contrast, an object’s behavior enables it to satisfy a variety of diﬀerent
requests (each with a separate method). A request to an object (a message) identiﬁes which
of these requests is being made. This is not a fundamental distinction—either functions
or objects can be trivially built from the other in a variety of ways. As we will see, in E,
objects are the more primitive notions, of which functions are deﬁned as a degenerate case.
Figure 6.2 shows the makePoint function which makes and returns point objects. From
a lambda calculus perspective, makePoint is like makeAddr—it is a lexically enclosing function that deﬁnes the variable bindings used by the object it both deﬁnes and returns.
From an object perspective, makePoint is simultaneously like a class and constructor—
both deﬁning the instance variables for points, and creating, initializing, and returning
individual points.
The returned points are clearly object-like rather than function-like. Each point’s behavior contains three methods: getX, getY, and add. Every request to a point names which
of these services it is requesting.
Some shorthands in this code need a brief explanation.
• “a + b ” is merely syntactic shorthand for “ a.add(b)”, and similarly for other expression operators. As in Smalltalk, all values, including integers, are objects. Addition
happens by asking one integer to add another integer. (As E’s robustness convention
demands, this operation either returns the correct sum or visibly fails due to resource
exhaustion.)
40

def makePoint (x ,y ) {
def point {
to getX() { return x }
to getY() { return y }
to add( other ) {
return makePoint(x + other.getX(), y + other.getY())
}
}
return point
}
? def p := makePoint(3,5)
# value: <point>
? p.getX()
# value: 3
? (p + makePoint(4,8)).getX()
# value: 7
Figure 6.2 : Objects as Closures. The expression deﬁning point is an object deﬁnition
expression. This is like a lambda expression and a variable deﬁnition. It
evaluates to a closure, and binds the point variable to that closure. This
closure has a single implicit parameter: a message consisting of a message
name and a list of arguments. The closure implicitly dispatches on the message
name and the number of arguments to select a method.
41

def makeAddr {
to run( x ) {
def adder {
to run( y ) {
return x.add(y)
}
}
return adder
}
}
Figure 6.3 : Expansion to Kernel-E. Expanding the makeAddr function to Kernel-E reveals
that E’s “functions” are really objects with a single run method. In E, all
values are ultimately objects, and all invocation is by message passing. Socalled functions are just a syntactic shorthand.
• Functions are simply one-method objects where the method is named “ run”. The
previous makeAddr is therefore just syntactic shorthand for the code shown in Figure 6.3.
• Likewise, the function call syntax “ makeAddr(3)” is just shorthand for the method
call “ makeAddr.run(3)”.
Once all the syntactic shorthands of an E program have been expanded away, we have a
Kernel-E program, expressed in the subset of the E language without such shorthands.
6.1.3 Adding Side Eﬀects
Starting with lambda calculus (or with lambda plus message dispatch), there are many ways
to add side eﬀects. The approach used by E, Scheme, ML and many other lambda languages
is to introduce assignment. In E, variables are non-assignable (or “ final”) by default. For
a variable to be assignable, it must be declared with “ var” as shown in Figure 6.4.
Under the covers, each assignable variable is actually a distinct primitive variable-object,
referred to as a Slot. By declaring var count , we introduce a binding from the name
"&count" to a new mutable Slot object holding the current count. Writing a use-occurrence
of count in an expression is like writing (&count).getValue(), asking the Slot for its
current value. Writing count := expr is like writing (&count).setValue(expr), asking
the Slot to remember the argument as its new current value. Slots serve the same purpose
in E as do so-called “Ref”s in Algol-68 and ML.
6.2 Composites and Facets
Because assignable variables are reiﬁed as Slot objects, they can be easily shared, as shown
in Figure 6.5.
Each time makeCounterPair is called, it deﬁnes a new Slot and two objects that use this
Slot. It then returns a list of the latter two objects, one that will increment and return the
value of this variable and one that will decrement and return it. This is a trivial example
42

def makeCounter () {
var count := 0
def counter {
to incr() { return count += 1 }
}
return counter
}
? def carol := makeCounter()
# value: <counter>
? carol.incr()
# value: 1
Figure 6.4 : A Counter in E. Variables in E are, by default, unassignable. The var keyword
makes count assignable, which is to say, it binds a new mutable Slot object
to "&count".
def makeCounterPair () {
var count := 0
def upCounter {
to incr() { return count += 1 }
}
def downCounter {
to decr() { return count -= 1 }
}
return [upCounter, downCounter]
}
? def [ u , d ] := makeCounterPair()
# value: [<upCounter>, <downCounter>]
? u.incr()
# value: 1
? u.incr()
# value: 2
? d.incr()
# problem: <NoSuchMethodException: <a downCounter>.incr/0>
? d.decr()
# value: 1
Figure 6.5 : Two Counting Facets Sharing a Slot. makeCounterPair makes a Slot, and it
makes and returns two objects sharing access to that Slot. These three objects
form a lexical composite. The returned objects are facets of this composite.
The Slot is encapsulated within this composite.
43

of a useful technique—deﬁning several objects in the same scope, each providing diﬀerent
operations for manipulating a common state held in that scope.
For compactness of description, we often aggregate a set of objects into a composite.
The three objects created together by each call to makeCounterPair form a lexical composite. Like an individual object, a composite is a combination of state and behavior. Like
an individual object, the state consists of all of the variables within the composite. The
behavior consists of all of the code within the composite, but here we have an important
diﬀerence.
The behavior elicited by a message to the composite depends both on the message and on
which object of the composite receives the message. Objects which may be referred to from
outside the composite, like upCounter and downCounter—are facets of the composite. In
this case, the Slot bound to &count need not be considered a facet since we can tell that no
reference to it can escape from the composite. This demonstrates how the reference passing
rules of objects, combined with encapsulation of object state, supports encapsulation of
objects within composites.
The aggregation of a network of objects into a composite is purely subjective—it allows
us to hide detail when we wish. The technique works because the possible interactions
among disjoint composites obey the same rules as the possible interactions among individual
objects.
6.3 Soft Type Checking
Explicit type systems help ensure compatibility between the behavior a client assumes and
the behavior its provider implements. Static type systems help catch such assumption
mismatches during development, but with two costs in expressive power: 1) Dynamically
safe code that can’t be statically checked is rejected. 2) The only kinds of mismatches that
can be caught are those that can be checked for statically.
By default, E provides only implicit types and dynamic type safety, which catch interface
assumption mismatches at the last moment: when a message is not understood by a recipient. This still fails safe with no loss of expressive power of the ﬁrst kind. E does provide
optional explicit soft types [ CF91], trademarks [ Mor73a, Mor73b], and auditors [ YM03] for
catching assumption mismatches earlier, though still at runtime. Variable declarations and
method returns can be annotated by a colon followed by an expression which evaluates to a
“guard.” At runtime, a guard determines what values may pass, with no loss of expressive
power of the second kind.
Object deﬁnition expressions can be annotated by an implements keyword followed by
a list of expressions which evaluate to “auditors.” At runtime, each auditor is given the
abstract syntax tree of this object deﬁnition expression, to determine whether its instances
would indeed implement the property the auditor represents. If the auditor approves, the
new instances carry its trademark. This forms the basis for a dynamically extensible code
veriﬁcation system. This dissertation employs only two kinds of auditors, stamps and Data,
which we explain here. Further explanation of the auditing framework is beyond the scope
of this dissertation.
The interface...guards... expression deﬁnes a (guard, auditor) pair representing a
new trademark. The auditor of this pair is a stamp, a rubber stamping auditor which approves any object deﬁnition expression it is asked to audit, thereby stamping these instances
44

interface TPoint guards TPointStamp {
to getX() :int
to getY() :int
to add( other :TPoint) :TPoint
}
def makeTPoint (x :int, y :(0..x)) :TPoint {
def tPoint implements TPointStamp {
to getX() :int { return x }
to getY() :int { return y }
to add( other :TPoint) :TPoint {
return makeTPoint(x + other.getX(), y + other.getY())
}
}
return tPoint
}
? def p :TPoint := makePoint(3,5)
# problem: Not audited by TPoint
? def p :TPoint := makeTPoint(3,5)
# problem: 5 is not in the region 0..!4
? def p :TPoint := makeTPoint(3,2)
# value: <tPoint>
Figure 6.6 : Soft Type Checking. Optional soft type checking can help ensure compatibility
between the behavior a client assumes and the one its provider implements.
The guard (after the colon) is asked to approve a value. Disapprovals occur
at runtime, which is later than one might like, but the checks may thus use
the full expressive power of the programming language.
45

with its trademark. The corresponding guard allows only objects carrying this trademark
to pass. For example, Figure 6.6 shows makeTPoint, a variant of makePoint which uses
guards to ensure that its x is an integer and its y is between 0 and x. It stamps all the
points it makes with TPointStamp so that they pass the TPoint guard.
“Data” is both a guard and an auditor. As a guard, the values it passes convey only
information, not authority of any kind. Among the conditions an object must satisfy to
be considered data, it must be transitively immutable. As an auditor, Data only approves
object deﬁnition expressions whose instances obey these constraints. 2 An identical copy of
a data object is indistinguishable from the original. When passed as an argument in remote
messages, data objects are passed by copy.
Soft type checking need not be expensive. Notice that compilers may transparently
optimize 2 + 3 by performing the addition at compile time. Likewise, when a compiler can
determine, by static type inference, that a guard will always pass, it may generate code
without an unnecessary runtime check. A deterministic auditing check which uses only
static information, like the abstract syntax tree of its object deﬁnition expression, can be
memoized, so it only needs to occur once per expression. Current E implementations do
not yet implement these optimizations.
6.4 Notes on Related Work
Reynold’s Gedanken [ Rey70], a dynamically-typed variant of Algol, seems to be the ﬁrst
language with ﬁrst-class indeﬁnite extent lexical closures. Gedanken introduced the trademarking technique explained above [ Mor73a, Mor73b]. Gedanken was pathbreaking regarding many of the issues covered in this dissertation, and is covered further in Related Work
Section 24.1.
E’s technique for deﬁning objects by nested lambda instantiation + message dispatch
dates back at least to Hewitt’s 1973 Actors languages [ HBS73], which combined Gedanken’s
lexical closures with Smalltalk’s method dispatch. Actors is covered further in Chapter 23.
This notion of object is also hinted at in Hoare’s note on “Record Handling” [ Hoa65]. Shroﬀ
and Smith’s Type Inference for First-Class Messages with Match-Functions [SS04] explains
how to statically type objects deﬁned by this technique. We have not yet applied this or
any other static type analysis techniques to E programs.
Many prior systems have provided functions as degenerate objects. In Smalltalk [ GK76],
blocks are a lightweight syntax for deﬁning function-like one-method objects, in which the
default method name is elided. The T language [ RA82] is a dialect of Scheme in which
all closures are objects, and function-invocation syntax invokes one of an object’s methods.
A C++ value type can overload “ operator()” in order to turn function application into
method invocation [ ES90].
Imperative programming language semantics often describe assignable locations as discrete location objects [ KCR98], but this notion is not usually made accessible to the programmer. The ﬁrst programmer-accessible reiﬁcation of locations seems to be the so-called
“ref” type constructor of Algol 68 [ vWMPK69]. This notion is widely familiar today as the
“ref” of ML [ Mil84].
Any imperative language with lexically nested object deﬁnitions, including Smalltalk’s
2 Only the auditing framework in “E-on-CL,” the Common lisp implementation of E [ Rei05], is currently
able to support auditors such as Data.
46

blocks, T [ RA82], Beta [ Mad00], Java’s inner classes, and Emerald [ HRB+87] covered brieﬂy
in Related Work Section 24.6, supports the easy deﬁnition of multiple facets sharing state.
Soft types [ CF91] and higher order contracts [ FF02] have been explored largely in the
context of the Scheme language.
The assurance provided by E’s Data auditor—that any object branded with the Data
trademark is transitively immutable—is similar to Anita Jones’ notion of “memoryless procedures” [ Jon73].
47

48
