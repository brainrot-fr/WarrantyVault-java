import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/cn.js';
import { apiRequest } from '@/lib/api.js';
import { formatDate } from '@/lib/formatters.js';

export const FormStack = forwardRef(function FormStack({ children, className = '', ...props }, ref) {
  return <form noValidate className={cn('form-stack', className)} ref={ref} {...props}>{children}</form>;
});

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

export function Field({ label, hint, error, optional = false, children, className = '', as: Control = 'input', id: suppliedId, ...controlProps }) {
  const generatedId = useId().replaceAll(':', '');
  const id = suppliedId || `field-${generatedId}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [controlProps['aria-describedby'], hintId, errorId].filter(Boolean).join(' ') || undefined;
  const inputProps = {
    ...controlProps,
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? 'true' : controlProps['aria-invalid']
  };
  return (
    <div className={cn('field', className)}>
      <label htmlFor={id}>{label}{optional ? <> <span className="optional-label">(optional)</span></> : null}</label>
      {hint ? <small id={hintId}>{hint}</small> : null}
      {typeof children === 'function' ? children(inputProps) : <Control {...inputProps}>{children}</Control>}
      {error ? <small className="form-error" id={errorId} role="alert"><CircleAlert aria-hidden="true" size={15} /><span>{error}</span></small> : null}
    </div>
  );
}

export function SwitchControl({ checked, disabled = false, label, onChange, name }) {
  return (
    <label className={`switch-control${disabled ? ' is-disabled' : ''}`}>
      <span>{label}</span>
      <input checked={checked} disabled={disabled} name={name} onChange={onChange} role="switch" type="checkbox" />
      <span className="switch-track" aria-hidden="true"><span /></span>
    </label>
  );
}

export function FreeTextCombobox({ id, label, name, value, onChange, onBlur, inputRef, ref, options = [], error, placeholder, maxLength = 60 }) {
  const controlRef = inputRef || ref;
  const generatedId = useId().replaceAll(':', '');
  const inputId = id || `combobox-${generatedId}`;
  const listId = `${inputId}-options`;
  const errorId = error ? `${inputId}-error` : undefined;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const normalizedValue = String(value || '');
  const matches = [...new Set(options.filter((option) => typeof option === 'string' && option.trim()))]
    .filter((option) => option.toLocaleLowerCase().includes(normalizedValue.trim().toLocaleLowerCase()))
    .slice(0, 8);
  const hasExactMatch = options.some((option) => typeof option === 'string'
    && option.toLocaleLowerCase() === normalizedValue.trim().toLocaleLowerCase());
  const choices = [
    ...matches.map((option) => ({ label: option, value: option, custom: false })),
    ...(normalizedValue.trim() && !hasExactMatch
      ? [{ label: `Use "${normalizedValue.trim()}"`, value: normalizedValue.trim(), custom: true }]
      : [])
  ];
  const select = (nextValue) => {
    onChange({ target: { name, value: nextValue } });
    setOpen(false);
    setActiveIndex(-1);
  };
  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' && choices.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current + 1) % choices.length);
    } else if (event.key === 'ArrowUp' && choices.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current <= 0 ? choices.length - 1 : current - 1));
    } else if (event.key === 'Enter' && open && activeIndex >= 0) {
      event.preventDefault();
      select(choices[activeIndex].value);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  };
  return (
    <div className="combobox">
      <label htmlFor={inputId}>{label}</label>
      <input
        aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-describedby={errorId}
        aria-expanded={open && choices.length > 0}
        aria-invalid={error ? 'true' : undefined}
        autoComplete="off"
        id={inputId}
        maxLength={maxLength}
        name={name}
        onBlur={(event) => {
          onBlur?.(event);
          window.setTimeout(() => setOpen(false), 100);
        }}
        onChange={(event) => {
          onChange(event);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        ref={controlRef}
        role="combobox"
        value={normalizedValue}
      />
      {open && choices.length ? (
        <ul className="combobox-options" id={listId} role="listbox" aria-label={`${label} suggestions`}>
          {choices.map((option, index) => (
            <li
              aria-selected={activeIndex === index}
              className={activeIndex === index ? 'active' : ''}
              id={`${listId}-${index}`}
              key={`${option.value}-${option.custom}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(option.value)}
              role="option"
            >{option.label}</li>
          ))}
        </ul>
      ) : null}
      {error ? <small className="form-error" id={errorId} role="alert"><CircleAlert aria-hidden="true" size={15} /><span>{error}</span></small> : null}
    </div>
  );
}

function fileSize(size) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImagePicker({ label, hint, file, current = false, currentLabel = 'Current image saved', currentSize, currentProductId, currentImageType, optional = false, onSelect, onRemove, error, fieldName, accept = 'image/jpeg,image/png,image/webp', camera = true }) {
  const pickerId = useId().replaceAll(':', '');
  const errorId = error ? `${pickerId}-error` : undefined;
  const browseRef = useRef(null);
  const cameraRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState('');
  const [currentPreviewError, setCurrentPreviewError] = useState('');
  useEffect(() => {
    if (!file || typeof URL.createObjectURL !== 'function') {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (!current || !currentProductId || !currentImageType) {
      setCurrentPreviewUrl('');
      setCurrentPreviewError('');
      return undefined;
    }
    let active = true;
    let objectUrl = '';
    setCurrentPreviewUrl('');
    setCurrentPreviewError('');
    apiRequest(`/api/products/${currentProductId}/images/${currentImageType}`)
      .then((response) => response.blob())
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setCurrentPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (active) setCurrentPreviewError('The saved image preview could not be loaded.');
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [current, currentImageType, currentProductId]);
  const pick = (event) => {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (selected) onSelect(selected);
  };
  return (
    <div className="field image-picker">
      <span className="field-label">{label}{optional ? <> <span className="optional-label">(optional)</span></> : null}</span>
      {hint ? <small>{hint}</small> : null}
      <input accept={accept} aria-describedby={errorId} aria-invalid={error ? 'true' : undefined} aria-label={`${label} file`} className="sr-only" id={`${pickerId}-browse`} onChange={pick} ref={browseRef} tabIndex="-1" type="file" />
      {camera ? <input accept={accept} aria-describedby={errorId} aria-invalid={error ? 'true' : undefined} aria-label={`${label} camera`} capture="environment" className="sr-only" id={`${pickerId}-camera`} onChange={pick} ref={cameraRef} tabIndex="-1" type="file" /> : null}
      {file ? (
        <div className="image-picker-preview">
          {previewUrl ? <img src={previewUrl} alt={`Selected ${label.toLowerCase()} thumbnail`} /> : null}
          <span className="image-picker-file"><strong>{file.name}</strong><small>{fileSize(file.size)}</small></span>
          <div className="image-picker-actions">
            {camera ? <button className="text-button" onClick={() => cameraRef.current?.click()} type="button">Take another</button> : null}
            <button className="text-button" onClick={() => browseRef.current?.click()} type="button">Replace</button>
            <button className="text-button remove-link" onClick={onRemove} type="button">Remove</button>
          </div>
        </div>
      ) : current ? (
        <div className="image-picker-current">
          {currentPreviewUrl ? <img src={currentPreviewUrl} alt={`Current ${label.toLowerCase()} thumbnail`} /> : <span className="image-picker-thumbnail-placeholder" aria-hidden="true" />}
          <span className="image-picker-saved-meta"><strong>{currentLabel}</strong>{currentSize ? <small>{fileSize(currentSize)}</small> : null}</span>
          {currentPreviewError ? <small className="field-hint" role="status">{currentPreviewError}</small> : null}
          <div className="image-picker-actions">
            {camera ? <button className="text-button" onClick={() => cameraRef.current?.click()} type="button">Take photo</button> : null}
            <button className="text-button" onClick={() => browseRef.current?.click()} type="button">Replace</button>
          </div>
        </div>
      ) : (
        <div className="image-picker-empty">
          {camera ? <button aria-describedby={errorId} aria-invalid={error ? 'true' : undefined} className="button button-quiet" name={fieldName ? `${fieldName}Picker` : undefined} onClick={() => cameraRef.current?.click()} type="button">Take a photo</button> : null}
          <button aria-describedby={errorId} aria-invalid={error ? 'true' : undefined} className="button button-quiet" name={fieldName ? `${fieldName}Picker` : undefined} onClick={() => browseRef.current?.click()} type="button">Choose a photo</button>
        </div>
      )}
      {error ? <small className="form-error" id={errorId} role="alert"><CircleAlert aria-hidden="true" size={15} /><span>{error}</span></small> : null}
    </div>
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
        <div key={label}><dt>{label}</dt><dd>{value === null || value === undefined || value === '' ? 'Not set' : value}</dd></div>
      ))}
    </dl>
  );
}

export function WarrantyLine({ purchasedOn, expiresOn, progress = 0, status = 'ACTIVE' }) {
  const reducedMotion = useReducedMotion();
  const elapsed = `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`;
  const formattedPurchasedOn = formatDate(purchasedOn);
  const formattedExpiresOn = formatDate(expiresOn);
  return (
    <div className="warranty-line" aria-label={`Purchased ${formattedPurchasedOn}; coverage ends ${formattedExpiresOn}`}>
      <div className="warranty-track">
        <i aria-hidden="true" className="warranty-start" />
        <motion.span className={`warranty-progress status-${status.toLowerCase().replaceAll('_', '-')}`} initial={reducedMotion ? false : { width: 0 }} animate={{ width: elapsed }} transition={{ duration: reducedMotion ? 0 : 0.5, ease: 'easeOut' }} />
        <i aria-label="Today" className="warranty-today" style={{ left: elapsed }} />
        <i aria-hidden="true" className="warranty-end" />
      </div>
      <div className="warranty-labels"><span>Purchased {formattedPurchasedOn}</span><span className="warranty-today-label" style={{ left: elapsed }}>Today</span><span>Expires {formattedExpiresOn}</span></div>
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
