## devlog - JS missing an enum type is bad, missing a tuple is also frustrating...

- E.g. I end up with a string for the player turn, which is so wack
- Type signatures would also be helpful... maybe just doing it in typescript would be nicer...
- The UI is a bit of a hassle, and maybe also takes away focus from some of the AI pieces. Feels fragile, quite CSS dependent. Rendering in a Canvas seems like it'd be more... natural? idk
- I kinda want to do it in Rust too... maybe next! (if the speed really is that limiting...)

Question:

- how deep can the tree search go? How fast is this?

## Speed

- depth of search will in fact be limited by how fast things are!
- if the evaluation function is really quick, then no worries

Is there low-hanging fruit for making things faster?

- representation changes to stop all the array shuffling :check:
- reimplement in a compiled lang / interface to the js API of the game

Qs:

- how long are we allowed to take to pick move? (1s limit? 5s limit? more?)
- what are the kinds of search strategies we want to use?

## Perf Log: Implementation 1 (strings in arrays)

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

There's also likely some other issues with the way updates and keys work.. I'm seeing a few errors on my asserts, which shouldn't happen.

For one thing: expectimax is losing to the depth-0 evaluation function, so I've probably got the implementation wrong. For one thing, the evaluation function does not know/care about which player is calling it; for another, we're not min/maxing correctly; there's also likely some other sources of error. When running pure evaluate against itself, white wins more than expected; that seems wrong.

## initial browser version

We have ways of measuring different strategies against each other, for comparison.

bench/game.ts measures some naive strategies against each other in speed terms... which is sort of like a real evaluation, since shorter games should be faster...

## improved implementation: binary board positions, using Uint8array, separate home and bar ints

lots of subtle bugs in the ordering of the handling of different parts of the game. Tests helped find and fix them. The code is a bit of a hairball (see src/backgammon.ts:validMoves).

Tests first, then benchmarking, then refactoring.

Refactoring!

- so nice to refactor under test
- hopefully, refactoring will enable some isolation of hotspots so that we can speed up more carefully

- refactor doesn't seem to have slowed things down a ton... but it's not that precise.

Benchmarking. Additional speedups.

Further speedups:

- bar and home currently reference string properties in the game object. Could likely speed up those accesses if we didn't do that. Since we have to switch on strings, and we have a number, which always copies instead of passing as a reference.
- we create and keep around a lot of duplicate game objects. might not be needed
- walking through every result to add further steps to it seems potentially slow; maybe we could keep a list of positions with pieces, and check that instead? Maybe we could check through the rolls, and then subsequently re-check with the positions that the rolls give us access to. Maybe that's the same as we have now?
- handle doubles specially, so it's not in our core loop?

## Testing

hurrah for testing!

Using bun test is really nice.

The tests run in 26ms, give me high confidence, and are (relatively) easy to write. I mostly have to think about what moves are actually valid, not anything else.

It'd be a nice thing to do, to fuzz-test the game logic and ensure some invariants hold. e.g. no matter how many moves are played, we never reach an invalid state.

## Benchmarking

mitata is nice, though the docs aren't much.

there's something funny about the game! I think sometimes it gets hung on some situation, and is deadlocked? some games take 1e7 rolls, but it's pretty rare. Shows up in the benchmarking.

Usually, the benchmark finds that a full game takes about 3ms to run. However, sometimes it is much longer! If the game is allowed to take lots more turns, it's possible for it to run quite a long time.

Also... choosing the moves seems like it takes a lot of the time? like, random is much slower than first option.

There's some neat little tricks... clone is much faster if we just make a new object with a literal syntax instead of spreading or structuredCloning or object.assign. like, lots faster!

games typically run in ~3ms, but I think sometimes get stuck taking much longer. like, the range is very wide, and the mean is driven by high outliers that take many turns to complete.

```
$ bun bench/game.ts
clk: ~3.53 GHz
cpu: Intel(R) Core(TM) i7-1068NG7 CPU @ 2.30GHz
runtime: bun (x64-darwin)

benchmark              avg (min … max) p75   p99    (min … top 1%)
-------------------------------------- -------------------------------
first valid option        2.41 ms/iter   2.00 ms  █
                (629.17 µs … 44.03 ms)  24.64 ms ▇█▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
second valid option      80.31 ms/iter 109.45 ms           █
                 (1.30 ms … 123.72 ms) 119.78 ms █▁▁▁▁▁▁▁▁▁█▁▁▁█▁▁▁█▁▁
random option             8.42 ms/iter   5.87 ms  █
                  (1.49 ms … 40.78 ms)  38.48 ms ██▇▂▃▂▁▁▂▁▁▁▁▁▁▁▃▃▂▂▁
pseudorandom option      13.52 ms/iter   7.41 ms █▇
                  (1.31 ms … 59.48 ms)  57.50 ms ██▃▂▂▁▁▁▁▁▁▁▁▁▁▁▃▅▃▁▁

summary
  first valid option
   3.5x faster than random option
   5.62x faster than pseudorandom option
   33.36x faster than second valid option
```

Okay, so... all of the benchmark issues seem like the were from bugs, mostly with bearing off, but also a bit from entering from the bar. Bearing off was missing the 1 point, and also not returning options in some cases, which could lead to deadlock.

Now that those are fixed, we see a much tighter spread:

```
$ bun bench/game.ts
clk: ~3.39 GHz
cpu: Intel(R) Core(TM) i7-1068NG7 CPU @ 2.30GHz
runtime: bun (x64-darwin)

benchmark              avg (min … max) p75   p99    (min … top 1%)
-------------------------------------- -------------------------------
first valid option        1.78 ms/iter   2.04 ms    ▆▅▆█▆▃
                 (745.41 µs … 4.98 ms)   3.66 ms ▁▃▆██████▅▇▆▃▄▅▃▂▂▁▁▁
second valid option       2.14 ms/iter   2.48 ms   ▂▃█▆▄ ▂
                 (936.38 µs … 5.44 ms)   4.56 ms ▁▄█████▇██▅▃▂▄▃▃▃▁▁▁▁
last valid option       922.28 µs/iter 996.79 µs    ▃▄▇█▄
                 (485.57 µs … 2.24 ms)   1.84 ms ▁▂▆█████▇▆▅▃▃▂▂▂▂▁▂▂▁
random option             3.80 ms/iter   4.82 ms   ▇▅█
                  (1.19 ms … 13.85 ms)  11.54 ms ██████▇▇▅▆▃▃▂▂▃▂▁▁▂▂▁
pseudorandom option       3.62 ms/iter   4.60 ms  ▄▂█▅▇▇▂▂
                   (1.14 ms … 9.87 ms)   8.90 ms ██████████▇▅▆▆▄▂▂▃▁▂▂
cheap modulo option       3.56 ms/iter   4.68 ms   ▂▇▄█▇
                   (1.02 ms … 9.96 ms)   8.49 ms ▅███████▇▅▇▅▅▇▄▅▂▂▂▂▂

summary
  last valid option
   1.93x faster than first valid option
   2.32x faster than second valid option
   3.86x faster than cheap modulo option
   3.92x faster than pseudorandom option
   4.12x faster than random option
```

It looks like the last option tends to be fastest; I wonder if that also means it performs best when we tournament these against each other.

Makes me think there could be some bugs left, and that fuzz / property testing would be worth the time invested.

## Rendering

got the html build working again, with the new binary game setup.

The api changed a bit between the two versions -- takeTurn now returns [Move, Game] which means we can't just assign it.

Maybe also displaying the valid moves (as a precursor to allowing human vs. AI play, or human vs. human play)

## Ai again

- expectimax sort of working, with at least a couple of tests
- it breaks Claude's brain, but it's still at least a little helpful
- if we can constrain the range of the evaluation function, we can use a version of a/b pruning when we look at the possible average achievable by a node in the tree
- pruning is important, we are currently really slow
- the evaluation function is pretty dumb rn, but could get good
  - incorporate some hit probabilities
  - check for pipcount
  - reward the golden prime
  - how to think about back game?
- we could check the evaluation function to decide whether to look deeper into the tree for a given move
  - e.g. cut off dumb lines of search earlier
- we could also sample from the rolls instead of evaluating all of them

## More ideas for speed improvements... pending finding legit hotspots

can do movement checks in a bitwise op:

- 25 positions for starts
- 25 valid ends
- shift by roll
- ^ or & depending on how the positions are represented
- bearing off and multiple rolls trickier

can represent a game in 140 bits:

- 24 x 5 bits (player, how many pieces)
- white and black bar, a byte
- white and black home, a byte
- doubling cube, five bits

128 bits: 24 positions and the bar, no cube, home inferred

very likely that games can be compressed further, maybe a hamming tree

a strategy takes a board state and die roll and outputs a new board state

a big nn could have just a game as input layer, or it could have game plus more info from eg a planning system

would the nn work on the compressed stream?

## some benchmarking

a couple runs of the benchmarking script (bench/strategies.ts)

```sh
$ bun bench/strategies.ts
clk: ~3.45 GHz
cpu: Intel(R) Core(TM) i7-1068NG7 CPU @ 2.30GHz
runtime: bun 1.1.30 (x64-darwin)

benchmark              avg (min … max) p75   p99    (min … top 1%)
-------------------------------------- -------------------------------
genGame                   8.97 µs/iter   8.45 µs  29.84 µs ▆█▁▁▁▁▁▁▁▁▁
generateRoll              5.34 ns/iter   5.28 ns   8.73 ns ▁█▁▁▁▁▁▁▁▁▁
game + roll + validMo..  70.55 µs/iter  47.45 µs 378.06 µs █▂▁▁▁▂▁▁▁▁▁

-------------------------------------- -------------------------------
apply balanced to 10 ..  71.23 µs/iter  72.53 µs    █▄
                (58.49 µs … 285.57 µs) 126.79 µs ▃▇▆██▅▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁
apply claude to 10 sc..  77.66 µs/iter  74.61 µs   █▄
                  (58.87 µs … 2.48 ms) 160.23 µs ▂▄██▂▁▁▁▁▂▂▂▁▁▁▁▁▁▁▁▁
apply claudeExpecti t..    2.26 s/iter    2.31 s  █
                     (2.09 s … 2.57 s)    2.49 s █████▁▁█▁█▁█▁▁▁▁▁▁▁█▁

summary
  apply balanced to 10 scenarios
   1.09x faster than apply claude to 10 scenarios
   31711.94x faster than apply claudeExpecti to 10 scenarios
claudeExpecti (total, 10 scenarios):{"validMoves":15552,"evalFunc":1161508,"expectimax":1161940}
claudeExpecti (scenario 1):{"validMoves":4320,"evalFunc":427004,"expectimax":427124}
claudeExpecti (scenario 2):{"validMoves":1872,"evalFunc":50585,"expectimax":50637}
claudeExpecti (scenario 3):{"validMoves":36,"evalFunc":1634,"expectimax":1635}
claudeExpecti (scenario 4):{"validMoves":1836,"evalFunc":142934,"expectimax":142985}
claudeExpecti (scenario 5):{"validMoves":36,"evalFunc":795,"expectimax":796}
claudeExpecti (scenario 6):{"validMoves":1620,"evalFunc":98175,"expectimax":98220}
claudeExpecti (scenario 7):{"validMoves":36,"evalFunc":3285,"expectimax":3286}
claudeExpecti (scenario 8):{"validMoves":720,"evalFunc":94369,"expectimax":94389}
claudeExpecti (scenario 9):{"validMoves":1764,"evalFunc":74413,"expectimax":74462}
claudeExpecti (scenario 10):{"validMoves":3312,"evalFunc":268314,"expectimax":268406}```
```

```sh
$ bun bench/strategies.ts
clk: ~3.55 GHz
cpu: Intel(R) Core(TM) i7-1068NG7 CPU @ 2.30GHz
runtime: bun 1.1.30 (x64-darwin)

benchmark              avg (min … max) p75   p99    (min … top 1%)
-------------------------------------- -------------------------------
apply balanced to 10 ..  42.56 µs/iter  41.60 µs   █
                (35.35 µs … 217.83 µs)  82.47 µs ▂▁█▆▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
apply claude to 10 sc..  42.69 µs/iter  43.39 µs            █
                 (40.38 µs … 45.08 µs)  44.72 µs █▁█▁▁█▁█▁█▁██▁█▁█▁▁▁▁
apply claudeExpecti t..    1.19 s/iter    1.22 s                   ██
                     (1.09 s … 1.29 s)    1.23 s █▁█▁▁▁▁██▁▁▁▁▁█▁█▁██▁

summary
  apply balanced to 10 scenarios
   1x faster than apply claude to 10 scenarios
   27980.36x faster than apply claudeExpecti to 10 scenarios
claudeExpecti (total, 10 scenarios):{"validMoves":10764,"evalFunc":806345,"expectimax":806644}
claudeExpecti (scenario 1 [_id 1335920278 17 options]):{"validMoves":612,"evalFunc":67057,"expectimax":67074}
claudeExpecti (scenario 2 [_id 702452313 22 options]):{"validMoves":792,"evalFunc":21379,"expectimax":21401}
claudeExpecti (scenario 3 [_id 2147483620 1 options]):{"validMoves":36,"evalFunc":1301,"expectimax":1302}
claudeExpecti (scenario 4 [_id 1 68 options]):{"validMoves":2448,"evalFunc":176720,"expectimax":176788}
claudeExpecti (scenario 5 [_id 1260141739 1 options]):{"validMoves":36,"evalFunc":178,"expectimax":179}
claudeExpecti (scenario 6 [_id 30 60 options]):{"validMoves":2160,"evalFunc":131955,"expectimax":132015}
claudeExpecti (scenario 7 [_id 25 1 options]):{"validMoves":36,"evalFunc":2019,"expectimax":2020}
claudeExpecti (scenario 8 [_id 2147483634 22 options]):{"validMoves":792,"evalFunc":104748,"expectimax":104770}
claudeExpecti (scenario 9 [_id 347289096 7 options]):{"validMoves":252,"evalFunc":8360,"expectimax":8367}
claudeExpecti (scenario 10 [_id 2147483622 100 options]):{"validMoves":3600,"evalFunc":292628,"expectimax":292728}
```

Note: the benchmark script uses  a seed for the random number generator, so the scenarios are the same every time. Hence, there are the same number of calls to each function for each scenario, based on the seed. The benching is random, but repeatable.
  NOT actually true! Not clear why, but I'm getting different scenarios for the seed. Dang!

Insights:
- validMoves generation takes about 10x as long as it takes to run the evaluation function as many times as needed for the scenario.
- as sort of expected, we call validMoves 36 times for each of the options passed in
- there is a lot of variation in the number of valid moves! from 1 to 68 in the 10 scenarios.

Improvements:
- we can iterate through the (21) unique rolls instead of all the rolls (36). Duh.
- Should be a ~40% speedup?

```sh
$ bun bench/strategies.ts
clk: ~3.63 GHz
cpu: Intel(R) Core(TM) i7-1068NG7 CPU @ 2.30GHz
runtime: bun 1.1.30 (x64-darwin)

benchmark              avg (min … max) p75   p99    (min … top 1%)
-------------------------------------- -------------------------------
apply balanced to 10 ..  41.93 µs/iter  43.64 µs █
                (37.74 µs … 229.71 µs)  84.20 µs █▃▄▇▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
apply claude to 10 sc..  41.93 µs/iter  43.28 µs █▅
                (37.82 µs … 220.31 µs)  83.37 µs ██▅█▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
apply claudeExpecti t.. 832.74 ms/iter 846.46 ms            █
               (785.70 ms … 894.90 ms) 883.51 ms █▁██▁██▁█▁▁██▁█▁▁▁▁▁▁

summary
  apply claude to 10 scenarios
   1x faster than apply balanced to 10 scenarios
   19858.89x faster than apply claudeExpecti to 10 scenarios
claudeExpecti (total, 10 scenarios):{"validMoves":6279,"evalFunc":570412,"expectimax":570711}
claudeExpecti (scenario 1 [_id 1335920278 17 options]):{"validMoves":357,"evalFunc":48732,"expectimax":48749}
claudeExpecti (scenario 2 [_id 702452313 22 options]):{"validMoves":462,"evalFunc":13679,"expectimax":13701}
claudeExpecti (scenario 3 [_id 2147483620 1 options]):{"validMoves":21,"evalFunc":852,"expectimax":853}
claudeExpecti (scenario 4 [_id 1 68 options]):{"validMoves":1428,"evalFunc":125403,"expectimax":125471}
claudeExpecti (scenario 5 [_id 1260141739 1 options]):{"validMoves":21,"evalFunc":163,"expectimax":164}
claudeExpecti (scenario 6 [_id 30 60 options]):{"validMoves":1260,"evalFunc":90909,"expectimax":90969}
claudeExpecti (scenario 7 [_id 25 1 options]):{"validMoves":21,"evalFunc":1443,"expectimax":1444}
claudeExpecti (scenario 8 [_id 2147483634 22 options]):{"validMoves":462,"evalFunc":76931,"expectimax":76953}
claudeExpecti (scenario 9 [_id 347289096 7 options]):{"validMoves":147,"evalFunc":5628,"expectimax":5635}
claudeExpecti (scenario 10 [_id 2147483622 100 options]):{"validMoves":2100,"evalFunc":206672,"expectimax":206772}
```

So, roughly in line with what we expected.

Next... some pruning?
Nah, some caching!

## Caching results
Lots of experiments with Caching. Lots of memoizing. a lot of failed experiments.
What worked?
- key the game by a computation of the state
- compute that when the state changes (not on demand)
- memoize the validMoves calls (not expectimax)

It's relatively easy, at least in benchmarks, to get tons of cache hits....

Fuck, I think I was just fooling myself in the benchmark again! Keeping the cache between bench runs means tons of hits, so the games run really fast...
in the benchmark.

Okay so, status:
- speedups from caching have all been illusory
- expectimax seems to lose to the plain evaluation functions that it wraps when I run a tournament
- things are a mite faster, but still pretty slow

The way to debug might be to do some rollouts, and see where the strategies differ, and see what is causing them to differ. honestly, I don't know that I care enough about expectimax to fix it! It's not what we're here for anyways.

Why do we think the expectimax is doing worse in the tournaments?

- bad luck?
- not enough iterations / depth?
- is my tournament code busted?
- Is the lookahead evaluation broken in some way?
  - does the turn switching mean that I'm not evaluating correctly?
- am I messing up the averaging?

Let's just get on to some pruning, evaluation fn improvements, neural nets, and mcts; I don't think more optimization is helping.

### a/b pruning

Gist: don't look deeper in places we know aren't as good as the other places. Direct the search with some bounds. That means we can search deeper.

Ideas:
- when we're looking at opponents rolls, can we look at each individual roll (1-6) instead of looking at all 21 unique combos?
- can we sample from the 21, instead of running all of them?

It basically doesn't work. Even when we get some sampling, we basically can't prune enough to make things faster / deeper.

### sampling

Skip lots of the search tree! That'll speed things up...

It does! Doing a fixed 4/21 rolls and 4/N moves speeds the game up dramatically -- like, a 6x speedup or so. Limiting to just 1 roll and evaluating 1 move results in a ~21x speedup.

unfortunately... doesn't really help improve the depth. That's not enough! The slowdown is probably that we are looking at all of the options and running a ply of expectimax on them each, which involves generating all the valid moves from some number of dice rolls for each of them. If we moved the sampling up to the `_expecti` function, we could make sure that we're not exploding quite as badly. (update: this does work! expecti was the source of some of the blowup). Fixing the sampling takes us to ~70x faster than normal expectimax. Try another ply? Let's see it at 3.

Now that we're sampling the moves in the top-level `expecti` search, it's still faster at 3 plys, which is so nice! We could likely improve quality by taking the n best (instead of random n) when we sample.

- this slows things down a bit... but how much?
- previously, speed with 3 rolls / 10 moves was 1.5x faster, now it's... only 1.3x faster. Seems like not much perf cost!

Quality will also get better with a stronger evaluation function!

### Quality check...

how does sampling do in the tournament (3ply, 3rolls, best 10 moves)?

(should beat everyone, I think...)

Loses to the vanilla 'balanced' evaluation function! Why? Seems like it really shouldn't.

What is going wrong with my expectimax implementations? I feel like something is really flawed! Increasing depth a little through sampling doesn't seem to have made things much better. Maybe my config is bad / tuning is bad? do more sample rolls or more moves? Fewer, but even more depth?

It's unclear -- maybe I'm on net hurting the evaluation by looking at some subset of the future; there's more variability in the future, so we end up comparing scenarios we don't see. Or something. Maybe just a bug in my expectimax implementation.

### mcts thoughts

- Can we generate a random move faster than getting all the valid moves and picking?
- If we're calling validMoves as we roll out the game, should we call the eval fn?
- should we rollout with the eval function?
  - in theory, if our eval function can predict the winner with pretty high confidence, we could bail early from the rollout
- should we limit the search space with the eval function? (only search promising nodes)

Phfew! Got lots of MCTS running, it's a bit finicky.
- there's tons of nodes and tree stuff in the code; it's... kinda  slow
- it seems like it works! as in, at least it returns options
- it's using a random evaluation function, which is definitely not great
- and it's not choosing which nodes to initially explore carefully at all, no evaluation at that step
- so, lots of room for improvement

Required redoing the way a strategy works -- feels a bit hacky. Made an "appliedstrategy" type helper and a function to turn one into the other. Strategies are responsible for generating their own sets of valid moves, and returning the move and the next game state. Seems okay, but likely getting punished for the indirection unless the JIT truly is magical.

Lots of parameters to explore tuning for making mcts good instead of bad.


WOWOOOOWW adding a halfway decent evaluation function to the rollouts makes a huuuge difference to mcts. Like, it was bad before and now it's good. 

NOPE! I was reversing good and bad and also it was just nooping because I forgot to pass the parameters. :o

MCTS is indeed kinda slow and kinda crappy, though it at least beats random. Still, lots to try to fix.

### mcts perf

Should I spend more time on perf, now that I have an mcts implementation?

Well... it's very slow. I don't know for sure what the slowness is coming from, but it's probably from finding validMoves? Or slowness in the evaluate function? Maybe worth getting a setup where I can run things in bun --inspect and get the profiler going there...

If there are obvious wins, and they would reliably improve the mcts quality... idk, that seems like it'd be good!

However... the mcts we have right now seems pretty bad, whether because of the limited number of simulations or because the implementation is wrong somehow.

## Better heuristics and a learned linear approximator

- more complicated doesn't seem much better
- learning (src/learnFactors.ts) seems like it does generate some factors, but it's unclear if they are good
- the factors may be bad because the learning is bad, or because I have fucked something else up somewhere

Training against the opponents we are likely to encounter might uhh bias the results a bit towards beating them. Hopefully. Maybe not! Maybe not trained hard enough?

```sh
$ bun evals/tournament.ts
1000 games per round. Strategies: balanced, runner, learned
[6/6] learned    vs learned

        	balanced	  runner	 learned
balanced	    50.0%	    20.7%	    33.8%
  runner	    79.3%	    50.0%	    97.7%
 learned	    66.2%	     2.3%	    50.0%
3 strategies. 6 matchups. 6000 games played.
best: balanced with 65.2% average win rate
worst: runner with 24.3% average win rate
Total time: 30.41s.
5.07s per matchup of 1000 games
```

Huh. It hammers the Runner strat, but loses more to balanced? idk, maybe there's more tweaking to do. Maybe add more copies of the balanced strat to the opponents in training. `¯\_(ツ)_/¯`

Re-training ends up with mostly-similar weights, which, I guess is interesting? It's now getting the best avg, and only losing to balanced 56% of the time, so that's kind of interesting.

What if we train for longer? Will we still end up in a similar spot? Maybe we could train until we reach that spot (difference between updates is small, or something) and then bail there (e.g. when we've converged / loss is not dropping any more, though we don't have a proper loss exactly right now).

So, cool! We can train some parameters in a heuristic function. Next, the world!

### improving heuristic parameter learning

would it make sense to have some decay for the learning for earlier moves in the game? or... ones that are more decisive?

maybe we can do something where we model the winning percentages, and use rollouts to update the model from different points, which could lead to less bias from bad games -- or at least, lead to a better loss function, because we have a proper error term, rather than just propagating the binary win/loss?

Likely we need to rewrite the evaluation function so that it predicts within some fixed scale (0-1 or -1 to 1 or something) instead of just arbitrary reals.

Also: we are currently hill-climbing, which means we could get trapped in local maxima. Should we have something that injects some randomness / starts in a different configuration / learns and mixes (genetically or similar?)

## UI / done...

- fonts
- colors
- improved history display (instead of transcript)
- explain move
  - text description of move
- render bar pieces in the middle
- reveal longer description from the short summary line
- collapse / expand all
- show what moved (arrows? shadows?)
  - show the most recent turn
- FIXED: something about moving more than 1 piece to a position is not highlighting correctly
- wood grains
- felt filter
- gradients and shadows
- arrows
- arrow/highlight improvements
  - arrow heads are weird
  - arrows are heavily drawn
  - arrow curves aren't around the pieces

- web: url to restore a game state... or even a game history? (game history would require some compression, we only have some ~16k (32k?) bytes in the address...  (https://stackoverflow.com/questions/417142/what-is-the-maximum-length-of-a-url-in-different-browsers/417184#417184)
  - `JSON.stringify(window.gameHistory).length == 16957` after a 38 turn game, and that's pretty compressible, so I think we could make it work
  - Big note: This was amazingly easy. So fucking cool. Claude++

- arrow issues
  - only picking the first when multiple destinations are on the same spot
  - always showing moving off the bar from black's bar
  - always showing moving to black's home

## UI / TODO

- arrow issues
  - start/end a little off? particularly the end

- first roll // first turn
- starting roll

- doubling cube
- scorekeeping between games / history

- tweak game controls
  - play / fast forward (10) / play to end
  - rewind a move

- reorder game panels so it fits on different screen sizes
  - history below

- show previous game state (as an option when we expand)
- undo / reset to a position

- separate roll from move

- show the valid moves

- display about the strategy
  - strategy descriptions
  - show probabilities of hits / other events
  - show current pip count for each player
  - what the strategy thinks about the different factors / what's the current evaluation
  - highlight blots
  - highlight primes

- interactive mode / "human player" strategy -- play against the AI
  - strategy for user to play against the computer

- web play / pvp
- web strategy simulator

## Other Todos...

- eventually, if the game really needs faster play, we can try optimizing again parallelize, maybe bun workers
  - see if we can find hotspots and optimize them down
- evaluation / strategy comparison
  - we have the tournament, but we could add a difference-of-rollouts method
  - find differences, then rollout from the differences to compare (e.g. how they do 'real' evals between top-of-the-line models)

## neural net thoughts

- what is the shape of the input?
- what is the shape of the output?
- what is the structure of the net?
- what is the backprop implementation like?

Let's just get to it, huh?
