import { createWorker, OEM } from 'tesseract.js';

export function createBillOcrTask(file, onProgress) {
  let worker;
  let cancelled = false;
  let termination;
  const terminate = () => {
    if (!termination && worker) termination = worker.terminate();
    return termination || Promise.resolve();
  };

  const promise = (async () => {
    const assetBase = `${import.meta.env.BASE_URL}tesseract/`;
    worker = await createWorker('eng', OEM.LSTM_ONLY, {
      workerPath: `${assetBase}worker.min.js`,
      corePath: assetBase,
      langPath: assetBase,
      gzip: false,
      logger: (message) => {
        if (message.status === 'recognizing text') onProgress?.(Math.max(0, Math.min(1, message.progress || 0)));
      }
    });
    if (cancelled) {
      await terminate();
      return '';
    }
    try {
      const result = await worker.recognize(file);
      return result.data.text;
    } finally {
      await terminate();
    }
  })();

  return {
    promise,
    cancel() {
      cancelled = true;
      return terminate();
    }
  };
}
