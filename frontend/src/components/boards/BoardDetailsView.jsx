import { useState } from 'react';
import { VendorProfileModal } from '../search/VendorProfileModal';
import { vendorWhatsappUrl } from '../../utils/whatsapp';

// Row props that open the vendor profile on click / Enter; inner buttons stop propagation.
function openable(onOpen) {
  return {
    role: 'button',
    tabIndex: 0,
    className: 'vendor-row-clickable',
    title: 'View vendor profile',
    onClick: onOpen,
    onKeyDown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpen();
      }
    }
  };
}

const stop = (handler) => (event) => {
  event.stopPropagation();
  handler();
};

export function BoardDetailsView({ board, boards, user, onBack, onDeleteBoard }) {
  const [profileVendor, setProfileVendor] = useState(null);
  const {
    removeVendorFromBoard,
    saveVendorToBoard,
    boardRecommendations,
    boardRationale,
    loadingRecommendations,
    boardSearchCity,
    setBoardSearchCity,
    boardSearchService,
    setBoardSearchService,
    boardSearchAiQuery,
    setBoardSearchAiQuery,
    boardSearchMode,
    setBoardSearchMode,
    boardSearchResults,
    boardSearching,
    boardSearchTotalResults,
    handleBoardSearch,
    handleBoardAiSearch
  } = boards;

  const isSaved = (vendorId) => board.vendors?.some(v => String(v._id || v) === String(vendorId));
  const profileSaved = profileVendor && isSaved(profileVendor._id);

  return (
    <div className="dashboard-container animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px 60px' }}>
      {profileVendor && (
        <VendorProfileModal
          vendor={profileVendor}
          user={user}
          onClose={() => setProfileVendor(null)}
          actions={profileSaved ? (
            <button
              type="button"
              className="btn btn-outline"
              style={{ color: 'var(--color-danger)', borderColor: 'var(--tone-danger-border)' }}
              onClick={() => removeVendorFromBoard(board._id, profileVendor._id)}
            >
              Remove from board
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => saveVendorToBoard(board._id, profileVendor._id)}>
              + Add to board
            </button>
          )}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <div>
          <button
            className="btn btn-outline"
            onClick={onBack}
            style={{ padding: '6px 12px', fontSize: '12px', marginBottom: '8px' }}
          >
            ← Back to Project Boards
          </button>
          <h2>📁 {board.name}</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: '4px' }}>
            Manage and curate verified artisan listings saved to this sourcing folder.
          </p>
        </div>
        <button
          className="btn btn-outline"
          style={{ color: 'var(--color-danger)', borderColor: 'var(--tone-danger-border)' }}
          onClick={() => onDeleteBoard(board._id)}
        >
          Delete Board
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '30px' }} className="board-details-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <div className="glass-card">
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '16px' }}>
              Saved Vendors ({board.vendors?.length || 0})
            </h3>

            {(!board.vendors || board.vendors.length === 0) ? (
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
                No vendors saved yet. Use the sourcing search console on the right to find and save verified partners!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {board.vendors.map(vendor => (
                  <div
                    key={vendor._id}
                    {...openable(() => setProfileVendor(vendor))}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-1)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--color-heading)' }}>{vendor.companyName}</h4>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        📍 {vendor.city} | Specialties: {vendor.specialization?.slice(0, 2).join(', ')}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                        {vendor.phoneNumber && (
                          <a
                            href={vendorWhatsappUrl(vendor)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            style={{ fontSize: '11px', color: '#25D366', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
                          >
                            💬 WhatsApp
                          </a>
                        )}
                      </div>
                    </div>

                    <button
                      className="btn btn-outline"
                      style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--color-danger)', borderColor: 'var(--tone-danger-border)' }}
                      onClick={stop(() => removeVendorFromBoard(board._id, vendor._id))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card" style={{ border: '1px solid var(--tone-purple-border)', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ animation: 'pulse 2s infinite' }}>🪄</span> Recommended For You
              </h3>
              <span className="badge badge-purple" style={{ fontSize: '10px' }}>GEMINI AI SOURCING</span>
            </div>

            {loadingRecommendations ? (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <div className="spinner" style={{ borderTopColor: 'var(--color-purple)', margin: '0 auto 12px' }}></div>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>Gemini is scanning project board scope...</p>
              </div>
            ) : (
              <div>
                {boardRationale && (
                  <div style={{ background: 'var(--tone-purple-bg)', border: '1px solid var(--tone-purple-border)', padding: '12px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.4', marginBottom: '16px', color: 'var(--color-text-secondary)' }}>
                    <strong style={{ color: 'var(--tone-purple-strong)', display: 'block', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Sourcing Recommendation Rationale
                    </strong>
                    {boardRationale}
                  </div>
                )}

                {boardRecommendations.length === 0 ? (
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', textAlign: 'center', padding: '10px 0' }}>
                    Add your first vendor to this board to trigger personalized project sourcing recommendations.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {boardRecommendations.map(rec => (
                      <div
                        key={rec._id}
                        {...openable(() => setProfileVendor(rec))}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          border: '1px solid var(--tone-purple-border)',
                          background: 'var(--tone-purple-bg)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--color-heading)' }}>{rec.companyName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                            📍 {rec.city} | {rec.specialization?.slice(0, 2).join(', ')}
                          </div>
                        </div>

                        <button
                          className="btn btn-purple"
                          style={{ padding: '6px 12px', fontSize: '11px' }}
                          onClick={stop(() => saveVendorToBoard(board._id, rec._id))}
                        >
                          + Save to Board
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-card" style={{ border: '1px solid var(--border-glow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Add Vendors to Sourcing Board</h3>
              <div className="search-mode-tabs" style={{ background: 'var(--bg-inset)', padding: '2px', borderRadius: '8px', display: 'flex' }}>
                <button
                  className={`btn ${boardSearchMode === 'standard' ? 'btn-primary' : ''}`}
                  style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px' }}
                  onClick={() => setBoardSearchMode('standard')}
                >
                  Standard
                </button>
                <button
                  className={`btn ${boardSearchMode === 'ai' ? 'btn-purple' : ''}`}
                  style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px' }}
                  onClick={() => setBoardSearchMode('ai')}
                >
                  AI Sourcing
                </button>
              </div>
            </div>

            {boardSearchMode === 'standard' ? (
              <form onSubmit={handleBoardSearch} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Service Specialized</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. False Ceiling, Interior"
                      value={boardSearchService}
                      onChange={(e) => setBoardSearchService(e.target.value)}
                      style={{ padding: '8px 12px', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>City / Location</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Tirupati, Delhi"
                      value={boardSearchCity}
                      onChange={(e) => setBoardSearchCity(e.target.value)}
                      style={{ padding: '8px 12px', fontSize: '13px' }}
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 14px', width: '100%', justifyContent: 'center' }}>
                  🔍 Search Directory
                </button>
              </form>
            ) : (
              <form onSubmit={handleBoardAiSearch} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Describe Sourcing Target</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    placeholder="e.g. I need a modular false ceiling builder in Tirupati..."
                    value={boardSearchAiQuery}
                    onChange={(e) => setBoardSearchAiQuery(e.target.value)}
                    style={{ padding: '10px', fontSize: '13px', resize: 'vertical' }}
                  />
                </div>
                <button type="submit" className="btn btn-purple" style={{ padding: '8px 14px', width: '100%', justifyContent: 'center' }}>
                  ✨ Scan Project Brief
                </button>
              </form>
            )}

            <div>
              {boardSearching ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div className="spinner" style={{ margin: '0 auto 8px' }}></div>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Querying verified data...</p>
                </div>
              ) : (
                <div>
                  {boardSearchResults.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        {boardSearchTotalResults} matches found
                      </span>
                      {(!user || user.subscriptionPlan === 'basic') && boardSearchTotalResults > 10 && (
                        <span style={{ fontSize: '10px', color: 'var(--color-warning)' }}>
                          Capped at 10 (Basic Plan)
                        </span>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                    {boardSearchResults.map(artisan => {
                      const saved = isSaved(artisan._id);
                      return (
                        <div
                          key={artisan._id}
                          {...openable(() => setProfileVendor(artisan))}
                          style={{
                            padding: '12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--surface-1)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div style={{ fontWeight: '500', fontSize: '13px', color: 'var(--color-heading)' }}>
                              {artisan.companyName}
                              {artisan.matchPercentage && (
                                <span className="badge badge-purple" style={{ fontSize: '8px', padding: '2px 4px', marginLeft: '6px' }}>
                                  {artisan.matchPercentage}% AI MATCH
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                              📍 {artisan.city} | {artisan.specialization?.slice(0, 2).join(', ')}
                            </div>
                          </div>

                          {saved ? (
                            <button
                              className="btn"
                              disabled
                              onClick={(event) => event.stopPropagation()}
                              style={{ padding: '6px 10px', fontSize: '11px', background: 'var(--surface-2)', color: 'var(--color-text-disabled)', border: 'none' }}
                            >
                              ✓ Added
                            </button>
                          ) : (
                            <button
                              className="btn btn-primary"
                              style={{ padding: '6px 10px', fontSize: '11px' }}
                              onClick={stop(() => saveVendorToBoard(board._id, artisan._id))}
                            >
                              + Add
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {boardSearchResults.length === 0 && !boardSearching && (
                      <p style={{ color: 'var(--color-text-secondary)', fontSize: '12px', textAlign: 'center', padding: '10px 0' }}>
                        Enter filters above to discover verified candidates.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BoardDetailsView;
