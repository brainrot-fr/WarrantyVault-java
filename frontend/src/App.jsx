import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/auth.jsx';
import { getApiConfigurationError } from '@/lib/api.js';
import { ConfigurationError } from '@/features/ConfigurationError.jsx';
import { AppRoutes } from '@/routes.jsx';
import { queryClient } from '@/lib/queryClient.js';

export default function App() {
  if (getApiConfigurationError()) return <ConfigurationError />;
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </QueryClientProvider>
  );
}
