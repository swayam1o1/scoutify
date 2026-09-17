import { RefreshCw } from 'lucide-react';

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

  return (
    <div className="glass-card" style={{ marginBottom: '20px' }}>
      <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Consumer Subscriptions</h3>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {['basic', 'pro', 'enterprise'].map(plan => (
          <div key={plan} style={{ minWidth: '100px' }}>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>{plan}</div>
            <div style={{ fontSize: '22px', fontWeight: 600 }}>{subscriptions[plan] || 0}</div>
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
      background: error ? 'rgba(239,68,68,0.15)' : 'rgba(20,241,149,0.15)',
      border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-primary)'}`,
      color: error ? '#fca5a5' : '#a7f3d0',
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
  const { vendors, statusFilter, setStatusFilter, setVendorStatus, deleteVendor, loading } = admin;

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        <h3 style={{ margin: 0 }}>Vendor Listings</h3>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map(status => (
            <button
              key={status}
              className={`btn ${statusFilter === status ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '12px', textTransform: 'capitalize', color: statusFilter === status ? '#000' : undefined }}
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {loading && vendors.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>Loading listings…</p>
      ) : vendors.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>No listings with this status.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '460px', overflowY: 'auto' }}>
          {vendors.map(vendor => (
            <div key={vendor._id} className="glass-card" style={{ padding: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                <div>
                  <strong style={{ fontSize: '15px' }}>{vendor.companyName}</strong>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    {[vendor.city, vendor.personOfContact, vendor.phoneNumber, vendor.email].filter(Boolean).join(' · ') || 'No contact details'}
                  </div>
                  {vendor.specialization?.length > 0 && (
                    <div className="artisan-specializations" style={{ marginTop: '6px' }}>
                      {vendor.specialization.map((spec, i) => (
                        <span key={i} className="spec-tag">{spec}</span>
                      ))}
                    </div>
                  )}
                </div>
                <span className={`badge ${['approved', 'verified'].includes(vendor.contactStatus) ? '' : 'badge-purple'}`} style={{ fontSize: '10px', whiteSpace: 'nowrap' }}>
                  {vendor.contactStatus?.toUpperCase()}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  style={{ padding: '6px 12px', fontSize: '12px', color: '#000' }}
                  onClick={() => setVendorStatus(vendor._id, 'approved')}
                >
                  Approve
                </button>
                <button
                  className="btn btn-outline"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  onClick={() => setVendorStatus(vendor._id, 'rejected')}
                >
                  Reject
                </button>
                <button
                  className="btn btn-outline"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  onClick={() => setVendorStatus(vendor._id, 'pending')}
                >
                  Mark Pending
                </button>
                <button
                  className="btn btn-outline"
                  style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                  onClick={() => deleteVendor(vendor._id)}
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
            <label className="form-label">City</label>
            <input type="text" className="form-control" value={newVendor.city} onChange={setField('city')} />
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

        <div className="grid-container grid-2">
          <div className="form-group">
            <label className="form-label">Person of Contact</label>
            <input type="text" className="form-control" value={newVendor.personOfContact} onChange={setField('personOfContact')} />
          </div>
          <div className="form-group">
            <label className="form-label">Listing Status</label>
            <select className="form-control form-select" value={newVendor.status} onChange={setField('status')}>
              <option value="approved">Approved (visible in search)</option>
              <option value="pending">Pending review</option>
            </select>
          </div>
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
            <div key={consumer._id} className="glass-card" style={{ padding: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
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
    </div>
  );
}

export default AdminView;
