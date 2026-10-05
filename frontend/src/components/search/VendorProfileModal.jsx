import { useEffect } from 'react';
import { Globe, Lock, Mail, MapPin, Phone, User as UserIcon, X } from 'lucide-react';
import { Instagram } from '../../icons/Instagram';
import { assetUrl } from '../../api/client';
import { vendorWhatsappUrl } from '../../utils/whatsapp';

function Section({ title, children }) {
  return (
    <div className="vendor-profile-section">
      <h5>{title}</h5>
      {children}
    </div>
  );
}

function TagList({ items }) {
  return (
    <div className="artisan-specializations" style={{ marginBottom: 0 }}>
      {items.map(item => <span key={item} className="spec-tag">{item}</span>)}
    </div>
  );
}

/**
 * Full vendor profile, opened from compact vendor rows (boards, recommendations).
 * `actions` renders the caller's buttons (Add / Remove) in the footer.
 */
export function VendorProfileModal({ vendor, user, onClose, actions }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!vendor) return null;

  const contactUnlocked = Boolean(user) && !vendor.contactLocked;
  const catalogue = vendor.matchedItems?.length ? vendor.matchedItems : vendor.catalogue || [];
  const products = [...(vendor.products || []), ...(vendor.customTags || [])];
  const portfolio = (vendor.portfolio || []).filter(Boolean);
  const waLink = contactUnlocked && vendorWhatsappUrl(vendor);

  return (
    <div className="modal-overlay modal-overlay-centered" onMouseDown={onClose}>
      <div
        className="modal-content vendor-profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vendor-profile-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>

        <div className="artisan-card-header" style={{ paddingRight: '40px' }}>
          <h3 id="vendor-profile-title" style={{ margin: 0 }}>{vendor.companyName}</h3>
          {vendor.matchPercentage ? (
            <span className="badge badge-purple">{vendor.matchPercentage}% MATCH</span>
          ) : (
            <span className="badge">VERIFIED</span>
          )}
        </div>

        <div className="artisan-info-item" style={{ marginBottom: '14px' }}>
          <MapPin size={14} />
          <span>{vendor.city || 'City not listed'}{vendor.serviceArea ? ` · serves ${vendor.serviceArea}` : ''}</span>
        </div>

        {vendor.specialization?.length > 0 && (
          <Section title="Specializations"><TagList items={vendor.specialization} /></Section>
        )}

        {vendor.description && (
          <Section title="About">
            <p className="vendor-profile-text">{vendor.description}</p>
          </Section>
        )}

        {products.length > 0 && (
          <Section title="Products & tags"><TagList items={[...new Set(products)]} /></Section>
        )}

        {catalogue.length > 0 && (
          <Section title={vendor.matchedItems?.length ? 'Matching catalogue products' : `Catalogue (${catalogue.length})`}>
            <div className="vendor-profile-catalogue">
              {catalogue.map(item => (
                <figure key={item._id || item.title}>
                  <img src={assetUrl(item.imageUrl)} alt={item.title} loading="lazy" />
                  <figcaption>
                    {item.similarity ? `${item.similarity}% · ` : ''}{item.title}
                    {(item.material || item.category) && <span>{[item.category, item.material].filter(Boolean).join(' · ')}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </Section>
        )}

        {vendor.aiReasoning && (
          <Section title="Why it matched">
            <p className="vendor-profile-text">{vendor.aiReasoning}</p>
          </Section>
        )}

        <Section title="Contact">
          {contactUnlocked ? (
            <div className="artisan-info" style={{ marginTop: 0 }}>
              <div className="artisan-info-item"><UserIcon size={14} /><span>{vendor.personOfContact || 'Not listed'}</span></div>
              <div className="artisan-info-item"><Phone size={14} /><span>{vendor.phoneNumber || 'Not listed'}</span></div>
              <div className="artisan-info-item"><Mail size={14} /><span style={{ wordBreak: 'break-all' }}>{vendor.email || 'Not listed'}</span></div>
              {vendor.instagram && (
                <div className="artisan-info-item"><Instagram size={14} /><span>{vendor.instagram}</span></div>
              )}
              {vendor.website && (
                <div className="artisan-info-item">
                  <Globe size={14} />
                  <a href={vendor.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', wordBreak: 'break-all' }}>
                    {vendor.website}
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="artisan-info-item" style={{ opacity: 0.85 }}>
              <Lock size={14} /><span>Contact details locked — sign in to view</span>
            </div>
          )}
        </Section>

        {portfolio.length > 0 && (
          <Section title="Portfolio links">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {portfolio.map(link => (
                <a key={link} href={link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', fontSize: '13px', wordBreak: 'break-all' }}>
                  {link}
                </a>
              ))}
            </div>
          </Section>
        )}

        <div className="vendor-profile-actions">
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn vendor-profile-whatsapp">
              Message on WhatsApp
            </a>
          )}
          {actions}
        </div>
      </div>
    </div>
  );
}

export default VendorProfileModal;
