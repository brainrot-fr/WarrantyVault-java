import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn.js';

export function Region({ as: Element = 'section', children, className = '', aside = false, ...props }) {
  return <Element className={cn(aside ? 'layout-aside' : 'layout-region', className)} {...props}>{children}</Element>;
}

export function PageTitle({ children, count, actions, ...props }) {
  return (
    <div className="workspace-page-title">
      <h1 className="page-title" data-page-title tabIndex="-1" {...props}>{children}{count != null ? <span className="page-title-count"> {count}</span> : null}</h1>
      {actions ? <div className="page-title-actions">{actions}</div> : null}
    </div>
  );
}

export function Sheet({ children, labelledBy, onClose, className = '', backdropClassName = '', role = 'dialog', describedBy }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const focusable = () => [...dialog.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')];
    (dialog.querySelector('[autofocus]') || focusable()[0] || dialog).focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        dialog.focus();
      } else if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault();
        items[0].focus();
      }
    };
    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      dialog.removeEventListener('keydown', onKeyDown);
      if (previousFocus instanceof window.HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <div className={`sheet-backdrop ${backdropClassName}`.trim()} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`add-sheet ${className}`.trim()} ref={dialogRef} role={role} aria-modal="true" aria-labelledby={labelledBy} aria-describedby={describedBy} tabIndex="-1">
        <div className="sheet-grabber" aria-hidden="true" />
        {children}
      </section>
    </div>
  );
}

export function ConfirmSheet({ title, description, confirmText, busy = false, onConfirm, onClose, children }) {
  const titleId = 'confirm-sheet-title';
  const descriptionId = 'confirm-sheet-description';
  return (
    <Sheet className="confirm-sheet" role="alertdialog" labelledBy={titleId} describedBy={descriptionId} onClose={onClose}>
      <h2 id={titleId}>{title}</h2>
      <p id={descriptionId}>{description}</p>
      {children}
      <div className="sheet-actions">
        <button className="button button-primary" disabled={busy} onClick={onConfirm} type="button">{confirmText}</button>
        <button className="text-button" disabled={busy} onClick={onClose} type="button">Cancel</button>
      </div>
    </Sheet>
  );
}

export function Section({ title, children, action, className = '' }) {
  return (
    <section className={cn('reading-section', className)}>
      <header className="section-heading">
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Field({ label, hint, error, children, className = '' }) {
  const errorId = error ? `field-error-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : undefined;
  return (
    <label className={cn('field', className)}>
      <span>{label}{hint ? <small>{hint}</small> : null}</span>
      {children(errorId)}
      {error ? <small className="form-error" id={errorId} role="alert">{error}</small> : null}
    </label>
  );
}

export function Skeleton({ rows = 4, className = '' }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 150);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <div className={`dashboard-skeleton ${className}`.trim()} aria-label="Loading content" role="status">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }, (_, index) => <span aria-hidden="true" key={index} />)}
    </div>
  );
}

export function OfflineNote() {
  return <p className="offline-note" role="status">You’re offline. You can view saved warranties, but changes need a connection.</p>;
}

export function Figure({ value, label, tone }) {
  return (
    <div className={`figure${tone ? ` figure-${tone}` : ''}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function StatusMark({ status, children }) {
  const label = children || status?.replaceAll('_', ' ').toLowerCase();
  const style = status?.toLowerCase().replaceAll('_', '-');
  return <span className={`status-mark status-${style}`}><span aria-hidden="true" />{label}</span>;
}

export function EmptyState({ title, detail, action }) {
  return (
    <div className="empty-state">
      <p>{title}</p>
      {detail ? <small>{detail}</small> : null}
      {action}
    </div>
  );
}

export function KeyValue({ rows }) {
  return (
    <dl className="key-value-list">
      {rows.map(({ label, value }) => (
        <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>
      ))}
    </dl>
  );
}

export function WarrantyLine({ purchasedOn, expiresOn, progress = 0, status = 'ACTIVE' }) {
  const reducedMotion = useReducedMotion();
  const elapsed = `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`;
  return (
    <div className="warranty-line" aria-label={`Purchased ${purchasedOn}; coverage ends ${expiresOn}`}>
      <div className="warranty-track">
        <i aria-hidden="true" className="warranty-start" />
        <motion.span className={`warranty-progress status-${status.toLowerCase().replaceAll('_', '-')}`} initial={reducedMotion ? false : { width: 0 }} animate={{ width: elapsed }} transition={{ duration: reducedMotion ? 0 : 0.5, ease: 'easeOut' }} />
        <i aria-label="Today" className="warranty-today" style={{ left: elapsed }} />
        <i aria-hidden="true" className="warranty-end" />
      </div>
      <div className="warranty-labels"><span>Purchased {purchasedOn}</span><span className="warranty-today-label" style={{ left: elapsed }}>Today</span><span>Expires {expiresOn}</span></div>
    </div>
  );
}

export function ListRow({ children, className = '', index, ...props }) {
  const animation = index == null ? {} : {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, delay: Math.min(index, 7) * 0.03 }
  };
  return <motion.article className={cn('reading-row', className)} {...animation} {...props}>{children}</motion.article>;
}
