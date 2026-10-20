import { constants as c, helpers as h } from "../backgammon";
import type { Game, Player, Result, Roll } from "../backgammon";
import { makeApplied } from "./strategies";
import type { AppliedStrategy, Candidate, CubeStrategy, Report } from "./strategies";
import type { MLP } from "../ml/mlp";
import { encode, INPUT_SIZE } from "../ml/encoding";

/*
  Nets have one output, P(white wins), or five, all from white's side:

    0  P(white wins)
    1  P(white wins a gammon or backgammon)
    2  P(white wins a backgammon)
    3  P(black wins a gammon or backgammon)
    4  P(black wins a backgammon)

  Strategies choose by equity, the expected points per game per unit of cube.
  For a one-output net that's 2p - 1, the same ordering as the win probability.
*/

const GAMMON_OUTPUTS = 5;

const other = (p: Player): Player => (p === c.WHITE ? c.BLACK : c.WHITE);

// the training targets (and the exact outputs) for a finished game
function resultOutputs(game: Game, outputs: number): number[] | null {
  const result = h.gameResult(game);
  if (!result) return null;
  const white = result.winner === c.WHITE;
  const gammon = result.points >= 2 ? 1 : 0;
  const backgammon = result.points === 3 ? 1 : 0;
  if (outputs === 1) return [white ? 1 : 0];
  return [white ? 1 : 0, white ? gammon : 0, white ? backgammon : 0, white ? 0 : gammon, white ? 0 : backgammon];
}

// the net's outputs from this position with `onRoll` to roll (exact for a finished game)
function netOutputs(net: MLP, game: Game, onRoll: Player, x: Float32Array): ArrayLike<number> {
  return resultOutputs(game, net.sizes[net.sizes.length - 1]) ?? net.forward(encode(game, onRoll, x));
}

function whiteEquityOf(outputs: ArrayLike<number>): number {
  const equity = 2 * outputs[0] - 1;
  if (outputs.length === 1) return equity;
  return equity + outputs[1] + outputs[2] - outputs[3] - outputs[4];
}

// the net's estimate that white wins
function whiteWins(net: MLP, game: Game, onRoll: Player, x: Float32Array): number {
  return netOutputs(net, game, onRoll, x)[0];
}

function whiteEquity(net: MLP, game: Game, onRoll: Player, x: Float32Array): number {
  return whiteEquityOf(netOutputs(net, game, onRoll, x));
}

// the mover's equity after each move; the opponent rolls next
function moveValues(net: MLP, options: Result[], x: Float32Array): number[] {
  const mover = h.toMove(options[0][1]);
  return options.map(([, next]) => {
    const e = whiteEquity(net, next, other(mover), x);
    return mover === c.WHITE ? e : -e;
  });
}

// how a strategy reports values: win probability for one-output nets, equity otherwise
function reportFor(net: MLP, depth: number, candidates?: number) {
  const single = net.sizes[net.sizes.length - 1] === 1;
  const search = depth ? `, ${depth}-ply; searched its ${candidates} best moves at 0-ply` : "";
  return {
    measure: (single ? "win probability" : "equity, points per game") + search,
    percent: single,
    // values are equities; a one-output net reports them as win probabilities
    value: (equity: number) => (single ? (equity + 1) / 2 : equity),
    format: (equity: number) => (single ? `${(50 * (equity + 1)).toFixed(1)}%` : equity.toFixed(3)),
  };
}

const argmax = (values: number[]) => {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
  return best;
};

// plays the move with the highest equity for the mover (0-ply)
function useNet(net: MLP): AppliedStrategy {
  const x = new Float32Array(INPUT_SIZE);
  const r = reportFor(net, 0);
  return makeApplied((options: Result[], report?: Report) => {
    const values = moveValues(net, options, x);
    if (report) {
      const candidates: Candidate[] = options.map(([move, game], i) => ({ move, game, value: r.value(values[i]) }));
      report({ measure: r.measure, percent: r.percent, candidates: candidates.sort((a, b) => b.value - a.value) });
    }
    return options[argmax(values)];
  });
}

/*
  Searching with the net, as GNU Backgammon does.

  A position's value at depth d (white's equity, with `onRoll` to move) is the
  average over the 21 distinct rolls, weighted by their odds, of the value at
  depth d - 1 after the player on roll's reply. The reply is the one the net
  picks at 0-ply, which keeps each ply to one net evaluation per legal move.
  At depth 0 the value is the net's estimate.

  At the root, the moves are first ranked by the 0-ply net, and only the best
  `candidates` are searched.
*/
function searchValue(net: MLP, game: Game, onRoll: Player, depth: number, x: Float32Array): number {
  if (depth === 0 || h.checkWinner(game)) return whiteEquity(net, game, onRoll, x);

  const position = h.cloneGame(game);
  position.turn = onRoll;
  let total = 0;
  for (const roll of c.UNIQUE_ROLLS as Roll[]) {
    const weight = roll[0] === roll[1] ? 1 : 2;
    const options = h.validMoves(position, roll);
    const best = argmax(moveValues(net, options, x));
    total += weight * searchValue(net, options[best][1], other(onRoll), depth - 1, x);
  }
  return total / 36;
}

function useNetSearch(net: MLP, depth: number, candidates = 8): AppliedStrategy {
  if (depth === 0) return useNet(net);
  const x = new Float32Array(INPUT_SIZE);
  const r = reportFor(net, depth, candidates);
  return makeApplied((options: Result[], report?: Report) => {
    const mover = h.toMove(options[0][1]);
    const zeroPly = moveValues(net, options, x);
    const ranked = options.map((option, i) => ({ option, zeroPly: zeroPly[i] })).sort((a, b) => b.zeroPly - a.zeroPly);
    const searched = ranked.slice(0, candidates).map((ranked) => {
      const e = searchValue(net, ranked.option[1], other(mover), depth, x);
      return { ...ranked, value: mover === c.WHITE ? e : -e };
    });
    let best = searched[0];
    for (const s of searched) if (s.value > best.value) best = s;

    if (report) {
      const list: Candidate[] = searched.map((s) => ({
        move: s.option[0],
        game: s.option[1],
        value: r.value(s.value),
        detail: `0-ply ${r.format(s.zeroPly)}`,
      }));
      report({ measure: r.measure, percent: r.percent, candidates: list.sort((a, b) => b.value - a.value) });
    }
    return best.option;
  });
}

/*
  Cube decisions from the net's cubeless equity E for the doubler, in the
  position before the doubler rolls (searched to the strategy's depth).

  - Take when E <= takeAt. With a dead cube the taker should take up to E = 0.5
    (taking loses 2E, dropping loses 1); owning the cube is worth something, so
    the default is a little higher.
  - Double when doubleAt <= E <= 1. Above 1, playing on for the gammon is worth
    more than the 1 point a drop would give: too good to double.

  This ignores how much the cube's value changes things beyond these
  thresholds; it's the simplest version that plays a sensible cube.
*/
type CubeThresholds = { doubleAt: number; takeAt: number };
const DEFAULT_CUBE: CubeThresholds = { doubleAt: 0.4, takeAt: 0.6 };

function useNetCube(net: MLP, depth: number, thresholds: CubeThresholds = DEFAULT_CUBE): CubeStrategy {
  const x = new Float32Array(INPUT_SIZE);
  const doublerEquity = (game: Game) => {
    const doubler = h.toMove(game);
    const e = searchValue(net, game, doubler, depth, x);
    return doubler === c.WHITE ? e : -e;
  };
  return {
    double: (game) => {
      const e = doublerEquity(game);
      return e >= thresholds.doubleAt && e <= 1;
    },
    take: (game) => doublerEquity(game) <= thresholds.takeAt,
  };
}

export { useNet, useNetSearch, useNetCube, DEFAULT_CUBE, type CubeThresholds, whiteWins, whiteEquity, whiteEquityOf, moveValues, searchValue, netOutputs, resultOutputs, GAMMON_OUTPUTS };
