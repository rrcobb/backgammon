import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { constants as c, helpers as h } from "../src/backgammon";
import { MLP, toSafetensors } from "../src/ml/mlp";
import { INPUT_SIZE } from "../src/ml/encoding";
import { resolveStrategy } from "../src/evals/resolve";
import { Strategies } from "../src/strategy/strategies";

describe("resolveStrategy", () => {
  test("resolves named strategies", () => {
    expect(resolveStrategy("learned")).toEqual({ label: "learned", strategy: Strategies.learned });
  });

  test("loads a net from a checkpoint", () => {
    const dir = mkdtempSync(join(tmpdir(), "backgammon-"));
    const path = join(dir, "tiny.safetensors");
    writeFileSync(path, toSafetensors(new MLP([INPUT_SIZE, 4, 1], ["sigmoid", "sigmoid"]).randomize()));
    const { label, strategy } = resolveStrategy(`net:${path}`);
    expect(label).toBe("net:tiny");
    const game = h.newGame();
    game.turn = c.WHITE;
    expect(strategy(game, [3, 1])[0]).toBeDefined();
  });

  test("names the problem for unknown names and missing files", () => {
    expect(() => resolveStrategy("nope")).toThrow(/unknown strategy nope/);
    expect(() => resolveStrategy("net:/no/such/file.safetensors")).toThrow(/can't read net checkpoint/);
  });
});
