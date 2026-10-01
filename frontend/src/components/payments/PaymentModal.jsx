export function PaymentModal({ order, onComplete }) {
  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="modal-content" style={{ maxWidth: '400px', border: '1px solid #1480f1', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' }}>
          <div style={{ color: 'var(--color-heading)', fontSize: '18px', fontWeight: '700', letterSpacing: '0.5px' }}>
            Razorpay Checkout
          </div>
          <span className="badge" style={{ background: '#1480f1', color: '#fff' }}>TEST MODE</span>
        </div>

        <div style={{ marginBottom: '20px', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
          <p style={{ color: 'var(--color-heading)', fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
            Scoutify Sourcing Hub
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span>Order Ref:</span>
            <span style={{ color: 'var(--color-heading)', fontFamily: 'monospace' }}>{order.orderId}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span>Plan Upgrade:</span>
            <span style={{ color: 'var(--color-heading)', textTransform: 'capitalize' }}>{order.plan}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '10px', marginTop: '10px' }}>
            <strong>Amount Due:</strong>
            <strong style={{ color: 'var(--color-primary)', fontSize: '18px' }}>
              ₹{order.amount / 100}.00
            </strong>
          </div>
        </div>

        <div style={{ background: 'var(--surface-1)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '20px', textAlign: 'center' }}>
          Select payment status to simulate the gateway response.
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1, background: '#1480f1', color: '#fff' }}
            onClick={() => onComplete(true)}
          >
            Simulate Success
          </button>
          <button
            className="btn btn-outline"
            style={{ flex: 1, borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
            onClick={() => onComplete(false)}
          >
            Simulate Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaymentModal;
