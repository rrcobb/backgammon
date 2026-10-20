import { describe, expect, test } from "bun:test";
import { constants as c, helpers as h } from "../src/backgammon";
import type { Game } from "../src/backgammon";
import { Strategies } from "../src/strategy/strategies";
import type { AppliedStrategy } from "../src/strategy/strategies";
import { MLP } from "../src/ml/mlp";
import { INPUT_SIZE } from "../src/ml/encoding";
import { useNetCube } from "../src/strategy/net";
import { playOut, seededDice } from "../src/evals/play";

// a copy of a strategy with a scripted cube
function withCube(strategy: AppliedStrategy, cube: { double: (g: Game) => boolean; take: (g: Game) => boolean }) {
  const s: AppliedStrategy = (game, roll, report) => strategy(game, roll, report);
  s.cube = cube;
  return s;
}

function start() {
  const game = h.newGame();
  game.turn = c.WHITE;
  return game;
}

describe("cube rules", () => {
  test("either player may double a centered cube; only the owner after that", () => {
    const g = start();
    expect(h.canDouble(g, c.WHITE)).toBe(true);
    expect(h.canDouble(g, c.BLACK)).toBe(true);
    g.cube = 2;
    g.cubeOwner = c.BLACK;
    expect(h.canDouble(g, c.WHITE)).toBe(false);
    expect(h.canDouble(g, c.BLACK)).toBe(true);
    g.cube = 64;
    expect(h.canDouble(g, c.BLACK)).toBe(false);
  });

  test("a drop ends the game for the cube's value", () => {
    const doubler = withCube(Strategies.learned, { double: () => true, take: () => true });
    const dropper = withCube(Strategies.learned, { double: () => false, take: () => false });
    expect(playOut(start(), doubler, dropper, seededDice(1))).toEqual({ winner: c.WHITE, points: 1 });
  });

  test("a take doubles the cube and passes it; points are multiplied", () => {
    let seen: { cube: number; owner: number | undefined }[] = [];
    const doubleOnce = withCube(Strategies.learned, {
      double: (g) => {
        seen.push({ cube: g.cube, owner: g.cubeOwner });
        return g.cube === 1;
      },
      take: () => true,
    });
    const taker = withCube(Strategies.learned, { double: () => false, take: () => true });
    const outcome = playOut(start(), doubleOnce, taker, seededDice(2));
    // white doubled once at the start; after that white no longer owns the cube, so isn't asked again
    expect(seen).toEqual([{ cube: 1, owner: undefined }]);
    expect(outcome.points % 2).toBe(0);
  });

  test("no doubling before the opening roll", () => {
    // count the moves made before white is first asked to double
    const firstAsk = (firstRoll?: [1, 3]) => {
      let moves = 0;
      let askedAfter = -1;
      const counting: AppliedStrategy = (game, roll, report) => (moves++, Strategies.learned(game, roll, report));
      const white = withCube(counting, { double: () => (askedAfter < 0 && (askedAfter = moves), false), take: () => true });
      const black: AppliedStrategy = (game, roll, report) => (moves++, Strategies.learned(game, roll, report));
      playOut(start(), white, black, seededDice(3), firstRoll);
      return askedAfter;
    };
    expect(firstAsk()).toBe(0);
    // with an opening roll, white plays it, black moves, and then white may double
    expect(firstAsk([1, 3])).toBe(2);
  });

  test("strategies without a cube never double and always take", () => {
    const doubler = withCube(Strategies.learned, { double: () => true, take: () => true });
    const outcome = playOut(start(), doubler, Strategies.learned, seededDice(4));
    expect(outcome.points).toBeGreaterThanOrEqual(2);
  });
});

describe("net cube decisions", () => {
  // a net that outputs the same probabilities everywhere
  function constantNet(outputs: number[]) {
    const net = new MLP([INPUT_SIZE, 2, outputs.length], ["sigmoid", "sigmoid"]);
    outputs.forEach((p, k) => (net.layers[1].biases[k] = Math.log(p / (1 - p))));
    return net;
  }

  test("doubles and the opponent drops when the doubler is well ahead", () => {
    const cube = useNetCube(constantNet([0.9]), 0); // white's equity 0.8
    expect(cube.double(start())).toBe(true);
    expect(cube.take(start())).toBe(false);
  });

  test("doesn't double, and would take, when it's close", () => {
    const cube = useNetCube(constantNet([0.6]), 0); // white's equity 0.2
    expect(cube.double(start())).toBe(false);
    expect(cube.take(start())).toBe(true);
  });

  test("too good to double when gammons are likely", () => {
    const cube = useNetCube(constantNet([0.95, 0.6, 0.05, 0.01, 0.001]), 0); // white's equity about 1.54
    expect(cube.double(start())).toBe(false);
  });

  test("decisions are from the doubler's side", () => {
    const cube = useNetCube(constantNet([0.1]), 0); // white's equity -0.8: black is well ahead
    const g = start();
    g.turn = c.BLACK;
    expect(cube.double(g)).toBe(true);
  });
});
