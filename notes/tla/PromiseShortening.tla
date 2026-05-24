------------------------ MODULE PromiseShortening ------------------------
(***************************************************************************)
(* Two-party promise resolution + pipelining + optional shortening.        *)
(*                                                                         *)
(* Alice (Vat A) calls Bob (Vat B); the answer is a promise P.  Bob is     *)
(* the resolver: he will eventually pick what P resolves to.  Alice        *)
(* pipelines messages on P; each message carries a monotonically           *)
(* increasing sequence number.  We track the order in which those          *)
(* messages are delivered at OBJ, the final target of P.                   *)
(*                                                                         *)
(* The network has two per-pair FIFO channels:                             *)
(*   chanAB :  Alice -> Bob                                                *)
(*   chanBA :  Bob   -> Alice                                              *)
(*                                                                         *)
(* This spec does NOT model promise-resolves-to-promise shortening (chain  *)
(* shortening).  It only covers the simpler case: the promise resolves to  *)
(* a remotable reference on one of the two existing vats.                  *)
(*                                                                         *)
(* Two CONSTANTS pick the scenario:                                        *)
(*                                                                         *)
(*   TARGET \in {"A", "B"}                                                 *)
(*     "A" - P resolves to a ref to OBJ inside Alice's vat                 *)
(*           (the "loopback" / "2-vat-resolve-to-sender" case)             *)
(*     "B" - P resolves to a ref to OBJ inside Bob's vat                   *)
(*           (the "same-connection" case)                                  *)
(*                                                                         *)
(*   SHORTEN \in BOOLEAN                                                   *)
(*     FALSE - every send Alice makes on P goes down chanAB.  No           *)
(*             protocol-level path optimization.  This is the              *)
(*             Waterken-style "no shortening" baseline.                    *)
(*     TRUE  - once Alice has learned the resolution, subsequent sends on  *)
(*             P go directly to OBJ instead of through the resolver:       *)
(*               * TARGET = "A": send is delivered locally in Alice (the   *)
(*                 wire path changes from A->B->A to A->local)             *)
(*               * TARGET = "B": send still goes A->B (the wire path       *)
(*                 doesn't actually change), so this configuration is      *)
(*                 observationally identical to SHORTEN = FALSE            *)
(*                                                                         *)
(* The expectation (matches markm's analysis in the Endo transcript and    *)
(* the implementations of DelayedRedirector / Disembargo / op:flush):      *)
(*                                                                         *)
(*   TARGET   SHORTEN   EndToEndFIFO                                       *)
(*   -----    -------   -----------                                        *)
(*   A        FALSE     holds  (per-pipe FIFO does the work)               *)
(*   A        TRUE      VIOLATED - the race                                *)
(*   B        FALSE     holds                                              *)
(*   B        TRUE      holds  (wire path doesn't change; same FIFO)       *)
(***************************************************************************)

EXTENDS Naturals, Sequences, TLC

CONSTANTS
    NumMessages,   \* messages Alice sends on the promise (e.g. 3)
    TARGET,        \* "A" or "B" - which vat hosts OBJ
    SHORTEN        \* TRUE = admit shortening; FALSE = always route via Bob

ASSUME TARGET \in {"A", "B"}
ASSUME SHORTEN \in BOOLEAN
ASSUME NumMessages \in Nat \ {0}

VARIABLES
    chanAB,        \* A -> B FIFO channel
    chanBA,        \* B -> A FIFO channel
    chanLocal,     \* A's local turn queue (only used when SHORTEN /\ TARGET = "A")
    bobPending,    \* calls received by Bob, awaiting resolution+forward (FIFO)
    aliceResolved, \* has Alice received the Resolve notification yet?
    bobResolved,   \* has Bob picked his resolution yet?
    aliceSent,     \* count of messages Alice has emitted so far
    deliveryOrder  \* sequence numbers of messages delivered to OBJ, in arrival order

vars == << chanAB, chanBA, chanLocal, bobPending,
           aliceResolved, bobResolved, aliceSent, deliveryOrder >>

----------------------------------------------------------------------------
(* Message constructors *)

Call(n)    == [type |-> "call", seq |-> n]
ResolveMsg == [type |-> "resolve"]

Messages == [type: {"call"}, seq: 1..NumMessages] \cup {ResolveMsg}

----------------------------------------------------------------------------
(* Type invariant *)

TypeOK ==
    /\ chanAB \in Seq(Messages)
    /\ chanBA \in Seq(Messages)
    /\ chanLocal \in Seq(Messages)
    /\ bobPending \in Seq(Messages)
    /\ aliceResolved \in BOOLEAN
    /\ bobResolved \in BOOLEAN
    /\ aliceSent \in 0..NumMessages
    /\ deliveryOrder \in Seq(1..NumMessages)

----------------------------------------------------------------------------
(* Initial state *)

Init ==
    /\ chanAB = << >>
    /\ chanBA = << >>
    /\ chanLocal = << >>
    /\ bobPending = << >>
    /\ aliceResolved = FALSE
    /\ bobResolved = FALSE
    /\ aliceSent = 0
    /\ deliveryOrder = << >>

----------------------------------------------------------------------------
(* Actions *)

(***************************************************************************)
(* Alice sends the next pipelined message on the promise.                  *)
(*                                                                         *)
(* If shortening is admitted AND Alice has learned the resolution AND the  *)
(* resolution is local (TARGET = "A"), the message goes onto her local     *)
(* turn queue for direct delivery to OBJ - bypassing the wire entirely.    *)
(* Otherwise, it goes onto chanAB toward Bob.                              *)
(***************************************************************************)
AliceSendCall ==
    /\ aliceSent < NumMessages
    /\ LET n == aliceSent + 1 IN
       /\ aliceSent' = n
       /\ IF SHORTEN /\ aliceResolved /\ TARGET = "A"
          THEN /\ chanLocal' = Append(chanLocal, Call(n))
               /\ UNCHANGED chanAB
          ELSE /\ chanAB' = Append(chanAB, Call(n))
               /\ UNCHANGED chanLocal
    /\ UNCHANGED << chanBA, bobPending, aliceResolved, bobResolved,
                    deliveryOrder >>

(***************************************************************************)
(* Bob receives a call from chanAB and stashes it in his pending queue.    *)
(* He cannot deliver or forward it until he has resolved the promise.      *)
(***************************************************************************)
BobReceiveCall ==
    /\ Len(chanAB) > 0
    /\ Head(chanAB).type = "call"
    /\ bobPending' = Append(bobPending, Head(chanAB))
    /\ chanAB' = Tail(chanAB)
    /\ UNCHANGED << chanBA, chanLocal, aliceResolved, bobResolved,
                    aliceSent, deliveryOrder >>

(***************************************************************************)
(* Bob picks the resolution and notifies Alice via chanBA.                 *)
(***************************************************************************)
BobResolve ==
    /\ ~bobResolved
    /\ bobResolved' = TRUE
    /\ chanBA' = Append(chanBA, ResolveMsg)
    /\ UNCHANGED << chanAB, chanLocal, bobPending, aliceResolved,
                    aliceSent, deliveryOrder >>

(***************************************************************************)
(* Bob processes the next pending call, now that he knows where OBJ lives. *)
(*   TARGET = "A": forward the call to Alice via chanBA                    *)
(*   TARGET = "B": deliver directly to OBJ (which lives locally in Bob)    *)
(***************************************************************************)
BobProcessPending ==
    /\ bobResolved
    /\ Len(bobPending) > 0
    /\ LET msg == Head(bobPending) IN
       /\ bobPending' = Tail(bobPending)
       /\ IF TARGET = "A"
          THEN /\ chanBA' = Append(chanBA, msg)
               /\ UNCHANGED deliveryOrder
          ELSE /\ deliveryOrder' = Append(deliveryOrder, msg.seq)
               /\ UNCHANGED chanBA
    /\ UNCHANGED << chanAB, chanLocal, aliceResolved, bobResolved,
                    aliceSent >>

(***************************************************************************)
(* Alice receives whatever is at the head of chanBA.                       *)
(*   - A Resolve updates her local state.                                  *)
(*   - A Call is a redirected pipelined message (TARGET = "A" only) and    *)
(*     gets delivered to OBJ.                                              *)
(***************************************************************************)
AliceReceive ==
    /\ Len(chanBA) > 0
    /\ LET msg == Head(chanBA) IN
       /\ chanBA' = Tail(chanBA)
       /\ IF msg.type = "resolve"
          THEN /\ aliceResolved' = TRUE
               /\ UNCHANGED deliveryOrder
          ELSE /\ deliveryOrder' = Append(deliveryOrder, msg.seq)
               /\ UNCHANGED aliceResolved
    /\ UNCHANGED << chanAB, chanLocal, bobPending, bobResolved, aliceSent >>

(***************************************************************************)
(* Alice delivers a locally-shortened message to OBJ.  Only fires when     *)
(* TARGET = "A" and SHORTEN is TRUE.                                       *)
(***************************************************************************)
AliceLocalDeliver ==
    /\ Len(chanLocal) > 0
    /\ deliveryOrder' = Append(deliveryOrder, Head(chanLocal).seq)
    /\ chanLocal' = Tail(chanLocal)
    /\ UNCHANGED << chanAB, chanBA, bobPending, aliceResolved, bobResolved,
                    aliceSent >>

----------------------------------------------------------------------------
(* Next-state relation *)

Next ==
    \/ AliceSendCall
    \/ BobReceiveCall
    \/ BobResolve
    \/ BobProcessPending
    \/ AliceReceive
    \/ AliceLocalDeliver

Spec == Init /\ [][Next]_vars

----------------------------------------------------------------------------
(* Invariants *)

(***************************************************************************)
(* The property under test: messages delivered to OBJ appear in increasing *)
(* send-order.  Equivalently, deliveryOrder is a strictly increasing       *)
(* prefix of <<1, 2, ..., NumMessages>>.                                   *)
(***************************************************************************)
EndToEndFIFO ==
    \A i \in 1..(Len(deliveryOrder) - 1):
        deliveryOrder[i] < deliveryOrder[i + 1]

============================================================================
