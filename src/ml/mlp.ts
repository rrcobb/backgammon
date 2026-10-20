/*
  A small fully connected network, written out by hand so every activation
  and gradient is visible.

  All parameters live in one flat Float32Array, layer by layer (weights, then
  biases). That keeps whole-network operations, like TD(λ)'s eligibility
  traces, to a single loop over `params`.

  Weights for layer l are stored row-major as [out][in]: the weight from
  input i to unit j is W[j * inSize + i].
*/

type Activation = "sigmoid" | "relu" | "tanh";

type LayerView = {
  inSize: number;
  outSize: number;
  activation: Activation;
  weights: Float32Array; // view into params
  biases: Float32Array; // view into params
  weightOffset: number;
  biasOffset: number;
};

const activate = {
  sigmoid: (x: number) => 1 / (1 + Math.exp(-x)),
  relu: (x: number) => (x > 0 ? x : 0),
  tanh: (x: number) => Math.tanh(x),
};

// derivative in terms of the activation's output y
const derivative = {
  sigmoid: (y: number) => y * (1 - y),
  relu: (y: number) => (y > 0 ? 1 : 0),
  tanh: (y: number) => 1 - y * y,
};

class MLP {
  sizes: number[]; // [inputs, hidden..., outputs]
  activations: Activation[]; // one per layer after the input
  params: Float32Array;
  layers: LayerView[];
  // per-layer outputs from the last forward pass; outputs[0] is the input
  outputs: Float32Array[];
  // scratch space for backprop
  private deltas: Float32Array[];

  constructor(sizes: number[], activations: Activation[], params?: Float32Array) {
    if (activations.length !== sizes.length - 1) throw new Error("need one activation per layer");
    this.sizes = sizes;
    this.activations = activations;

    let count = 0;
    for (let l = 1; l < sizes.length; l++) count += sizes[l - 1] * sizes[l] + sizes[l];
    if (params && params.length !== count) throw new Error(`expected ${count} params, got ${params.length}`);
    this.params = params ?? new Float32Array(count);

    this.layers = [];
    let offset = 0;
    for (let l = 1; l < sizes.length; l++) {
      const inSize = sizes[l - 1];
      const outSize = sizes[l];
      const weightOffset = offset;
      offset += inSize * outSize;
      const biasOffset = offset;
      offset += outSize;
      this.layers.push({
        inSize,
        outSize,
        activation: activations[l - 1],
        weights: this.params.subarray(weightOffset, weightOffset + inSize * outSize),
        biases: this.params.subarray(biasOffset, biasOffset + outSize),
        weightOffset,
        biasOffset,
      });
    }
    this.outputs = sizes.map((n) => new Float32Array(n));
    this.deltas = sizes.map((n) => new Float32Array(n));
  }

  // uniform in [-scale, scale]
  randomize(scale = 0.1, random = Math.random) {
    for (let i = 0; i < this.params.length; i++) this.params[i] = (2 * random() - 1) * scale;
    return this;
  }

  // returns the output layer; the array is reused by the next call
  forward(input: Float32Array): Float32Array {
    this.outputs[0].set(input);
    for (let l = 0; l < this.layers.length; l++) {
      const { inSize, outSize, weights, biases, activation } = this.layers[l];
      const x = this.outputs[l];
      const y = this.outputs[l + 1];
      const f = activate[activation];
      for (let j = 0; j < outSize; j++) {
        let sum = biases[j];
        const row = j * inSize;
        for (let i = 0; i < inSize; i++) sum += weights[row + i] * x[i];
        y[j] = f(sum);
      }
    }
    return this.outputs[this.outputs.length - 1];
  }

  // gradient of output `k` with respect to every parameter, written into `grad`
  // (same layout as params). Uses the activations from the last forward pass.
  outputGradient(k: number, grad: Float32Array) {
    const last = this.layers.length - 1;
    // delta = d(output k) / d(pre-activation) for each unit, layer by layer from the top
    const top = this.deltas[last + 1];
    top.fill(0);
    top[k] = derivative[this.layers[last].activation](this.outputs[last + 1][k]);

    for (let l = last; l >= 0; l--) {
      const { inSize, outSize, weights, weightOffset, biasOffset } = this.layers[l];
      const delta = this.deltas[l + 1];
      const x = this.outputs[l];
      for (let j = 0; j < outSize; j++) {
        const d = delta[j];
        const row = j * inSize;
        for (let i = 0; i < inSize; i++) grad[weightOffset + row + i] = d * x[i];
        grad[biasOffset + j] = d;
      }
      if (l === 0) break;
      // push deltas down to the layer below
      const below = this.deltas[l];
      const dBelow = derivative[this.layers[l - 1].activation];
      for (let i = 0; i < inSize; i++) {
        let sum = 0;
        for (let j = 0; j < outSize; j++) sum += weights[j * inSize + i] * delta[j];
        below[i] = sum * dBelow(x[i]);
      }
    }
  }

  // every layer's output for this input, copied (layer 0 is the input)
  getActivations(input: Float32Array): Float32Array[] {
    this.forward(input);
    return this.outputs.map((o) => o.slice());
  }

  clone(): MLP {
    return new MLP(this.sizes.slice(), this.activations.slice(), this.params.slice());
  }
}

/*
  safetensors: an 8-byte little-endian header length, a JSON header naming each
  tensor's dtype, shape, and byte range, then the raw little-endian bytes.
  https://github.com/huggingface/safetensors
*/
type SafetensorsHeader = Record<string, { dtype: string; shape: number[]; data_offsets: [number, number] } | Record<string, string>>;

function toSafetensors(net: MLP, metadata: Record<string, string> = {}): Uint8Array {
  const header: SafetensorsHeader = {
    __metadata__: { ...metadata, sizes: JSON.stringify(net.sizes), activations: JSON.stringify(net.activations) },
  };
  const tensors: Float32Array[] = [];
  let offset = 0;
  net.layers.forEach((layer, l) => {
    for (const [name, data, shape] of [
      [`layers.${l}.weight`, layer.weights, [layer.outSize, layer.inSize]],
      [`layers.${l}.bias`, layer.biases, [layer.outSize]],
    ] as const) {
      header[name] = { dtype: "F32", shape: [...shape], data_offsets: [offset, offset + data.byteLength] };
      tensors.push(data);
      offset += data.byteLength;
    }
  });

  let headerBytes = new TextEncoder().encode(JSON.stringify(header));
  // pad the header with spaces so the data starts 8-byte aligned
  const padded = Math.ceil(headerBytes.length / 8) * 8;
  if (padded !== headerBytes.length) {
    const p = new Uint8Array(padded).fill(0x20);
    p.set(headerBytes);
    headerBytes = p;
  }

  const out = new Uint8Array(8 + headerBytes.length + offset);
  new DataView(out.buffer).setBigUint64(0, BigInt(headerBytes.length), true);
  out.set(headerBytes, 8);
  let at = 8 + headerBytes.length;
  for (const t of tensors) {
    out.set(new Uint8Array(t.buffer, t.byteOffset, t.byteLength), at);
    at += t.byteLength;
  }
  return out;
}

function fromSafetensors(bytes: Uint8Array): { net: MLP; metadata: Record<string, string> } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerLength = Number(view.getBigUint64(0, true));
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + headerLength))) as SafetensorsHeader;
  const metadata = (header.__metadata__ ?? {}) as Record<string, string>;
  const net = new MLP(JSON.parse(metadata.sizes), JSON.parse(metadata.activations));
  const data = bytes.subarray(8 + headerLength);
  net.layers.forEach((layer, l) => {
    for (const [name, target] of [
      [`layers.${l}.weight`, layer.weights],
      [`layers.${l}.bias`, layer.biases],
    ] as const) {
      const entry = header[name] as { dtype: string; data_offsets: [number, number] };
      if (!entry || entry.dtype !== "F32") throw new Error(`missing or non-F32 tensor ${name}`);
      const [start, end] = entry.data_offsets;
      // copy through a fresh buffer so the source doesn't need 4-byte alignment
      target.set(new Float32Array(data.slice(start, end).buffer));
    }
  });
  return { net, metadata };
}

export { MLP, toSafetensors, fromSafetensors, type Activation };
