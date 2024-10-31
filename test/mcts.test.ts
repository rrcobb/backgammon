import { test, expect, describe } from "bun:test";
import { genGame } from "./helpers";
import { random } from '../src/strategies';
import { MCTSNode } from "../src/mcts";

describe("mcts", () => {
  test("Can get a result from evaluating a Node", () => {
    const game = genGame();
    const strategy = (...args) => { 
      let res = random(...args)
      if (!res) {
        console.log(args);
      }
      return res;
    };
    const roll = [4,6];
    const gameNode = new MCTSNode(game, game.turn, strategy, null, roll);
    const result = gameNode.evaluate();
    expect(result).not.toBe(null);
  });
});
