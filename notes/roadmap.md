# Roadmap

Notes from picking the project back up in October 2026. The last commit was February 2025, partway into a TD-Gammon-style net.

## Goal

A backgammon training ground. You play or watch a game, and for any position you can see the candidate moves, how the engines rank them, and why one move is better than another. Getting there needs a well-trained evaluation net, and a well-trained net is also the starting point for looking inside it with interpretability techniques.

## State as of October 2026

- `bun test`: 27 pass, 1 skip, 1 fail. `ab pruning > matches expectimax` times out (about 12s against a 5s limit).
- `tsc --noEmit`: about 45 errors. Most are import paths in `src/ml/linearFactors/` that broke when those files moved into a subfolder. Others are in `tournament.ts`, `analysis.ts`, and `evaluate.ts`.
- `getPositionInfo` in `src/strategy/evaluate.ts` treats indices 0–5 as white's home board, but white's home board is 18–23 (see `isBearingOff`). So `homeBonus` rewards points made in the opponent's home board, `anchorBonus` rewards points made in your own home board, and "five-point control" measures distance to the opponent's 5-point. It's symmetric between colors. Fixing it changes how `balanced` plays and what the learned weights mean.
- The expectimax searches never switched turns between plies, so the opponent never moved inside a search. Fixed in October 2026, and alpha-beta pruning was removed (it isn't sound with chance nodes). After the fix, the searches still don't beat the plain `learned` evaluation (see below).
- MCTS (`src/strategy/mcts.ts`) is a flat UCB1 bandit over the root moves, not a tree. `evaluate()` always selects from the root, and child nodes have no roll, so they never expand.
- The TD net (`src/ml/nets/tdg.ts`) differs from TD-Gammon:
  - the input doesn't encode whose turn it is
  - a point with 5+ checkers encodes the same as a point with 4
  - games are played by `Strategies.learned`, not by the net
  - the update adds `r` at every step, uses γ=0.8, and applies λ as a decay from the end of the game, so the target is a discounted Monte Carlo return rather than TD(λ)
  - the output is an unbounded regression trained toward ±1

### The convnet nets

The main checkout had an uncommitted `convnet.json` from a training run after the last commit. We compared it with the committed weights on 300 games played by `Strategies.learned` (about 22k positions), with targets of +1 for a white win and -1 for a black win:

| | MSE | sign accuracy | first quarter of game | last quarter of game |
|---|---|---|---|---|
| predict 0 | 1.000 | 50% | | |
| committed | 1.026 | 63.8% | 49.6%, mean prediction -0.55 | 86.9% |
| uncommitted | 1.057 | 62.1% | 49.4%, mean prediction -0.43 | 87.1% |

Both nets do worse than predicting 0 on MSE. Early in the game they predict a black win with no better than chance accuracy. Late-game accuracy is high, but late-game positions are easy to call from the pip count. The uncommitted run wasn't better, so we dropped it.

### Search vs evaluation

Tournament after the expectimax fix, 50 pairs (100 games) per matchup, seed 1:

| | win rate | 95% interval |
|---|---|---|
| `learnedFastExp` (3-ply, sampled) vs `learned` | 46.0% | 36.8–55.2% |
| `fastOnePly` (2-ply, sampled) vs `learned` | 40.0% | 31.1–48.9% |
| `learnedFastExp` vs `fastOnePly` | 50.0% | 40.3–59.7% |

Searching with the hand-written evaluation makes play no better, and the 2-ply search is worse. Likely causes:

- The evaluation assumes the opponent rolls next: the blot penalty is the opponent's chance to hit. At a 2-ply leaf the root player rolls next, so the leaf is scored as if the opponent were about to roll, and the root player's own shots aren't counted.
- The learned weights were tuned for 0-ply play.
- The search samples 10 of the 21 rolls, which adds noise.

An evaluation that estimates win probability for a given player to move (the net) avoids the first two. 100 games per matchup only resolves differences of about 10 points; smaller differences need more pairs.

## Basics

1. Done: get `tsc` clean and all tests passing.
2. Done: make the tournament fair: play each pairing as both colors, use the same dice sequences for both sides of a pairing, and report win rates with confidence intervals.
3. Fix the home and anchor labels in `evaluate.ts`, then re-learn the weights and compare with the tournament.
4. Add a difference-rollout comparison: find positions where two strategies pick different moves, roll out from each choice, and compare the results.

## Nets

Build a few nets, each small enough to understand fully.

1. TD-Gammon 0.0: 198 inputs in the TD-Gammon encoding (including whose turn it is), one hidden layer of 40–80 units, sigmoid output for P(white wins). Self-play, γ=1, TD(λ) with eligibility traces.
2. The same net with more outputs: win, gammon win, gammon loss (and backgammon). These give equity, which the learning mode and a future doubling cube both need.
3. Variants to compare: hand-crafted features added to the raw inputs (as TD-Gammon 2 did), wider or deeper hidden layers, and other activations.
4. Use the trained net as the evaluation inside 1-ply and 2-ply sampled expectimax.

Each net needs an evaluation alongside it: prediction error against game outcomes, broken down by game stage, and win rate against the existing strategies in the tournament.

### Implementation

Write the MLP ourselves on `Float32Array`, with explicit forward and backward passes, and remove convnetjs. These nets are small (198×40×3 is about 8k weights), so this is practical and fast enough in Bun, and it makes every activation and gradient visible.

Keep a small interface (`forward`, `backward`, `getActivations`, `save`, `load`) so a library-backed version can replace it later if we try larger architectures.

Train in JS for now. If training gets too slow or we want PyTorch tooling, we can switch to training in Python and load the weights in JS.

### Weight storage

- Save weights as safetensors: a JSON header plus raw float32 bytes. An 8k-weight net is about 32KB, compared to about 1MB as pretty-printed JSON. Python tools can read the same files.
- Gitignore `*.safetensors` by default. Commit a checkpoint only when we want to keep it permanently, for example the one the UI uses.
- If larger checkpoints need to be shared or deployed, put them in GitHub release assets or object storage and fetch them by name.
- Remove `convnet.json` when the new net replaces it.

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
- Doubling cube and match play, after the net has gammon outputs.
