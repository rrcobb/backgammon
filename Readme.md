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
  - checkpoint: evaluation is about half an ms
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

Is there low-hanging fruit for making things faster?
- representation changes to stop all the array shuffling
- reimplement in a compiled lang / interface to the js API of the game

Qs:
- how long are we allowed to take to pick move? (1s limit? 5s limit? more?)
- what are the kinds of search strategies we want to use?

## Testing and Evaluation

It'd be a nice thing to do, to fuzz-test the different games

We also need ways of measuring different strategies against each other, for comparison.

## Reading

- [TD-Gammon](https://bkgm.com/articles/tesauro/tdl.html)
