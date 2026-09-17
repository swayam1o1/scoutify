import { Plus, Trash } from 'lucide-react';

function TwoFactorPanel({ user, auth }) {
  const {
    totpQr,
    totpManualKey,
    totpSetupCode,
    setTotpSetupCode,
    totpDisableCode,
    setTotpDisableCode,
    totpBusy,
    startTotpSetup,
    confirmTotpEnable,
    disableTotp,
    cancelTotpSetup
  } = auth;

  return (
    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '10px' }}>
      <h4 style={{ fontSize: '15px', marginBottom: '10px' }}>Google Authenticator (2FA)</h4>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
        After password, login needs the 6-digit code from the Google Authenticator app on your phone. No SMS.
      </p>
      {user.twoFactorEnabled ? (
        <form onSubmit={disableTotp}>
          <label className="form-label">Current app code to disable</label>
          <input
            type="text"
            className="form-control"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            value={totpDisableCode}
            onChange={e => setTotpDisableCode(e.target.value)}
            required
            style={{ marginBottom: '10px' }}
          />
          <button type="submit" className="btn btn-outline" disabled={totpBusy} style={{ width: '100%', fontSize: '13px', padding: '8px' }}>
            Disable Authenticator
          </button>
        </form>
      ) : totpQr ? (
        <form onSubmit={confirmTotpEnable}>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '10px' }}>
            1. Install Google Authenticator. 2. Scan this QR. 3. Enter the code the app shows.
          </p>
          <img src={totpQr} alt="Authenticator QR code" style={{ width: '180px', height: '180px', background: '#fff', borderRadius: '8px', display: 'block', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', wordBreak: 'break-all', marginBottom: '10px' }}>
            Or type this key in the app: {totpManualKey}
          </p>
          <input
            type="text"
            className="form-control"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code from the app"
            value={totpSetupCode}
            onChange={e => setTotpSetupCode(e.target.value)}
            required
            style={{ marginBottom: '10px' }}
          />
          <button type="submit" className="btn btn-primary" disabled={totpBusy} style={{ width: '100%', fontSize: '13px', padding: '8px', color: '#000', marginBottom: '8px' }}>
            Confirm and enable
          </button>
          <button type="button" className="btn btn-outline" disabled={totpBusy} style={{ width: '100%', fontSize: '13px', padding: '8px' }} onClick={cancelTotpSetup}>
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" className="btn btn-primary" disabled={totpBusy} onClick={startTotpSetup} style={{ width: '100%', fontSize: '13px', padding: '8px', color: '#000' }}>
          Set up Google Authenticator
        </button>
      )}
    </div>
  );
}

function ArtisanListingForm({ auth }) {
  const { profileForm, setProfileForm, newPortfolioLink, setNewPortfolioLink, handleArtisanProfileSave } = auth;

  return (
    <div className="glass-card">
      <h3 style={{ marginBottom: '16px' }}>Public Directory Listing</h3>
      <form onSubmit={handleArtisanProfileSave}>
        <div className="grid-container grid-2">
          <div className="form-group">
            <label className="form-label">Company Name</label>
            <input
              type="text"
              className="form-control"
              value={profileForm.companyName}
              onChange={e => setProfileForm({ ...profileForm, companyName: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input
              type="text"
              className="form-control"
              value={profileForm.phoneNumber}
              onChange={e => setProfileForm({ ...profileForm, phoneNumber: e.target.value })}
            />
          </div>
        </div>

        <div className="grid-container grid-2">
          <div className="form-group">
            <label className="form-label">Instagram Handle</label>
            <input
              type="text"
              className="form-control"
              placeholder="@studio_name"
              value={profileForm.instagram}
              onChange={e => setProfileForm({ ...profileForm, instagram: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Listing City</label>
            <input
              type="text"
              className="form-control"
              value={profileForm.city}
              onChange={e => setProfileForm({ ...profileForm, city: e.target.value })}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Person of Contact</label>
          <input
            type="text"
            className="form-control"
            value={profileForm.personOfContact}
            onChange={e => setProfileForm({ ...profileForm, personOfContact: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Specializations (comma separated)</label>
          <input
            type="text"
            className="form-control"
            placeholder="Architectural Services, Interior Styling, Contracting..."
            value={profileForm.specialization.join(', ')}
            onChange={e => setProfileForm({ ...profileForm, specialization: e.target.value.split(',').map(s => s.trim()) })}
          />
        </div>

        <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '20px' }}>
          <label className="form-label">Portfolio Items / Website Links</label>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
            <input
              type="url"
              className="form-control"
              placeholder="https://behance.net/my-project"
              value={newPortfolioLink}
              onChange={e => setNewPortfolioLink(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                if (newPortfolioLink) {
                  setProfileForm({
                    ...profileForm,
                    portfolio: [...profileForm.portfolio, newPortfolioLink]
                  });
                  setNewPortfolioLink('');
                }
              }}
            >
              <Plus size={16} /> Add
            </button>
          </div>

          <div className="portfolio-list">
            {profileForm.portfolio.map((link, idx) => (
              <div key={idx} className="portfolio-item">
                <span style={{ fontSize: '13px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '350px' }}>
                  {link}
                </span>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: '4px 8px', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                  onClick={() => {
                    setProfileForm({
                      ...profileForm,
                      portfolio: profileForm.portfolio.filter((_, i) => i !== idx)
                    });
                  }}
                >
                  <Trash size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '20px' }}>
          Save Listing Details
        </button>
      </form>
    </div>
  );
}

function ClientPortalPanel({ auth, boards }) {
  const { profileForm } = auth;
  const {
    boards: boardList,
    activeBoardId,
    setActiveBoardId,
    newBoardName,
    setNewBoardName,
    createBoard,
    deleteBoard,
    removeVendorFromBoard
  } = boards;

  const activeBoard = boardList.find(b => b._id === activeBoardId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="glass-card">
        <h3 style={{ marginBottom: '14px' }}>Client Profile Details</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="grid-container grid-2">
            <div className="glass-card" style={{ padding: '16px' }}>
              <span style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)' }}>User Type</span>
              <strong style={{ fontSize: '16px', textTransform: 'capitalize' }}>
                {profileForm.clientType || 'Interior Designer'}
              </strong>
            </div>
            <div className="glass-card" style={{ padding: '16px' }}>
              <span style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)' }}>Planned Sourcing Purpose</span>
              <strong style={{ fontSize: '16px', textTransform: 'capitalize' }}>
                {profileForm.plannedUse || 'Contractor Hiring'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>My Project Boards</h3>
          {activeBoardId ? (
            <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setActiveBoardId(null)}>
              ← Back to Boards
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="New Board Name..."
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                style={{ padding: '6px 12px', fontSize: '12px', height: 'auto', width: '160px' }}
              />
              <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px', color: '#000' }} onClick={() => createBoard(newBoardName)}>
                + Create
              </button>
            </div>
          )}
        </div>

        {activeBoardId ? (
          <div>
            {!activeBoard ? (
              <p>Board not found.</p>
            ) : (
              <div>
                <h4 style={{ marginBottom: '16px', fontSize: '16px', color: 'var(--color-primary)' }}>
                  Folder: {activeBoard.name} ({activeBoard.vendors?.length || 0} vendors saved)
                </h4>
                {(!activeBoard.vendors || activeBoard.vendors.length === 0) ? (
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                    No vendors saved in this board yet. Go to search to add some!
                  </p>
                ) : (
                  <div className="grid-container grid-2">
                    {activeBoard.vendors.map(vendor => (
                      <div key={vendor._id} className="glass-card animate-fade-in" style={{ padding: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                          <h5 style={{ margin: 0, fontSize: '15px', color: '#fff' }}>{vendor.companyName}</h5>
                          <button
                            className="btn btn-outline"
                            style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--color-danger)', borderColor: 'rgba(255,75,75,0.2)' }}
                            onClick={() => removeVendorFromBoard(activeBoard._id, vendor._id)}
                          >
                            Remove
                          </button>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div>📍 {vendor.city}</div>
                          <div>📞 {vendor.phoneNumber || 'Hidden'}</div>
                          <div>✉️ {vendor.email || 'Hidden'}</div>
                        </div>
                        {vendor.phoneNumber && (
                          <a
                            href={`https://wa.me/91${vendor.phoneNumber.split('/')[0].replace(/[^0-9]/g, '')}?text=Hi%20${encodeURIComponent(vendor.personOfContact || vendor.companyName)},%20we%20saved%20your%20profile%20on%20Scoutify%20and%20would%20like%20to%20discuss%20our%20project%20board%20"${encodeURIComponent(activeBoard.name)}".`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '12px', marginTop: '12px', width: '100%', background: '#25D366', color: '#fff', border: 'none', justifyContent: 'center', fontWeight: '500' }}
                          >
                            WhatsApp Sourcing Chat
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div>
            {boardList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                You have no project boards. Create one above to start organizing sourcing vendors!
              </div>
            ) : (
              <div className="boards-grid">
                {boardList.map(board => (
                  <div key={board._id} className="board-card" onClick={() => setActiveBoardId(board._id)}>
                    <button
                      className="board-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteBoard(board._id);
                      }}
                      title="Delete board"
                    >
                      ✕
                    </button>
                    <div className="board-card-title">📁 {board.name}</div>
                    <div className="board-card-meta">
                      {board.vendors?.length || 0} Vendors Saved
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function DashboardView({ user, auth, boards }) {
  return (
    <div className="dashboard-container animate-fade-in">
      <div className="dashboard-header">
        <div>
          <h2>{user.role === 'artisan' ? 'Artisan Sourcing Portal' : 'Client User Portal'}</h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>Manage account parameters and configurations.</p>
        </div>
        {user.role === 'client' && (
          <span className="badge badge-purple" style={{ fontSize: '14px', padding: '6px 16px' }}>
            Plan: {user.subscriptionPlan.toUpperCase()}
          </span>
        )}
      </div>

      <div className="dashboard-grid">
        {/* Left sidebar: general details */}
        <div className="glass-card">
          <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '14px' }}>
            Account Info
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '15px' }}>
            <div>
              <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '13px' }}>Member Name</span>
              <strong>{user.name}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '13px' }}>Account Role</span>
              <strong style={{ textTransform: 'capitalize' }}>{user.role}</strong>
            </div>

            {(user.role === 'client' || user.role === 'artisan') && (
              <TwoFactorPanel user={user} auth={auth} />
            )}
          </div>
        </div>

        {/* Right content: profile forms */}
        {user.role === 'artisan' ? (
          <ArtisanListingForm auth={auth} />
        ) : (
          <ClientPortalPanel auth={auth} boards={boards} />
        )}
      </div>
    </div>
  );
}

export default DashboardView;
