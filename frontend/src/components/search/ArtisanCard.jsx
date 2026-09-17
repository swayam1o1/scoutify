import { Globe, Lock, Mail, MapPin, Phone, User as UserIcon } from 'lucide-react';
import { Instagram } from '../../icons/Instagram';

export function ArtisanCard({
  artisan,
  index = 0,
  user,
  boards,
  activeSaveDropdownId,
  setActiveSaveDropdownId,
  quickNewBoardName,
  setQuickNewBoardName,
  onSaveVendorToBoard,
  onCreateBoard,
  onRequireAuth
}) {
  const contactUnlocked = Boolean(user) && !artisan.contactLocked;

  return (
    <div className="glass-card animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="artisan-card-header">
        <h4 className="artisan-title">{artisan.companyName}</h4>
        {artisan.matchPercentage ? (
          <span className="badge badge-purple">{artisan.matchPercentage}% MATCH</span>
        ) : (
          <span className="badge">VERIFIED</span>
        )}
      </div>

      <div className="artisan-specializations">
        {artisan.specialization?.map((spec, i) => (
          <span key={i} className="spec-tag">{spec}</span>
        ))}
      </div>

      <div className="artisan-info">
        <div className="artisan-info-item">
          <MapPin size={14} />
          <span>{artisan.city}{artisan.serviceArea ? ` · serves ${artisan.serviceArea}` : ''}</span>
        </div>
        {artisan.description && (
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '8px 0 0', lineHeight: 1.4 }}>
            {artisan.description.length > 120
              ? `${artisan.description.slice(0, 120)}…`
              : artisan.description}
          </p>
        )}
        {contactUnlocked ? (
          <>
            <div className="artisan-info-item">
              <UserIcon size={14} />
              <span>Contact: {artisan.personOfContact || 'N/A'}</span>
            </div>
            <div className="artisan-info-item">
              <Phone size={14} />
              <span>{artisan.phoneNumber || 'Not listed'}</span>
            </div>
            <div className="artisan-info-item">
              <Mail size={14} />
              <span style={{ fontSize: '13px', wordBreak: 'break-all' }}>{artisan.email || 'Not listed'}</span>
            </div>
            {artisan.instagram && (
              <div className="artisan-info-item">
                <Instagram size={14} />
                <span>{artisan.instagram}</span>
              </div>
            )}
            {artisan.website && (
              <div className="artisan-info-item">
                <Globe size={14} />
                <a href={artisan.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: 'var(--color-primary)', wordBreak: 'break-all' }}>
                  {artisan.website}
                </a>
              </div>
            )}
          </>
        ) : (
          <div className="artisan-info-item" style={{ marginTop: '8px', opacity: 0.85 }}>
            <Lock size={14} />
            <span>Contact details locked — sign in to view</span>
          </div>
        )}
      </div>

      {contactUnlocked && artisan.phoneNumber ? (
        <a
          href={`https://wa.me/91${artisan.phoneNumber.split('/')[0].replace(/[^0-9]/g, '')}?text=Hi%20${encodeURIComponent(artisan.personOfContact || artisan.companyName)},%20I%20found%20your%20verified%20profile%20on%20Scoutify%20and%20would%20like%20to%20discuss%20a%20project%20in%20${encodeURIComponent(artisan.city)}.`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary"
          style={{ padding: '8px 12px', fontSize: '13px', marginTop: '12px', width: '100%', background: '#25D366', color: '#fff', border: 'none', justifyContent: 'center', fontWeight: '600' }}
        >
          Message on WhatsApp
        </a>
      ) : !user ? (
        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: '8px 12px', fontSize: '13px', marginTop: '12px', width: '100%', justifyContent: 'center' }}
          onClick={() => onRequireAuth('login')}
        >
          <Lock size={14} /> Sign in for full details
        </button>
      ) : null}

      {(!user || user.role === 'client') && (
        <div style={{ position: 'relative', marginTop: '8px' }}>
          <button
            className="btn btn-outline"
            style={{ width: '100%', padding: '8px 12px', fontSize: '13px', justifyContent: 'center' }}
            onClick={() => {
              if (!user) {
                onRequireAuth('login');
              } else {
                setActiveSaveDropdownId(activeSaveDropdownId === artisan._id ? null : artisan._id);
                setQuickNewBoardName('');
              }
            }}
          >
            Save to Project Board
          </button>

          {activeSaveDropdownId === artisan._id && (
            <div className="save-board-dropdown animate-fade-in">
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', padding: '4px 8px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                Select Board
              </div>

              {boards.length === 0 ? (
                <div style={{ padding: '6px 8px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  No boards created yet.
                </div>
              ) : (
                <div style={{ maxHeight: '120px', overflowY: 'auto', marginBottom: '8px' }}>
                  {boards.map(board => (
                    <div
                      key={board._id}
                      className="save-board-item"
                      onClick={() => onSaveVendorToBoard(board._id, artisan._id)}
                    >
                      📁 {board.name}
                    </div>
                  ))}
                </div>
              )}

              <div className="save-board-create">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Create new board..."
                  value={quickNewBoardName}
                  onChange={(e) => setQuickNewBoardName(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '12px', height: 'auto', marginBottom: '6px', background: 'rgba(255,255,255,0.02)' }}
                />
                <button
                  className="btn btn-primary"
                  style={{ padding: '4px 8px', fontSize: '11px', width: '100%', justifyContent: 'center' }}
                  onClick={() => onCreateBoard(quickNewBoardName, artisan._id)}
                >
                  Create & Save
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {artisan.aiReasoning && (
        <div style={{ background: 'rgba(153, 69, 255, 0.06)', border: '1px solid rgba(153, 69, 255, 0.15)', padding: '12px', borderRadius: '8px', marginTop: '10px', fontSize: '13px', textAlign: 'left' }}>
          <strong style={{ color: '#c084fc', display: 'block', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            AI Match Reasoning
          </strong>
          {artisan.aiReasoning}
        </div>
      )}
    </div>
  );
}

export default ArtisanCard;
