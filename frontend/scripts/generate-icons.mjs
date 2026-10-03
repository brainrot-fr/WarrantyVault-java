import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#1f2a2d" />
  <path d="M160 180h192v152c0 34-27 61-61 61H221c-34 0-61-27-61-61V180Zm42 0V146c0-35 28-63 63-63h42c35 0 63 28 63 63v34" stroke="#f5efe8" stroke-width="22" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M256 220v72M220 256h72" stroke="#f5efe8" stroke-width="18" stroke-linecap="round"/>
</svg>`;

await sharp(Buffer.from(svg)).resize(192, 192).png().toFile(path.join(outDir, 'icon-192.png'));
await sharp(Buffer.from(svg)).resize(512, 512).png().toFile(path.join(outDir, 'icon-512.png'));
await sharp(Buffer.from(svg)).resize(512, 512, { fit: 'contain', background: { r: 31, g: 42, b: 45, alpha: 1 } }).png().toFile(path.join(outDir, 'icon-maskable-512.png'));

const androidResDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'res');
if (fs.existsSync(androidResDir)) {
  const foregroundSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <path d="M160 180h192v152c0 34-27 61-61 61H221c-34 0-61-27-61-61V180Zm42 0V146c0-35 28-63 63-63h42c35 0 63 28 63 63v34" stroke="#f5efe8" stroke-width="22" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M256 220v72M220 256h72" stroke="#f5efe8" stroke-width="18" stroke-linecap="round"/>
</svg>`;
  const androidIconSizes = [
    ['mdpi', 48, 108],
    ['hdpi', 72, 162],
    ['xhdpi', 96, 216],
    ['xxhdpi', 144, 324],
    ['xxxhdpi', 192, 432]
  ];
  for (const [density, iconSize, foregroundSize] of androidIconSizes) {
    const mipmapDir = path.join(androidResDir, `mipmap-${density}`);
    await sharp(Buffer.from(svg)).resize(iconSize, iconSize).png().toFile(path.join(mipmapDir, 'ic_launcher.png'));
    await sharp(Buffer.from(svg)).resize(iconSize, iconSize).png().toFile(path.join(mipmapDir, 'ic_launcher_round.png'));
    await sharp(Buffer.from(foregroundSvg)).resize(foregroundSize, foregroundSize).png().toFile(path.join(mipmapDir, 'ic_launcher_foreground.png'));
  }
}

console.log('Generated app icons at', outDir);
