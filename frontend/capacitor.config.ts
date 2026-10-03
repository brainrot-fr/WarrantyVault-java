import type { CapacitorConfig } from '@capacitor/cli';

const configuredUrl = process.env.ANDROID_APP_URL?.trim();
let server: CapacitorConfig['server'];

if (configuredUrl) {
  const appUrl = new URL(configuredUrl);
  if (appUrl.protocol !== 'https:' || appUrl.pathname !== '/' || appUrl.search || appUrl.hash) {
    throw new Error('ANDROID_APP_URL must be an HTTPS origin without a path, query, or fragment.');
  }
  server = {
    url: appUrl.origin,
    allowNavigation: [appUrl.hostname]
  };
}

const config: CapacitorConfig = {
  appId: 'com.warrantyvault.app',
  appName: 'WarrantyVault',
  webDir: 'dist',
  server
};

export default config;