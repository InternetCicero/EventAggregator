const { createWorker } = require('tesseract.js');

let workerPromise = null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker(['eng', 'deu']).catch((err) => {
      workerPromise = null; // allow retry on next call
      throw err;
    });
  }
  return workerPromise;
}

async function extractTextFromImage(buffer) {
  const worker = await getWorker();
  const { data } = await worker.recognize(buffer);
  return data.text.trim();
}

module.exports = { extractTextFromImage };
