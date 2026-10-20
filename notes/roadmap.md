# Roadmap

Notes from picking the project back up in October 2026. The last commit was February 2025, partway into a TD-Gammon-style net.

## Goal

A backgammon training ground. You play or watch a game, and for any position you can see the candidate moves, how the engines rank them, and why one move is better than another. Getting there needs a well-trained evaluation net, and a well-trained net is also the starting point for looking inside it with interpretability techniques.

## State as of October 2026

When we picked the project up, `tsc` had about 45 errors and one test timed out. Fixing those, and building a fair tournament, turned up a set of sign and perspective errors in the engine's strategies:

- The expectimax searches never switched turns between plies, so the opponent never moved inside a search, and the minimizing ply chose the root player's own worst move.
- Alpha-beta pruning cut off a roll's replies against alpha, which isn't sound when the node averages over rolls. It was removed.
- In `evaluate.ts`: the pip difference rewarded being behind, `isRacing` was inverted, checkers on the bar had no pips, shots from the bar were attributed to the wrong side, and the home board and anchor points were swapped (so five-point control measured the opponent's 5 point).
- The evaluation charged blot risk to the scored player even when that player was on roll, as at a 2-ply search leaf.
- The linear learner scored each recorded position for the opponent while using the learner's outcome, always played white, and validated with unpaired games.
- The genetic learner saved its population best-first, but `factors.ts` uses the last entry as `learned`.
- MCTS was a flat UCB1 bandit over the root moves, not a tree: it always selected from the root, and child nodes had no roll, so they never expanded.
- `validMoves` returned `[]` for a blocked player off the bar (a pass everywhere else), which made expectimax values infinite; and after entering from the bar with doubles it kept the wrong number of dice, dropping legal moves. A blocked human player waited forever.

All of these are fixed, with tests, and `learned` has been retrained. MCTS now searches a tree with chance nodes for the dice. TypeScript strict mode is on.

The convnetjs TD net (`src/ml/nets/tdg.ts`, removed) differed from TD-Gammon:
  - the input didn't encode whose turn it is
  - a point with 5+ checkers encoded the same as a point with 4
  - games were played by `Strategies.learned`, not by the net
  - the update added `r` at every step, used γ=0.8, and applied λ as a decay from the end of the game, so the target was a discounted Monte Carlo return rather than TD(λ)
  - the output was an unbounded regression trained toward ±1

### The convnet nets

The main checkout had an uncommitted `convnet.json` from a training run after the last commit. We compared it with the committed weights on 300 games played by `Strategies.learned` (about 22k positions), with targets of +1 for a white win and -1 for a black win:

| | MSE | sign accuracy | first quarter of game | last quarter of game |
|---|---|---|---|---|
| predict 0 | 1.000 | 50% | | |
| committed | 1.026 | 63.8% | 49.6%, mean prediction -0.55 | 86.9% |
| uncommitted | 1.057 | 62.1% | 49.4%, mean prediction -0.43 | 87.1% |

Both nets do worse than predicting 0 on MSE. Early in the game they predict a black win with no better than chance accuracy. Late-game accuracy is high, but late-game positions are easy to call from the pip count. The uncommitted run wasn't better, so we dropped it.

### Strategy results after the fixes

0-ply strategies, 300 pairs (600 games) per matchup, seed 42. "Hill-climbed" is the linear learner's result, "genetic" is the genetic learner's result (now `learned`), and "old learned" is the previous `learned`:

| | average win rate against the field |
|---|---|
| genetic | 80.6% |
| old learned | 76.6% |
| hill-climbed | 67.5% |
| `balanced` | 36.3% |
| `runner` | 30.7% |
| `random` | 8.2% |

Genetic beats old learned 56.8% [53.2%, 60.4%].

Search vs evaluation, 100 pairs (200 games) per matchup, seed 1:

| | win rate | 95% interval |
|---|---|---|
| `fastOnePly` (2-ply, sampled) vs `learned` | 58.0% | 50.5–65.5% |
| `learnedFastExp` (3-ply, sampled) vs `learned` | 52.5% | 45.5–59.5% |
| `balancedFastExpectimax` (3-ply, sampled) vs `balanced` | 56.0% | 49.9–62.1% |

Before the fixes, 2-ply search lost to `learned` 40% of the time. Now it wins significantly, and the 3-ply searches lean positive but aren't significant at 200 games. (These were measured before the `validMoves` pass fix, which affected searches whenever the opponent had no legal move for a roll.)

MCTS with `learned` rollouts vs `learned`, by difference rollouts (60 disagreements, 60 rollouts per choice, `learned` playing the rollouts):

| simulations | MCTS minus `learned` | time per decision |
|---|---|---|
| 50 | -6.7% [-9.6%, -3.7%] | 101 ms |
| 200 | -2.7% [-5.3%, -0.2%] | 129 ms |
| 800 | +0.2% [-2.3%, +2.8%] | 431 ms |
| 2000 | +2.5% [+0.3%, +4.6%] | 579 ms |

The MCTS strategies now use 1000–2000 simulations.

## Tools

- `bun run tournament [pairs] [names...]`: round robin of paired games on seeded dice, with intervals over pairs.
- `bun run differences <A> <B> [positions] [rollouts] [policy]`: where two strategies disagree, roll out both choices on the same dice and compare the mover's win rate. Much more sensitive than a tournament for strategies that mostly agree, and it prints the largest disagreements in standard notation (`src/notation.ts`).

## Basics

1. Done: get `tsc` clean and all tests passing.
2. Done: make the tournament fair: play each pairing as both colors, use the same dice sequences for both sides of a pairing, and report win rates with confidence intervals.
3. Done: fix the sign errors in the evaluation, searches, and learners, then retrain and compare.
4. Done: add a difference-rollout comparison.
5. Done: rebuild MCTS as a tree with chance nodes.
6. Done: turn on TypeScript strict mode.

## Nets

Build a few nets, each small enough to understand fully.

### First TD net

198-40-1, sigmoid, α 0.1, λ 0.7, 200k games of self-play (about 25 minutes). Checkpoints are in `checkpoints/` (gitignored).

Against `learned`, 100 pairs per checkpoint: 78% at 20k games, 86% at 60k, then 83–87% through 200k.

Checkpoints against each other, 200 pairs per matchup:

| | average win rate against the other checkpoints |
|---|---|
| 200k | 54.0% |
| 140k | 53.9% |
| 100k | 52.3% |
| 60k | 51.4% |
| 20k | 38.4% |

Every later checkpoint beats 20k significantly; from 60k on, no pair differs significantly, though the later ones lean ahead.

Predictions on 300 games of `learned` vs `learned` (Brier score; always guessing 50% scores 0.250):

| | overall | first quarter of game | last quarter |
|---|---|---|---|
| 20k | 0.157 | 0.221 | 0.068 |
| 60k | 0.148 | 0.216 | 0.056 |
| 200k | 0.146 | 0.215 | 0.050 |

Most of the learning happens in the first 60k games.

### Search with the net

`net:<path>@<ply>` searches with the net: each ply averages over the 21 rolls, with the player on roll's reply picked by the 0-ply net. The root searches its 8 best moves at 0-ply.

- 1-ply vs 0-ply (200k checkpoint), 200 pairs: 1-ply wins 58.5% [53.9%, 63.1%], at about 30 ms per move.
- 2-ply vs 1-ply, 100 pairs: 2-ply wins 52.5% [46.4%, 58.6%], not significant, at about 0.3 s per move. Telling them apart would take several hundred more pairs, about 20 s per game.

Difference rollouts with the 0-ply net as the rollout policy found no difference between 1-ply and 0-ply (-0.9% [-2.7%, +0.8%]), although 1-ply wins the head-to-head. The rollouts can only judge strategies weaker than the rollout policy; when the strategies being compared are as strong as the policy, use a tournament.

### Net variants

All 100k games unless noted, α 0.1 and λ 0.7 unless noted. Head to head at 0-ply, 200 pairs per matchup:

| net | average win rate against the others | Brier |
|---|---|---|
| 80 hidden | 52.8% | 0.152 |
| 40 hidden, 200k games | 52.8% | 0.146 |
| 40 hidden, α 0.1 decaying to 0.01 | 51.3% | 0.150 |
| 40 hidden | 50.3% | 0.149 |
| 80 hidden, α 0.1 decaying to 0.01 | 49.7% | 0.147 |
| 40 hidden, tanh | 43.0% | 0.151 |

Tanh is significantly weaker than three of the others; no other pair differs significantly. More hidden units and a decaying learning rate didn't help within 100k games.

### Gammons

Games score 1, 2 (gammon), or 3 (backgammon) points, and tournaments report points per game. Nets can have five outputs (`--outputs=5`): white wins, white gammons, white backgammons, black gammons, black backgammons. Strategies choose by equity, the expected points per game.

The 40-hidden five-output net (100k games) against the one-output nets, 200 pairs:

| | win rate | points per game |
|---|---|---|
| vs one-output, 100k games | 50.2% [45.7%, 54.8%] | +0.24 [+0.08, +0.39] |
| vs one-output, 200k games | 46.8% [42.0%, 51.5%] | +0.20 [+0.04, +0.35] |

It wins about as many games and scores more points.

### Cube

Money play. The game tracks the cube's value and owner; before each roll except the opening, the player on roll may double if the cube is centered or theirs. A drop ends the game for the cube's value; a take doubles the cube and passes it. Strategies have an optional `cube` (double, take); without one they never double and always take. Not in the UI yet.

Nets decide from their cubeless equity E for the doubler, at their search depth: double when 0.4 ≤ E ≤ 1 (above 1 it's too good to double), take when E ≤ 0.6. `net:<path>+cube` in the eval tools.

- The 200k one-output net with the cube vs itself without, 200 pairs: +0.62 points per game [+0.54, +0.70]. The moves are the same, so this is all from doubling against an opponent that always takes.

Next for the cube: compare thresholds in cube-vs-cube play, and use the five-output nets' equity.

### Other net ideas

- Hand-crafted features added to the raw inputs, as TD-Gammon 2 did.
- Deeper nets.
- Longer training for the 80-hidden nets.

Each net needs an evaluation alongside it: prediction error against game outcomes, broken down by game stage, and win rate against the existing strategies in the tournament.

### Implementation

Write the MLP ourselves on `Float32Array`, with explicit forward and backward passes (convnetjs is already removed). These nets are small (198×40×3 is about 8k weights), so this is practical and fast enough in Bun, and it makes every activation and gradient visible.

Keep a small interface (`forward`, `backward`, `getActivations`, `save`, `load`) so a library-backed version can replace it later if we try larger architectures.

Train in JS for now. If training gets too slow or we want PyTorch tooling, we can switch to training in Python and load the weights in JS.

### Weight storage

- Save weights as safetensors: a JSON header plus raw float32 bytes. An 8k-weight net is about 32KB, compared to about 1MB as pretty-printed JSON. Python tools can read the same files.
- Gitignore `*.safetensors` by default. Commit a checkpoint only when we want to keep it permanently, for example the one the UI uses.
- If larger checkpoints need to be shared or deployed, put them in GitHub release assets or object storage and fetch them by name.

## Interpretability

Once a net plays well, look at what it has learned, on a separate page from the game. With a single hidden layer of 40–80 units, much of this can be done directly:

- show each hidden unit's weights as a board heatmap
- find the positions from self-play games that activate each unit most strongly
- train linear probes for known concepts (pip count, blot exposure, primes, racing vs contact) and see which units or directions encode them
- ablate units and see which moves change
- train a sparse autoencoder on hidden activations, mainly to try the technique; it matters more for wider nets with superposition

The page can reuse the board rendering and link positions by URL.

## Learning mode

For a position and roll, show:

- the candidate moves ranked by equity, with the difference from the best move
- for the linear evaluation, the factor breakdown (the analysis panel already shows some of this)
- for the net, what changed between the top moves, in terms of probes or features from the interpretability work
- optionally, an LLM-written explanation built from those numbers

## Other ideas

- Real MCTS with chance nodes for the dice, or truncated rollouts that stop after a few plies and use the net's evaluation.
- LLM players in the tournament, using a text format for positions.
- Match play (the cube is money play only).
