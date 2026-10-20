# Roadmap

## Goal

A backgammon training ground. You play or watch a game, and for any position you can see the candidate moves, how the engines rank them, and why one move is better than another.

## Now

- Strategies: `random`, `balanced` and `runner` (hand-weighted evaluation), `learned` (the same evaluation with evolved weights), sampled expectimax, and MCTS with chance nodes for the dice.
- Nets: a hand-written MLP trained by TD(λ) self-play on the TD-Gammon encoding (`bun run train`), with one output (P(white wins)) or five (with gammons), n-ply search, and cube decisions. Checkpoints are safetensors in `checkpoints/`, gitignored; commit one only to keep it.
- Tools: `bun run tournament`, `bun run differences`, `bun run eval-net`. Any of them takes `net:<path>`, with `@<ply>` to search and `+cube` (or `+cube=<double>,<take>`) for cube decisions.

## Next

- The cube in the UI: show it, record doubles and drops in the history, and Double, Take, and Drop for a human player.
- A committed checkpoint the UI can load, so the nets are playable in the browser.
- Learning mode: for a position and roll, the candidate moves ranked by equity with the difference from the best, and what separates the top moves.
- Interpretability: see `notes/interpretability.md`.
- Nets: hand-crafted input features (as TD-Gammon 2 did), deeper nets, longer training.
- Match play, and LLM players in the tournament.
