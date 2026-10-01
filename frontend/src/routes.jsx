import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuth } from '@/lib/auth.jsx';
import {
  AuthPage,
  DashboardPage,
  InvitationsPage,
  LandingPage,
  NotFoundPage,
  ProductFormPage,
  ProductReaderPage,
  ProtectedPage,
  SettingsPage,
  SpaceMembersPage,
  SpacePage,
  SpacesPage
} from '@/features/screens.jsx';

export function AppRoutes() {
  const { status, bootstrapError } = useAuth();
  return (
    <>
      {bootstrapError ? <p className="connection-banner" role="status">{bootstrapError}</p> : null}
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
      <Toaster position="top-right" />
    </>
  );
}
