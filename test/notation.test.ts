import { describe, expect, test } from "bun:test";
import { constants as c, helpers as h } from "../src/backgammon";
import { formatMove, formatPosition } from "../src/notation";

describe("notation", () => {
  test("the start position is the same from both sides", () => {
    expect(formatPosition(h.newGame())).toBe(
      ["white: 24x2 13x5 8x3 6x5", "black: 24x2 13x5 8x3 6x5"].join("\n"),
    );
  });

  test("opening 3-1 makes the 5 point for either player", () => {
    const white = h.newGame();
    white.turn = c.WHITE;
    const whiteMoves = h.validMoves(white, [3, 1]).map(([m]) => formatMove(m, c.WHITE));
    expect(whiteMoves).toContain("8/5 6/5");

    const black = h.newGame();
    black.turn = c.BLACK;
    const blackMoves = h.validMoves(black, [3, 1]).map(([m]) => formatMove(m, c.BLACK));
    expect(blackMoves).toContain("8/5 6/5");
  });

  test("bar and off", () => {
    expect(formatMove([[c.BAR, 2], [20, c.HOME]], c.WHITE)).toBe("bar/22 4/off");
    expect(formatMove([null, null], c.WHITE)).toBe("(no move)");
  });
});
