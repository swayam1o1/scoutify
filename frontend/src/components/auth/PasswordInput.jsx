import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/** Password field with show/hide toggle (eye icon). */
export function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete = 'current-password',
  required = false,
  id,
  name,
  className = 'form-control'
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-input-wrap">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        className={className}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export default PasswordInput;
