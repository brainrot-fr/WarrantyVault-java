import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useInfiniteQuery, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowRight, ChevronRight, Plus } from 'lucide-react';
import { computeExpiresOn } from '@/lib/expiry.js';
import { AppShell } from '@/components/layout/AppShell';
import { ConfirmSheet, EmptyState, Field, Figure, FreeTextCombobox, FormStack, ImagePicker, KeyValue, ListRow, Region, Section, Sheet, Skeleton, StatusMark, SwitchControl, WarrantyLine } from '@/components/layout/Primitives.jsx';
import { useAuth } from '@/lib/auth.jsx';
import { useTheme } from '@/lib/theme.jsx';
import { useOnlineStatus } from '@/lib/online.jsx';
import { apiJson, apiRequest } from '@/lib/api.js';
import { invalidateAfterProfileChange, invalidateAfterProductChange } from '@/lib/queryInvalidation.js';
import { formatCurrency, formatDate, formatDateTime, currencySymbol, localDateInputValue } from '@/lib/formatters.js';
import { formatPriceInput, normalizePrice } from '@/lib/formValidation.js';
import { changePasswordSchema, inviteSchema, loginSchema, productSchema, profileSchema, registrationSchema, spaceSchema } from '@/lib/formSchemas.js';
import { focusFieldAfterRender, focusFirstErrorAfterRender, mapServerFieldErrors } from '@/lib/formErrors.js';
import { parseBill } from '@/lib/parseBill.js';
import { prepareImage } from '@/lib/prepareImage.js';
import { BRAND_DICTIONARY, PRODUCT_TYPE_DICTIONARY } from '@/lib/ocr/dictionaries.js';
import '../app.css';

/* Preflight: desktop=shared shell skeleton; mobile=shared shell skeleton; empty=not applicable; loading=delayed shell skeleton; error=bootstrap banner and anonymous route; success=restored user shell; keyboard=normal tab order; announcement=restoring status; offline=login path remains reachable; restoration=refresh cookie bootstrap. */
function LoadingScreen({ waking = false }) {
  return (
    <main className="loading-screen" aria-label="Restoring your session">
      <div className="loading-mark">WarrantyVault</div>
      <Skeleton rows={4} />
      <p>Restoring your session</p>
      {waking ? <p>The server is waking up. This can take up to a minute.</p> : null}
    </main>
  );
}

function ErrorMessage({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="form-error" role="alert">
      <p>{error.message || 'Something went wrong. Please try again.'}</p>
      {onRetry ? <button className="text-button" onClick={onRetry} type="button">Try again</button> : null}
    </div>
  );
}

/* Preflight: desktop=child route; mobile=child route; empty=child owns its empty state; loading=auth shell skeleton; error=bootstrap banner; success=authorized child; keyboard=child controls; announcement=route title; offline=protected cache/read behavior; restoration=refresh token, then next-path login redirect if expired. */
export function ProtectedPage({ children }) {
  const { status, bootstrapWaiting } = useAuth();
  if (status === 'loading') return <LoadingScreen waking={bootstrapWaiting} />;
  if (status !== 'authenticated') return <Navigate to={`/login?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`} replace />;
  return children;
}

/* Preflight: desktop=editorial recovery layout; mobile=stacked recovery layout; empty=not applicable; loading=not applicable; error=404 explanation; success=home navigation; keyboard=focusable recovery link; announcement=focused page title; offline=home route remains local; restoration=return to home or sign in. */
export function NotFoundPage() {
  return (
    <AppShell publicPage title="Page not found">
      <section className="auth-layout">
        <div className="auth-statement">
          <h1 className="entry-title">That page isn’t here.</h1>
          <p>Return to your warranty records or sign in to continue.</p>
        </div>
        <Link className="text-button" to="/">Go to WarrantyVault</Link>
      </section>
    </AppShell>
  );
}

/* Preflight: desktop=editorial copy with side note; mobile=single-column copy; empty=not applicable; loading=not applicable; error=not applicable; success=register/login navigation; keyboard=two ordered links; announcement=semantic heading and link names; offline=links remain actionable; restoration=login or registration route. */
export function LandingPage() {
  return (
    <AppShell publicPage>
      <section className="landing">
        <div className="landing-copy">
          <p className="entry-kicker">A considered place for the things you own</p>
          <h1>Your warranties,<br />kept close.</h1>
          <p className="landing-intro">Keep purchase bills and warranty dates together, organized by the places and people that matter.</p>
          <div className="landing-actions">
            <Link className="button button-primary" to="/register">Create your vault <ArrowRight aria-hidden="true" size={17} /></Link>
            <Link className="text-button" to="/login">Sign in</Link>
          </div>
        </div>
        <aside className="landing-note">
          <span className="landing-rule" aria-hidden="true" />
          <p>Every receipt, model number, and coverage date in one reliable record.</p>
        </aside>
      </section>
    </AppShell>
  );
}

/* Preflight: desktop=statement and form columns; mobile=stacked statement/form; empty=blank form; loading=submit pending label; error=inline role-alert; success=authenticated redirect; keyboard=native fields and submit; announcement=errors and pending text; offline=submit error, no writes; restoration=retry credentials or next-path destination. */
export function AuthPage({ registration = false }) {
  const { login, register, status } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const formRef = useRef(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const form = useForm({
    resolver: zodResolver(registration ? registrationSchema : loginSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
    mode: 'onBlur'
  });
  const { errors } = form.formState;
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data: meta } = useQuery({
    queryKey: ['meta-config'],
    queryFn: () => apiJson('/api/meta/config')
  });
  const submit = async (values) => {
    setBusy(true);
    setError(null);
    try {
      if (registration) await register(values);
      else await login(values.email, values.password);
      const next = searchParams.get('next');
      navigate(next?.startsWith('/') && !next.startsWith('//') ? next : '/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError);
      const invalidFields = mapServerFieldErrors(requestError.fieldErrors, form.setError);
      if (invalidFields.length) focusFieldAfterRender(invalidFields[0], formRef.current);
    } finally {
      setBusy(false);
    }
  };

  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;
  return (
    <AppShell publicPage>
      <div className="auth-layout">
        <section className="auth-statement">
          <p className="entry-kicker">{registration ? 'A place for every purchase' : 'Your records, ready when you are'}</p>
          <h1 className="entry-title">{registration ? 'Keep the details that matter.' : 'Your warranties, kept close.'}</h1>
          <p>{registration ? 'Bring bills and coverage dates together in one private place.' : 'Sign in to find the receipts and coverage dates you have saved.'}</p>
        </section>
        <FormStack className="form-column" onSubmit={form.handleSubmit(submit, (invalid) => focusFirstErrorAfterRender(invalid, formRef.current))} ref={formRef}>
          <h2>{registration ? 'Create your vault' : 'Sign in'}</h2>
          {registration ? (
            <Field autoComplete="name" error={errors.name?.message} label="Your name" maxLength={120} placeholder="e.g. Alex Morgan" {...form.register('name')} />
          ) : null}
          <Field autoComplete="email" error={errors.email?.message} label="Email address" placeholder="e.g. name@example.com" type="email" {...form.register('email')} />
          <Field autoComplete={registration ? 'new-password' : 'current-password'} error={errors.password?.message} hint={registration ? 'Use 8 to 72 UTF-8 bytes. Longer passwords are harder to guess.' : undefined} label="Password" type={passwordVisible ? 'text' : 'password'} {...form.register('password')}>
            {(props) => <div className="password-control"><input {...props} /><button aria-label={passwordVisible ? 'Hide password' : 'Show password'} aria-pressed={passwordVisible} className="password-toggle" onClick={() => setPasswordVisible((visible) => !visible)} type="button">{passwordVisible ? 'Hide' : 'Show'}</button></div>}
          </Field>
          {registration ? <Field autoComplete="new-password" error={errors.confirmPassword?.message} label="Confirm password" type={passwordVisible ? 'text' : 'password'} {...form.register('confirmPassword')} /> : null}
          <ErrorMessage error={error} />
          <button className="button button-primary form-submit" disabled={busy} type="submit">
            {busy ? 'Please wait…' : registration ? 'Create account' : 'Sign in'}
          </button>
          {!registration && meta?.mode === 'local' ? (
            <p className="demo-hint">Local demo: <code>demo@warrantyvault.local</code> · <code>Password123!</code></p>
          ) : null}
          <p className="form-switch">
            {registration ? 'Already have an account? ' : 'New to WarrantyVault? '}
            <Link to={registration ? '/login' : '/register'}>{registration ? 'Sign in' : 'Create an account'}</Link>
          </p>
        </FormStack>
      </div>
    </AppShell>
  );
}

/* Preflight: desktop=Space list and preview aside; mobile=stacked list; empty=first-Space action; loading=delayed row skeleton; error=retry query; success=created toast and refreshed list; keyboard=links plus focus-managed create sheet; announcement=errors/toast; offline=creation disabled; restoration=React Query refresh from server/cache. */
export function SpacesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClientRef = useQueryClient();
  const { user } = useAuth();
  const online = useOnlineStatus();
  const { data: spaces = [], isLoading, error } = useQuery({
    queryKey: ['spaces', user?.id],
    queryFn: () => apiJson('/api/spaces')
  });
  const createFormRef = useRef(null);
  const createForm = useForm({
    resolver: zodResolver(spaceSchema),
    defaultValues: { name: searchParams.get('create') === '1' ? 'Home' : '', description: '' }
  });
  const createErrors = createForm.formState.errors;
  const [showCreate, setShowCreate] = useState(() => searchParams.get('create') === '1');
  const [addAfterCreate] = useState(() => searchParams.get('add') === '1');
  const [selectedId, setSelectedId] = useState('');
  const selectedSpace = spaces.find((space) => space.id === selectedId) || spaces[0];
  const previewQueries = useQueries({
    queries: [
      {
        queryKey: ['space-preview-products', user?.id, selectedSpace?.id],
        queryFn: () => apiJson(`/api/spaces/${selectedSpace.id}/products?size=3&sort=expiry`),
        enabled: Boolean(selectedSpace?.id)
      },
      {
        queryKey: ['space-preview-members', user?.id, selectedSpace?.id],
        queryFn: () => apiJson(`/api/spaces/${selectedSpace.id}/members`),
        enabled: Boolean(selectedSpace?.id)
      }
    ]
  });
  const create = useMutation({
    mutationFn: (values) => apiJson('/api/spaces', {
      method: 'POST',
      body: JSON.stringify({ name: values.name, description: values.description || null })
    }),
    onSuccess: (space) => {
      createForm.reset({ name: '', description: '' });
      setShowCreate(false);
      toast.success('Space created');
      queryClientRef.invalidateQueries({ queryKey: ['spaces', user?.id] });
      if (addAfterCreate) {
        navigate(`/spaces/${space.id}/products/new`, { replace: true });
      }
    },
    onError: (requestError) => {
      const invalidFields = mapServerFieldErrors(requestError.fieldErrors, createForm.setError);
      if (invalidFields.length) focusFieldAfterRender(invalidFields[0], createFormRef.current);
    }
  });

  return (
    <AppShell title="Spaces" actions={<button className="button button-primary" disabled={!online} onClick={() => setShowCreate(true)} type="button"><Plus aria-hidden="true" size={17} /> New Space</button>}>
      <div className="spaces-split">
        <section className="spaces-main">
          <p className="section-intro">Spaces group the things you own by place. Each one keeps products, bills, and collaborators together.</p>
          {error ? <ErrorMessage error={error} onRetry={() => queryClientRef.invalidateQueries({ queryKey: ['spaces', user?.id] })} /> : null}
          {isLoading ? <Skeleton rows={6} /> : (
            <div className="line-list">
              {spaces.map((space) => (
                <Link
                  aria-current={selectedSpace?.id === space.id ? 'true' : undefined}
                  className="line-item space-row"
                  key={space.id}
                  onFocus={() => setSelectedId(space.id)}
                  onMouseEnter={() => setSelectedId(space.id)}
                  to={`/spaces/${space.id}`}
                >
                  <span><strong>{space.name}</strong>{space.myRole !== 'OWNER' ? <small>{space.myRole.toLowerCase()}</small> : null}{space.description ? <small>{space.description}</small> : null}</span>
                  <span className="space-row-meta"><span>{space.productCount} products</span><small>{space.nextExpiry ? `Next expiry ${formatDate(space.nextExpiry.expiresOn)}` : 'No expiry dates'}</small></span>
                </Link>
              ))}
              {!spaces.length ? <EmptyState title="Spaces group the things you own by place." detail="Start with Home, then add another space whenever it helps." action={<button className="text-button" disabled={!online} onClick={() => setShowCreate(true)} type="button">Create a Space</button>} /> : null}
            </div>
          )}
        </section>
        <aside className="spaces-aside" aria-label="Selected Space preview">
          {selectedSpace ? (
            <>
              <p className="aside-label">SPACE PREVIEW</p>
              <h2>{selectedSpace.name}</h2>
              <p className="quiet-copy">{selectedSpace.description || 'Products and people kept together.'}</p>
              <KeyValue rows={[
                { label: 'Your role', value: selectedSpace.myRole?.toLowerCase() },
                { label: 'Products', value: selectedSpace.productCount },
                { label: 'People', value: selectedSpace.memberCount },
                { label: 'Expiring soon', value: selectedSpace.expiringSoonCount }
              ]} />
              <Section title="Soonest expirations">
                {(previewQueries[0].data?.items || []).length ? (previewQueries[0].data.items).slice(0, 3).map((product) => (
                  <div className="space-preview-expiry" key={product.id}>
                    <span>{product.productType} · {product.brand}</span>
                    <time dateTime={product.expiresOn}>{formatDate(product.expiresOn)}</time>
                  </div>
                )) : <p className="quiet-copy">No products in this Space yet.</p>}
              </Section>
              <Section title="People">
                <div className="member-initials" aria-label={`${previewQueries[1].data?.members?.length || 0} Space members`}>
                  {(previewQueries[1].data?.members || []).map((member) => <span key={member.userId} title={`${member.name} · ${member.role}`}>{member.name.trim().charAt(0).toUpperCase()}</span>)}
                </div>
              </Section>
              <Link className="text-button" to={`/spaces/${selectedSpace.id}`}>Open Space</Link>
            </>
          ) : <p className="quiet-copy">Your Space preview will appear here.</p>}
        </aside>
      </div>
      {showCreate ? (
        <Sheet labelledBy="new-space-title" onClose={() => setShowCreate(false)}>
            <h2 id="new-space-title">Create a Space</h2>
            <p>Give a place or household its own set of product records.</p>
            <FormStack className="form-column" onSubmit={createForm.handleSubmit((values) => create.mutate(values), (invalid) => focusFirstErrorAfterRender(invalid, createFormRef.current))} ref={createFormRef}>
              <Field autoFocus error={createErrors.name?.message} label="Name" maxLength={80} placeholder="e.g. Home" {...createForm.register('name')} />
              <Field error={createErrors.description?.message} label="Description" maxLength={255} optional placeholder="e.g. Main home" {...createForm.register('description')} />
              <ErrorMessage error={create.error} />
              <button className="button button-primary" disabled={!online || create.isPending || !createForm.watch('name')?.trim()} type="submit">{create.isPending ? 'Creating…' : 'Create Space'}</button>
            </FormStack>
            <button className="text-button" onClick={() => setShowCreate(false)} type="button">Cancel</button>
        </Sheet>
      ) : null}
    </AppShell>
  );
}

/* Preflight: desktop=attention list and summary aside; mobile=stacked summary/list; empty=quiet attention and expired messages; loading=matching delayed skeletons; error=retry dashboard; success=server summaries and invitation notice; keyboard=links and actions; announcement=live route/toasts; offline=read cached view, disable add; restoration=server refresh on reconnect. */
export function DashboardPage() {
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const { user } = useAuth();
  const spacesQuery = useQuery({
    queryKey: ['spaces', user?.id],
    queryFn: () => apiJson('/api/spaces')
  });
  const dashboardQuery = useQuery({
    queryKey: ['dashboard', user?.id],
    queryFn: () => apiJson('/api/dashboard')
  });
  const invitationsQuery = useQuery({
    queryKey: ['invitations', user?.id],
    queryFn: () => apiJson('/api/invitations')
  });
  const dashboard = dashboardQuery.data;
  const thresholdDays = dashboard?.thresholdDays || 30;
  const upcoming = dashboard?.upcoming || [];
  const withinSeven = upcoming.filter((product) => product.daysRemaining <= 7);
  const withinThreshold = upcoming.filter((product) => product.daysRemaining > 7 && product.daysRemaining <= thresholdDays);
  const later = upcoming.filter((product) => product.daysRemaining > thresholdDays);
  const expired = dashboard?.recentlyExpired || [];
  const invitations = invitationsQuery.data || [];
  const spaces = spacesQuery.data || [];
  const hasAnyProducts = spaces.some((space) => space.productCount > 0);
  const contentLoading = dashboardQuery.isLoading || spacesQuery.isLoading;
  const contentError = dashboardQuery.error || spacesQuery.error;
  const blockingError = (dashboardQuery.error && !dashboardQuery.data) || (spacesQuery.error && !spacesQuery.data);
  const addAction = <button className="button button-primary" disabled={!online} onClick={() => window.dispatchEvent(new CustomEvent('warrantyvault:open-add'))} type="button"><Plus aria-hidden="true" size={17} /> Add product</button>;
  return (
    <AppShell title="Overview" actions={addAction}>
      <div className="dashboard-layout">
        <Region as="section" className="dashboard-main">
          {spaces.length ? <p className="section-intro">{(dashboard?.counts?.expiringSoon || 0) > 0
            ? `${dashboard.counts.expiringSoon} ${dashboard.counts.expiringSoon === 1 ? 'warranty ends' : 'warranties end'} in the next ${thresholdDays} days.`
            : dashboard?.counts?.active > 0
              ? 'Nothing needs your attention right now.'
              : 'All your recorded warranties have ended.'}</p> : null}
          {contentError ? <ErrorMessage error={contentError} onRetry={() => Promise.all([dashboardQuery.refetch(), spacesQuery.refetch(), invitationsQuery.refetch()])} /> : null}
          {blockingError ? null : contentLoading ? <DashboardSkeleton /> : (
            <>
              {invitationsQuery.error ? <ErrorMessage error={invitationsQuery.error} onRetry={() => invitationsQuery.refetch()} /> : invitations.length ? <Link className="invitation-notice" to="/invitations">You have {invitations.length} invitation{invitations.length === 1 ? '' : 's'} waiting <ChevronRight aria-hidden="true" size={16} /></Link> : null}
              {!spaces.length ? (
                <section className="first-run">
                  <ol>
                    <li>Create a Space for a place, such as Home.</li>
                    <li>Add a bill and its warranty period.</li>
                    <li>We email you before the warranty ends.</li>
                  </ol>
                  <button className="button button-primary" disabled={!online} onClick={() => navigate('/spaces?create=1&add=1')} type="button">Create your first Space</button>
                </section>
              ) : !hasAnyProducts ? (
                <section className="first-run">
                  <p>Your Spaces are ready. Add a bill to start tracking warranty dates.</p>
                  <button className="button button-primary" disabled={!online} onClick={() => window.dispatchEvent(new CustomEvent('warrantyvault:open-add'))} type="button">Add your first bill</button>
                </section>
              ) : null}
              {spaces.length && hasAnyProducts ? <>
                <Section title="Needs attention">
                {withinSeven.length ? <ProductGroup title="Within 7 days" products={withinSeven} /> : null}
                {withinThreshold.length ? <ProductGroup title={`Within ${thresholdDays} days`} products={withinThreshold} /> : null}
                {later.length ? <ProductGroup title="Later" products={later} /> : null}
                {!upcoming.length ? (
                  <EmptyState
                    title={`Nothing is expiring in the next ${thresholdDays} days.`}
                    detail="Add a purchase record to keep its coverage date close."
                    action={<button className="text-button" disabled={!online} onClick={() => window.dispatchEvent(new CustomEvent('warrantyvault:open-add'))} type="button">Add a product</button>}
                  />
                ) : null}
              </Section>
              <Section title="Recently expired" className="recently-expired">
                {expired.length ? <ProductGroup products={expired} quiet /> : <p className="quiet-copy">No recently expired warranties to review.</p>}
              </Section>
              </> : null}
            </>
          )}
        </Region>
        {!blockingError && spaces.length && hasAnyProducts ? <aside className="dashboard-aside" aria-label="Warranty summary">
          {contentLoading ? <Skeleton rows={4} className="dashboard-aside-skeleton" /> : (
          <>
          <div className="summary-figures">
            <Figure value={dashboard?.counts.active ?? 0} label="Active" />
            <Figure value={dashboard?.counts.expiringSoon ?? 0} label="Expiring soon" tone="soon" />
            <Figure value={dashboard?.counts.expired ?? 0} label="Expired" tone="expired" />
          </div>
          <div className="covered-value">
            <h2>Covered value</h2>
            {Object.entries(dashboard?.totalCoveredValue || {}).length ? Object.entries(dashboard.totalCoveredValue).map(([currency, value]) => (
              <p key={currency}><strong>{formatCurrency(value, currency)}</strong><span>{currency}</span></p>
            )) : <p><span>No product values yet</span></p>}
          </div>
          </>
          )}
        </aside> : null}
      </div>
    </AppShell>
  );
}

function ProductGroup({ title, products, quiet = false }) {
  return (
    <section className={`product-group${quiet ? ' product-group-quiet' : ''}`}>
      {title ? <h3>{title}</h3> : null}
      {products.map((product, index) => (
        <ListRow index={index} key={product.id} className="attention-row">
          <div className="attention-product">
            <strong>{product.productType} <span>·</span> {product.brand}</strong>
            <small>{product.spaceName}</small>
          </div>
          <div className="attention-expiry">
            <StatusMark status={product.status}>{product.daysRemaining < 0 ? `${Math.abs(product.daysRemaining)} days ago` : `${product.daysRemaining} days left`}</StatusMark>
            <time dateTime={product.expiresOn}>{formatDate(product.expiresOn)}</time>
          </div>
          <Link aria-label={`Open ${product.productType} in ${product.spaceName}`} className="row-open" to={`/spaces/${product.spaceId}/products/${product.id}`}><ChevronRight aria-hidden="true" size={17} /></Link>
        </ListRow>
      ))}
    </section>
  );
}

/* Preflight: desktop=documents with facts aside; mobile=documents with facts sheet; empty=optional-card/notes explanations; loading=delayed skeleton; error=retry product/image; success=details and image; keyboard=zoom/facts/delete controls and trapped sheets; announcement=status, errors, confirmations; offline=read cache and disable destructive submit; restoration=product requery and image retry. */
export function ProductReaderPage() {
  const { spaceId, productId } = useParams();
  const navigate = useNavigate();
  const queryClientRef = useQueryClient();
  const { user } = useAuth();
  const online = useOnlineStatus();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [factsOpen, setFactsOpen] = useState(false);
  const productQuery = useQuery({
    queryKey: ['product', user?.id, productId],
    queryFn: () => apiJson(`/api/products/${productId}`)
  });
  const product = productQuery.data;
  const deleteProduct = useMutation({
    mutationFn: () => apiJson(`/api/products/${productId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClientRef.removeQueries({ queryKey: ['product', user?.id, productId] });
      invalidateAfterProductChange(queryClientRef, user.id, spaceId, productId);
      toast.success('Product deleted');
      navigate(`/spaces/${spaceId}`, { replace: true });
    }
  });
  const title = product ? `${product.brand} ${product.productType}` : 'Product';
  const progress = product?.warrantyElapsedFraction || 0;
  const readerActions = product ? (
    <>
      <button className="text-button facts-mobile" onClick={() => setFactsOpen(true)} type="button">Product facts</button>
      {product.permissions?.canEdit ? <Link className="text-button" to={`/spaces/${spaceId}/products/${productId}/edit`}>Edit product</Link> : null}
      {product.permissions?.canDelete ? <button className="text-button remove-link" onClick={() => setConfirmDelete(true)} type="button">Delete product</button> : null}
    </>
  ) : null;
  return (
    <AppShell title={title} actions={readerActions}>
      {productQuery.isLoading ? <Skeleton rows={8} /> : productQuery.error ? (
        <ErrorMessage error={productQuery.error} onRetry={() => productQuery.refetch()} />
      ) : product ? (
        <div className="product-reader-layout">
          <section className="product-reader-main">
            <div className="reader-status">
              <StatusMark status={product.status}>{product.status.replaceAll('_', ' ').toLowerCase()}</StatusMark>
              <span>{product.daysRemaining < 0 ? `Expired ${Math.abs(product.daysRemaining)} days ago` : `Ends ${formatDate(product.expiresOn)}, in ${product.daysRemaining} days`}</span>
            </div>
            <WarrantyLine purchasedOn={product.purchasedOn} expiresOn={product.expiresOn} progress={progress} status={product.status} />
            <Section title="Purchase bill">
              <PrivateImage productId={product.id} imageType="bill" label={`Purchase bill for ${product.brand} ${product.productType}`} />
            </Section>
            <Section title="Warranty card">
              {product.hasWarrantyCard ? <PrivateImage productId={product.id} imageType="warranty-card" label={`Warranty card for ${product.brand} ${product.productType}`} /> : <p className="quiet-copy">No warranty card added. The bill may already carry the terms.</p>}
            </Section>
            {product.notes ? <Section title="Notes"><p className="reader-notes">{product.notes}</p></Section> : null}
          </section>
          <aside className="product-reader-aside" aria-label="Product facts">
            <ProductFacts product={product} />
            <div className="reader-actions">
              <Link className="text-button" to={`/spaces/${spaceId}`}>Open Space</Link>
              {product.permissions?.canEdit ? <Link className="text-button" to={`/spaces/${spaceId}/products/${product.id}/edit`}>Edit product</Link> : null}
            </div>
            {deleteProduct.error ? <ErrorMessage error={deleteProduct.error} /> : null}
          </aside>
          {factsOpen ? (
            <Sheet labelledBy="product-facts-title" onClose={() => setFactsOpen(false)}>
              <h2 id="product-facts-title">Product facts</h2>
              <ProductFacts product={product} />
              <div className="reader-actions">
                <Link className="text-button" to={`/spaces/${spaceId}`}>Open Space</Link>
                {product.permissions?.canEdit ? <Link className="text-button" to={`/spaces/${spaceId}/products/${product.id}/edit`}>Edit product</Link> : null}
                {product.permissions?.canDelete ? <button className="text-button remove-link" onClick={() => { setFactsOpen(false); setConfirmDelete(true); }} type="button">Delete product</button> : null}
              </div>
            </Sheet>
          ) : null}
        </div>
      ) : null}
      {confirmDelete && product ? (
        <ConfirmSheet
          title="Delete this product?"
          description={`Delete ${product.brand} ${product.productType}, its details, and its stored bill and warranty-card images? This cannot be undone.`}
          confirmText={deleteProduct.isPending ? 'Deleting…' : 'Delete product and images'}
          busy={deleteProduct.isPending || !online}
          onConfirm={() => deleteProduct.mutate()}
          onClose={() => setConfirmDelete(false)}
        >
          <ErrorMessage error={deleteProduct.error} />
        </ConfirmSheet>
      ) : null}
    </AppShell>
  );
}

function ProductFacts({ product }) {
  return (
    <KeyValue rows={[
      { label: 'Purchased on', value: formatDate(product.purchasedOn) },
      { label: 'Warranty period', value: `${product.warrantyMonths} ${product.warrantyMonths === 1 ? 'month' : 'months'}` },
      { label: 'Expires on', value: formatDate(product.expiresOn) },
      { label: 'Purchase price', value: formatCurrency(product.purchasePrice, product.currency) },
      { label: 'Model', value: product.modelName },
      { label: 'Serial number', value: product.serialNumber },
      { label: 'Added by', value: product.createdBy?.name },
      { label: 'Space', value: product.spaceName }
    ]} />
  );
}

function DashboardSkeleton() {
  return <Skeleton rows={5} className="dashboard-layout-skeleton" />;
}

/* Preflight: desktop=product list and selected summary columns; mobile=single list with facts sheet; empty=Space-specific create prompt; loading=Space/product skeletons; error=retry both requests; success=filtered/paginated rows; keyboard=search, filters, selected rows; announcement=status and mutation toast; offline=disable writes/pagination; restoration=requery selected Space and products. */
export function SpacePage() {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const queryClientRef = useQueryClient();
  const { user } = useAuth();
  const online = useOnlineStatus();
  const [filters, setFilters] = useState({ q: '', status: '', sort: 'expiry' });
  const [searchDraft, setSearchDraft] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const spaceQuery = useQuery({
    queryKey: ['space', user?.id, spaceId],
    queryFn: () => apiJson(`/api/spaces/${spaceId}`)
  });
  const productsQuery = useInfiniteQuery({
    queryKey: ['products', user?.id, spaceId, filters],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ size: '50', page: String(pageParam), sort: filters.sort });
      if (filters.q.trim()) params.set('q', filters.q.trim());
      if (filters.status) params.set('status', filters.status);
      return apiJson(`/api/spaces/${spaceId}/products?${params}`);
    },
    enabled: Boolean(spaceQuery.data),
    placeholderData: keepPreviousData,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.page + 1 < lastPage.totalPages ? lastPage.page + 1 : undefined
  });
  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilters((current) => current.q === searchDraft ? current : { ...current, q: searchDraft });
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchDraft]);
  const [showSpaceSettings, setShowSpaceSettings] = useState(false);
  const [confirmDeleteSpace, setConfirmDeleteSpace] = useState(false);
  const spaceFormRef = useRef(null);
  const spaceForm = useForm({
    resolver: zodResolver(spaceSchema),
    defaultValues: { name: '', description: '' }
  });
  const resetSpaceForm = spaceForm.reset;
  const spaceFormErrors = spaceForm.formState.errors;
  const saveSpace = useMutation({
    mutationFn: (values) => apiJson(`/api/spaces/${spaceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: values.name, description: values.description || null })
    }),
    onSuccess: (space) => {
      queryClientRef.setQueryData(['space', user.id, spaceId], space);
      queryClientRef.invalidateQueries({ queryKey: ['spaces', user.id] });
      spaceForm.reset({ name: space.name, description: space.description || '' });
      toast.success('Space updated');
    },
    onError: (requestError) => {
      const invalidFields = mapServerFieldErrors(requestError.fieldErrors, spaceForm.setError);
      if (invalidFields.length) focusFieldAfterRender(invalidFields[0], spaceFormRef.current);
    }
  });
  const deleteSpace = useMutation({
    mutationFn: () => apiJson(`/api/spaces/${spaceId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClientRef.invalidateQueries({ queryKey: ['spaces', user.id] });
      toast.success('Space deleted');
      navigate('/spaces', { replace: true });
    }
  });
  useEffect(() => {
    if (spaceQuery.data) resetSpaceForm({ name: spaceQuery.data.name, description: spaceQuery.data.description || '' });
  }, [spaceQuery.data, resetSpaceForm]);
  const products = (productsQuery.data?.pages || []).flatMap((page) => page.items);
  const selectedProduct = products.find((product) => product.id === selectedProductId) || products[0];
  const title = spaceQuery.data?.name || 'Space';
  useEffect(() => {
    if (!selectedProductId && products[0]) setSelectedProductId(products[0].id);
  }, [selectedProductId, products]);

  if (spaceQuery.isLoading) return <AppShell title="Space"><Skeleton rows={8} /></AppShell>;
  if (spaceQuery.error) return <AppShell title="Space"><ErrorMessage error={spaceQuery.error} onRetry={() => spaceQuery.refetch()} /></AppShell>;
  const addProduct = () => navigate(`/spaces/${spaceId}/products/new`);
  return (
    <AppShell title={title}>
      <div className="space-split">
        <section className="space-main">
          <div className="section-toolbar">
            <p className="section-intro">{spaceQuery.data.description || 'Products and their coverage details.'}</p>
            <div className="toolbar-actions">
              <Link className="text-button" to={`/spaces/${spaceId}/members`}>Members</Link>
              {spaceQuery.data.permissions?.canEdit ? <button className="text-button" onClick={() => setShowSpaceSettings(true)} type="button">Space settings</button> : null}
              {spaceQuery.data.permissions?.canCreateProducts ? (
                <button className="button button-primary" disabled={!online} onClick={addProduct} title={!online ? 'Connect to add a product' : undefined} type="button">Add product</button>
              ) : null}
            </div>
          </div>
          <ErrorMessage error={productsQuery.error} onRetry={() => productsQuery.refetch()} />
          {spaceQuery.data.productCount > 0 ? (
          <div className="product-filters">
            <label className="field"><span>Search products</span><input onChange={(event) => setSearchDraft(event.target.value)} placeholder="e.g. dishwasher" value={searchDraft} /></label>
            <div className="status-filters" role="group" aria-label="Filter by warranty status">
              {[
                ['', 'All'],
                ['ACTIVE', 'Active'],
                ['EXPIRING_SOON', 'Expiring soon'],
                ['EXPIRED', 'Expired']
              ].map(([status, label]) => <button aria-pressed={filters.status === status} className="text-button" key={status || 'all'} onClick={() => setFilters((current) => ({ ...current, status }))} type="button">{label}</button>)}
            </div>
            <label className="field"><span>Sort</span><select onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))} value={filters.sort}><option value="expiry">Soonest expiry</option><option value="purchased">Recently purchased</option><option value="name">Product name</option></select></label>
          </div>
        ) : null}
          {productsQuery.isLoading && !productsQuery.data ? <Skeleton rows={6} /> : productsQuery.error ? null : (
          <div aria-busy={productsQuery.isFetching} className={`line-list${productsQuery.isFetching ? ' list-refreshing' : ''}`}>
            {products.map((product, index) => <ProductRow index={index} key={product.id} product={product} selected={product.id === selectedProduct?.id} onSelect={() => setSelectedProductId(product.id)} />)}
            {productsQuery.data?.pages?.[0]?.totalItems === 0 ? (
              filters.q || filters.status ? (
                <div className="empty-state">
                  <p>No products match these filters.</p>
                  <button className="text-button" onClick={() => { setSearchDraft(''); setFilters({ q: '', status: '', sort: filters.sort }); }} type="button">Clear filters</button>
                </div>
              ) : <EmptyState title="This Space has no products yet." detail="Product records keep purchase bills and coverage dates together." action={spaceQuery.data.permissions?.canCreateProducts ? <button className="text-button" disabled={!online} onClick={addProduct} type="button">Add a product</button> : null} />
            ) : null}
          </div>
        )}
          {selectedProduct ? <button className="text-button facts-mobile" onClick={() => setSummaryOpen(true)} type="button">Selected: {selectedProduct.productType} · product details</button> : null}
          {productsQuery.hasNextPage ? <button className="text-button load-more" disabled={!online || productsQuery.isFetchingNextPage} onClick={() => productsQuery.fetchNextPage()} type="button">{productsQuery.isFetchingNextPage ? 'Loading…' : 'Show more products'}</button> : null}
        </section>
        <aside className="space-aside" aria-label={selectedProduct ? 'Selected product summary' : 'Space summary'}>
          {selectedProduct ? (
            <>
              <p className="aside-label">SELECTED PRODUCT</p>
              <h2>{selectedProduct.brand} {selectedProduct.productType}</h2>
              <StatusMark status={selectedProduct.status}>{selectedProduct.daysRemaining < 0 ? `${Math.abs(selectedProduct.daysRemaining)} days past expiry` : `${selectedProduct.daysRemaining} days left`}</StatusMark>
              <WarrantyLine purchasedOn={selectedProduct.purchasedOn} expiresOn={selectedProduct.expiresOn} progress={selectedProduct.warrantyElapsedFraction} status={selectedProduct.status} />
              <div className="reader-actions">
                <Link className="text-button" to={`/spaces/${spaceId}/products/${selectedProduct.id}`}>Open record</Link>
                {selectedProduct.permissions?.canEdit ? <Link className="text-button" to={`/spaces/${spaceId}/products/${selectedProduct.id}/edit`}>Edit product</Link> : null}
              </div>
            </>
          ) : (
            <>
              <p className="aside-label">SPACE DETAILS</p>
              <KeyValue rows={[
                { label: 'Role', value: spaceQuery.data.myRole?.toLowerCase() },
                { label: 'People', value: spaceQuery.data.memberCount },
                { label: 'Products', value: spaceQuery.data.productCount },
                { label: 'Next expiry', value: spaceQuery.data.nextExpiry ? formatDate(spaceQuery.data.nextExpiry.expiresOn) : 'No products yet' }
              ]} />
            </>
          )}
        </aside>
      </div>
      {summaryOpen && selectedProduct ? (
        <Sheet labelledBy="selected-product-title" onClose={() => setSummaryOpen(false)}>
          <h2 id="selected-product-title">{selectedProduct.brand} {selectedProduct.productType}</h2>
          <StatusMark status={selectedProduct.status}>{selectedProduct.daysRemaining < 0 ? `${Math.abs(selectedProduct.daysRemaining)} days past expiry` : `${selectedProduct.daysRemaining} days left`}</StatusMark>
          <WarrantyLine purchasedOn={selectedProduct.purchasedOn} expiresOn={selectedProduct.expiresOn} progress={selectedProduct.warrantyElapsedFraction} status={selectedProduct.status} />
          <KeyValue rows={[
            { label: 'Role', value: spaceQuery.data.myRole?.toLowerCase() },
            { label: 'Purchased', value: formatDate(selectedProduct.purchasedOn) },
            { label: 'Expires', value: formatDate(selectedProduct.expiresOn) },
            { label: 'Warranty', value: `${selectedProduct.warrantyMonths} months` }
          ]} />
          <div className="reader-actions">
            <Link className="text-button" to={`/spaces/${spaceId}/products/${selectedProduct.id}`}>Open record</Link>
            {selectedProduct.permissions?.canEdit ? <Link className="text-button" to={`/spaces/${spaceId}/products/${selectedProduct.id}/edit`}>Edit product</Link> : null}
          </div>
        </Sheet>
      ) : null}
      {showSpaceSettings && spaceQuery.data.permissions?.canEdit ? (
        <Sheet labelledBy="space-settings-title" onClose={() => setShowSpaceSettings(false)}>
          <h2 id="space-settings-title">Space settings</h2>
          <FormStack className="form-column" onSubmit={spaceForm.handleSubmit((values) => saveSpace.mutate(values), (invalid) => focusFirstErrorAfterRender(invalid, spaceFormRef.current))} ref={spaceFormRef}>
            <Field autoFocus error={spaceFormErrors.name?.message} label="Name" maxLength={80} placeholder="e.g. Home" {...spaceForm.register('name')} />
            <Field error={spaceFormErrors.description?.message} label="Description" maxLength={255} optional placeholder="e.g. Main home" {...spaceForm.register('description')} />
            <ErrorMessage error={saveSpace.error} />
            <button className="button button-primary" disabled={!online || saveSpace.isPending} type="submit">{saveSpace.isPending ? 'Saving…' : 'Save Space'}</button>
          </FormStack>
          {spaceQuery.data.permissions?.canDelete ? <button className="text-button remove-link" disabled={!online || deleteSpace.isPending} onClick={() => { setShowSpaceSettings(false); setConfirmDeleteSpace(true); }} type="button">Delete Space and its products</button> : null}
        </Sheet>
      ) : null}
      {confirmDeleteSpace && spaceQuery.data ? (
        <ConfirmSheet
          title="Delete this Space?"
          description={`Delete ${spaceQuery.data.name}, its products, and all stored images? This cannot be undone.`}
          confirmText={deleteSpace.isPending ? 'Deleting…' : 'Delete Space and images'}
          busy={deleteSpace.isPending || !online}
          onConfirm={() => deleteSpace.mutate()}
          onClose={() => setConfirmDeleteSpace(false)}
        >
          <ErrorMessage error={deleteSpace.error} />
        </ConfirmSheet>
      ) : null}
    </AppShell>
  );
}

/* Preflight: desktop=flat member/invitation rows; mobile=wrapped rows; empty=member/invitation messages; loading=delayed skeleton; error=retry Space/members; success=toast and refreshed membership; keyboard=role/select/confirmation; announcement=mutation feedback; offline=all membership writes disabled; restoration=membership query refresh. */
export function SpaceMembersPage() {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const queryClientRef = useQueryClient();
  const { user } = useAuth();
  const online = useOnlineStatus();
  const spaceQuery = useQuery({
    queryKey: ['space', user?.id, spaceId],
    queryFn: () => apiJson(`/api/spaces/${spaceId}`)
  });
  const membersQuery = useQuery({
    queryKey: ['members', user?.id, spaceId],
    queryFn: () => apiJson(`/api/spaces/${spaceId}/members`)
  });
  const inviteFormRef = useRef(null);
  const inviteForm = useForm({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'VIEWER' },
    mode: 'onBlur'
  });
  const inviteErrors = inviteForm.formState.errors;
  const [confirmMember, setConfirmMember] = useState(null);
  const invalidate = () => {
    queryClientRef.invalidateQueries({ queryKey: ['members', user?.id, spaceId] });
    queryClientRef.invalidateQueries({ queryKey: ['space', user?.id, spaceId] });
    queryClientRef.invalidateQueries({ queryKey: ['spaces', user?.id] });
    queryClientRef.invalidateQueries({ queryKey: ['invitations', user?.id] });
    queryClientRef.invalidateQueries({ queryKey: ['space-preview-members', user?.id, spaceId] });
  };
  const invite = useMutation({
    mutationFn: (values) => apiJson(`/api/spaces/${spaceId}/invitations`, {
      method: 'POST',
      body: JSON.stringify(values)
    }),
    onSuccess: (invitation) => {
      inviteForm.reset({ email: '', role: 'VIEWER' });
      toast.success('Invitation created. The invitee can accept it from their invitations list.');
      invalidate();
    },
    onError: (requestError) => {
      const invalidFields = mapServerFieldErrors(requestError.fieldErrors, inviteForm.setError);
      if (invalidFields.length) focusFieldAfterRender(invalidFields[0], inviteFormRef.current);
    }
  });
  const revoke = useMutation({
    mutationFn: (invitationId) => apiJson(`/api/spaces/${spaceId}/invitations/${invitationId}`, { method: 'DELETE' }),
    onSuccess: invalidate
  });
  const changeRole = useMutation({
    mutationFn: ({ userId, nextRole }) => apiJson(`/api/spaces/${spaceId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: nextRole })
    }),
    onSuccess: invalidate
  });
  const removeMember = useMutation({
    mutationFn: (userId) => apiJson(`/api/spaces/${spaceId}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: (_, removedUserId) => {
      setConfirmMember(null);
      if (removedUserId === user?.id) {
        queryClientRef.invalidateQueries({ queryKey: ['spaces', user?.id] });
        toast.success('You left the Space');
        navigate('/spaces', { replace: true });
      } else {
        invalidate();
      }
    }
  });
  const owner = spaceQuery.data?.permissions?.canManageMembers;

  return (
    <AppShell title={`${spaceQuery.data?.name || 'Space'} members`}>
      <section className="content-column">
        <p className="section-intro">People only see Spaces shared with them. Editors can update products; viewers can read records.</p>
        <ErrorMessage error={spaceQuery.error || membersQuery.error || revoke.error || changeRole.error || removeMember.error} onRetry={() => { spaceQuery.refetch(); membersQuery.refetch(); }} />
        {membersQuery.isLoading ? <Skeleton rows={5} /> : (
          <>
            <div className="line-list">
              {(membersQuery.data?.members || []).map((member) => (
                <article className="line-item member-row" key={member.userId}>
                  <div><strong>{member.name}</strong><small>{member.email}</small></div>
                  <div className="member-actions">
                    {owner && member.role !== 'OWNER' ? (
                      <select
                        aria-label={`Role for ${member.name}`}
                        disabled={!online || changeRole.isPending}
                        onChange={(event) => changeRole.mutate({ userId: member.userId, nextRole: event.target.value })}
                        value={member.role}
                      >
                        <option value="EDITOR">Editor</option>
                        <option value="VIEWER">Viewer</option>
                      </select>
                    ) : <span className="role-label">{member.role.toLowerCase()}</span>}
                    {member.role !== 'OWNER' && (owner || member.userId === user?.id) ? (
                      <button className="text-button remove-link" disabled={!online || removeMember.isPending} onClick={() => setConfirmMember(member)} type="button">
                        {member.userId === user?.id ? 'Leave' : 'Remove'}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
            {owner ? (
              <>
                <FormStack className="invite-form" onSubmit={inviteForm.handleSubmit((values) => invite.mutate(values), (invalid) => focusFirstErrorAfterRender(invalid, inviteFormRef.current))} ref={inviteFormRef}>
                  <h2>Invite someone</h2>
                  <Field autoComplete="email" error={inviteErrors.email?.message} label="Email address" placeholder="e.g. name@example.com" type="email" {...inviteForm.register('email')} />
                  <Field as="select" error={inviteErrors.role?.message} label="Access" {...inviteForm.register('role')} disabled={!online}>
                    <option value="VIEWER">Viewer: can view products and documents</option>
                    <option value="EDITOR">Editor: can add and edit products</option>
                  </Field>
                  <p className="invite-role-help">Viewers can see everything. Editors can add and edit products, but cannot delete them or manage people.</p>
                  <ErrorMessage error={invite.error} />
                  <button className="button button-primary" disabled={!online || invite.isPending} type="submit">{invite.isPending ? 'Sending…' : 'Send invitation'}</button>
                  {!online ? <p className="offline-note" role="status">Connect to send invitations or update membership.</p> : null}
                </FormStack>
                {(membersQuery.data?.invitations || []).length ? (
                  <div className="pending-invitations">
                    <h2>Pending invitations</h2>
                    {(membersQuery.data.invitations).map((invitation) => (
                      <div className="line-item invitation-row" key={invitation.id}>
                        <span><strong>{invitation.email}</strong><small>{invitation.role.toLowerCase()} · expires {formatDateTime(invitation.expiresAt)}</small></span>
                        <button className="text-button remove-link" disabled={!online || revoke.isPending} onClick={() => revoke.mutate(invitation.id)} type="button">Revoke</button>
                      </div>
                    ))}
                  </div>
                ) : <p className="empty-note">No pending invitations.</p>}
              </>
            ) : null}
          </>
        )}
        <div className="subtle-action"><Link to={`/spaces/${spaceId}`}>← Back to Space</Link></div>
      </section>
      {confirmMember ? (
        <ConfirmSheet
          title={confirmMember.userId === user?.id ? 'Leave this Space?' : 'Remove this person?'}
          description={confirmMember.userId === user?.id ? `You will no longer see ${spaceQuery.data?.name || 'this Space'} or its products.` : `Remove ${confirmMember.name} from ${spaceQuery.data?.name || 'this Space'}? They will lose access to its products and documents.`}
          confirmText={removeMember.isPending ? 'Removing…' : confirmMember.userId === user?.id ? 'Leave Space' : 'Remove member'}
          busy={removeMember.isPending || !online}
          onConfirm={() => removeMember.mutate(confirmMember.userId)}
          onClose={() => setConfirmMember(null)}
        >
          <ErrorMessage error={removeMember.error} />
        </ConfirmSheet>
      ) : null}
    </AppShell>
  );
}

/* Preflight: desktop=flat pending invitation rows; mobile=wrapped rows; empty=no pending invitations; loading=delayed skeleton; error=retry invitation query; success=accept navigates or decline toasts; keyboard=separate accept/decline actions; announcement=toast; offline=server action errors without local mutation; restoration=refetch invitations and Spaces. */
export function InvitationsPage() {
  const queryClientRef = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const invitationsQuery = useQuery({
    queryKey: ['invitations', user?.id],
    queryFn: () => apiJson('/api/invitations')
  });
  const respond = useMutation({
    mutationFn: ({ invitationId, action }) => apiJson(`/api/invitations/${invitationId}/${action}`, { method: 'POST', body: '{}' }),
    onSuccess: (result, variables) => {
      queryClientRef.invalidateQueries({ queryKey: ['invitations', user.id] });
      queryClientRef.invalidateQueries({ queryKey: ['spaces', user.id] });
      if (variables.action === 'accept') {
        toast.success('You joined the Space');
        navigate(`/spaces/${result.id}`);
      } else {
        toast.success('Invitation declined');
      }
    }
  });
  return (
    <AppShell title="Invitations">
      <section className="content-column">
        <ErrorMessage error={invitationsQuery.error || respond.error} />
        {invitationsQuery.isLoading ? <Skeleton rows={4} /> : (
          <div className="line-list">
            {(invitationsQuery.data || []).map((invitation) => (
              <article className="line-item invitation-row" key={invitation.id}>
                <span>
                  <strong>{invitation.spaceName}</strong>
                  <small>{invitation.invitedByName} invited you as {invitation.role.toLowerCase()} · expires {formatDateTime(invitation.expiresAt)}</small>
                </span>
                <span className="member-actions">
                  <button className="text-button" disabled={respond.isPending} onClick={() => respond.mutate({ invitationId: invitation.id, action: 'decline' })} type="button">Decline</button>
                  <button className="text-button accept-link" disabled={respond.isPending} onClick={() => respond.mutate({ invitationId: invitation.id, action: 'accept' })} type="button">Accept</button>
                </span>
              </article>
            ))}
            {!invitationsQuery.data?.length ? <p className="empty-note">You have no pending invitations.</p> : null}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function ProductRow({ product, selected, onSelect, index }) {
  return (
    <ListRow index={index} className={`product-row${selected ? ' product-row-selected' : ''}`}>
      <button className="product-select" aria-pressed={selected} onClick={onSelect} type="button">
        <strong>{product.productType} <span className="muted">·</span> {product.brand}</strong>
        {product.modelName ? <small>{product.modelName}</small> : null}
        <small>{formatCurrency(product.purchasePrice, product.currency)} · purchased {formatDate(product.purchasedOn)}</small>
      </button>
      <div className="product-expiry">
        <StatusMark status={product.status} />
        <time dateTime={product.expiresOn}>{formatDate(product.expiresOn)}</time>
        <Link className="text-button" to={`/spaces/${product.spaceId}/products/${product.id}`}>Open</Link>
      </div>
    </ListRow>
  );
}

function PrivateImage({ productId, imageType, label }) {
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const [zoomed, setZoomed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    apiRequest(`/api/products/${productId}/images/${imageType}`)
      .then((response) => response.blob())
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'The image could not be loaded.');
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [productId, imageType, retryCount]);
  if (error) return <div className="form-error" role="alert"><p>{error}</p><button className="text-button" onClick={() => { setError(''); setImageUrl(''); setRetryCount((count) => count + 1); }} type="button">Try again</button></div>;
  return (
    <>
      <figure className="private-image">
        {imageUrl ? <button className="image-open" aria-label={`Open full-size ${label}`} onClick={() => setZoomed(true)} type="button"><img alt={label} src={imageUrl} /></button> : <Skeleton rows={2} />}
        <figcaption>{label}</figcaption>
      </figure>
      {zoomed ? (
        <Sheet className="image-sheet" backdropClassName="image-backdrop" labelledBy="zoom-image-title" onClose={() => setZoomed(false)}>
          <h2 className="sr-only" id="zoom-image-title">{label}</h2>
          <button className="text-button" onClick={() => setZoomed(false)} type="button">Close image</button>
          <img alt={label} src={imageUrl} />
        </Sheet>
      ) : null}
    </>
  );
}

function SuggestionUndo({ onUndo }) {
  return (
    <span className="suggestion-mark">
      <small>Suggested</small>
      <button className="text-button" onClick={onUndo} type="button">Undo</button>
    </span>
  );
}

export function ProductForm({ spaceId, productId, onSaved }) {
  const queryClientRef = useQueryClient();
  const { user } = useAuth();
  const online = useOnlineStatus();
  const productQuery = useQuery({
    queryKey: ['product', user?.id, productId],
    queryFn: () => apiJson(`/api/products/${productId}`),
    enabled: Boolean(productId)
  });
  const facetsQuery = useQuery({
    queryKey: ['product-facets', user?.id],
    queryFn: () => apiJson('/api/products/facets')
  });
  const facets = facetsQuery.data;
  const formRef = useRef(null);
  const form = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      productType: '', brand: '', purchasedOn: '', warrantyMonths: '', purchasePrice: '',
      currency: user?.currency || 'INR', modelName: '', serialNumber: '', notes: ''
    },
    mode: 'onBlur'
  });
  const resetProductForm = form.reset;
  const getProductValues = form.getValues;
  const values = form.watch();
  const formErrors = form.formState.errors;
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [billFile, setBillFile] = useState(null);
  const [cardFile, setCardFile] = useState(null);
  const [billFileError, setBillFileError] = useState('');
  const [cardFileError, setCardFileError] = useState('');
  const [removeWarrantyCard, setRemoveWarrantyCard] = useState(false);
  const [suggestions, setSuggestions] = useState({});
  const [previousValues, setPreviousValues] = useState({});
  const [rawOcr, setRawOcr] = useState('');
  const [billPreview, setBillPreview] = useState('');
  const [ocrStatus, setOcrStatus] = useState('idle');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrError, setOcrError] = useState('');
  const [dirty, setDirty] = useState(false);
  const valuesRef = useRef(getProductValues());
  const touchedFields = useRef(new Set());
  const ocrTask = useRef(null);
  const ocrRequest = useRef(0);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (
    dirty && !busy && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search)
  ));

  useEffect(() => {
    const product = productQuery.data;
    if (!product) return;
    const next = {
      productType: product.productType,
      brand: product.brand,
      purchasedOn: product.purchasedOn,
      warrantyMonths: String(product.warrantyMonths),
      purchasePrice: product.purchasePrice,
      currency: product.currency,
      modelName: product.modelName || '',
      serialNumber: product.serialNumber || '',
      notes: product.notes || ''
    };
    valuesRef.current = next;
    resetProductForm(next);
    setRemoveWarrantyCard(false);
    setDirty(false);
    setBillFile(null);
    setCardFile(null);
    setSuggestions({});
    setPreviousValues({});
    setCustomWarranty(![6, 12, 24, 36, 60].includes(Number(next.warrantyMonths)));
  }, [productQuery.data, resetProductForm]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => () => {
    ocrRequest.current += 1;
    ocrTask.current?.cancel();
  }, []);

  useEffect(() => {
    if (!billFile) {
      setBillPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(billFile);
    setBillPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [billFile]);

  const changeField = (event) => {
    const { name, value } = event.target;
    touchedFields.current.add(name);
    const next = { ...valuesRef.current, [name]: value };
    valuesRef.current = next;
    setDirty(true);
    setError(null);
    form.clearErrors(name);
    setSuggestions((current) => {
      if (!current[name]) return current;
      const updated = { ...current };
      delete updated[name];
      return updated;
    });
  };

  const applySuggestions = (parsed) => {
    const fieldMap = {
      productType: parsed.productType,
      brand: parsed.brand,
      purchasedOn: parsed.purchaseDate,
      warrantyMonths: parsed.warrantyMonths,
      purchasePrice: parsed.amount,
      modelName: parsed.modelName,
      serialNumber: parsed.serialNumber
    };
    const next = { ...valuesRef.current };
    const oldValues = {};
    const suggested = {};
    for (const [field, value] of Object.entries(fieldMap)) {
      if (!value || touchedFields.current.has(field) || next[field]) continue;
      oldValues[field] = next[field];
      next[field] = value;
      suggested[field] = true;
    }
    if (Object.keys(suggested).length) {
      valuesRef.current = next;
      for (const field of Object.keys(suggested)) form.setValue(field, next[field], { shouldDirty: true, shouldValidate: true });
      if (suggested.warrantyMonths && ![6, 12, 24, 36, 60].includes(Number(next.warrantyMonths))) setCustomWarranty(true);
      setPreviousValues((current) => ({ ...current, ...oldValues }));
      setSuggestions((current) => ({ ...current, ...suggested }));
    }
  };

  const undoSuggestion = (field) => {
    const next = { ...valuesRef.current, [field]: previousValues[field] || '' };
    valuesRef.current = next;
    form.setValue(field, next[field], { shouldDirty: true, shouldValidate: true });
    touchedFields.current.add(field);
    form.clearErrors(field);
    setSuggestions((current) => {
      const updated = { ...current };
      delete updated[field];
      return updated;
    });
  };

  const prepareBill = async (selectedFile) => {
    ocrTask.current?.cancel();
    ocrTask.current = null;
    const requestId = ++ocrRequest.current;
    setBillFile(null);
    setRawOcr('');
    setOcrError('');
    setBillFileError('');
    setOcrStatus('idle');
    setOcrProgress(0);
    setError(null);
    try {
      const prepared = await prepareImage(selectedFile);
      if (!prepared) return;
      if (requestId !== ocrRequest.current) return;
      setDirty(true);
      setBillFile(prepared);
      setOcrStatus('reading');
      setOcrProgress(0);
      const { createBillOcrTask } = await import('@/lib/ocr/recognize.js');
      if (requestId !== ocrRequest.current) return;
      const task = createBillOcrTask(prepared, setOcrProgress);
      ocrTask.current = task;
      const text = await task.promise;
      if (requestId !== ocrRequest.current) return;
      ocrTask.current = null;
      setRawOcr(text.trim());
      if (!text.trim()) {
        setOcrStatus('empty');
        setOcrError('No readable text was found. You can still enter details and save the product.');
        return;
      }
      applySuggestions(parseBill(text, { localeHint: navigator.language || 'en-IN' }));
      setOcrStatus('done');
    } catch (ocrFailure) {
      if (requestId !== ocrRequest.current) return;
      ocrTask.current = null;
      setOcrStatus('idle');
      setBillFileError(ocrFailure.message || 'Choose a JPEG, PNG, or WebP image.');
    }
  };

  const prepareCard = async (selectedFile) => {
    setCardFile(null);
    setCardFileError('');
    try {
      const prepared = await prepareImage(selectedFile);
      if (!prepared) return;
      setCardFile(prepared);
      setRemoveWarrantyCard(false);
      setDirty(true);
      setError(null);
    } catch (imageFailure) {
      setCardFileError(imageFailure.message || 'Choose a JPEG, PNG, or WebP image.');
    }
  };

  const cancelOcr = () => {
    ocrRequest.current += 1;
    ocrTask.current?.cancel();
    ocrTask.current = null;
    setOcrStatus('skipped');
  };
  const productTypeOptions = [...new Set([
    ...PRODUCT_TYPE_DICTIONARY.map(([label]) => label),
    ...(facets?.types || [])
  ])];
  const brandOptions = [...new Set([
    ...BRAND_DICTIONARY.map(([label]) => label),
    ...(facets?.brands || [])
  ])];
  let expiresOn = '';
  if (values.purchasedOn && Number(values.warrantyMonths)) {
    try {
      expiresOn = computeExpiresOn(values.purchasedOn, Number(values.warrantyMonths)).toISOString().slice(0, 10);
    } catch {
      expiresOn = '';
    }
  }
  const pickWarranty = (months) => {
    const next = { ...valuesRef.current, warrantyMonths: String(months) };
    valuesRef.current = next;
    form.setValue('warrantyMonths', String(months), { shouldDirty: true, shouldValidate: true });
    setDirty(true);
    touchedFields.current.add('warrantyMonths');
    form.clearErrors('warrantyMonths');
    setError(null);
  };
  const registerField = (name) => form.register(name, { onChange: changeField });
  const priceFieldRegistration = registerField('purchasePrice');
  const updateField = (name, value) => {
    const next = { ...valuesRef.current, [name]: value };
    valuesRef.current = next;
    form.setValue(name, value, { shouldDirty: true, shouldValidate: true });
    touchedFields.current.add(name);
    setDirty(true);
    setError(null);
    form.clearErrors(name);
  };
  const [customWarranty, setCustomWarranty] = useState(false);

  const submit = async (validatedValues) => {
    setBusy(true);
    setError(null);
    if (!online) {
      setError(new Error('You need a connection to save product changes.'));
      setBusy(false);
      return;
    }
    if (!productId && !billFile) {
      setBillFileError('Choose a bill image to continue.');
      setError(new Error('Choose a bill image to continue.'));
      focusFieldAfterRender('billPicker', formRef.current);
      setBusy(false);
      return;
    }
    const data = {
      productType: validatedValues.productType.trim(),
      brand: validatedValues.brand.trim(),
      purchasedOn: validatedValues.purchasedOn,
      warrantyMonths: Number(validatedValues.warrantyMonths),
      purchasePrice: normalizePrice(validatedValues.purchasePrice),
      currency: validatedValues.currency,
      modelName: validatedValues.modelName || null,
      serialNumber: validatedValues.serialNumber || null,
      notes: validatedValues.notes || null
    };
    if (productId) data.removeWarrantyCard = removeWarrantyCard;
    const payload = new FormData();
    payload.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
    if (billFile) payload.append('bill', billFile);
    if (cardFile) payload.append('warrantyCard', cardFile);
    try {
      const savedProduct = await apiJson(productId ? `/api/products/${productId}` : `/api/spaces/${spaceId}/products`, {
        method: productId ? 'PUT' : 'POST',
        body: payload
      });
      queryClientRef.setQueryData(['product', user.id, savedProduct.id], savedProduct);
      invalidateAfterProductChange(queryClientRef, user.id, spaceId, savedProduct.id);
      setDirty(false);
      toast.success(productId ? 'Product updated' : 'Product saved');
      onSaved(savedProduct);
    } catch (requestError) {
      setError(requestError);
      const invalidFields = mapServerFieldErrors(requestError.fieldErrors, form.setError);
      if (invalidFields.includes('warrantyMonths')) setCustomWarranty(true);
      if (invalidFields.length) focusFieldAfterRender(invalidFields[0], formRef.current);
    } finally {
      setBusy(false);
    }
  };

  if (productId && productQuery.isLoading) return <Skeleton rows={8} />;
  if (productId && productQuery.error) return <ErrorMessage error={productQuery.error} onRetry={() => productQuery.refetch()} />;

  return (
    <div className="product-form-layout">
      <FormStack className="product-form" onSubmit={form.handleSubmit(submit, (invalid) => focusFirstErrorAfterRender(invalid, formRef.current))} ref={formRef}>
        <h2>Product details</h2>
        {facetsQuery.error ? <p className="ocr-note" role="status">Saved product suggestions are unavailable. You can still enter any product type or brand.</p> : null}
        {!online ? <p className="offline-note" role="status">You’re offline. Product changes need a connection.</p> : null}
        <section className="product-form-section">
          <h3>Bill</h3>
          <ImagePicker
            camera
            current={Boolean(productId && !billFile)}
            currentImageType="bill"
            currentLabel="Current saved purchase bill"
            currentProductId={productId}
            currentSize={productQuery.data?.bill?.sizeBytes}
            fieldName="bill"
            file={billFile}
            hint={productId ? 'Replace the current bill if you have a clearer copy.' : 'Required. JPEG, PNG, or WebP. Image processing and text recognition stay on this device.'}
            label="Purchase bill"
            optional={Boolean(productId)}
            error={billFileError}
            onSelect={prepareBill}
            onRemove={() => { cancelOcr(); setOcrStatus('idle'); setBillFile(null); setBillPreview(''); setDirty(true); }}
          />
          {ocrStatus === 'reading' ? (
            <div className="ocr-progress" aria-live="polite">
              <label htmlFor="bill-reading-progress">Reading bill · {Math.round(ocrProgress * 100)}%</label>
              <progress id="bill-reading-progress" max="1" value={ocrProgress} />
              <button className="text-button" onClick={cancelOcr} type="button">Cancel reading</button>
            </div>
          ) : null}
          {ocrError ? <p className="ocr-note" role="status">{ocrError}</p> : null}
          {rawOcr ? <details className="ocr-found-text"><summary>Text found on the bill</summary><pre>{rawOcr}</pre></details> : null}
        </section>
        <section className="product-form-section">
          <h3>Product</h3>
          <div className="form-grid">
            <div className="field full-width">
              <Controller control={form.control} name="productType" render={({ field }) => <FreeTextCombobox error={formErrors.productType?.message} inputRef={field.ref} label="Product type" name={field.name} onBlur={field.onBlur} onChange={(event) => { changeField(event); field.onChange(event.target.value); }} options={productTypeOptions} placeholder="e.g. Refrigerator" value={field.value} />} />
              {suggestions.productType ? <SuggestionUndo onUndo={() => undoSuggestion('productType')} /> : null}
            </div>
            <div className="field full-width">
              <Controller control={form.control} name="brand" render={({ field }) => <FreeTextCombobox error={formErrors.brand?.message} inputRef={field.ref} label="Brand" name={field.name} onBlur={field.onBlur} onChange={(event) => { changeField(event); field.onChange(event.target.value); }} options={brandOptions} placeholder="e.g. LG" value={field.value} />} />
              {suggestions.brand ? <SuggestionUndo onUndo={() => undoSuggestion('brand')} /> : null}
            </div>
          </div>
        </section>
        <section className="product-form-section">
          <h3>Warranty</h3>
          <Field error={formErrors.purchasedOn?.message} label="Purchased on">
            {(props) => (
              <>
                <div className="date-control"><input {...props} {...registerField('purchasedOn')} max={localDateInputValue()} type="date" /><button className="text-button" onClick={() => updateField('purchasedOn', localDateInputValue())} type="button">Today</button></div>
                {values.purchasedOn ? <small className="field-hint">Purchased {formatDate(values.purchasedOn)}</small> : null}
              </>
            )}
          </Field>
          <div className="field full-width">
            <span className="field-label">Warranty period</span>
            <div className="quick-picks" role="group" aria-label="Common warranty periods">
              {[6, 12, 24, 36, 60].map((months, index) => <button aria-describedby={formErrors.warrantyMonths?.message ? 'warranty-period-error' : undefined} aria-invalid={Boolean(formErrors.warrantyMonths?.message)} aria-pressed={!customWarranty && Number(values.warrantyMonths) === months} key={months} name={index === 0 ? 'warrantyMonths' : undefined} onClick={() => { setCustomWarranty(false); pickWarranty(months); }} type="button">{months} months</button>)}
              <button aria-pressed={customWarranty} onClick={() => { setCustomWarranty(true); updateField('warrantyMonths', ''); }} type="button">Other</button>
            </div>
            {customWarranty ? <Field error={formErrors.warrantyMonths?.message} label="Custom warranty in months" max="120" min="1" type="number" {...registerField('warrantyMonths')} /> : null}
            {!customWarranty && formErrors.warrantyMonths?.message ? <small className="form-error" id="warranty-period-error" role="alert">{formErrors.warrantyMonths.message}</small> : null}
            {expiresOn ? <p className="expiry-preview">Warranty ends <time dateTime={expiresOn}>{formatDate(expiresOn)}</time></p> : null}
          </div>
        </section>
        <section className="product-form-section">
          <h3>Price</h3>
          <div className="field full-width">
            <span className="field-label">Purchase price</span>
            {suggestions.purchasePrice ? <SuggestionUndo onUndo={() => undoSuggestion('purchasePrice')} /> : null}
            <div className="price-field">
              <span className="currency-symbol" aria-hidden="true">{currencySymbol(values.currency || 'INR')}</span>
              <input aria-describedby={formErrors.purchasePrice?.message ? 'purchase-price-error' : undefined} aria-invalid={Boolean(formErrors.purchasePrice?.message)} aria-label="Purchase price" inputMode="decimal" placeholder="e.g. 5,000.50" {...priceFieldRegistration} onBlur={(event) => {
                  priceFieldRegistration.onBlur(event);
                  const formatted = formatPriceInput(event.currentTarget.value);
                  if (formatted !== event.currentTarget.value) updateField('purchasePrice', formatted);
                }} />
              <select aria-describedby={formErrors.currency?.message ? 'purchase-currency-error' : undefined} aria-invalid={Boolean(formErrors.currency?.message)} aria-label="Currency" {...registerField('currency')}>{[...new Set([values.currency || user?.currency || 'INR', 'INR', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'])].map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select>
            </div>
            {values.purchasePrice && formErrors.purchasePrice == null ? <output className="price-preview" aria-live="polite">{formatCurrency(normalizePrice(values.purchasePrice), values.currency || 'INR')}</output> : null}
            {formErrors.purchasePrice?.message ? <small className="form-error" id="purchase-price-error" role="alert">{formErrors.purchasePrice.message}</small> : null}
            {formErrors.currency?.message ? <small className="form-error" id="purchase-currency-error" role="alert">{formErrors.currency.message}</small> : null}
          </div>
        </section>
        <details className="product-more-details">
          <summary>More details</summary>
          <div className="product-form-section">
            <ImagePicker camera current={Boolean(productQuery.data?.hasWarrantyCard && !removeWarrantyCard && !cardFile)} currentImageType="warranty-card" currentLabel="Current saved warranty card" currentProductId={productId} currentSize={productQuery.data?.warrantyCard?.sizeBytes} fieldName="warrantyCard" file={cardFile} hint="Add a second image showing the warranty terms." label="Warranty card" optional onSelect={prepareCard} onRemove={() => { setCardFile(null); setRemoveWarrantyCard(false); setDirty(true); }} />
            {productId && productQuery.data?.hasWarrantyCard ? <SwitchControl checked={removeWarrantyCard} label="Remove current warranty card" onChange={(event) => { setRemoveWarrantyCard(event.target.checked); setDirty(true); }} /> : null}
            <Field error={formErrors.modelName?.message} label="Model" maxLength={120} optional placeholder="e.g. RS-28" {...registerField('modelName')} />
            <Field error={formErrors.serialNumber?.message} label="Serial number" maxLength={120} optional placeholder="e.g. ABC123456" {...registerField('serialNumber')} />
            <Field as="textarea" error={formErrors.notes?.message} label="Notes" maxLength={1000} optional placeholder="e.g. Purchased for the kitchen" rows={3} {...registerField('notes')} />
          </div>
        </details>
        <ErrorMessage error={error} />
        <div className="product-save-bar"><button className="button button-primary" disabled={busy || !online} title={!online ? 'Connect to save product changes' : undefined} type="submit">{busy ? 'Saving…' : productId ? 'Save changes' : 'Save product'}</button></div>
      </FormStack>
      <aside className="product-form-aside">
        {billPreview ? <figure className="bill-preview"><img alt="Preview of selected purchase bill" src={billPreview} /><figcaption>Purchase bill · processed on this device</figcaption></figure> : productId ? <PrivateImage productId={productId} imageType="bill" label={`Current purchase bill for ${productQuery.data?.brand || 'product'}`} /> : <p className="preview-empty">Your bill preview will appear here.</p>}
        {ocrStatus === 'reading' ? <p className="preview-status">Reading text · {Math.round(ocrProgress * 100)}%</p> : null}
        {Object.keys(suggestions).length ? <p className="preview-status">{Object.keys(suggestions).length} suggested field{Object.keys(suggestions).length === 1 ? '' : 's'} ready to review.</p> : null}
      </aside>
      {blocker.state === 'blocked' ? (
        <ConfirmSheet
          title="Discard unsaved changes?"
          description="The changes on this form have not been saved."
          confirmText="Discard changes"
          onConfirm={() => { setDirty(false); blocker.proceed(); }}
          onClose={() => blocker.reset()}
        />
      ) : null}
    </div>
  );
}

/* Preflight: desktop=single form column with bill preview aside; mobile=stacked preview and fields; empty=required bill guidance; loading=delayed edit skeleton; error=field-level validation and retryable product query; success=toast then reader route; keyboard=native fields and unsaved-change alertdialog; announcement=OCR progress and errors; offline=editing allowed locally, saving disabled; restoration=discard confirmation or server save/reload. */
export function ProductFormPage({ editing = false }) {
  const { spaceId, productId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: space, isLoading, error, refetch } = useQuery({
    queryKey: ['space', user?.id, spaceId],
    queryFn: () => apiJson(`/api/spaces/${spaceId}`)
  });
  const title = editing ? 'Edit product' : 'Add product';
  return (
    <AppShell
      title={title}
      actions={<Link className="text-button" to={editing ? `/spaces/${spaceId}/products/${productId}` : `/spaces/${spaceId}`}>Back to {space?.name || 'Space'}</Link>}
    >
      {isLoading ? <Skeleton rows={8} /> : error ? <ErrorMessage error={error} onRetry={refetch} /> : (
        <ProductForm
          spaceId={spaceId}
          productId={editing ? productId : undefined}
          onSaved={(product) => navigate(`/spaces/${spaceId}/products/${product.id}`, { replace: true })}
        />
      )}
    </AppShell>
  );
}

/* Preflight: desktop=vertical account sections; mobile=wrapped controls; empty=not applicable; loading=profile form; error=profile/password errors; success=save toast and updated profile; keyboard=native controls and buttons; announcement=role status/toasts; offline=profile/password writes disabled; restoration=reload profile, sign out returns to login. */
export function SettingsPage() {
  const queryClientRef = useQueryClient();
  const { user, updateUser, logout } = useAuth();
  const { preference: themePreference, changeTheme } = useTheme();
  const navigate = useNavigate();
  const profileFormRef = useRef(null);
  const passwordFormRef = useRef(null);
  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      timezone: user?.timezone || 'UTC',
      currency: user?.currency || 'INR'
    }
  });
  const profileErrors = profileForm.formState.errors;
  const passwordForm = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' }
  });
  const passwordErrors = passwordForm.formState.errors;
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const saveProfile = useMutation({
    mutationFn: (profile) => apiJson('/api/me', {
      method: 'PATCH',
      body: JSON.stringify(profile)
    }),
    onSuccess: (updatedUser) => {
      updateUser(updatedUser);
      profileForm.reset({
        name: updatedUser.name || '',
        timezone: updatedUser.timezone || 'UTC',
        currency: updatedUser.currency || 'INR'
      });
      invalidateAfterProfileChange(queryClientRef, user.id);
      toast.success('Account details saved');
    },
    onError: (requestError) => {
      const invalidFields = mapServerFieldErrors(requestError.fieldErrors, profileForm.setError);
      if (invalidFields.length) focusFieldAfterRender(invalidFields[0], profileFormRef.current);
    }
  });
  const changePassword = useMutation({
    mutationFn: (passwords) => apiJson('/api/me/password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      })
    }),
    onSuccess: () => {
      passwordForm.reset();
      setChangePasswordOpen(false);
      setPasswordVisible(false);
      toast.success('Password changed');
    },
    onError: (requestError) => {
      const invalidFields = mapServerFieldErrors(requestError.fieldErrors, passwordForm.setError);
      if (invalidFields.length) focusFieldAfterRender(invalidFields[0], passwordFormRef.current);
    }
  });
  const online = useOnlineStatus();
  const signOut = async () => {
    try {
      await logout();
    } catch {
      toast.error('Your session could not be cleared at the server.');
    } finally {
      navigate('/login', { replace: true });
    }
  };
  return (
    <AppShell title="Your account">
      <section className="content-column settings-content">
        <section className="settings-section">
          <header className="section-heading"><h2>Profile</h2></header>
          <div className="settings-row"><span>Email</span><strong>{user?.email}</strong></div>
          <FormStack className="settings-form" onSubmit={profileForm.handleSubmit((profile) => saveProfile.mutate(profile), (invalid) => focusFirstErrorAfterRender(invalid, profileFormRef.current))} ref={profileFormRef}>
            <Field autoComplete="name" error={profileErrors.name?.message} label="Name" maxLength={120} placeholder="e.g. Alex Morgan" {...profileForm.register('name')} />
            <Field as="select" error={profileErrors.timezone?.message} label="Timezone" {...profileForm.register('timezone')}>
              {[...new Set([user?.timezone || 'UTC', 'UTC', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Europe/Paris', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney'])].map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
            </Field>
            <Field as="select" error={profileErrors.currency?.message} label="Currency" {...profileForm.register('currency')}>
              {[...new Set([user?.currency || 'INR', 'INR', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'])].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </Field>
            <ErrorMessage error={saveProfile.error} />
            {profileForm.formState.isDirty ? <button className="button button-primary" disabled={!online || saveProfile.isPending} type="submit">{saveProfile.isPending ? 'Saving…' : 'Save account details'}</button> : null}
          </FormStack>
        </section>
        <section className="settings-section">
          <header className="section-heading"><h2>Appearance</h2></header>
          <p className="settings-help">Use the system setting or choose a theme for this device.</p>
          <div className="theme-options" role="group" aria-label="Appearance">
            {['system', 'light', 'dark'].map((theme) => (
              <button aria-pressed={themePreference === theme} className={`theme-option${themePreference === theme ? ' selected' : ''}`} key={theme} onClick={() => changeTheme(theme)} type="button">{theme[0].toUpperCase() + theme.slice(1)}</button>
            ))}
          </div>
        </section>
        <section className="settings-section">
          <header className="section-heading"><h2>Account</h2></header>
          <div className="settings-account-actions">
            <button className="text-button" disabled={!online} onClick={() => setChangePasswordOpen(true)} type="button">Change password</button>
            <button className="text-button" disabled={!online} onClick={signOut} type="button">Sign out</button>
          </div>
        </section>
        {changePasswordOpen ? (
          <Sheet className="password-sheet" labelledBy="change-password-title" onClose={() => setChangePasswordOpen(false)}>
            <h2 id="change-password-title">Change password</h2>
            <p>Choose a new password for your WarrantyVault account.</p>
            <FormStack className="form-column password-form" onSubmit={passwordForm.handleSubmit((values) => changePassword.mutate(values), (invalid) => focusFirstErrorAfterRender(invalid, passwordFormRef.current))} ref={passwordFormRef}>
              <Field autoComplete="current-password" error={passwordErrors.currentPassword?.message} label="Current password" type={passwordVisible ? 'text' : 'password'} {...passwordForm.register('currentPassword')} />
              <Field autoComplete="new-password" error={passwordErrors.newPassword?.message} hint="Use 8 to 72 UTF-8 bytes. Longer passwords are harder to guess." label="New password" type={passwordVisible ? 'text' : 'password'} {...passwordForm.register('newPassword')} />
              <Field autoComplete="new-password" error={passwordErrors.confirmPassword?.message} label="Confirm new password" type={passwordVisible ? 'text' : 'password'} {...passwordForm.register('confirmPassword')} />
              <button aria-pressed={passwordVisible} className="text-button password-visibility" onClick={() => setPasswordVisible((visible) => !visible)} type="button">{passwordVisible ? 'Hide passwords' : 'Show passwords'}</button>
              <ErrorMessage error={changePassword.error} />
              <div className="sheet-actions">
                <button className="button button-primary" disabled={!online || changePassword.isPending} type="submit">{changePassword.isPending ? 'Updating…' : 'Update password'}</button>
                <button className="text-button" disabled={changePassword.isPending} onClick={() => setChangePasswordOpen(false)} type="button">Cancel</button>
              </div>
            </FormStack>
          </Sheet>
        ) : null}
      </section>
    </AppShell>
  );
}
