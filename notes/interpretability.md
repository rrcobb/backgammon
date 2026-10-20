# Interpretability

Notes from a survey of interpretability techniques (October 2026), for the TD-Gammon nets. The first net is 198-40-1 with a sigmoid hidden layer and a sigmoid output, P(white wins).

## Our net

With one hidden layer, the output's pre-sigmoid value is exactly `b + Σ_j w_j · h_j`. Each hidden unit's contribution to the output is exact, not estimated, so ablation, patching, and attribution are a few lines of code. The tooling built for LLMs (TransformerLens, nnsight, SAELens, circuit-tracer) is PyTorch- and transformer-specific, and we don't need it at this size.

Tesauro did a version of this in 1992 on the same architecture: Hinton diagrams of two hidden units' input weights, one read as a race detector and one as an attack detector ([Tesauro 1992](https://papers.neurips.cc/paper_files/paper/1991/file/68ce199ec2c5517597ce0a4d89620f55-Paper.pdf), Fig. 2). The survey found no more recent interpretability work on backgammon nets.

## Techniques that fit

- **Weights and top activations.** Each unit's 198 input weights drawn on the board, its output weight, and the positions from self-play that activate it most and least. With 40 units we can look at all of them. Activations alone can mislead when a unit responds to several things, so check against probes and ablations.
- **Concept probes.** Linear or logistic regression from hidden activations to concepts we define: pip difference, blots, shots, home board points, prime length, anchors, race or contact, checkers on the bar or off. Compare against a probe on the raw inputs, since many of these are nearly linear in the inputs already; the question is whether the hidden layer makes them easier to read. Probe both absolute (white/black) and mover-relative versions: Othello-GPT's board was only linear in "mine / theirs" terms ([Nanda et al.](https://arxiv.org/abs/2309.00941)). Repeat across checkpoints to see when concepts appear, as [McGrath et al.](https://www.pnas.org/doi/10.1073/pnas.2206625119) did for AlphaZero.
- **Ablation.** Mean-ablate each unit (for a sigmoid, 0 is an extreme, not a neutral value) and measure the change in output and in win rate.
- **Patching between two moves.** For the chosen move and the runner-up, each unit's share of the difference in output is `w_j · (h_j(A) - h_j(B))`, exactly. Each unit's change can then be traced to the handful of inputs that differ between the two positions. This is what [Jenner et al.](https://arxiv.org/abs/2406.00877) used on Leela Chess Zero, at much larger scale, and it's the natural way to explain "why this move over that one."

## Techniques for later

- **Sparse autoencoders and transcoders** undo superposition, where one neuron carries several features. It's an open question how much a 40-unit, single-output layer has; a 40→160→40 sparse autoencoder would answer it. More useful once we have wider nets. In 2025 Google DeepMind's interpretability team reported linear probes beating sparse autoencoders on downstream tasks (seen through summaries, not the original post).
- **Crosscoders** ([Anthropic 2024](https://transformer-circuits.pub/2024/crosscoders/index.html)) could compare checkpoints, or a 40-unit net with a wider one.
- **Weight-sparse training** ([OpenAI 2025](https://arxiv.org/abs/2511.13653)): an L1 penalty on input→hidden weights would keep each unit's inputs readable, at some cost in strength. An easy change to the trainer.
- **Parameter decomposition** ([SPD](https://arxiv.org/abs/2506.20790)) suits small MLPs in principle but needs real autodiff and is still a research method.

## Teaching humans

[Schut et al. 2025](https://arxiv.org/abs/2310.16410) found concept directions in AlphaZero, kept the ones a student network could learn from examples and that weren't in human games, and showed four grandmasters prototype positions; they improved at solving them. That's the closest model for a learning mode. For backgammon, explanations should use concepts learners already have (blots, shots, primes, anchors, timing, race), checked with probes, shown by contrasting two candidate moves, with the difference broken down by concept.

## Plan

1. Unit pages: input weights on the board, output weight, top and bottom positions.
2. Concept functions and probes, on hidden activations and raw inputs, absolute and mover-relative, across checkpoints.
3. Ablations and the exact per-unit breakdown of a position's value and of the difference between two moves.
4. Move explanations: combine the per-unit breakdown with the probes to say which concepts account for the difference between the best move and an alternative.
