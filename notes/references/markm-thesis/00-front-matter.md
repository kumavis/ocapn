# Front matter


Source: Mark S. Miller, *Robust Composition* (Johns Hopkins PhD thesis, 2006), PDF pp. 1–18.

---

Robust Composition:
Towards a Uniﬁed Approach to Access Control and Concurrency Control
by
Mark Samuel Miller
A dissertation submitted to Johns Hopkins University in conformity with the
requirements for the degree of Doctor of Philosophy.
Baltimore, Maryland
May, 2006
Copyright c⃝ 2006, Mark Samuel Miller. All rights reserved.
Permission is hereby granted to make and distribute verbatim copies of this document
without royalty or fee. Permission is granted to quote excerpts from this documented
provided the original source is properly cited.

ii

Abstract
When separately written programs are composed so that they may cooperate, they
may instead destructively interfere in unanticipated ways. These hazards limit the
scale and functionality of the software systems we can successfully compose. This
dissertation presents a framework for enabling those interactions between components
needed for the cooperation we intend, while minimizing the hazards of destructive
interference.
Great progress on the composition problem has been made within the object
paradigm, chieﬂy in the context of sequential, single-machine programming among
benign components. We show how to extend this success to support robust composition of concurrent and potentially malicious components distributed over potentially
malicious machines. We present E, a distributed, persistent, secure programming
language, and CapDesk, a virus-safe desktop built in E, as embodiments of the techniques we explain.
Advisor: Jonathan S. Shapiro, Ph.D.
Readers: Scott Smith, Ph.D., Yair Amir, Ph.D.
iii

iv

This dissertation is dedicated to the number “3469” and the letter “E”.
v

vi

Acknowledgements
Jonathan Shapiro, my advisor, for encouraging me to continue this work in an academic setting, and for providing insight, encouragement, and support way beyond the
call of any duty.
Terry Stanley, for her patient support, encouragement, and enthusiam for this
project.
My parents, Ann and Bernard Miller. Knowing the naches they would feel,
helped motivate me to complete this dissertation (“Naches” is approximately “reﬂected pride”).
Hewlett-Packard Laboratories for supporting portions of this research, and Alan
Karp for helping to arrange this.
Combex and Henry Boreen for investing in these ideas. I still hope to see this
investment pay oﬀ.
The Defense Advanced Research Projects Agency for sponsoring the security review of E, CapDesk, and the DarpaBrowser [ WT02].
Lauren Williams for rescue from crisis. I don’t know what would have happened
without your help.
The software systems explained in this dissertation are the results of collaborative
eﬀorts starting at Electric Communities, Inc. and continuing with the e-lang online
community. Since the contributors are many and changing, they are accurately documented only by navigation from erights.org. Here, I’d like to single out and express
my gratitude speciﬁcally to E’s most creative and proliﬁc user, Marc Stiegler. He is
the creator and primary developer of the systems documented in Part IV: CapDesk,
Polaris, and the DarpaBrowser. Without his contributions, the value of E would have
remained inaccessibly abstract.
This dissertation borrows liberally from several of my previous papers [ MMF00,
MYS03, MS03, MTS04, MTS05]. Without further attribution, I’d like to especially
thank my co-authors on these papers: Bill Frantz, Chip Morningstar, Jonathan
Shapiro, E. Dean Tribble, Bill Tulloh, and Ka-Ping Yee. I cannot hope to enumerate
all their contributions to the ideas presented here.
I’d also like to thank again all those who contributed to these prior papers: Yair
Amir, Paul Baclace, Darius Bacon, Howie Baetjer, Hans Boehm, Dan Bornstein, Per
Brand, Marc “Lucky Green” Briceno, Michael Butler, Tyler Close, John Corbett, M.
Scott Doerrie, Jed Donnelley, K. Eric Drexler, Ian Grigg, Norm Hardy, Chris Hibbert,
Jack High, Tad Hogg, David Hopwood, Jim Hopwood, Ted Kaehler, Ken Kahn, Piotr
vii

Kaminski, Alan Karp, Terence Kelly, Lorens Kockum, Matej Kosik, Kevin Lacobie,
Charles Landau, Jon Leonard, Mark Lillibridge, Brian Marick, Patrick McGeer, Eric
Messick, Greg Nelson, Eric Northup, Constantine Plotnikov, Jonathan Rees, Kevin
Reid, Matthew Roller, Vijay Saraswat, Christian Scheideler, Scott Smith, Michael
Sperber, Fred Spiessens, Swaroop Sridhar, Terry Stanley, Marc Stiegler, Nick Szabo,
Kazunori Ueda, David Wagner, Bryce “Zooko” Wilcox-O’Hearn, Steve Witham, and
the e-lang and cap-talk communities.
Thanks to Ka-Ping Yee and David Hopwood for a wide variety of assistance. They
reviewed numerous drafts, contributed extensive and deep technical feedback, clarifying rephrasings, crisp illustrations, and moral support. Ka-Ping Yee contributed
Figures 14.2 (p. 107), 14.3 (p. 108), 16.1 (p. 118), and 17.1 (p. 124) with input from
the e-lang community. Thanks to Terry Stanley for suggesting the listener pattern
and purchase-order examples. Thanks to Marc Stiegler for the membrane example
shown in Figure 9.3 (p. 71). Thanks to Darius Bacon for the promise pipelining example shown in Figure 16.1 (p. 118). Thanks to Mark Seaborn for suggesting that the
when-catch expression evaluate to a promise for its handler’s result, as explained in
Section 18.1. Thanks to the Internet Assigned Numbers Authority, for choosing the
perfect port number for Pluribus on their own. Thanks to Norm Hardy for bringing
to my attention the relationship between knowledge and authority in computational
systems.
For helpful suggestions regarding the dissertation itself, I thank Yair Amir, Tyler
Close, M. Scott Doerrie, K. Eric Drexler, Bill Frantz, Norm Hardy, Chris Hibbert,
Ken Kahn, Alan Karp, Patrick McGeer, Chip Morningstar, Eric Northup, Jonathan
Shapiro, Matthew Roller, Scott Smith, Mark Smotherman, Swaroop Sridhar, Terry
Stanley, Marc Stiegler, E. Dean Tribble, Bill Tulloh, and Lauren Williams.
I am eternally grateful to the board of Electric Communities for open sourcing E
when their business plans changed.
Thanks to Kevin Reid and E. Dean Tribble for keeping the E development process
alive and well while I spent time on this dissertation.
viii

Contents
Abstract iii
Acknowledgements vii
List of T ables xv
List of Figures xvii
1 Introduction 1
1.1 Organization of this Dissertation . . . . . . . . . . . . . . . . . . . . . . . . 2
2 Approach and Contributions 5
2.1 Unattenuated Composition . . . . . . . . . . . . . . . . . . . . . . . . . . . 5
2.2 Attenuating Authority . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 6
2.3 Distributed Access Control . . . . . . . . . . . . . . . . . . . . . . . . . . . 6
2.4 Distributed Concurrency Control . . . . . . . . . . . . . . . . . . . . . . . . 7
2.5 Promise Pipelining . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 9
2.6 Delivering Messages in E-ORDER . . . . . . . . . . . . . . . . . . . . . . . 9
2.7 Emergent Robustness . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 10
I The Software Composition Problem 13
3 F ragile Composition 15
3.1 Excess Authority: The Gateway to Abuse . . . . . . . . . . . . . . . . . . . 16
3.2 How Much Authority is Adequate? . . . . . . . . . . . . . . . . . . . . . . . 17
3.3 Shared-State Concurrency is Diﬃcult . . . . . . . . . . . . . . . . . . . . . . 18
3.4 Why a Uniﬁed Approach? . . . . . . . . . . . . . . . . . . . . . . . . . . . . 19
3.5 Notes on Related Work on Designation . . . . . . . . . . . . . . . . . . . . . 20
4 Programs as Plans 23
4.1 Using Objects to Organize Assumptions . . . . . . . . . . . . . . . . . . . . 23
4.1.1 Decomposition . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 23
4.1.2 Encapsulation . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 24
4.1.3 Abstraction . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 24
4.1.4 Composition . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 25
4.2 Notes on Related Work . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 26
ix

5 F orms of Robustness 29
5.1 Vulnerability Relationships . . . . . . . . . . . . . . . . . . . . . . . . . . . 29
5.2 Platform Risk . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 30
5.3 Conventional Correctness . . . . . . . . . . . . . . . . . . . . . . . . . . . . 30
5.4 Cooperative Correctness . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 31
5.5 Defensive Correctness . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 32
5.6 Defensive Consistency . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 32
5.7 A Practical Standard for Defensive Programming . . . . . . . . . . . . . . . 33
5.8 Notes on Related Work . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 35
6 A T aste of E 39
6.1 From Functions to Objects . . . . . . . . . . . . . . . . . . . . . . . . . . . 39
6.1.1 Lambda Abstraction . . . . . . . . . . . . . . . . . . . . . . . . . . . 39
6.1.2 Adding Message Dispatch . . . . . . . . . . . . . . . . . . . . . . . . 40
6.1.3 Adding Side Eﬀects . . . . . . . . . . . . . . . . . . . . . . . . . . . 42
6.2 Composites and Facets . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 42
6.3 Soft Type Checking . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 44
6.4 Notes on Related Work . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 46
7 A T aste of Pluribus 49
7.1 Pointer Safety . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 49
7.2 Distributed Objects . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 50
7.3 Distributed Pointer Safety . . . . . . . . . . . . . . . . . . . . . . . . . . . . 51
7.4 Bootstrapping Initial Connectivity . . . . . . . . . . . . . . . . . . . . . . . 52
7.5 No Central Points of Failure . . . . . . . . . . . . . . . . . . . . . . . . . . . 52
7.6 Notes on Related Work . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 53
II Access Control 55
8 Bounding Access Rights 57
8.1 Permission and Authority . . . . . . . . . . . . . . . . . . . . . . . . . . . . 58
8.2 Notes on Related Work . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 61
9 The Object-Capability Paradigm 63
9.1 The Object-Capability Model . . . . . . . . . . . . . . . . . . . . . . . . . . 64
9.2 Reference Graph Dynamics . . . . . . . . . . . . . . . . . . . . . . . . . . . 66
9.2.1 Connectivity by Initial Conditions . . . . . . . . . . . . . . . . . . . 66
9.2.2 Connectivity by Parenthood . . . . . . . . . . . . . . . . . . . . . . . 66
9.2.3 Connectivity by Endowment . . . . . . . . . . . . . . . . . . . . . . 66
9.2.4 Connectivity by Introduction . . . . . . . . . . . . . . . . . . . . . . 67
9.2.5 Only Connectivity Begets Connectivity . . . . . . . . . . . . . . . . 68
9.3 Selective Revocation: Redell’s Caretaker Pattern . . . . . . . . . . . . . . . 68
9.4 Analysis and Blind Spots . . . . . . . . . . . . . . . . . . . . . . . . . . . . 70
9.5 Access Abstraction . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 72
9.6 Notes on Related Work . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 72
x

10 The Loader: T urning Code Into Behavior 75
10.1 Closed Creation is Adequate . . . . . . . . . . . . . . . . . . . . . . . . . . . 75
10.2 Open Creation is Adequate . . . . . . . . . . . . . . . . . . . . . . . . . . . 75
10.3 Loader Isolation . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 77
10.4 Notes on Related Work . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 78
11 Conﬁnement 81
11.1 A Non-Discretionary Model . . . . . . . . . . . . . . . . . . . . . . . . . . . 83
11.2 The *-Properties . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 83
11.3 The Arena and Terms of Entry . . . . . . . . . . . . . . . . . . . . . . . . . 84
11.4 Composing Access Policies . . . . . . . . . . . . . . . . . . . . . . . . . . . . 85
11.5 The Limits of Decentralized Access Control . . . . . . . . . . . . . . . . . . 85
11.5.1 Implications for Conﬁnement . . . . . . . . . . . . . . . . . . . . . . 86
11.5.2 Implications for the *-Properties . . . . . . . . . . . . . . . . . . . . 86
11.5.3 Implications for Revocation . . . . . . . . . . . . . . . . . . . . . . . 87
11.6 Notes on Related Work . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 88
12 Summary of Access Control 91
III Concurrency Control 93
13 Interleaving Hazards 97
13.1 Sequential Interleaving Hazards . . . . . . . . . . . . . . . . . . . . . . . . . 97
13.2 Why Not Shared-State Concurrency? . . . . . . . . . . . . . . . . . . . . . . 100
13.3 Preserving Consistency . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 101
13.4 Avoiding Deadlock . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 101
13.5 Race Conditions . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 102
13.6 Notes on Related Work . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 103
14 Two W ays to Postpone Plans 105
14.1 The Vat . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 106
14.2 Communicating Event-Loops . . . . . . . . . . . . . . . . . . . . . . . . . . 107
14.3 Issues with Event-loops . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 109
14.4 Notes on Related Work . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 110
15 Protection from Misbehavior 113
15.1 Can’t Just Avoid Threads by Convention . . . . . . . . . . . . . . . . . . . 113
15.2 Reify Distinctions in Authority as Distinct Objects . . . . . . . . . . . . . . 113
15.3 Notes on Related Work . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 115
16 Promise Pipelining 117
16.1 Promises . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 117
16.2 Pipelining . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 117
16.3 Datalock . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 118
16.4 Explicit Promises . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 119
16.5 Broken Promise Contagion . . . . . . . . . . . . . . . . . . . . . . . . . . . 120
16.6 Notes on Related Work . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 120
xi

17 Partial F ailure 123
17.1 Handling Loss of a Provider . . . . . . . . . . . . . . . . . . . . . . . . . . . 124
17.2 Handling Loss of a Client . . . . . . . . . . . . . . . . . . . . . . . . . . . . 125
17.3 Oﬄine Capabilities . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 126
17.4 Persistence . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 126
17.5 Notes on Related Work . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 127
18 The When-Catch Expression 129
18.1 Eventual Control Flow . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 131
18.2 Manual Continuation-Passing Style . . . . . . . . . . . . . . . . . . . . . . . 132
18.3 Notes on Related Work . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 133
19 Delivering Messages in E-ORDER 137
19.1 E-ORDER Includes Fail-Stop FIFO . . . . . . . . . . . . . . . . . . . . . . 137
19.2 FIFO is Too Weak . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 137
19.3 Forks in E-ORDER . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 138
19.4 CAUSAL Order is Too Strong . . . . . . . . . . . . . . . . . . . . . . . . . 139
19.5 Joins in E-ORDER . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 139
19.6 Fairness . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 141
19.7 Notes on Related Work . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 141
IV Emergent Robustness 145
20 Composing Complex Systems 147
20.1 The Fractal Locality of Knowledge . . . . . . . . . . . . . . . . . . . . . . . 147
21 The F ractal Nature of Authority 149
21.1 Human-Granularity POLA in an Organization . . . . . . . . . . . . . . . . 151
21.2 Application-Granularity POLA on the Desktop . . . . . . . . . . . . . . . . 152
21.3 Module-Granularity POLA Within a Caplet . . . . . . . . . . . . . . . . . . 154
21.4 Object-Granularity POLA . . . . . . . . . . . . . . . . . . . . . . . . . . . . 155
21.5 Object-Capability Discipline . . . . . . . . . . . . . . . . . . . . . . . . . . . 156
21.6 Notes on Related Work . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 156
22 Macro Patterns of Robustness 159
22.1 Nested Platforms Follow the Spawning Tree . . . . . . . . . . . . . . . . . . 159
22.2 Subcontracting Forms Dynamic Networks of Authority . . . . . . . . . . . . 159
22.3 Legacy Limits POLA, But Can be Managed Incrementally . . . . . . . . . . 159
22.4 Nested POLA Multiplicatively Reduces Attack Surface . . . . . . . . . . . . 160
22.5 Let “Knows About” Shape “Access To” . . . . . . . . . . . . . . . . . . . . 160
22.6 Notes on Related Work . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 161
V Related Work 163
23 F rom Objects to Actors and Back Again 165
23.1 Objects . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 165
xii

23.2 Actors . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 166
23.3 Vulcan . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 166
23.4 Joule . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 166
23.5 Promise Pipelining in Udanax Gold . . . . . . . . . . . . . . . . . . . . . . . 166
23.6 Original-E . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 167
23.7 From Original-E to E . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 167
24 Related Languages 169
24.1 Gedanken . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 169
24.2 Erlang . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 169
24.3 Argus . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 170
24.4 W7 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 171
24.5 J-Kernel . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 171
24.6 Emerald . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 172
24.7 Secure Network Objects . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 172
25 Other Related W ork 173
25.1 Group Membership . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 173
25.2 Croquet and TeaTime . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 173
25.3 DCCS . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 174
25.4 Amoeba . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 174
25.5 Secure Distributed Mach . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 174
25.6 Client Utility . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 174
26 W ork Inﬂuenced by E 177
26.1 The Web-Calculus . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 177
26.2 Twisted Python . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 177
26.3 Oz-E . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 177
26.4 SCOLL . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 178
26.5 Joe-E . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 179
26.6 Emily . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 180
26.7 Subjects . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 180
26.8 Tweak Islands . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 181
27 Conclusions and F uture W ork 183
27.1 Contributions . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 183
27.2 Future Work . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 184
27.3 Continuing Eﬀorts . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 185
Bibliography 187
Vita 207
xiii

xiv

List of Tables
8.1 Bounds on Access Rights . . . . . . . . . . . . . . . . . . . . . . . . . . . . 60
9.1 Capability / OS / Object corresponding concepts . . . . . . . . . . . . . . . 64
21.1 Security as Extreme Modularity . . . . . . . . . . . . . . . . . . . . . . . . . 156
xv

xvi

List of Figures
2.1 Unattenuated Composition . . . . . . . . . . . . . . . . . . . . . . . . . . . 5
2.2 Attenuating Authority . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 6
2.3 Distributed Access Control . . . . . . . . . . . . . . . . . . . . . . . . . . . 7
2.4 Distributed Concurrency Control . . . . . . . . . . . . . . . . . . . . . . . . 8
2.5 Promise Pipelining . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 9
2.6 Delivering Messages in E-ORDER . . . . . . . . . . . . . . . . . . . . . . . 10
2.7 Emergent Robustness . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 11
3.1 Purposes and Hazards . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 15
3.2 Functionality vs. Security? . . . . . . . . . . . . . . . . . . . . . . . . . . . 17
3.3 Progress vs. Consistency? . . . . . . . . . . . . . . . . . . . . . . . . . . . . 19
4.1 Composition Creates New Relationships . . . . . . . . . . . . . . . . . . . . 25
5.1 A Cooperatively Correct Counter in Java . . . . . . . . . . . . . . . . . . . 31
5.2 A Defensively Consistent Counter in Java . . . . . . . . . . . . . . . . . . . 33
6.1 Lexically Nested Function Deﬁnition . . . . . . . . . . . . . . . . . . . . . . 40
6.2 Objects as Closures . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 41
6.3 Expansion to Kernel-E . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 42
6.4 A Counter in E . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 43
6.5 Two Counting Facets Sharing a Slot . . . . . . . . . . . . . . . . . . . . . . 43
6.6 Soft Type Checking . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 45
7.1 Distributed Introduction . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 50
8.1 Access Diagrams Depict Protection State . . . . . . . . . . . . . . . . . . . 58
8.2 Authority is the Ability to Cause Eﬀects . . . . . . . . . . . . . . . . . . . . 59
9.1 Introduction by Message Passing . . . . . . . . . . . . . . . . . . . . . . . . 67
9.2 Redell’s Caretaker Pattern . . . . . . . . . . . . . . . . . . . . . . . . . . . . 69
9.3 Membranes Form Compartments . . . . . . . . . . . . . . . . . . . . . . . . 71
10.1 Closed Creation is Adequate . . . . . . . . . . . . . . . . . . . . . . . . . . . 76
10.2 Open Creation is Adequate . . . . . . . . . . . . . . . . . . . . . . . . . . . 76
11.1 Factory-based Conﬁnement . . . . . . . . . . . . . . . . . . . . . . . . . . . 82
11.2 Cassie Checks Conﬁnement . . . . . . . . . . . . . . . . . . . . . . . . . . . 84
11.3 Unplanned Composition of Access Policies . . . . . . . . . . . . . . . . . . . 85
xvii

13.1 The Sequential Listener Pattern in Java . . . . . . . . . . . . . . . . . . . . 98
13.2 Anatomy of a Nested Publication Bug . . . . . . . . . . . . . . . . . . . . . 99
13.3 Thread-safety is Surprisingly Hard . . . . . . . . . . . . . . . . . . . . . . . 101
13.4 A First Attempt at Deadlock Avoidance . . . . . . . . . . . . . . . . . . . . 102
14.1 The Sequential Listener Pattern in E . . . . . . . . . . . . . . . . . . . . . . 105
14.2 A Vat’s Thread Services a Stack and a Queue . . . . . . . . . . . . . . . . . 107
14.3 An Eventually-Sent Message is Queued in its Target’s Vat . . . . . . . . . . 108
15.1 Reify Distinctions in Authority as Distinct Objects . . . . . . . . . . . . . . 114
16.1 Promise Pipelining . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 118
16.2 Datalock . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 119
17.1 Reference States and Transitions . . . . . . . . . . . . . . . . . . . . . . . . 124
18.1 Eventual Conjunction . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 130
18.2 Using Eventual Control Flow . . . . . . . . . . . . . . . . . . . . . . . . . . 130
18.3 The Default Joiner . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 131
19.1 Forks in E-ORDER . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 138
19.2 Eventual Equality as Join . . . . . . . . . . . . . . . . . . . . . . . . . . . . 140
19.3 Joins in E-ORDER . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 141
21.1 Attack Surface Area Measures Risk . . . . . . . . . . . . . . . . . . . . . . . 150
21.2 Barb’s Situation . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 151
21.3 Doug’s Situation . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 153
21.4 Level 4: Object-granularity POLA . . . . . . . . . . . . . . . . . . . . . . . 155
xviii
