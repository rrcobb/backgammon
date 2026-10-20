import { describe, expect, test } from "bun:test";
import { constants as c, helpers as h } from "../src/backgammon";
import { MLP } from "../src/ml/mlp";
import { INPUT_SIZE } from "../src/ml/encoding";
import { trainGame } from "../src/ml/td";
import { useNet, useNetSearch, searchValue, whiteWins } from "../src/strategy/net";
import type { Analysis } from "../src/strategy/strategies";
import { seededRandom } from "../src/evals/play";

const config = { games: 1, hidden: 10, alpha: 0.1, lambda: 0.7, evalEvery: 1, evalPairs: 1, out: "" };

function smallNet() {
  return new MLP([INPUT_SIZE, 10, 1], ["sigmoid", "sigmoid"]).randomize(0.1, seededRandom(5));
}

describe("td training", () => {
  test("a training game plays to the end and changes the weights", () => {
    const net = smallNet();
    const before = net.params.slice();
    const n = net.params.length;
    const moves = trainGame(net, config, new Float32Array(n), new Float32Array(n), new Float32Array(INPUT_SIZE));
    expect(moves).toBeGreaterThan(10);
    expect(Array.from(net.params)).not.toEqual(Array.from(before));
    expect(net.params.every((p) => Number.isFinite(p))).toBe(true);
  });
});

describe("net strategy", () => {
  test("reports win probabilities for the mover, best first, and plays the best", () => {
    const game = h.newGame();
    game.turn = c.WHITE;
    const reports: Analysis[] = [];
    const result = useNet(smallNet())(game, [3, 1], (a) => reports.push(a));
    const [analysis] = reports;
    expect(analysis.percent).toBe(true);
    expect(analysis.candidates[0].move).toEqual(result[0]);
    const values = analysis.candidates.map((cand) => cand.value);
    expect(values).toEqual([...values].sort((a, b) => b - a));
    expect(values.every((v) => v >= 0 && v <= 1)).toBe(true);
  });

  test("a finished game is a certain win or loss", () => {
    const game = h.newGame();
    game.positions.fill(0);
    game.wHome = 15;
    game.positions[0] = c.BLACK | 15;
    expect(whiteWins(smallNet(), game, c.BLACK, new Float32Array(INPUT_SIZE))).toBe(1);
  });
});

describe("net search", () => {
  test("depth 0 is the net's estimate", () => {
    const net = smallNet();
    const game = h.newGame();
    const x = new Float32Array(INPUT_SIZE);
    expect(searchValue(net, game, c.WHITE, 0, x)).toBeCloseTo(whiteWins(net, game, c.WHITE, x), 6);
  });

  test("1-ply values are probabilities, and the move played is the best searched", () => {
    const game = h.newGame();
    game.turn = c.WHITE;
    const reports: Analysis[] = [];
    const result = useNetSearch(smallNet(), 1, 4)(game, [3, 1], (a) => reports.push(a));
    const [analysis] = reports;
    expect(analysis.candidates.length).toBe(4);
    expect(analysis.candidates[0].move).toEqual(result[0]);
    expect(analysis.candidates.every((cand) => cand.value >= 0 && cand.value <= 1)).toBe(true);
  });
});
