const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_EDGE = 2000;
const SMALL_PNG_BYTES = 300 * 1024;

async function readBuffer(blob) {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('The image file could not be read.'));
    reader.readAsArrayBuffer(blob);
  });
}

export async function detectImageType(file) {
  if (!file || file.size === 0) throw new Error('Choose an image file.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Each image must be 10 MB or smaller.');
  const bytes = new Uint8Array(await readBuffer(file.slice(0, 12)));
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
    throw new Error('HEIC images are not supported in the browser. Choose “Most Compatible” in your camera settings and select a JPEG instead.');
  }
  throw new Error('Choose a JPEG, PNG, or WebP image.');
}

export async function prepareImage(file) {
  const sourceType = await detectImageType(file);
  let image;
  let release = () => {};
  try {
    try {
      image = await createImageBitmap(file, { imageOrientation: 'from-image' });
      release = () => image.close();
    } catch {
      const imageUrl = URL.createObjectURL(file);
      release = () => URL.revokeObjectURL(imageUrl);
      image = await loadImage(imageUrl);
    }
    if (sourceType === 'image/png' && file.size < SMALL_PNG_BYTES
      && Math.max(image.width, image.height) <= MAX_EDGE) return file;

    const longestEdge = Math.max(image.width, image.height);
    const scale = Math.min(1, MAX_EDGE / longestEdge);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('This browser could not prepare the image.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const jpeg = await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('This browser could not prepare the image.'));
      }, 'image/jpeg', 0.82);
    });
    const basename = file.name.replace(/\.[^.]+$/, '') || 'warranty-document';
    return new File([jpeg], `${basename}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    release();
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('This image could not be opened. Try another JPEG, PNG, or WebP file.'));
    image.src = url;
  });
}
