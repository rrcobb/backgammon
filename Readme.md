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

**Correctness** of the game logic is tested with unit tests (tests/backgammon.ts) and property tests (tests/properties.ts). 

The property testing makes assertions about whole classes of errors, giving greater confidence that no edge cases can lead to inconsistent game states... though there are no guarantees.

**Benchmarks** of the logic and helpers are key to speeding things up. Because the search strategies are so dependent on performance, there are some microbenchmarks of the different core logic functions, as well as of the strategies overall. These are in `bench/`.

**Play quality** of the strategies is evaluated with a tournament that pits a handful of different strategies against one another, round-robin. Planned: simulate individual games, see differences, and run rollouts. `src/tournament.ts`.

## Strategies

There are some random-choice strategies, for comparison.

Backgammon is a good fit for some heuristic strategies. implemented between strategies.ts and evaluationFns.ts. In short: given a game state and a set of valid moves, which move is best?

The simplest ones just evaluate the positions after the move statically, and choose the best one per some parameters (how much to value different features).

One step more complicated are search evaluations. There's a couple of versions of expectimax. Expectimax is a minimax algorithm that uses a weighted average for the chance nodes of the search tree. 

Because the branching factor of the game is large (~400?), search depth-limited. We can't actually search very far into the future / down the tree. This makes it relatively ineffective. 

In this implementation, there's a basic version of expectimax that attempts to evaluate all the nodes, and there's two versions that try to speed things up. One uses a/b pruning, and the other uses sampling. A/b pruning should be equivalent to vanilla expectimax, but skips searching deep into nodes that the player won't care about. Sampling trades accuracy for depth of search. Neither seem to help enough with the search depth to improve results.

## Planned strategies

Planned strategies:
- improved heuristic functions
- MCTS and variants
- linear function approximator, with features from pure heuristic evaluation functions
- Neuro-gammon (NN but trained on some expert examples etc, features, etc)
- TD learning, like a td-gammon style RL neural net (TD0, TD1, TD2, TD3)
- maybe others? see ML notes

Separate strategies for doubling cube / evaluating gammons and backgammons
