import { constants as c, helpers as h } from "../backgammon";
import type { Game, Player, Result, Roll } from "../backgammon";
import { makeApplied } from "./strategies";
import type { AppliedStrategy, Candidate, Report } from "./strategies";
import type { MLP } from "../ml/mlp";
import { encode, INPUT_SIZE } from "../ml/encoding";

const other = (p: Player): Player => (p === c.WHITE ? c.BLACK : c.WHITE);

// the net's estimate that white wins, from this position with `onRoll` to roll
function whiteWins(net: MLP, game: Game, onRoll: Player, x: Float32Array): number {
  const winner = h.checkWinner(game);
  if (winner) return winner === c.WHITE ? 1 : 0;
  return net.forward(encode(game, onRoll, x))[0];
}

// the mover's win probability after each move; the opponent rolls next
function moveValues(net: MLP, options: Result[], x: Float32Array): number[] {
  const mover = h.toMove(options[0][1]);
  return options.map(([, next]) => {
    const p = whiteWins(net, next, other(mover), x);
    return mover === c.WHITE ? p : 1 - p;
  });
}

// plays the move with the highest win probability for the mover (0-ply)
function useNet(net: MLP): AppliedStrategy {
  const x = new Float32Array(INPUT_SIZE);
  return makeApplied((options: Result[], report?: Report) => {
    const values = moveValues(net, options, x);
    let best = 0;
    for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
    if (report) {
      const candidates: Candidate[] = options.map(([move, game], i) => ({ move, game, value: values[i] }));
      report({ measure: "win probability", percent: true, candidates: candidates.sort((a, b) => b.value - a.value) });
    }
    return options[best];
  });
}

/*
  Searching with the net, as GNU Backgammon does.

  A position's value at depth d (P(white wins), with `onRoll` to move) is the
  average over the 21 distinct rolls, weighted by their odds, of the value at
  depth d - 1 after the player on roll's reply. The reply is the one the net
  picks at 0-ply, which keeps each ply to one net evaluation per legal move.
  At depth 0 the value is the net's estimate.

  At the root, the moves are first ranked by the 0-ply net, and only the best
  `candidates` are searched.
*/
function searchValue(net: MLP, game: Game, onRoll: Player, depth: number, x: Float32Array): number {
  const winner = h.checkWinner(game);
  if (winner) return winner === c.WHITE ? 1 : 0;
  if (depth === 0) return net.forward(encode(game, onRoll, x))[0];

  const position = h.cloneGame(game);
  position.turn = onRoll;
  let total = 0;
  for (const roll of c.UNIQUE_ROLLS as Roll[]) {
    const weight = roll[0] === roll[1] ? 1 : 2;
    const options = h.validMoves(position, roll);
    const values = moveValues(net, options, x);
    let best = 0;
    for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
    total += weight * searchValue(net, options[best][1], other(onRoll), depth - 1, x);
  }
  return total / 36;
}

function useNetSearch(net: MLP, depth: number, candidates = 8): AppliedStrategy {
  if (depth === 0) return useNet(net);
  const x = new Float32Array(INPUT_SIZE);
  return makeApplied((options: Result[], report?: Report) => {
    const mover = h.toMove(options[0][1]);
    const zeroPly = moveValues(net, options, x);
    const ranked = options.map((option, i) => ({ option, zeroPly: zeroPly[i] })).sort((a, b) => b.zeroPly - a.zeroPly);
    const searched = ranked.slice(0, candidates).map((r) => {
      const p = searchValue(net, r.option[1], other(mover), depth, x);
      return { ...r, value: mover === c.WHITE ? p : 1 - p };
    });
    let best = searched[0];
    for (const r of searched) if (r.value > best.value) best = r;

    if (report) {
      const list: Candidate[] = searched.map((r) => ({
        move: r.option[0],
        game: r.option[1],
        value: r.value,
        detail: `0-ply ${(100 * r.zeroPly).toFixed(1)}%`,
      }));
      report({
        measure: `win probability, ${depth}-ply; searched its ${candidates} best moves at 0-ply`,
        percent: true,
        candidates: list.sort((a, b) => b.value - a.value),
      });
    }
    return best.option;
  });
}

export { useNet, useNetSearch, whiteWins, moveValues, searchValue };
