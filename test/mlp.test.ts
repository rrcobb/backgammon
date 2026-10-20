import { describe, expect, test } from "bun:test";
import { MLP, toSafetensors, fromSafetensors } from "../src/ml/mlp";
import { seededRandom } from "../src/evals/play";

function randomInput(n: number, random: () => number) {
  return Float32Array.from({ length: n }, () => random());
}

describe("mlp", () => {
  test("forward matches a hand computation", () => {
    // 2 inputs -> 1 sigmoid output
    const net = new MLP([2, 1], ["sigmoid"], Float32Array.from([0.5, -1, 0.25]));
    const out = net.forward(Float32Array.from([2, 1]))[0];
    expect(out).toBeCloseTo(1 / (1 + Math.exp(-(0.5 * 2 - 1 * 1 + 0.25))), 6);
  });

  for (const activations of [["sigmoid", "sigmoid"], ["relu", "sigmoid"], ["tanh", "sigmoid"]] as const) {
    test(`outputGradient matches finite differences (${activations.join(", ")})`, () => {
      const random = seededRandom(7);
      const net = new MLP([6, 5, 2], [...activations]).randomize(0.8, random);
      const input = randomInput(6, random);
      const grad = new Float32Array(net.params.length);
      for (const k of [0, 1]) {
        net.forward(input);
        net.outputGradient(k, grad);
        const eps = 1e-3;
        for (let p = 0; p < net.params.length; p++) {
          const saved = net.params[p];
          net.params[p] = saved + eps;
          const up = net.forward(input)[k];
          net.params[p] = saved - eps;
          const down = net.forward(input)[k];
          net.params[p] = saved;
          expect(grad[p]).toBeCloseTo((up - down) / (2 * eps), 3);
        }
      }
    });
  }

  test("safetensors round trip", () => {
    const random = seededRandom(3);
    const net = new MLP([198, 40, 1], ["sigmoid", "sigmoid"]).randomize(0.1, random);
    const bytes = toSafetensors(net, { games: "123" });
    const { net: loaded, metadata } = fromSafetensors(bytes);
    expect(loaded.sizes).toEqual(net.sizes);
    expect(loaded.activations).toEqual(net.activations);
    expect(Array.from(loaded.params)).toEqual(Array.from(net.params));
    expect(metadata.games).toBe("123");
    // header length is little-endian u64, and data starts 8-byte aligned
    const headerLength = Number(new DataView(bytes.buffer).getBigUint64(0, true));
    expect(headerLength % 8).toBe(0);
    expect(bytes.length).toBe(8 + headerLength + net.params.length * 4);
  });
});
