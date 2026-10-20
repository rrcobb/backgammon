import { readFileSync } from "fs";
import { basename } from "path";
import { Strategies, isStrategyName } from "../strategy/strategies";
import type { AppliedStrategy } from "../strategy/strategies";
import { useNet } from "../strategy/net";
import { fromSafetensors } from "../ml/mlp";

/*
  Strategy names for the command-line tools: anything in Strategies, or
  net:<path> for a trained net in a safetensors checkpoint.
*/

type Resolved = { label: string; strategy: AppliedStrategy };

function resolveStrategy(name: string): Resolved {
  if (name.startsWith("net:")) {
    const path = name.slice("net:".length);
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(readFileSync(path));
    } catch {
      throw new Error(`can't read net checkpoint ${path}`);
    }
    const { net } = fromSafetensors(bytes);
    const label = `net:${basename(path, ".safetensors")}`;
    const strategy = useNet(net);
    strategy.sname = label;
    return { label, strategy };
  }
  if (isStrategyName(name)) return { label: name, strategy: Strategies[name] };
  throw new Error(`unknown strategy ${name}. Use net:<checkpoint path> or one of: ${Object.keys(Strategies).join(", ")}`);
}

export { resolveStrategy, type Resolved };
