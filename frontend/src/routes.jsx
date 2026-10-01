import { Component, lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuth } from '@/lib/auth.jsx';

function lazyScreen(name) {
  return lazy(() => import('@/features/screens.jsx').then((screens) => ({ default: screens[name] })));
}

const AuthPage = lazyScreen('AuthPage');
const DashboardPage = lazyScreen('DashboardPage');
const InvitationsPage = lazyScreen('InvitationsPage');
const LandingPage = lazyScreen('LandingPage');
const NotFoundPage = lazyScreen('NotFoundPage');
const ProductFormPage = lazyScreen('ProductFormPage');
const ProductReaderPage = lazyScreen('ProductReaderPage');
const ProtectedPage = lazyScreen('ProtectedPage');
const SettingsPage = lazyScreen('SettingsPage');
const SpaceMembersPage = lazyScreen('SpaceMembersPage');
const SpacePage = lazyScreen('SpacePage');
const SpacesPage = lazyScreen('SpacesPage');

class PageErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('Page rendering failed:', error.name);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="configuration-error" role="alert">
          <h1>This page could not be loaded</h1>
          <p>Reload WarrantyVault to try again.</p>
          <button className="button button-primary" onClick={() => window.location.reload()} type="button">Reload page</button>
        </main>
      );
    }
    return this.props.children;
  }
}

function RouteLoading() {
  return <main className="loading-screen" role="status" aria-live="polite"><p>Loading page</p></main>;
}

export function AppRoutes() {
  const { status, bootstrapError } = useAuth();
  const location = useLocation();
  return (
    <>
      {bootstrapError ? <p className="connection-banner" role="status">{bootstrapError}</p> : null}
      <PageErrorBoundary key={location.pathname}>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={status === 'authenticated' ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/register" element={<AuthPage registration />} />
            <Route path="/dashboard" element={<ProtectedPage><DashboardPage /></ProtectedPage>} />
            <Route path="/spaces" element={<ProtectedPage><SpacesPage /></ProtectedPage>} />
            <Route path="/spaces/:spaceId" element={<ProtectedPage><SpacePage /></ProtectedPage>} />
            <Route path="/spaces/:spaceId/products/new" element={<ProtectedPage><ProductFormPage /></ProtectedPage>} />
            <Route path="/spaces/:spaceId/products/:productId/edit" element={<ProtectedPage><ProductFormPage editing /></ProtectedPage>} />
            <Route path="/spaces/:spaceId/products/:productId" element={<ProtectedPage><ProductReaderPage /></ProtectedPage>} />
            <Route path="/spaces/:spaceId/members" element={<ProtectedPage><SpaceMembersPage /></ProtectedPage>} />
            <Route path="/invitations" element={<ProtectedPage><InvitationsPage /></ProtectedPage>} />
            <Route path="/settings" element={<ProtectedPage><SettingsPage /></ProtectedPage>} />
            <Route path="/not-found" element={<NotFoundPage />} />
            <Route path="*" element={<Navigate to="/not-found" replace />} />
          </Routes>
        </Suspense>
      </PageErrorBoundary>
      <Toaster position="top-right" />
    </>
  );
}
