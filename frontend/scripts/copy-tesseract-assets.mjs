import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, '..');
const publicDirectory = path.join(rootDirectory, 'public', 'tesseract');
const workerSource = path.join(rootDirectory, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js');
const coreSourceDirectory = path.join(rootDirectory, 'node_modules', 'tesseract.js-core');
fs.mkdirSync(publicDirectory, { recursive: true });

if (!fs.existsSync(workerSource)) {
  throw new Error('Tesseract worker is missing. Install frontend dependencies before copying OCR assets.');
}
fs.copyFileSync(workerSource, path.join(publicDirectory, 'worker.min.js'));

const coreFiles = fs.readdirSync(coreSourceDirectory)
  .filter((file) => /^tesseract-core.*\.wasm(?:\.js)?$/.test(file));
if (!coreFiles.length) {
  throw new Error('Tesseract WASM core files are missing from node_modules/tesseract.js-core.');
}
for (const file of coreFiles) {
  fs.copyFileSync(path.join(coreSourceDirectory, file), path.join(publicDirectory, file));
}

const languageFile = path.join(publicDirectory, 'eng.traineddata');
if (!fs.existsSync(languageFile) || fs.statSync(languageFile).size < 100_000) {
  try {
    const response = await fetch('https://raw.githubusercontent.com/tesseract-ocr/tessdata/main/eng.traineddata');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 100_000) throw new Error('downloaded language file is unexpectedly small');
    fs.writeFileSync(languageFile, bytes);
  } catch (error) {
    throw new Error(
      `English OCR data is missing and could not be downloaded (${error.message}). ` +
      'Connect to the network once or place eng.traineddata in frontend/public/tesseract/.'
    );
  }
}

console.log(`Tesseract worker, ${coreFiles.length} core files, and English data are ready in ${publicDirectory}`);
