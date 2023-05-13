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


## Speed

depth of search will in fact be limited by how fast things are!

if the evaluation function is really quick, then no worries

but if it is not, if we need to look deep into a game tree, then generating the moves themselves is actually pretty key!

Qs:
- how long are we allowed to take to pick move?
- what are the kinds of search strategies we want to use?