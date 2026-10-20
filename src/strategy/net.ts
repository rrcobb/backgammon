import { constants as c, helpers as h } from "../backgammon";
import type { Game, Player, Result } from "../backgammon";
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

export { useNet, whiteWins, moveValues };
