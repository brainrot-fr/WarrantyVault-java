import { getApiConfigurationError } from '@/lib/api.js';
import '../app.css';

export function ConfigurationError() {
  return (
    <main className="configuration-error" role="alert">
      <p className="eyebrow">WARRANTYVAULT CONFIGURATION</p>
      <h1>Connect your WarrantyVault API</h1>
      <p>{getApiConfigurationError()}</p>
    </main>
  );
}
