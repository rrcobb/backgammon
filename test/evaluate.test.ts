// test/evaluate.test.ts
import { test, expect, describe } from "bun:test";
import type { Game, Player } from "../src/backgammon";
import { constants as c, helpers as h } from "../src/backgammon";
import { genGames } from "./helpers";
import { evaluate, getPipCounts, getBlots, getBoardStrength } from "../src/strategy/evaluate";
import { factors as f } from "../src/strategy/factors";

// this doesn't ultimately matter, since we're persisting the games to evaluate in the snapshot
test("genGames produces consistent output with same seed", () => {
  const games1 = genGames(5);
  const games2 = genGames(5);

  expect(games1).toEqual(games2);
});

// regenerate with `bun test/scoring-snapshot.ts` after an intended change to evaluate
test("evaluate matches scoring snapshot", async () => {
  const snapshot = JSON.parse(await Bun.file("test/scoring-snapshot.json").text());
  const snapScores = snapshot.map(({ score }) => expect.closeTo(score, 6));
  const evalScores = snapshot.map(({ game }) => {
    const g = { ...game, positions: new Uint8Array(game.positions) };
    return evaluate(f.balancedFactors)(g, g.turn);
  });
  expect(evalScores).toEqual(snapScores);
});

// board helpers: white moves from index 0 up to 23 (home board 18-23),
// black moves from 23 down to 0 (home board 0-5)
function emptyGame(turn: Player = c.WHITE): Game {
  const g = h.newGame();
  g.positions.fill(0);
  g.turn = turn;
  return g;
}

describe("pip counts", () => {
  test("start position is even and not a race", () => {
    const pips = getPipCounts(h.newGame(), c.WHITE);
    expect(pips.white).toBe(167);
    expect(pips.black).toBe(167);
    expect(pips.diff).toBe(0);
    expect(pips.isRacing).toBe(false);
  });

  test("diff is the player's lead", () => {
    const g = emptyGame();
    g.positions[23] = c.WHITE | 2; // white 1 point: 2 pips
    g.positions[18] = c.BLACK | 1; // black 19 point: 19 pips
    expect(getPipCounts(g, c.WHITE).diff).toBe(17);
    expect(getPipCounts(g, c.BLACK).diff).toBe(-17);
  });

  test("a race is when the checkers have passed each other", () => {
    const race = emptyGame();
    race.positions[20] = c.WHITE | 3;
    race.positions[2] = c.BLACK | 3;
    expect(getPipCounts(race, c.WHITE).isRacing).toBe(true);

    const contact = emptyGame();
    contact.positions[2] = c.WHITE | 3;
    contact.positions[20] = c.BLACK | 3;
    expect(getPipCounts(contact, c.WHITE).isRacing).toBe(false);
  });

  test("checkers on the bar count 25 pips and mean contact", () => {
    const g = emptyGame();
    g.positions[20] = c.WHITE | 3;
    g.positions[2] = c.BLACK | 3;
    g.wBar = 1;
    const pips = getPipCounts(g, c.WHITE);
    expect(pips.white).toBe(3 * 4 + 25);
    expect(pips.isRacing).toBe(false);
  });
});

describe("blot hit chances", () => {
  test("black can hit a white blot when entering from the bar", () => {
    const g = emptyGame();
    g.positions[20] = c.WHITE | 1; // black enters at 24 - die, so a 4 hits
    g.bBar = 1;
    expect(getBlots(g, c.WHITE).blots[20]).toBeGreaterThan(0);
    g.bBar = 0;
    expect(getBlots(g, c.WHITE).blots[20]).toBe(0);
  });

  test("white can hit a black blot when entering from the bar", () => {
    const g = emptyGame(c.BLACK);
    g.positions[3] = c.BLACK | 1; // white enters at die - 1, so a 4 hits
    g.wBar = 1;
    expect(getBlots(g, c.BLACK).blots[3]).toBeGreaterThan(0);
    g.wBar = 0;
    expect(getBlots(g, c.BLACK).blots[3]).toBe(0);
  });

  test("only checkers behind a blot can hit it", () => {
    const g = emptyGame();
    g.positions[10] = c.WHITE | 1;
    g.positions[8] = c.BLACK | 1; // black is past the blot, moving away
    expect(getBlots(g, c.WHITE).blots[10]).toBe(0);
    g.positions[12] = c.BLACK | 1; // black is 2 behind the blot
    expect(getBlots(g, c.WHITE).blots[10]).toBeGreaterThan(0);
  });
});

describe("board strength", () => {
  const strength = (g: Game, player: Player) => getBoardStrength(g, player, getBlots(g, player), f.balancedFactors);

  test("points in your own home board count as home, in the opponent's as anchors", () => {
    const counts = (index: number, player: Player) => {
      const g = emptyGame(player);
      g.positions[index] = player | 2;
      const { homeCount, anchorCount } = strength(g, player);
      return { homeCount, anchorCount };
    };
    expect(counts(19, c.WHITE)).toEqual({ homeCount: 1, anchorCount: 0 }); // white's 5 point
    expect(counts(3, c.WHITE)).toEqual({ homeCount: 0, anchorCount: 1 }); // white's 21 point
    expect(counts(4, c.BLACK)).toEqual({ homeCount: 1, anchorCount: 0 }); // black's 5 point
    expect(counts(20, c.BLACK)).toEqual({ homeCount: 0, anchorCount: 1 }); // black's 21 point
  });

  test("control is highest on your own 5 point", () => {
    const control = (index: number, player: Player) => {
      const g = emptyGame(player);
      g.positions[index] = player | 2;
      return strength(g, player).fivePointControl;
    };
    const whiteFive = control(19, c.WHITE);
    expect(whiteFive).toBeGreaterThan(control(18, c.WHITE));
    expect(whiteFive).toBeGreaterThan(control(20, c.WHITE));
    expect(whiteFive).toBeGreaterThan(control(4, c.WHITE));
    expect(control(4, c.BLACK)).toBeCloseTo(whiteFive);
  });
});

describe("who rolls next", () => {
  // game.turn is the player who just moved; the other player rolls next
  const score = (g: Game, player: Player) => evaluate(f.balancedFactors)(g, player);

  test("your blots are at risk after you move, not while you're on roll", () => {
    const g = emptyGame();
    g.positions[10] = c.WHITE | 1;
    g.positions[12] = c.BLACK | 2; // black can hit the white blot with a 2
    const justMoved = score({ ...g, turn: c.WHITE }, c.WHITE);
    const onRoll = score({ ...g, turn: c.BLACK }, c.WHITE);
    expect(onRoll).toBeGreaterThan(justMoved);
  });

  test("on roll, you get credit for shots at the opponent's blots", () => {
    const g = emptyGame();
    g.positions[10] = c.WHITE | 2;
    g.positions[12] = c.BLACK | 1; // white can hit this with a 2
    const shots = getBlots(g, c.BLACK).totalPenalty;
    expect(shots).toBeGreaterThan(0);

    const justMoved = score({ ...g, turn: c.WHITE }, c.WHITE);
    const onRoll = score({ ...g, turn: c.BLACK }, c.WHITE);
    expect(onRoll - justMoved).toBeCloseTo(shots * f.balancedFactors.blotPenalty);
  });
});
