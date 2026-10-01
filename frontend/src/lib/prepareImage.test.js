import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectImageType, prepareImage, prepareImageSelection } from './prepareImage.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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

  it('clears the file input before rejecting an unsupported image', async () => {
    const input = {
      files: [new File(['not an image'], 'bill.pdf', { type: 'application/pdf' })],
      value: 'C:\\fakepath\\bill.pdf'
    };
    await expect(prepareImageSelection(input)).rejects.toThrow('Choose a JPEG, PNG, or WebP image.');
    expect(input.value).toBe('');
  });

  it('resizes decoded images, applies orientation, and uses a white opaque background', async () => {
    const bitmap = { width: 3000, height: 1500, close: vi.fn() };
    const createImageBitmap = vi.fn().mockResolvedValue(bitmap);
    vi.stubGlobal('createImageBitmap', createImageBitmap);

    const context = {
      fillRect: vi.fn(),
      drawImage: vi.fn()
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(context),
      toBlob: vi.fn((callback) => callback(new Blob(['jpeg'], { type: 'image/jpeg' })))
    };
    vi.spyOn(document, 'createElement').mockReturnValue(canvas);

    const jpegBytes = new Uint8Array(10 * 1024 * 1024 + 1);
    jpegBytes.set([0xff, 0xd8, 0xff]);
    const file = new File([jpegBytes], 'receipt.scan.jpg', { type: 'image/jpeg' });
    const prepared = await prepareImage(file);

    expect(createImageBitmap).toHaveBeenCalledWith(file, { imageOrientation: 'from-image' });
    expect(canvas.width).toBe(2000);
    expect(canvas.height).toBe(1000);
    expect(context.fillStyle).toBe('#fff');
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 2000, 1000);
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 2000, 1000);
    expect(prepared).toBeInstanceOf(File);
    expect(prepared.name).toBe('receipt.scan.jpg');
    expect(prepared.type).toBe('image/jpeg');
    expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it('rejects processed output larger than 10 MB', async () => {
    const bitmap = { width: 1000, height: 1000, close: vi.fn() };
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({ fillRect: vi.fn(), drawImage: vi.fn() }),
      toBlob: vi.fn((callback) => callback(new Blob([new Uint8Array(10 * 1024 * 1024 + 1)])))
    };
    vi.spyOn(document, 'createElement').mockReturnValue(canvas);
    const bytes = new Uint8Array([0xff, 0xd8, 0xff]);
    const file = new File([bytes], 'bill.jpg', { type: 'image/jpeg' });

    await expect(prepareImage(file)).rejects.toThrow('processed image must be 10 MB or smaller');
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
});
