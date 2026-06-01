# Spritely: “Conundrum: Message Ordering” (verbatim excerpts)

**Thread:** https://community.spritely.institute/t/conundrum-message-ordering/28  

**Mirrors in this directory:** `spritely-conundrum-message-ordering-28.json` (full Discourse export), `spritely-conundrum-message-ordering-28-post8.html`, `spritely-conundrum-message-ordering-28-post9.html`.

**Fetched:** 2026-05-06 (re-fetch for updates).

---

## Post #8 — @markm (2022-10-06)

> **frandallfarmer:** What does ordered messaging look like in a universe of promise pipelining? And what do we mean by resilience in our world…

For any of the message orders being considered for these distributed ocap systems, promise pipelining can be introduced without hurting the ordering. But the ordering sometimes does constrain the pipelining, and often does around the edges. Decide what ordering you’d like, and then just make sure you don’t break it when you add pipelining.

Lately I’ve come to favor Tyler’s point-to-point fifo ordering over e-order, given appropriate affordances and conventions to recover e-order, or something e-order-like, at the user level.

---

## Post #9 — @markm (2022-10-06)

> **cwebber:** E-Order can fall apart. More useful conversation on [this cap-talk thread](https://groups.google.com/g/cap-talk/c/R5kc06XGqWs/m/WDraOqkQAgAJ).

> Prior to the “Lost Resolution Bug”, E-Order appears to be something delivered “for free”, falling out of the implementation naturally. We can jump up and down and say “look at this thing we got at no extra cost!”

This is indeed one of the considerations leading me to retreat to Tyler’s Waterken point-to-point fifo.

Even after that retreat, there’s a related problem we’ve internally at Agoric been calling the “Auxiliary Data Problem” for which we have several adequate but complex paper designs. I have in progress a cheap approximation at [fix: cheap auxdata · Agoric/agoric-sdk#6355](https://github.com/Agoric/agoric-sdk/pull/6355) that I owe everyone a writeup about. Might as well mention it here so I’ll owe it to y’all as well.
