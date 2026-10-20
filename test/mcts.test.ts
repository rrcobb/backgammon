import { test, expect, describe } from "bun:test";
import { constants as c, helpers as h } from "../src/backgammon";
import type { Roll } from "../src/backgammon";
import { random, Strategies } from "../src/strategy/strategies";
import { useMCTS, search, mostVisited, Decision } from "../src/strategy/mcts";

const options = { explore: 0.3, simulations: 200, rolloutStrategy: random };

function startGame() {
  const game = h.newGame();
  game.turn = c.WHITE;
  return game;
}

describe("mcts", () => {
  test("returns one of the valid moves", () => {
    const game = startGame();
    const roll: Roll = [4, 6];
    const result = useMCTS({ ...options, simulations: 20 })(game, roll);
    const valid = h.validMoves(game, roll).map(([m]) => JSON.stringify(m));
    expect(valid).toContain(JSON.stringify(result[0]));
  });

  test("counts every simulation at the root", () => {
    const root = search(startGame(), [3, 1], options);
    expect(root.visits).toBe(200);
    expect(root.children.reduce((s, ch) => s + ch.visits, 0)).toBe(200);
  });

  test("grows past the first move, with the opponent's rolls as chance nodes", () => {
    const root = search(startGame(), [3, 1], options);
    const opponentDecisions = root.children.flatMap((ch) => [...ch.children.values()]);
    expect(opponentDecisions.length).toBeGreaterThan(0);
    // the opponent's decisions are black's moves
    expect(opponentDecisions.every((d) => d.player === c.BLACK)).toBe(true);
    // and some of them have been expanded further
    expect(opponentDecisions.some((d: Decision) => d.children.length > 0)).toBe(true);
  });

  test("records wins from the mover's side", () => {
    const root = search(startGame(), [3, 1], options);
    for (const child of root.children) {
      expect(child.mover).toBe(c.WHITE);
      expect(child.wins).toBeLessThanOrEqual(child.visits);
      for (const decision of child.children.values()) {
        for (const reply of decision.children) expect(reply.mover).toBe(c.BLACK);
      }
    }
  });

  test("returns the only move without searching", () => {
    const game = h.newGame();
    game.positions.fill(0);
    game.turn = c.WHITE;
    game.positions[23] = c.WHITE | 1;
    game.wHome = 14;
    game.positions[0] = c.BLACK | 15;
    const result = useMCTS(options)(game, [6, 5]);
    expect(result[1].wHome).toBe(15);
  });

  test("picks the move the rollouts favor", () => {
    // white can hit black's last checker back to the bar or not; hitting is far better
    const game = h.newGame();
    game.positions.fill(0);
    game.turn = c.WHITE;
    game.positions[18] = c.WHITE | 13;
    game.positions[20] = c.BLACK | 1; // black's last checker, on white's 4 point
    game.positions[16] = c.WHITE | 2;
    game.bHome = 14;
    const root = search(game, [4, 2], { ...options, simulations: 400, rolloutStrategy: Strategies.balanced });
    const best = mostVisited(root);
    expect(best.game.bBar).toBe(1);
  });
});
