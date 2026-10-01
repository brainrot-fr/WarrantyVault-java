import { describe, expect, it } from 'vitest';
import { detectImageType } from './prepareImage.js';

describe('image preparation validation', () => {
  it('uses image magic bytes rather than the browser-provided MIME type', async () => {
    const pngSignature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const file = new File([pngSignature], 'bill.jpg', { type: 'image/jpeg' });
    await expect(detectImageType(file)).resolves.toBe('image/png');
  });

  it('gives a camera-specific message for HEIC files', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'bill.heic', { type: 'image/heic' });
    await expect(detectImageType(file)).rejects.toThrow('Most Compatible');
  });
});
