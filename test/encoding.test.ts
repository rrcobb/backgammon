import { describe, expect, test } from "bun:test";
import { constants as c, helpers as h } from "../src/backgammon";
import { encode, inputName, INPUT_SIZE, OFFSET } from "../src/ml/encoding";

describe("td-gammon encoding", () => {
  test("has 198 units", () => {
    expect(encode(h.newGame(), c.WHITE).length).toBe(INPUT_SIZE);
    expect(INPUT_SIZE).toBe(198);
  });

  test("encodes the start position", () => {
    const x = encode(h.newGame(), c.WHITE);
    // white has 2 on index 0 and 5 on index 11
    expect(Array.from(x.subarray(OFFSET.white, OFFSET.white + 4))).toEqual([1, 1, 0, 0]);
    expect(Array.from(x.subarray(OFFSET.white + 11 * 4, OFFSET.white + 12 * 4))).toEqual([1, 1, 1, 1]);
    // black has 5 on index 5
    expect(Array.from(x.subarray(OFFSET.black + 5 * 4, OFFSET.black + 6 * 4))).toEqual([1, 1, 1, 1]);
    // each side's units add up to the same total
    const sum = (a: Float32Array) => a.reduce((s, v) => s + v, 0);
    expect(sum(x.subarray(OFFSET.white, OFFSET.black))).toBeCloseTo(sum(x.subarray(OFFSET.black, OFFSET.wBar)));
    expect(x[OFFSET.whiteToMove]).toBe(1);
    expect(x[OFFSET.blackToMove]).toBe(0);
  });

  test("encodes bar, off, and turn", () => {
    const g = h.newGame();
    g.wBar = 2;
    g.bHome = 3;
    const x = encode(g, c.BLACK);
    expect(x[OFFSET.wBar]).toBe(1);
    expect(x[OFFSET.bHome]).toBeCloseTo(3 / 15);
    expect(x[OFFSET.whiteToMove]).toBe(0);
    expect(x[OFFSET.blackToMove]).toBe(1);
  });

  test("names units", () => {
    expect(inputName(0)).toBe("white index 0 n>=1");
    expect(inputName(96 + 4 * 5 + 3)).toBe("black index 5 (n-3)/2");
    expect(inputName(197)).toBe("black to move");
  });
});
