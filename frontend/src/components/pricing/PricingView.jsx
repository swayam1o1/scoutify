import { Check, Lock } from 'lucide-react';

export function PricingView({ onStartFreeSearch, onUpgradeClick }) {
  return (
    <div className="pricing-section animate-fade-in">
      <div className="pricing-header">
        <h2>Select Your Membership Tier</h2>
        <p>Find local artisans, build partnerships, and contract seamlessly with no middleman margins.</p>
      </div>

      <div className="pricing-grid">
        {/* Basic */}
        <div className="pricing-card">
          <div className="plan-name">Basic Searcher</div>
          <div className="plan-price">₹0 <span>/ lifetime</span></div>
          <div className="plan-desc">For individual clients starting with basic discovery.</div>
          <ul className="plan-features">
            <li><Check size={16} /> 10 free search views</li>
            <li><Check size={16} /> Basic location filters</li>
            <li style={{ color: 'var(--color-text-secondary)', textDecoration: 'line-through' }}><Lock size={12} /> Unlimited results</li>
            <li style={{ color: 'var(--color-text-secondary)', textDecoration: 'line-through' }}><Lock size={12} /> Priority email support</li>
          </ul>
          <button className="btn btn-secondary" onClick={onStartFreeSearch}>
            Start Free Search
          </button>
        </div>

        {/* Pro */}
        <div className="pricing-card popular">
          <div className="popular-badge">Recommended</div>
          <div className="plan-name" style={{ color: 'var(--color-primary)' }}>Pro Directory</div>
          <div className="plan-price">₹999 <span>/ month</span></div>
          <div className="plan-desc">For architects, designers, and firms with regular sourcing needs.</div>
          <ul className="plan-features">
            <li><Check size={16} /> Unlimited search lookups</li>
            <li><Check size={16} /> Full contact details unlocked</li>
            <li><Check size={16} /> OTP & 2FA security features</li>
            <li><Check size={16} /> Sync multiple locations</li>
          </ul>
          <button className="btn btn-primary" onClick={() => onUpgradeClick('pro')}>
            Upgrade to Pro
          </button>
        </div>

        {/* Enterprise */}
        <div className="pricing-card">
          <div className="plan-name" style={{ color: 'var(--color-secondary)' }}>Enterprise API</div>
          <div className="plan-price">₹4,999 <span>/ month</span></div>
          <div className="plan-desc">Corporate account for developers, bulk inquiries, and data sync.</div>
          <ul className="plan-features">
            <li><Check size={16} /> Everything in Pro plan</li>
            <li><Check size={16} /> Export to Excel / CSV format</li>
            <li><Check size={16} /> Bulk messaging integration</li>
            <li><Check size={16} /> Dedicated client success rep</li>
          </ul>
          <button className="btn btn-purple" onClick={() => onUpgradeClick('enterprise')}>
            Get Enterprise
          </button>
        </div>
      </div>
    </div>
  );
}

export default PricingView;
