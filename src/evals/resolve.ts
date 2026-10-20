import { readFileSync } from "fs";
import { basename } from "path";
import { Strategies, isStrategyName } from "../strategy/strategies";
import type { AppliedStrategy } from "../strategy/strategies";
import { useNetSearch, useNetCube, DEFAULT_CUBE } from "../strategy/net";
import { fromSafetensors } from "../ml/mlp";

/*
  Strategy names for the command-line tools: anything in Strategies, or
  net:<path> for a trained net in a safetensors checkpoint. Add @<ply> to
  search with the net, and +cube to have it double and take (+cube=0.5,0.6 sets
  the double and take thresholds), e.g. net:checkpoints/td-h40-latest.safetensors@1+cube.
*/

type Resolved = { label: string; strategy: AppliedStrategy };

function resolveStrategy(name: string): Resolved {
  if (name.startsWith("net:")) {
    const [spec, cubeArg] = name.split("+cube");
    const withCube = cubeArg !== undefined;
    let thresholds = DEFAULT_CUBE;
    if (cubeArg) {
      const [doubleAt, takeAt] = cubeArg.replace(/^=/, "").split(",").map(Number);
      if (!Number.isFinite(doubleAt) || !Number.isFinite(takeAt)) throw new Error(`bad cube thresholds in ${name}`);
      thresholds = { doubleAt, takeAt };
    }
    const [path, plyArg] = spec.slice("net:".length).split("@");
    const ply = Number(plyArg ?? 0);
    if (!Number.isInteger(ply) || ply < 0) throw new Error(`bad ply in ${name}`);
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(readFileSync(path));
    } catch {
      throw new Error(`can't read net checkpoint ${path}`);
    }
    const { net } = fromSafetensors(bytes);
    const label = `net:${basename(path, ".safetensors")}${ply ? `@${ply}` : ""}${withCube ? `+cube${cubeArg}` : ""}`;
    const strategy = useNetSearch(net, ply);
    if (withCube) strategy.cube = useNetCube(net, ply, thresholds);
    strategy.sname = label;
    return { label, strategy };
  }
  if (isStrategyName(name)) return { label: name, strategy: Strategies[name] };
  throw new Error(`unknown strategy ${name}. Use net:<checkpoint path> or one of: ${Object.keys(Strategies).join(", ")}`);
}

export { resolveStrategy, type Resolved };
