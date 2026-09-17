import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Dark-theme dropdown that avoids native OS select menus
 * (Windows often renders a broken white popup).
 */
export function DarkSelect({ label, value, onChange, options, required = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listId = useId();
  const selected = options.find(opt => opt.value === value) || options[0];

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="form-group dark-select" ref={rootRef}>
      {label && (
        <label className={`form-label${required ? ' required' : ''}`}>
          {label}
        </label>
      )}
      <button
        type="button"
        className={`form-control dark-select-trigger ${open ? 'is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(v => !v)}
      >
        <span>{selected?.label || 'Select…'}</span>
        <ChevronDown size={16} />
      </button>

      {/* Keep a hidden input so HTML5 required still works inside forms */}
      <input type="hidden" value={value || ''} required={required} readOnly />

      {open && (
        <ul className="dark-select-menu" role="listbox" id={listId}>
          {options.map(opt => (
            <li key={opt.value}>
              <button
                type="button"
                role="option"
                aria-selected={opt.value === value}
                className={`dark-select-option ${opt.value === value ? 'is-selected' : ''}`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default DarkSelect;
