import { test, expect, describe } from "bun:test";
import { genGame } from "./helpers";
import { random } from '../src/strategy/strategies';
import { MCTSNode } from "../src/strategy/mcts";

describe("mcts", () => {
  test("Can get a result from evaluating a Node", () => {
    const game = genGame();
    const strategy = random;
    const roll = [4,6];
    const explore = 0.1;
    const simulations = 4;
    const gameNode = new MCTSNode(game, game.turn, strategy, null, roll, null, explore, simulations);
    const result = gameNode.evaluate();
    expect(result).not.toBe(null);
  });
});
