import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/auth.jsx';
import { getApiConfigurationError } from '@/lib/api.js';
import { ConfigurationError } from '@/features/screens.jsx';
import { AppRoutes } from '@/routes.jsx';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } }
});

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
