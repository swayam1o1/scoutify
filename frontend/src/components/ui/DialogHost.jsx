import { useEffect, useRef, useState } from 'react';
import { closeDialog, subscribeDialogs } from './dialog';

const DEFAULT_TITLES = { info: 'Notice', success: 'Success', error: 'Something went wrong' };
const ICONS = { info: 'ℹ', success: '✓', error: '!' };

export function DialogHost() {
  const [queue, setQueue] = useState([]);
  const primaryRef = useRef(null);
  const dialog = queue[0];

  useEffect(() => subscribeDialogs(setQueue), []);

  useEffect(() => {
    if (!dialog) return undefined;
    primaryRef.current?.focus();
    const dismissValue = dialog.type === 'confirm' ? false : undefined;
    const onKey = event => {
      if (event.key === 'Escape') closeDialog(dialog.id, dismissValue);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog]);

  if (!dialog) return null;

  const isConfirm = dialog.type === 'confirm';
  const dismiss = () => closeDialog(dialog.id, isConfirm ? false : undefined);

  return (
    <div className="modal-overlay modal-overlay-centered app-dialog-overlay" onMouseDown={dismiss}>
      <div
        className={`app-dialog app-dialog-${dialog.tone}`}
        role={isConfirm ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={`app-dialog-title-${dialog.id}`}
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="app-dialog-header">
          <span className="app-dialog-icon" aria-hidden="true">{ICONS[dialog.tone] || ICONS.info}</span>
          <h3 id={`app-dialog-title-${dialog.id}`}>{dialog.title || DEFAULT_TITLES[dialog.tone]}</h3>
        </div>
        <p className="app-dialog-message">{dialog.message}</p>
        <div className="app-dialog-actions">
          {isConfirm && (
            <button type="button" className="btn btn-secondary" onClick={dismiss}>
              {dialog.cancelLabel}
            </button>
          )}
          <button
            ref={primaryRef}
            type="button"
            className={`btn ${isConfirm && dialog.danger ? 'btn-danger-solid' : 'btn-primary'}`}
            onClick={() => closeDialog(dialog.id, isConfirm ? true : undefined)}
          >
            {isConfirm ? dialog.confirmLabel : dialog.okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DialogHost;
