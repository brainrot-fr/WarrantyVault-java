import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { House, LayoutDashboard, Mail, Moon, Plus, Settings, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { apiJson } from '@/lib/api.js';
import { useAuth } from '@/lib/auth.jsx';
import { useOnlineStatus } from '@/lib/online.jsx';
import { useTheme } from '@/lib/theme.jsx';
import { OfflineNote, PageTitle, Sheet } from './Primitives.jsx';

const navigation = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/spaces', label: 'Spaces', icon: House },
  { to: '/invitations', label: 'Invitations', icon: Mail },
  { to: '/settings', label: 'Settings', icon: Settings }
];

export function AppShell({ children, title, actions, publicPage = false }) {
  const { user, logout } = useAuth();
  const { preference, changeTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const online = useOnlineStatus();
  const [selectedSpaceId, setSelectedSpaceId] = useState(localStorage.getItem('wv-last-space') || '');
  const [chosenSpaceId, setChosenSpaceId] = useState('');
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installHintDismissed, setInstallHintDismissed] = useState(localStorage.getItem('wv-install-hint') === 'dismissed');
  const {
    needRefresh: [needRefresh],
    updateServiceWorker
  } = useRegisterSW({ immediate: true });
  const isIosSafari = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);
  const spacesQuery = useQuery({
    queryKey: ['spaces'],
    queryFn: () => apiJson('/api/spaces'),
    enabled: Boolean(user),
    staleTime: 60_000
  });
  const spaces = useMemo(() => spacesQuery.data || [], [spacesQuery.data]);
  const canAddSpaces = useMemo(() => spaces.filter((space) => space.permissions?.canCreateProducts), [spaces]);
  const currentTitle = title || navigation.find((item) => location.pathname.startsWith(item.to))?.label || 'WarrantyVault';

  useEffect(() => {
    document.querySelector('[data-page-title]')?.focus();
  }, [location.pathname, title]);

  useEffect(() => {
    const captureInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', captureInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', captureInstallPrompt);
  }, []);

  useEffect(() => {
    if (spaces.some((space) => space.id === selectedSpaceId && space.permissions?.canCreateProducts)) return;
    const firstAvailable = canAddSpaces[0]?.id || '';
    setSelectedSpaceId(firstAvailable);
    if (firstAvailable) localStorage.setItem('wv-last-space', firstAvailable);
  }, [spaces, selectedSpaceId, canAddSpaces]);

  useEffect(() => {
    if (!addOpen) return undefined;
    const dismiss = (event) => {
      if (event.key === 'Escape') setAddOpen(false);
    };
    window.addEventListener('keydown', dismiss);
    return () => window.removeEventListener('keydown', dismiss);
  }, [addOpen]);

  const signOut = async () => {
    try {
      await logout();
    } catch (error) {
      toast.error(error.message || 'The server could not confirm sign out.');
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const openAddFlow = useCallback(() => {
    if (!online) {
      toast.error('Connect to add a product.');
      return;
    }
    if (!canAddSpaces.length) {
      toast.error('Create a Space or ask an owner for editor access before adding products.');
      return;
    }
    const preferred = canAddSpaces.find((space) => space.id === selectedSpaceId) || canAddSpaces[0];
    if (canAddSpaces.length === 1 || preferred) {
      setChosenSpaceId(preferred.id);
      setAddOpen(true);
      return;
    }
    setChosenSpaceId('');
    setAddOpen(true);
  }, [online, canAddSpaces, selectedSpaceId]);

  useEffect(() => {
    const open = () => openAddFlow();
    window.addEventListener('warrantyvault:open-add', open);
    return () => window.removeEventListener('warrantyvault:open-add', open);
  }, [openAddFlow]);

  const goToProductForm = () => {
    if (!chosenSpaceId) return;
    localStorage.setItem('wv-last-space', chosenSpaceId);
    setSelectedSpaceId(chosenSpaceId);
    setAddOpen(false);
    navigate(`/spaces/${chosenSpaceId}/products/new`);
  };

  const installApp = async () => {
    if (!installPrompt) {
      setInstallHintDismissed(true);
      localStorage.setItem('wv-install-hint', 'dismissed');
      return;
    }
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      setInstallHintDismissed(true);
      localStorage.setItem('wv-install-hint', 'dismissed');
    } catch (error) {
      toast.error(error.message || 'The app could not be installed on this device.');
    }
  };

  const toggleTheme = () => {
    const next = preference === 'system' ? 'dark' : preference === 'dark' ? 'light' : 'system';
    changeTheme(next);
  };

  if (publicPage) {
    return (
      <div className="entry-page">
        <header className="entry-header">
          <Link className="wordmark" to={user ? '/dashboard' : '/'} aria-label="WarrantyVault home">
            Warranty<span>Vault</span>
          </Link>
          <button className="quiet-icon-action" onClick={toggleTheme} type="button" aria-label={`Theme: ${preference}. Change theme`}>
            {preference === 'dark' ? <Moon size={18} /> : preference === 'light' ? <Sun size={18} /> : <span aria-hidden="true">◐</span>}
          </button>
        </header>
        <main className="entry-content">
          {title ? <h1 className="page-title" data-page-title tabIndex="-1">{title}</h1> : null}
          {children}
        </main>
        <footer className="site-footer">Your records, kept close and cared for.</footer>
      </div>
    );
  }

  return (
    <div className="workspace">
      <aside className="desktop-rail" aria-label="Application navigation">
        <Link className="wordmark" to="/dashboard" aria-label="WarrantyVault home">
          Warranty<span>Vault</span>
        </Link>
        <nav className="rail-navigation" aria-label="Main navigation">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink className={({ isActive }) => `rail-link${isActive ? ' active' : ''}`} key={to} to={to}>
              <Icon aria-hidden="true" size={18} strokeWidth={1.7} />
              <span>{label}</span>
              {label === 'Spaces' && spaces.length > 0 ? <span className="rail-meta">{spaces.length}</span> : null}
            </NavLink>
          ))}
        </nav>
        {spaces.length ? (
          <section className="rail-spaces" aria-labelledby="rail-spaces-title">
            <h2 id="rail-spaces-title">YOUR SPACES</h2>
            {spaces.map((space) => (
              <Link className="rail-space" key={space.id} onClick={() => setSelectedSpaceId(space.id)} to={`/spaces/${space.id}`}>
                <span>{space.name}</span>
                <span className={space.expiringSoonCount ? 'rail-expiring' : 'rail-meta'}>{space.expiringSoonCount}</span>
              </Link>
            ))}
          </section>
        ) : null}
        <div className="rail-bottom">
          <button className="rail-link rail-theme" onClick={toggleTheme} type="button">
            {preference === 'dark' ? <Moon aria-hidden="true" size={18} /> : <Sun aria-hidden="true" size={18} />}
            <span>Appearance</span><small>{preference}</small>
          </button>
          <div className="rail-user">
            <span className="user-initial" aria-hidden="true">{user?.name?.trim().charAt(0)?.toUpperCase() || 'U'}</span>
            <span className="rail-user-name">{user?.name}</span>
            <button className="text-button" onClick={signOut} type="button">Sign out</button>
          </div>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="mobile-topbar">
          <Link className="wordmark" to="/dashboard" aria-label="WarrantyVault home">W<span>V</span></Link>
          <h1>{currentTitle}</h1>
          <button className="quiet-icon-action" onClick={toggleTheme} type="button" aria-label={`Theme: ${preference}. Change theme`}>
            {preference === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </header>
        <main className="workspace-content">
          {title ? (
            <PageTitle actions={actions}>{title}</PageTitle>
          ) : null}
          <span className="sr-only" aria-live="polite">Page: {currentTitle}</span>
          {!online ? <OfflineNote /> : null}
          {needRefresh ? <p className="pwa-note" role="status">Update available, <button className="text-button" onClick={() => updateServiceWorker(true)} type="button">reload</button></p> : null}
          {!installHintDismissed && (installPrompt || isIosSafari) ? (
            <p className="pwa-note" role="status">
              {isIosSafari ? 'Install WarrantyVault: use Share, then Add to Home Screen.' : 'Install WarrantyVault on this device.'}
              <button className="text-button" onClick={installApp} type="button">{installPrompt ? 'Install' : 'Dismiss'}</button>
            </p>
          ) : null}
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      <nav className="mobile-tabbar" aria-label="Quick navigation">
        <NavLink to="/dashboard"><LayoutDashboard aria-hidden="true" size={19} /><span>Overview</span></NavLink>
        <NavLink to="/spaces"><House aria-hidden="true" size={19} /><span>Spaces</span></NavLink>
        <button className="mobile-add-tab" disabled={!online} onClick={openAddFlow} title={!online ? 'Connect to add a product' : undefined} type="button"><Plus aria-hidden="true" size={20} /><span>Add</span></button>
        <NavLink to="/settings"><Settings aria-hidden="true" size={19} /><span>Settings</span></NavLink>
      </nav>

      {addOpen ? (
        <Sheet labelledBy="add-sheet-title" onClose={() => setAddOpen(false)}>
            <h2 id="add-sheet-title">Add a product</h2>
            <p>Choose where this product belongs.</p>
            <label className="field">
              <span>Space</span>
              <select autoFocus onChange={(event) => setChosenSpaceId(event.target.value)} value={chosenSpaceId}>
                {canAddSpaces.length > 1 ? <option value="">Select a Space</option> : null}
                {canAddSpaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
              </select>
            </label>
            <div className="sheet-actions">
              <button className="button button-primary" disabled={!chosenSpaceId} onClick={goToProductForm} type="button">Continue</button>
              <button className="text-button" onClick={() => setAddOpen(false)} type="button">Cancel</button>
            </div>
        </Sheet>
      ) : null}
    </div>
  );
}
