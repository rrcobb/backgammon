# Backgammon

Implementing a fast core game logic, so that I can mess around with some AI ideas. Eventually aiming to explore mcts, if I can get there.

## Basics

backgammon.ts is a game logic implementation
- it represents the board state
- it finds valid moves
- it checks winners
- it advances the game state

build.js turns index.html into a static version of the game, playable in the browser. render.ts does the work there to render the game and ui.

## Testing, benchmarking, and evaluation

Building this takes patience and testing. There are several things to test:
- correctness of the game logic
- performance (i.e. speed) of the core logic
- performance (i.e. speed) of the strategies
- play quality of the strategies

**Correctness** of the game logic is tested with unit tests (`tests/backgammon.ts`) and property tests (`tests/properties.ts`). 

The property testing makes assertions about whole classes of errors, giving greater confidence that no edge cases can lead to inconsistent game states... though there are no guarantees.

**Benchmarks** of the logic and helpers are key to speeding things up. Because the search strategies are so dependent on performance, there are some microbenchmarks of the different core logic functions, as well as of the strategies overall. These are in `bench/`.

**Play quality** of the strategies is evaluated with a tournament that pits a handful of different strategies against one another, round-robin. Planned: simulate individual games, see differences, and run rollouts. `src/evals/tournament.ts`.

## Strategies

There are some random-choice strategies, for comparison.

Backgammon is a good fit for some heuristic strategies. implemented between strategies.ts and evaluationFns.ts. In short: given a game state and a set of valid moves, which move is best?

The simplest ones just evaluate the positions after the move statically, and choose the best one per some parameters (how much to value different features).

One step more complicated are search evaluations. There's a couple of versions of expectimax. Expectimax is a minimax algorithm that uses a weighted average for the chance nodes of the search tree. 

Because the branching factor of the game is large (~400?), search depth-limited. We can't actually search very far into the future / down the tree. This makes it relatively ineffective. 

There's a basic version of expectimax that attempts to evaluate all the nodes, and there's two versions that try to speed things up. One uses a/b pruning, and the other uses sampling. A/b pruning should be equivalent to vanilla expectimax, but skips searching deep into nodes that the player won't care about. Sampling trades accuracy for depth of search. A/b pruning doesn't help very much. Sampling allows another layer of search depth, which appears to be significant in improving the strategy, at least a little bit.

There's an implementation of Monte Carlo Tree Search (src/strategy/mcts.ts). At each turn, MCTS does a bunch of rollouts of the available moves, and then scores the based on how the rollouts worked out. If a move ended up getting a lot of wins in the rollouts, MCTS figures it's a good move.

The first set of evaluation functions were hand-coded, based on some intuitions about what was important about a game position. There is also a set of (lite) ML techniques for learning an improved set of weights for the heuristic evaluation function. 

First, there's a basic RL setup doing some gradient descent / hill climbing (`src/ml/learnFactors.ts`). It starts with a set of factors, moves them around a little, and then updates the factors based on whether they made the evaluation better. It's got a few additional RL techniques - adaptive learning rate, attempt to escape local optima, some attempts to normalize the improvements and implement momentum to the changes. It uses a separate set of games for validation of the factor changes. It seems like it sorta works? I think I'm likely doing it wrong in some way due to my inexperience with RL methods, but it's at least fun to see a few numbers change over time.

There's another training helper `src/ml/pruneLearnedStrategies.ts` that drops similar strategies and keeps only the 10 best strategies among the ones we've got saved. 

There's also a genetic algorithm in `src/ml/geneticLearning.ts`. It does some crossover with mutation on strategies, and then keeps strategies in the next generation based on which ones perform the best. It seems like it does good; injecting some randomness into the search seems like it helps some.

All of these are somewhat limited, because they can only optimize the weights of the parameters that get applied in the evaluation function. The learning doesn't see the whole game state, and can't approximate arbitrary functions on the game, just combinations of the factors I picked. I think they're decent ones, but it is inherently limited, compared to methods that can approximate more complicated functions.

## Planned strategies

- Neuro-gammon (NN but trained on some expert examples etc, features, etc)
- TD learning, like a td-gammon style RL neural net (TD0, TD1, TD2, TD3)
- Separate strategies for doubling cube / evaluating gammons and backgammons

## UI

I spent some time making the web interface nice. You can pick different computer strategies and pit them against each other, or try playing against them yourself.

There are a few niceties:
- the board looks textured (some cool svg filter tricks)
- turns show with highlights and arrows, to illustrate what moved where
  - Shoutout to @steveruizok's perfectarrows library. Arrows are a huge pain, but so nice.
- the game history shows turn by turn. You can see past turns or play from a past position
- there's a scoreboard showing how different strategies have done in the past
- the current game + history are persisted to the url, so you can share a game or refresh without losing the state
  - this is _such_ a useful feature for debugging, and it's shockingly easy to implement (though, the urls don't look nice). `src/ui/url.ts`.
- there's keyboard navigation for ai-vs-ai play (though not yet for human play)

There are also some nice little CLI ui things for when we do the eval tournament and training steps, since I have to look at them a lot.
