import { Briefcase, Lock, Sparkles, User as UserIcon } from 'lucide-react';

// Floating YC judge demo console: one-click personas and scripted workflows.
export function DemoHud({ isCollapsed, setIsCollapsed, onDemoLogin, onPaywallDemo, onAiDemo }) {
  return (
    <div className={`yc-hud ${isCollapsed ? 'collapsed' : ''}`} onClick={isCollapsed ? () => setIsCollapsed(false) : undefined}>
      {isCollapsed ? (
        <Sparkles size={24} style={{ color: 'var(--color-primary)' }} />
      ) : (
        <>
          <div className="yc-hud-header">
            <h3><Sparkles size={16} /> YC Demo Console</h3>
            <button className="yc-hud-close-btn" onClick={(e) => { e.stopPropagation(); setIsCollapsed(true); }}>
              [Collapse]
            </button>
          </div>

          <div className="yc-hud-section">
            <div className="yc-hud-section-title">Instant Personas</div>
            <div className="yc-hud-grid">
              <button className="yc-hud-btn" onClick={() => onDemoLogin('client_basic')}>
                <UserIcon size={14} style={{ color: 'var(--color-primary)' }} />
                Login as Client Basic
              </button>
              <button className="yc-hud-btn" onClick={() => onDemoLogin('client_pro')}>
                <UserIcon size={14} style={{ color: '#c084fc' }} />
                Login as Client Pro
              </button>
              <button className="yc-hud-btn" onClick={() => onDemoLogin('artisan')}>
                <Briefcase size={14} style={{ color: '#14f195' }} />
                Login as Artisan
              </button>
            </div>
          </div>

          <div className="yc-hud-section">
            <div className="yc-hud-section-title">Automated Workflows</div>
            <div className="yc-hud-grid">
              <button className="yc-hud-btn" onClick={onPaywallDemo}>
                <Lock size={14} style={{ color: 'var(--color-warning)' }} />
                Trigger Sourcing Paywall
              </button>
              <button className="yc-hud-btn yc-hud-btn-purple" onClick={onAiDemo}>
                <Sparkles size={14} style={{ color: '#c084fc' }} />
                Run AI Matchmaker
              </button>
            </div>
          </div>

          <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: '10px', borderTop: '1px dashed rgba(255,255,255,0.05)', paddingTop: '6px' }}>
            One-click testing helper for YC reviewers
          </div>
        </>
      )}
    </div>
  );
}

export default DemoHud;
