import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidAssetsDir = path.join(frontendDir, 'android', 'app', 'src', 'main', 'assets');
const capacitorConfigPath = path.join(androidAssetsDir, 'capacitor.config.json');

if (fs.existsSync(capacitorConfigPath)) {
  const capacitorConfig = JSON.parse(fs.readFileSync(capacitorConfigPath, 'utf8'));
  if (capacitorConfig.server?.url) {
    fs.rmSync(path.join(androidAssetsDir, 'public', 'tesseract'), { recursive: true, force: true });
  }
}