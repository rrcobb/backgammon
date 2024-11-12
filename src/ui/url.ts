import { constants as c } from '../backgammon'
import { setStrategy } from './strategy';

async function compressString(str) {
  // Convert string to stream
  const stream = new Blob([str]).stream();

  // Compress the stream
  const compressedStream = stream.pipeThrough(new CompressionStream("gzip"));

  // Convert compressed stream back to string (base64)
  const compressedResponse = await new Response(compressedStream);
  const buffer = await compressedResponse.arrayBuffer();
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

async function decompressString(base64Str) {
  // Convert base64 back to binary
  const binaryStr = atob(base64Str);
  const bytes = Uint8Array.from(binaryStr, c => c.charCodeAt(0));

  // Create blob and stream
  const blob = new Blob([bytes]);
  const decompressedStream = blob.stream().pipeThrough(new DecompressionStream("gzip"));

  // Convert back to string
  const decompressedResponse = await new Response(decompressedStream);
  return await decompressedResponse.text();
}

async function objectToUrl(obj) {
  try {
    // Custom replacer to handle Uint8Array
    const jsonStr = JSON.stringify(obj, (key, value) => {
      if (value instanceof Uint8Array) {
        return {
          type: 'Uint8Array',
          data: Array.from(value)  // Convert to regular array for JSON
        };
      }
      return value;
    });

    const compressed = await compressString(jsonStr);
    return `#data=${compressed}`;
  } catch (err) {
    console.error('Failed to convert object to URL:', err);
    throw err;
  }
}
async function objectFromUrl(url) {
  try {
    const hash = url.split('#data=')[1];
    if (!hash) throw new Error('No data found in URL');

    const decompressed = await decompressString(hash);

    // Custom reviver to restore Uint8Array
    return JSON.parse(decompressed, (key, value) => {
      if (value && value.type === 'Uint8Array' && Array.isArray(value.data)) {
        return new Uint8Array(value.data);
      }
      return value;
    });
  } catch (err) {
    console.error('Failed to parse object from URL:', err);
    throw err;
  }
}

export function saveStrategyToUrl(state) {
  const params = new URLSearchParams();
  params.set('w', state.whiteStrategy.sname);
  params.set('b', state.blackStrategy.sname);

  history.replaceState(null, '', '?' + params.toString() + window.location.hash);
}

async function saveGameHistoryToUrl(gHistory, state) {
  saveStrategyToUrl(state);
  const url = await objectToUrl(gHistory);
  window.location.hash = url 
}

async function restoreFromUrl(state) {
  let urlHistory = await objectFromUrl(window.location.hash);
  state.gameHistory = urlHistory;
  let last = state.gameHistory[state.gameHistory.length - 1];
  state.game = last.game;
  state.turnNo = last.turnNo;
  state.backCount = 0;
  const params = new URLSearchParams(window.location.search);
  if (params.has('w')) setStrategy(c.WHITE, params.get('w'), state);
  if (params.has('b')) setStrategy(c.BLACK, params.get('b'), state);
}

export { saveGameHistoryToUrl, restoreFromUrl }
