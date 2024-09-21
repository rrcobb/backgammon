# backgammon

implementing a MCTS ai, and maybe other heuristic search ai too

Notes:
- JS missing an enum type is bad, missing a tuple is also frustrating...
  - E.g. I end up with a string for the player turn, which is so wack
- Type signatures would also be helpful... maybe just doing it in typescript would be nicer...
- The UI is a bit of a hassle, and maybe also takes away focus from some of the AI pieces. Feels fragile, quite CSS dependent. Rendering in a Canvas seems like it'd be more... natural? idk
- I kinda want to do it in Rust too... maybe next!

Question:
- how deep can the tree search go? How fast is this?

## missing features

- show current player's turn
- show winner
- showing pieces that have been borne off
- starting roll
- doubling cube
- interactive mode? play against the AI?
- scorekeeping between games

## Speed

- depth of search will in fact be limited by how fast things are!
- if the evaluation function is really quick, then no worries
  
Is there low-hanging fruit for making things faster?
- representation changes to stop all the array shuffling
- reimplement in a compiled lang / interface to the js API of the game

Qs:
- how long are we allowed to take to pick move? (1s limit? 5s limit? more?)
- what are the kinds of search strategies we want to use?

## Perf Log

checkpoint 1: evaluation is about half an ms
  - we do... how many evaluations per expectimax level?
    - 36 rolls, several moves per roll (3? 5?)
    - so, 36 times the average work... or 17.5ms per turn
    - for a game of ~80 turns, it should be about 1600ms, so 1.6s
    - but instead, it's... much longer -- close to 4s per turn, 283s!
    - what's happening?
    - way more calls than I thought?
- after some perf attention, things are faster, though not fast
- evaluating the game state hundreds of thousands of time is slow!
- changing the representation to the compressed version for manipulation is likely better for speed too

checkpoint 2: expectimax vs evaluate, runs for too long, but in 10 seconds:

```
Overall stats:
    Total time: 13079.33 ms
    Average game time: 13079.20 ms
    Total turns: 36
    Average turns: 36
    Average turn time: 363.31 ms

Function stats:
makeKey : 2198901 calls, 0.0009ms on average, 1996.06ms in total
safeUpdate : 845519 calls, 0.0108ms on average, 9105.65ms in total
	missed cache 593993/845519 on calls (70.252% miss)
evaluate : 1353382 calls, 0.0081ms on average, 11016.85ms in total
	missed cache 553921/1353382 on calls (40.929% miss)
_em : 8794 calls, 2.7489ms on average, 24173.93ms in total
expectimax : 10 calls, 1304.1552ms on average, 13041.55ms in total
structuredClone : 593993 calls, 0.0090ms on average, 5326.67ms in total
update : 594021 calls, 0.0039ms on average, 2316.67ms in total
```

A full game, in a minute:
```
Overall stats:
    Total time: 59403.34 ms
    Average game time: 59403.19 ms
    Total turns: 49
    Average turns: 49
    Average turn time: 1212.31 ms

Function stats:
makeKey : 14132273 calls, 0.0008ms on average, 11853.29ms in total
safeUpdate : 4336983 calls, 0.0079ms on average, 34194.08ms in total
	missed cache 2131358/4336983 on calls (49.144% miss)
evaluate : 9795290 calls, 0.0049ms on average, 48383.52ms in total
	missed cache 2434761/9795290 on calls (24.856% miss)
_em : 43797 calls, 2.4793ms on average, 108586.71ms in total
expectimax : 21 calls, 2825.6782ms on average, 59339.24ms in total
structuredClone : 2131358 calls, 0.0089ms on average, 19010.83ms in total
update : 2131404 calls, 0.0037ms on average, 7845.88ms in total
```

- well known: almost all the time is somewhere within expectimax
- added some caching / memoization to evaluate and safeUpdate, they got somewhat faster
- structuredClone and update are doing a lot of the work
- after some time, memory does actually become an issue...

The real fix is likely to be to the representation; we want to be working on a Uint8Array instead of an array of arrays of strings.

We should just pause, fix, and test.

## Testing and Evaluation

It'd be a nice thing to do, to fuzz-test the different games

We also need ways of measuring different strategies against each other, for comparison.

For one thing: expectimax is losing to the depth-0 evaluation function, so I've probably got the implementation wrong. For one thing, the evaluation function does not know/care about which player is calling it; for another, we're not min/maxing correctly; there's also likely some other sources of error. When running pure evaluate against itself, white wins more than expected; that seems wrong.

There's also likely some other issues with the way updates and keys work.. I'm seeing a few errors on my asserts, which shouldn't happen.

## Reading

- [TD-Gammon](https://bkgm.com/articles/tesauro/tdl.html)
