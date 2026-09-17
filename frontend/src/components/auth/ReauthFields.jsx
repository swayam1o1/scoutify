/**
 * Re-auth inputs for sensitive actions.
 * Shows password / TOTP / email OTP depending on the signed-in user.
 */
export function ReauthFields({
  user,
  values,
  onChange,
  onRequestEmailCode,
  emailCodeBusy,
  compact = false
}) {
  if (!user) return null;

  const gap = compact ? '8px' : '10px';
  const set = (field) => (e) => onChange({ ...values, [field]: e.target.value });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, marginBottom: compact ? '10px' : '12px' }}>
      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
        Confirm it&apos;s you before continuing.
      </p>

      {user.hasPassword !== false && (
        <input
          type="password"
          className="form-control"
          placeholder="Current password"
          autoComplete="current-password"
          value={values.currentPassword || ''}
          onChange={set('currentPassword')}
          required={user.hasPassword !== false}
        />
      )}

      {user.twoFactorEnabled && (
        <input
          type="text"
          className="form-control"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Authenticator 6-digit code"
          value={values.totpCode || ''}
          onChange={set('totpCode')}
          required
        />
      )}

      {user.hasPassword === false && !user.twoFactorEnabled && (
        <>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="form-control"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Email re-auth code"
              value={values.emailOtp || ''}
              onChange={set('emailOtp')}
              required
            />
            <button
              type="button"
              className="btn btn-outline"
              disabled={emailCodeBusy}
              onClick={onRequestEmailCode}
              style={{ whiteSpace: 'nowrap', fontSize: '12px', padding: '8px 10px' }}
            >
              Send code
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function emptyReauth() {
  return { currentPassword: '', totpCode: '', emailOtp: '' };
}

export default ReauthFields;
