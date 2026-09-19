import { Plus, Trash } from 'lucide-react';
import { useCategories } from '../../hooks/useCategories';
import { ReauthFields } from '../auth/ReauthFields.jsx';

const FIRM_TYPES = new Set(['architectural_firm', 'design_firm', 'company', 'firm']);

const STATUS_BANNERS = {
  pending: {
    text: 'Your listing is awaiting Scoutify admin approval. It stays hidden from search until it is approved.',
    background: 'rgba(250, 204, 21, 0.12)',
    border: '1px solid rgba(250, 204, 21, 0.35)',
    color: '#fde68a'
  },
  rejected: {
    text: 'Your listing was rejected by a Scoutify admin. Update the details below and save to request another review.',
    background: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid var(--color-danger)',
    color: '#fca5a5'
  },
  approved: {
    text: 'Your listing is approved and visible in Scoutify search.',
    background: 'rgba(20, 241, 149, 0.12)',
    border: '1px solid var(--color-primary)',
    color: '#a7f3d0'
  },
  verified: {
    text: 'Your listing is live in Scoutify search.',
    background: 'rgba(20, 241, 149, 0.12)',
    border: '1px solid var(--color-primary)',
    color: '#a7f3d0'
  }
};

function StatusBanner({ status }) {
  const banner = STATUS_BANNERS[status];
  if (!banner) return null;

  return (
    <div style={{
      background: banner.background,
      border: banner.border,
      color: banner.color,
      padding: '12px',
      borderRadius: '8px',
      fontSize: '13px',
      marginBottom: '16px'
    }}>
      {banner.text}
    </div>
  );
}

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

  const isAdmin = user.role === 'admin';
  const mustEnable = !!user.mustEnable2FA;

  return (
    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '10px' }}>
      <h4 style={{ fontSize: '15px', marginBottom: '10px' }}>Google Authenticator (2FA)</h4>
      {mustEnable && (
        <div style={{
          background: 'rgba(250, 204, 21, 0.12)',
          border: '1px solid rgba(250, 204, 21, 0.35)',
          color: '#fde68a',
          padding: '10px 12px',
          borderRadius: '8px',
          fontSize: '13px',
          marginBottom: '12px'
        }}>
          Admin accounts require Authenticator before admin tools unlock. Set it up below.
        </div>
      )}
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
        After password, login needs the 6-digit code from the Google Authenticator app on your phone. No SMS.
        {isAdmin ? ' Admins cannot turn this off.' : ''}
      </p>
      {user.twoFactorEnabled ? (
        isAdmin ? (
          <p style={{ fontSize: '13px', color: '#a7f3d0' }}>Authenticator is enabled (required for admins).</p>
        ) : (
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
        )
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
          {!mustEnable && (
            <button type="button" className="btn btn-outline" disabled={totpBusy} style={{ width: '100%', fontSize: '13px', padding: '8px' }} onClick={cancelTotpSetup}>
              Cancel
            </button>
          )}
        </form>
      ) : (
        <button type="button" className="btn btn-primary" disabled={totpBusy} onClick={startTotpSetup} style={{ width: '100%', fontSize: '13px', padding: '8px', color: '#000' }}>
          Set up Google Authenticator
        </button>
      )}
    </div>
  );
}

function AccountSecurityPanel({ user, auth }) {
  const {
    passwordForm,
    setPasswordForm,
    reauthForm,
    setReauthForm,
    emailChangeForm,
    setEmailChangeForm,
    phoneChangeForm,
    setPhoneChangeForm,
    emailChangeStage,
    phoneChangeStage,
    accountBusy,
    reauthBusy,
    handleChangePassword,
    handleDeleteAccount,
    requestReauthEmailCode,
    handleStartEmailChange,
    handleConfirmEmailChange,
    handleStartPhoneChange,
    handleConfirmPhoneChange
  } = auth;

  return (
    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '10px' }}>
      <h4 style={{ fontSize: '15px', marginBottom: '10px' }}>Password</h4>
      <form onSubmit={handleChangePassword}>
        <input
          type="password"
          className="form-control"
          placeholder="Current password"
          autoComplete="current-password"
          value={passwordForm.currentPassword}
          onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
          required
          style={{ marginBottom: '8px' }}
        />
        {user.twoFactorEnabled && (
          <input
            type="text"
            className="form-control"
            inputMode="numeric"
            placeholder="Authenticator code"
            value={passwordForm.totpCode || ''}
            onChange={e => setPasswordForm({ ...passwordForm, totpCode: e.target.value })}
            required
            style={{ marginBottom: '8px' }}
          />
        )}
        <input
          type="password"
          className="form-control"
          placeholder="New password (min 8 characters)"
          autoComplete="new-password"
          value={passwordForm.newPassword}
          onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
          required
          style={{ marginBottom: '8px' }}
        />
        <input
          type="password"
          className="form-control"
          placeholder="Confirm new password"
          autoComplete="new-password"
          value={passwordForm.confirmPassword}
          onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
          required
          style={{ marginBottom: '10px' }}
        />
        <button type="submit" className="btn btn-primary" disabled={accountBusy} style={{ width: '100%', fontSize: '13px', padding: '8px', color: '#000' }}>
          Change Password
        </button>
      </form>

      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '16px' }}>
        <h4 style={{ fontSize: '15px', marginBottom: '8px' }}>Change Email</h4>
        {emailChangeStage === 'confirm' ? (
          <form onSubmit={handleConfirmEmailChange}>
            <input
              type="text"
              className="form-control"
              inputMode="numeric"
              placeholder="Code sent to new email"
              value={emailChangeForm.otp}
              onChange={e => setEmailChangeForm({ ...emailChangeForm, otp: e.target.value })}
              required
              style={{ marginBottom: '10px' }}
            />
            <button type="submit" className="btn btn-primary" disabled={accountBusy} style={{ width: '100%', fontSize: '13px', padding: '8px', color: '#000' }}>
              Confirm Email
            </button>
          </form>
        ) : (
          <form onSubmit={handleStartEmailChange}>
            <input
              type="email"
              className="form-control"
              placeholder="New email address"
              value={emailChangeForm.newEmail}
              onChange={e => setEmailChangeForm({ ...emailChangeForm, newEmail: e.target.value })}
              required
              style={{ marginBottom: '8px' }}
            />
            <ReauthFields
              user={user}
              values={reauthForm}
              onChange={setReauthForm}
              onRequestEmailCode={requestReauthEmailCode}
              emailCodeBusy={reauthBusy}
              compact
            />
            <button type="submit" className="btn btn-outline" disabled={accountBusy} style={{ width: '100%', fontSize: '13px', padding: '8px' }}>
              Send confirmation to new email
            </button>
          </form>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '16px' }}>
        <h4 style={{ fontSize: '15px', marginBottom: '8px' }}>Change Phone</h4>
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
          Current: {user.phoneNumber || 'Not set'}{user.phoneVerified ? ' (verified)' : ''}
        </p>
        {phoneChangeStage === 'confirm' ? (
          <form onSubmit={handleConfirmPhoneChange}>
            <input
              type="text"
              className="form-control"
              inputMode="numeric"
              placeholder="Code sent to new phone"
              value={phoneChangeForm.otp}
              onChange={e => setPhoneChangeForm({ ...phoneChangeForm, otp: e.target.value })}
              required
              style={{ marginBottom: '10px' }}
            />
            <button type="submit" className="btn btn-primary" disabled={accountBusy} style={{ width: '100%', fontSize: '13px', padding: '8px', color: '#000' }}>
              Confirm Phone
            </button>
          </form>
        ) : (
          <form onSubmit={handleStartPhoneChange}>
            <input
              type="tel"
              className="form-control"
              placeholder="New 10-digit phone"
              value={phoneChangeForm.newPhone}
              onChange={e => setPhoneChangeForm({ ...phoneChangeForm, newPhone: e.target.value })}
              required
              style={{ marginBottom: '8px' }}
            />
            <ReauthFields
              user={user}
              values={reauthForm}
              onChange={setReauthForm}
              onRequestEmailCode={requestReauthEmailCode}
              emailCodeBusy={reauthBusy}
              compact
            />
            <button type="submit" className="btn btn-outline" disabled={accountBusy} style={{ width: '100%', fontSize: '13px', padding: '8px' }}>
              Send confirmation to new phone
            </button>
          </form>
        )}
      </div>

      {user.role !== 'admin' && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '16px' }}>
          <h4 style={{ fontSize: '15px', marginBottom: '8px' }}>Delete Account</h4>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '10px' }}>
            Removes your access and hides your data from Scoutify. Support can restore it on request.
          </p>
          <form onSubmit={handleDeleteAccount}>
            <ReauthFields
              user={user}
              values={reauthForm}
              onChange={setReauthForm}
              onRequestEmailCode={requestReauthEmailCode}
              emailCodeBusy={reauthBusy}
              compact
            />
            <button
              type="submit"
              className="btn btn-outline"
              disabled={accountBusy}
              style={{ width: '100%', fontSize: '13px', padding: '8px', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
            >
              Delete My Account
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function CategoryPicker({ label, selected, onChange, placeholder }) {
  const categories = useCategories();
  const predefined = categories.filter(category => category !== 'Other');
  const custom = selected.filter(tag => !predefined.includes(tag));

  const toggle = (category) => {
    onChange(selected.includes(category)
      ? selected.filter(tag => tag !== category)
      : [...selected, category]);
  };

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
        {predefined.map(category => (
          <button
            type="button"
            key={category}
            className={`btn ${selected.includes(category) ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '12px', color: selected.includes(category) ? '#000' : undefined }}
            onClick={() => toggle(category)}
          >
            {category}
          </button>
        ))}
      </div>
      <input
        type="text"
        className="form-control"
        placeholder={placeholder}
        value={custom.join(', ')}
        onChange={e => {
          const typed = e.target.value.split(',').map(tag => tag.trim()).filter(Boolean);
          onChange([...selected.filter(tag => predefined.includes(tag)), ...typed]);
        }}
      />
      <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
        Other / custom entries, comma separated.
      </span>
    </div>
  );
}

function ArtisanListingForm({ user, auth }) {
  const {
    profileForm,
    setProfileForm,
    newPortfolioLink,
    setNewPortfolioLink,
    handleArtisanProfileSave,
    artisanListingStatus,
    reauthForm,
    setReauthForm,
    requestReauthEmailCode,
    reauthBusy
  } = auth;

  const setField = (field) => (event) => setProfileForm({ ...profileForm, [field]: event.target.value });
  const companyChanged =
    String(profileForm.companyName || '').trim().toLowerCase() !==
    String(user?.artisanProfile?.companyName || '').trim().toLowerCase();

  return (
    <div className="glass-card">
      <h3 style={{ marginBottom: '16px' }}>Public Directory Listing</h3>

      <StatusBanner status={artisanListingStatus} />

      <form onSubmit={handleArtisanProfileSave}>
        <div className="grid-container grid-2">
          <div className="form-group">
            <label className="form-label">Company Name</label>
            <input
              type="text"
              className="form-control"
              value={profileForm.companyName}
              onChange={setField('companyName')}
              placeholder="Your studio / company name"
              required
            />
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginTop: '6px' }}>
              Change this name to update company details. Re-auth (password / 2FA) will appear below when it changes.
            </span>
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input type="text" className="form-control" value={profileForm.phoneNumber} onChange={setField('phoneNumber')} />
          </div>
        </div>

        {companyChanged && (
          <div style={{ marginBottom: '14px', padding: '12px', borderRadius: '8px', border: '1px solid rgba(250, 204, 21, 0.35)', background: 'rgba(250, 204, 21, 0.08)' }}>
            <p style={{ fontSize: '12px', color: '#fde68a', marginBottom: '8px' }}>
              Company name changed{user?.artisanProfile?.companyName ? ` from “${user.artisanProfile.companyName}”` : ''}. Enter password to save.
            </p>
            <ReauthFields
              user={user}
              values={reauthForm}
              onChange={setReauthForm}
              onRequestEmailCode={requestReauthEmailCode}
              emailCodeBusy={reauthBusy}
              compact
            />
          </div>
        )}

        <div className="grid-container grid-2">
          <div className="form-group">
            <label className="form-label">Listing Email</label>
            <input type="email" className="form-control" value={profileForm.email} onChange={setField('email')} />
          </div>
          <div className="form-group">
            <label className="form-label">Instagram Handle</label>
            <input type="text" className="form-control" placeholder="@studio_name" value={profileForm.instagram} onChange={setField('instagram')} />
          </div>
        </div>

        <div className="grid-container grid-2">
          <div className="form-group">
            <label className="form-label">Listing City</label>
            <input type="text" className="form-control" value={profileForm.city} onChange={setField('city')} />
          </div>
          <div className="form-group">
            <label className="form-label">Service Area</label>
            <input type="text" className="form-control" placeholder="South Bangalore, whole of Karnataka..." value={profileForm.serviceArea} onChange={setField('serviceArea')} />
          </div>
        </div>

        <div className="grid-container grid-2">
          <div className="form-group">
            <label className="form-label">Person of Contact</label>
            <input type="text" className="form-control" value={profileForm.personOfContact} onChange={setField('personOfContact')} />
          </div>
          <div className="form-group">
            <label className="form-label">Website</label>
            <input type="url" className="form-control" placeholder="https://studio.com" value={profileForm.website} onChange={setField('website')} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Studio Description</label>
          <textarea
            className="form-control"
            rows={3}
            placeholder="What your studio does, materials you work with, typical project sizes..."
            value={profileForm.description}
            onChange={setField('description')}
          />
        </div>

        <CategoryPicker
          label="Specializations"
          selected={profileForm.specialization}
          onChange={specialization => setProfileForm({ ...profileForm, specialization })}
          placeholder="Modular Kitchens, Stonework..."
        />

        <div className="form-group">
          <label className="form-label">Products (comma separated)</label>
          <input
            type="text"
            className="form-control"
            placeholder="Teak furniture, Pendant lights, Terrazzo tiles..."
            value={profileForm.products.join(', ')}
            onChange={e => setProfileForm({ ...profileForm, products: e.target.value.split(',').map(item => item.trim()).filter(Boolean) })}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Custom Tags (comma separated)</label>
          <input
            type="text"
            className="form-control"
            placeholder="Sustainable, Turnkey, Heritage restoration..."
            value={profileForm.customTags.join(', ')}
            onChange={e => setProfileForm({ ...profileForm, customTags: e.target.value.split(',').map(item => item.trim()).filter(Boolean) })}
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

function ClientProfileForm({ user, auth }) {
  const {
    accountForm,
    setAccountForm,
    accountBusy,
    handleAccountProfileSave,
    reauthForm,
    setReauthForm,
    requestReauthEmailCode,
    reauthBusy
  } = auth;

  const showCompany = FIRM_TYPES.has(accountForm.clientType);
  const companyChanged =
    String(accountForm.companyName || '').trim().toLowerCase() !==
    String(user?.clientProfile?.companyName || '').trim().toLowerCase();

  return (
    <div className="glass-card">
      <h3 style={{ marginBottom: '14px' }}>Client Profile Details</h3>

      <form onSubmit={handleAccountProfileSave}>
        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input
            type="text"
            className="form-control"
            value={accountForm.name}
            onChange={e => setAccountForm({ ...accountForm, name: e.target.value })}
            required
          />
        </div>

        <div className="grid-container grid-2">
          <div className="form-group">
            <label className="form-label">What best describes you?</label>
            <select
              className="form-control form-select"
              value={accountForm.clientType}
              onChange={e => setAccountForm({ ...accountForm, clientType: e.target.value })}
            >
              <option value="interior_designer">Interior Designer</option>
              <option value="architectural_firm">Architectural Firm</option>
              <option value="design_firm">Design Firm</option>
              <option value="company">Company</option>
              <option value="hobbyist">Hobbyist</option>
              <option value="student">Student</option>
              <option value="private_client">Private Client</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Planned Sourcing Purpose</label>
            <select
              className="form-control form-select"
              value={accountForm.plannedUse}
              onChange={e => setAccountForm({ ...accountForm, plannedUse: e.target.value })}
            >
              <option value="source_vendors">Source Vendors for active projects</option>
              <option value="hiring">Direct hiring for short-term projects</option>
              <option value="collaboration">Collaborations and partnership reference</option>
              <option value="research">Research and database compilation</option>
            </select>
          </div>
        </div>

        {showCompany && (
          <div className="form-group">
            <label className="form-label">Company Name</label>
            <input
              type="text"
              className="form-control"
              value={accountForm.companyName || ''}
              onChange={e => setAccountForm({ ...accountForm, companyName: e.target.value })}
              required
            />
          </div>
        )}

        {companyChanged && (
          <div style={{ marginBottom: '14px', padding: '12px', borderRadius: '8px', border: '1px solid rgba(250, 204, 21, 0.35)', background: 'rgba(250, 204, 21, 0.08)' }}>
            <p style={{ fontSize: '12px', color: '#fde68a', marginBottom: '8px' }}>
              Changing company details requires re-authentication.
            </p>
            <ReauthFields
              user={user}
              values={reauthForm}
              onChange={setReauthForm}
              onRequestEmailCode={requestReauthEmailCode}
              emailCodeBusy={reauthBusy}
              compact
            />
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={accountBusy} style={{ width: '100%' }}>
          Save Profile Details
        </button>
      </form>
    </div>
  );
}

function ClientPortalPanel({ user, auth, boards }) {
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
      <ClientProfileForm user={user} auth={auth} />

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
          <h2>
            {user.role === 'admin'
              ? 'Admin Security Setup'
              : user.role === 'artisan'
                ? 'Artisan Sourcing Portal'
                : 'Client User Portal'}
          </h2>
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
              <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '13px' }}>Email</span>
              <strong style={{ fontSize: '14px', wordBreak: 'break-all' }}>{user.email}</strong>
            </div>
            {user.role === 'artisan' && (
              <div>
                <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '13px' }}>Company Name</span>
                <strong>{user.artisanProfile?.companyName || 'Not set — edit on the right'}</strong>
              </div>
            )}
            <div>
              <span style={{ color: 'var(--color-text-secondary)', display: 'block', fontSize: '13px' }}>Account Role</span>
              <strong style={{ textTransform: 'capitalize' }}>{user.role}</strong>
            </div>

            <TwoFactorPanel user={user} auth={auth} />
            <AccountSecurityPanel user={user} auth={auth} />
          </div>
        </div>

        {/* Right content: profile forms */}
        {user.role === 'artisan' ? (
          <ArtisanListingForm user={user} auth={auth} />
        ) : user.role === 'admin' ? (
          <div className="glass-card">
            <h3 style={{ marginBottom: '12px' }}>Admin access</h3>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              {user.mustEnable2FA
                ? 'Enable Google Authenticator on the left to unlock the Admin console.'
                : 'Authenticator is ready. Open Admin from the navigation menu.'}
            </p>
          </div>
        ) : (
          <ClientPortalPanel user={user} auth={auth} boards={boards} />
        )}
      </div>
    </div>
  );
}

export default DashboardView;
