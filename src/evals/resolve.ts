import { readFileSync } from "fs";
import { basename } from "path";
import { Strategies, isStrategyName } from "../strategy/strategies";
import type { AppliedStrategy } from "../strategy/strategies";
import { useNetSearch } from "../strategy/net";
import { fromSafetensors } from "../ml/mlp";

/*
  Strategy names for the command-line tools: anything in Strategies, or
  net:<path> for a trained net in a safetensors checkpoint. Add @<ply> to
  search with the net, e.g. net:checkpoints/td-h40-latest.safetensors@1.
*/

type Resolved = { label: string; strategy: AppliedStrategy };

function resolveStrategy(name: string): Resolved {
  if (name.startsWith("net:")) {
    const [path, plyArg] = name.slice("net:".length).split("@");
    const ply = Number(plyArg ?? 0);
    if (!Number.isInteger(ply) || ply < 0) throw new Error(`bad ply in ${name}`);
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(readFileSync(path));
    } catch {
      throw new Error(`can't read net checkpoint ${path}`);
    }
    const { net } = fromSafetensors(bytes);
    const label = `net:${basename(path, ".safetensors")}${ply ? `@${ply}` : ""}`;
    const strategy = useNetSearch(net, ply);
    strategy.sname = label;
    return { label, strategy };
  }
  if (isStrategyName(name)) return { label: name, strategy: Strategies[name] };
  throw new Error(`unknown strategy ${name}. Use net:<checkpoint path> or one of: ${Object.keys(Strategies).join(", ")}`);
}

export { resolveStrategy, type Resolved };
