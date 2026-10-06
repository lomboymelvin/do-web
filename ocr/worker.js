// Dō screenshot reader (web version). Runs in the background, on this device only.
// It uses Tesseract, a classic open-source text-recognition engine (see LICENSE-Tesseract.txt), compiled to
// WebAssembly. Nothing is sent anywhere: the picture goes in, the words and where they sit on it come out.
/* global TesseractCore */
let ready = null, api = null, core = null;

// Faster engine on devices that support SIMD (most phones and computers since 2021), plain one otherwise.
const SIMD = (() => { try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch { return false; } })();

function start() {
  if (ready) return ready;
  ready = (async () => {
    const name = SIMD ? 'tesseract-core-simd-lstm' : 'tesseract-core-lstm';
    importScripts(`${name}.js`);
    core = await TesseractCore({ locateFile: (p) => (p.endsWith('.wasm') ? `${name}.wasm` : p), print: () => {}, printErr: () => {} });
    const data = new Uint8Array(await (await fetch('eng.traineddata')).arrayBuffer());
    core.FS.writeFile('/eng.traineddata', data);
    api = new core.TessBaseAPI();
    if (api.Init('/', 'eng', 1) !== 0) throw new Error('The text reader could not start.'); // 1 = the LSTM engine only
    api.SetVariable('preserve_interword_spaces', '1');
  })();
  ready.catch(() => { ready = null; });
  return ready;
}

self.onmessage = async (e) => {
  const { id, type, image } = e.data || {};
  try {
    await start();
    if (type === 'warm') { self.postMessage({ id, ok: true }); return; }
    core.FS.writeFile('/input', image);
    if (api.SetImageFile(1, 0) === 1) throw new Error('Dō couldn’t open that picture.');
    api.Recognize(null);
    // One row per word: level, page, block, paragraph, line, word, left, top, width, height, confidence, text.
    const tsv = api.GetTSVText(0);
    api.Clear();
    try { core.FS.unlink('/input'); } catch { /* already gone */ }
    self.postMessage({ id, ok: true, tsv });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err?.message || err) });
  }
};
