# Roadmap

## Goal

A backgammon training ground. You play or watch a game, and for any position you can see the candidate moves, how the engines rank them, and why one move is better than another.

## Now

- Strategies: `random`, `balanced` and `runner` (hand-weighted evaluation), `learned` (the same evaluation with evolved weights), sampled expectimax, and MCTS with chance nodes for the dice.
- Nets: a hand-written MLP trained by TD(λ) self-play on the TD-Gammon encoding (`bun run train`), with one output (P(white wins)) or five (with gammons), n-ply search, and cube decisions. Checkpoints are safetensors in `checkpoints/`, gitignored; commit one only to keep it.
- Strongest: the 80-hidden five-output net (`td-h80-g5`, 100k games), searched 1-ply.
- Tools: `bun run tournament`, `bun run differences`, `bun run eval-net`. Any of them takes `net:<path>`, with `@<ply>` to search and `+cube` (or `+cube=<double>,<take>`) for cube decisions.

## Findings

- Net training plateaus by about 60k games. 80 hidden units and a decaying learning rate didn't help within 100k games; tanh was worse.
- Gammon outputs score about +0.2 points per game over one-output nets that win as often.
- 1-ply beats 0-ply 58.5% of games. 2-ply vs 1-ply wasn't significant at 100 pairs, at about 0.3 s per move.
- Difference rollouts can only judge strategies weaker than their rollout policy; for strategies as strong as the policy, use a tournament.
- With the cube, compare points per game, not win rate, and expect to need about ten times the pairs. Doubling at 0.4–0.5 and taking up to 0.6–0.7 play the same.

## Next

- The cube in the UI: show it, record doubles and drops in the history, and Double, Take, and Drop for a human player.
- A committed checkpoint the UI can load, so the nets are playable in the browser.
- Learning mode: for a position and roll, the candidate moves ranked by equity with the difference from the best, and what separates the top moves.
- Interpretability: see `notes/interpretability.md`.
- Nets: hand-crafted input features (as TD-Gammon 2 did), deeper nets, longer training.
- Match play, and LLM players in the tournament.
