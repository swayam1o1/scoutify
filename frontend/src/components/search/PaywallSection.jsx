import { Lock } from 'lucide-react';

export function PaywallSection({ totalResults, user, onRegister, onUpgrade }) {
  return (
    <div className="glass-card paywall-section animate-fade-in" style={{ marginTop: '30px', padding: '40px', position: 'relative', textAlign: 'center', overflow: 'hidden' }}>
      {/* Previews background graphic */}
      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', opacity: 0.1, filter: 'blur(5px)', pointerEvents: 'none', marginBottom: '20px', userSelect: 'none' }}>
        <div className="glass-card" style={{ width: '220px', padding: '12px' }}>
          <h4>Hidden Studio</h4>
          <p>Architectural Services</p>
        </div>
        <div className="glass-card" style={{ width: '220px', padding: '12px' }}>
          <h4>Locked Artisan</h4>
          <p>Interior Designing</p>
        </div>
      </div>

      {/* Paywall Content */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, position: 'relative' }}>
        <Lock size={36} style={{ color: 'var(--color-primary)', marginBottom: '12px' }} />
        <h3>Viewing Limits Exceeded</h3>
        <p style={{ color: 'var(--color-text-secondary)', maxWidth: '400px', margin: '8px auto 20px', fontSize: '14px' }}>
          Unlock access to remaining {totalResults - 10} verified artisans found matching this search!
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          {!user ? (
            <button className="btn btn-primary" onClick={onRegister}>
              Register to Unlock
            </button>
          ) : (
            <button className="btn btn-purple" onClick={onUpgrade}>
              Upgrade Subscription
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PaywallSection;
