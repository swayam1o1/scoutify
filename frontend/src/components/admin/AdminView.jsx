import { Eye, RefreshCw } from 'lucide-react';
import { VendorDetailModal } from './VendorDetailModal.jsx';
import { isLiveStatus } from './vendorStatus';

const STATUS_FILTERS = ['pending', 'approved', 'rejected', 'verified', 'all'];

const STAT_CARDS = [
  { key: 'consumers', label: 'Consumers' },
  { key: 'vendors', label: 'Vendor Accounts' },
  { key: 'artisansPublic', label: 'Listings In Search' },
  { key: 'pendingApprovals', label: 'Pending Approvals' },
  { key: 'rejected', label: 'Rejected Listings' },
  { key: 'suspended', label: 'Suspended Users' },
  { key: 'deleted', label: 'Deleted Users' },
  { key: 'totalArtisans', label: 'Total Listings' }
];

function SubscriptionStats({ subscriptions }) {
  if (!subscriptions) return null;

  const basic = subscriptions.basic || 0;
  const pro = subscriptions.pro || 0;
  const enterprise = subscriptions.enterprise || 0;
  const paid = pro + enterprise;

  return (
    <div className="glass-card" style={{ marginBottom: '20px' }}>
      <h3 style={{ marginBottom: '6px', fontSize: '16px' }}>Plans taken by consumers</h3>
      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '14px' }}>
        How many signed-up clients are on each membership tier (not a credits wallet).
      </p>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div style={{ minWidth: '120px', padding: '10px 14px', borderRadius: '10px', background: 'var(--surface-3)' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Paid plans taken</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-primary)' }}>{paid}</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Pro + Enterprise</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {[
          { key: 'basic', label: 'Basic (free)', value: basic },
          { key: 'pro', label: 'Pro', value: pro },
          { key: 'enterprise', label: 'Enterprise', value: enterprise }
        ].map(plan => (
          <div key={plan.key} style={{ minWidth: '100px' }}>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{plan.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 600 }}>{plan.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Feedback({ message, error }) {
  if (!message && !error) return null;

  return (
    <div style={{
      background: error ? 'var(--tone-danger-bg)' : 'var(--tone-success-bg)',
      border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-primary)'}`,
      color: error ? 'var(--tone-danger-text)' : 'var(--tone-success-text)',
      padding: '10px 12px',
      borderRadius: '8px',
      fontSize: '13px',
      marginBottom: '16px'
    }}>
      {error || message}
    </div>
  );
}

function AdminLoginScreen({ admin }) {
  const { loginForm, setLoginForm, loginError, loginBusy, adminLogin } = admin;

  return (
    <div className="dashboard-container animate-fade-in" style={{ maxWidth: '440px' }}>
      <div className="glass-card">
        <h2 style={{ marginBottom: '6px' }}>Scoutify Admin</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
          Internal console. Admin accounts only.
        </p>

        <Feedback error={loginError} />

        <form onSubmit={adminLogin}>
          <div className="form-group">
            <label className="form-label">Admin Email</label>
            <input
              type="email"
              className="form-control"
              value={loginForm.email}
              onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              value={loginForm.password}
              onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loginBusy} style={{ width: '100%' }}>
            {loginBusy ? 'Signing in…' : 'Sign In To Console'}
          </button>
        </form>
      </div>
    </div>
  );
}

function StatsGrid({ stats }) {
  if (!stats) return null;

  return (
    <div className="grid-container grid-2 grid-4" style={{ marginBottom: '20px' }}>
      {STAT_CARDS.map(card => (
        <div key={card.key} className="glass-card" style={{ padding: '16px' }}>
          <span style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)' }}>{card.label}</span>
          <strong style={{ fontSize: '24px' }}>{stats[card.key] ?? 0}</strong>
        </div>
      ))}
    </div>
  );
}

function VendorModerationPanel({ admin }) {
  const { vendors, statusFilter, setStatusFilter, setVendorStatus, deleteVendor, openVendorDetail, loading } = admin;
  // Skip shell / incomplete rows that have no company name (look like an empty card).
  const visibleVendors = vendors.filter(v => String(v.companyName || '').trim());

  return (
    <div className="glass-card admin-vendor-panel">
      <div className="admin-vendor-panel-header">
        <h3>Vendor Listings</h3>
        <div className="admin-status-filters">
          {STATUS_FILTERS.map(status => (
            <button
              key={status}
              type="button"
              className={`btn ${statusFilter === status ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {loading && visibleVendors.length === 0 ? (
        <p className="admin-panel-empty">Loading listings…</p>
      ) : visibleVendors.length === 0 ? (
        <p className="admin-panel-empty">No listings with this status.</p>
      ) : (
        <div className="admin-vendor-list">
          {visibleVendors.map(vendor => {
            const isFirm = (vendor.vendorType || vendor.verification?.vendorType) === 'firm';
            const isLight = vendor.verification?.verificationTier === 'light' || isFirm;
            const missing = vendor.verification && !vendor.verification.readyForReview
              ? vendor.verification.missingRequired
              : [];
            const changeNote = vendor.isFirstSubmission
              ? 'New listing'
              : [
                vendor.changeCount > 0 && `${vendor.changeCount} change${vendor.changeCount === 1 ? '' : 's'}`,
                vendor.newCatalogueCount > 0 && `${vendor.newCatalogueCount} new product${vendor.newCatalogueCount === 1 ? '' : 's'}`
              ].filter(Boolean).join(' · ');

            return (
              <article key={vendor._id} className="admin-vendor-card">
                <div className="admin-vendor-card-top">
                  <div className="admin-vendor-card-main">
                    <h4 className="admin-vendor-name">{vendor.companyName}</h4>
                    <p className="admin-vendor-meta">
                      {[vendor.city, vendor.personOfContact, vendor.phoneNumber, vendor.email].filter(Boolean).join(' · ') || 'No contact details'}
                    </p>
                  </div>
                  <div className="admin-vendor-badges">
                    <span className={`badge ${isLiveStatus(vendor.contactStatus) ? '' : 'badge-purple'}`}>
                      {vendor.contactStatus?.toUpperCase()}
                    </span>
                    <span className={`badge admin-tier-badge ${isLight ? 'is-light' : 'is-strict'}`}>
                      {isFirm ? 'Firm · Light' : 'Individual · Strict'}
                    </span>
                    {changeNote && (
                      <span className={`admin-vendor-note ${vendor.isFirstSubmission ? 'is-new' : 'is-changed'}`}>
                        {changeNote}
                      </span>
                    )}
                  </div>
                </div>

                {vendor.specialization?.length > 0 && (
                  <div className="admin-vendor-tags">
                    {vendor.specialization.map((spec, i) => (
                      <span key={i} className="spec-tag">{spec}</span>
                    ))}
                  </div>
                )}

                {missing.length > 0 && (
                  <div className="admin-vendor-missing" title={missing.join(', ')}>
                    <span className="admin-vendor-missing-label">Missing for review</span>
                    <span className="admin-vendor-missing-list">{missing.join(' · ')}</span>
                  </div>
                )}

                <div className="admin-vendor-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => openVendorDetail(vendor._id)}>
                    <Eye size={14} /> View Details
                  </button>
                  {!isLiveStatus(vendor.contactStatus) && (
                    <button type="button" className="btn btn-primary" onClick={() => setVendorStatus(vendor._id, 'approved', vendor)}>
                      Approve
                    </button>
                  )}
                  {vendor.contactStatus !== 'rejected' && (
                    <button type="button" className="btn btn-outline" onClick={() => setVendorStatus(vendor._id, 'rejected')}>
                      Reject
                    </button>
                  )}
                  {vendor.contactStatus !== 'pending' && (
                    <button type="button" className="btn btn-outline" onClick={() => setVendorStatus(vendor._id, 'pending')}>
                      Mark Pending
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline admin-vendor-delete"
                    onClick={() => deleteVendor(vendor._id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateVendorPanel({ admin }) {
  const { newVendor, setNewVendor, createVendor } = admin;

  const setField = (field) => (event) => setNewVendor({ ...newVendor, [field]: event.target.value });

  return (
    <div className="glass-card">
      <h3 style={{ marginBottom: '14px' }}>Add Vendor Manually</h3>
      <form onSubmit={createVendor}>
        <div className="grid-container grid-2">
          <div className="form-group">
            <label className="form-label">Company Name</label>
            <input type="text" className="form-control" value={newVendor.companyName} onChange={setField('companyName')} required />
          </div>
          <div className="form-group">
            <label className="form-label">Vendor type</label>
            <select className="form-control form-select" value={newVendor.vendorType || 'individual'} onChange={setField('vendorType')}>
              <option value="individual">Individual (strict)</option>
              <option value="firm">Firm (light)</option>
            </select>
          </div>
        </div>

        <div className="grid-container grid-2">
          <div className="form-group">
            <label className="form-label">City</label>
            <input type="text" className="form-control" value={newVendor.city} onChange={setField('city')} />
          </div>
          <div className="form-group">
            <label className="form-label">Person of Contact</label>
            <input type="text" className="form-control" value={newVendor.personOfContact} onChange={setField('personOfContact')} />
          </div>
        </div>

        <div className="grid-container grid-2">
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input type="text" className="form-control" value={newVendor.phoneNumber} onChange={setField('phoneNumber')} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-control" value={newVendor.email} onChange={setField('email')} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Listing Status</label>
          <select className="form-control form-select" value={newVendor.status} onChange={setField('status')}>
            <option value="approved">Approved (visible in search)</option>
            <option value="pending">Pending review</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Specializations (comma separated)</label>
          <input
            type="text"
            className="form-control"
            placeholder="Architectural, Painting, Lighting..."
            value={newVendor.specialization}
            onChange={setField('specialization')}
          />
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
          Create Listing
        </button>
      </form>
    </div>
  );
}

function ConsumerPanel({ admin }) {
  const { consumers, setConsumerSuspended, deleteConsumer } = admin;

  return (
    <div className="glass-card">
      <h3 style={{ marginBottom: '14px' }}>Consumer Accounts</h3>
      {consumers.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>No consumer accounts yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '460px', overflowY: 'auto' }}>
          {consumers.map(consumer => (
            <div key={consumer._id} className="glass-card" style={{ padding: '14px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                <div>
                  <strong style={{ fontSize: '15px' }}>{consumer.name}</strong>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', wordBreak: 'break-all' }}>{consumer.email}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    Plan: {consumer.subscriptionPlan?.toUpperCase() || 'BASIC'}
                    {consumer.clientProfile?.type ? ` · ${consumer.clientProfile.type}` : ''}
                  </div>
                </div>
                {consumer.isSuspended && (
                  <span className="badge badge-purple" style={{ fontSize: '10px' }}>SUSPENDED</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-outline"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  onClick={() => setConsumerSuspended(consumer._id, !consumer.isSuspended)}
                >
                  {consumer.isSuspended ? 'Reinstate' : 'Suspend'}
                </button>
                <button
                  className="btn btn-outline"
                  style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                  onClick={() => deleteConsumer(consumer._id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditLogPanel({ auditLogs }) {
  return (
    <div className="glass-card">
      <h3 style={{ marginBottom: '14px' }}>Recent Admin Activity</h3>
      {auditLogs.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>No admin actions recorded yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto', fontSize: '13px' }}>
          {auditLogs.map(log => (
            <div key={log.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <strong>{log.action}</strong>
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {' '}· {log.actor?.email || 'system'} · {new Date(log.createdAt).toLocaleString()}
              </span>
              {log.meta && (
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                  {Object.entries(log.meta).map(([key, value]) => `${key}: ${value}`).join(' · ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminView({ admin }) {
  if (!admin.isAdmin) {
    return <AdminLoginScreen admin={admin} />;
  }

  return (
    <div className="dashboard-container animate-fade-in">
      <div className="dashboard-header">
        <div>
          <h2>Admin Console</h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Approve vendor listings, manage consumer accounts, and review activity.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={admin.loadConsole} disabled={admin.loading}>
          <RefreshCw size={16} /> {admin.loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <Feedback message={admin.message} error={admin.error} />
      <StatsGrid stats={admin.stats} />
      <SubscriptionStats subscriptions={admin.stats?.subscriptions} />

      <div className="grid-container grid-2">
        <VendorModerationPanel admin={admin} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <CreateVendorPanel admin={admin} />
          <ConsumerPanel admin={admin} />
          <AuditLogPanel auditLogs={admin.auditLogs} />
        </div>
      </div>

      <VendorDetailModal admin={admin} />
    </div>
  );
}

export default AdminView;
