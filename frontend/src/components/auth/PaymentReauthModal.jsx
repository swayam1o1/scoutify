import { ReauthFields } from './ReauthFields.jsx';

export function PaymentReauthModal({
  open,
  user,
  plan,
  reauthForm,
  setReauthForm,
  reauthError,
  reauthBusy,
  emailCodeBusy,
  onRequestEmailCode,
  onSubmit,
  onCancel
}) {
  if (!open || !user) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 2100 }}>
      <div className="modal-content" style={{ maxWidth: '420px' }}>
        <h3 style={{ marginBottom: '8px' }}>Confirm upgrade</h3>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '14px' }}>
          Re-authenticate to change your subscription to <strong style={{ color: '#fff' }}>{plan}</strong>.
        </p>
        {reauthError && (
          <div style={{
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid var(--color-danger)',
            color: '#fca5a5',
            padding: '10px 12px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '12px'
          }}>
            {reauthError}
          </div>
        )}
        <form onSubmit={onSubmit}>
          <ReauthFields
            user={user}
            values={reauthForm}
            onChange={setReauthForm}
            onRequestEmailCode={onRequestEmailCode}
            emailCodeBusy={emailCodeBusy}
          />
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" className="btn btn-primary" disabled={reauthBusy} style={{ flex: 1, color: '#000' }}>
              Continue to payment
            </button>
            <button type="button" className="btn btn-outline" disabled={reauthBusy} onClick={onCancel} style={{ flex: 1 }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PaymentReauthModal;
