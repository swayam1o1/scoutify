import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { assetUrl } from '../../api/client';
import { isLiveStatus } from './vendorStatus';

const DETAIL_FIELDS = [
  { key: 'companyName', label: 'Company name' },
  { key: 'phoneNumber', label: 'Phone number' },
  { key: 'email', label: 'Listing email' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'city', label: 'City' },
  { key: 'serviceArea', label: 'Service area' },
  { key: 'personOfContact', label: 'Person of contact' },
  { key: 'website', label: 'Website', link: true },
  { key: 'description', label: 'Description', wide: true },
  { key: 'specialization', label: 'Specializations', list: true },
  { key: 'products', label: 'Products', list: true },
  { key: 'customTags', label: 'Custom tags', list: true },
  { key: 'portfolio', label: 'Portfolio links', list: true, link: true, wide: true }
];

const sectionTitle = { fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-secondary)', margin: '22px 0 10px' };
const muted = { color: 'var(--color-text-secondary)' };
const empty = <span style={{ ...muted, fontStyle: 'italic' }}>—</span>;

function formatDate(value) {
  return value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : null;
}

function Chips({ items, tone }) {
  if (!items?.length) return empty;
  const colors = {
    added: { background: 'var(--tone-success-bg)', color: 'var(--tone-success-text)', border: '1px solid var(--tone-success-border)' },
    removed: { background: 'var(--tone-danger-bg)', color: 'var(--tone-danger-text)', border: '1px solid var(--tone-danger-border)', textDecoration: 'line-through' }
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {items.map(item => (
        <span key={item} className="spec-tag" style={{ ...(colors[tone] || {}), wordBreak: 'break-all' }}>
          {tone === 'added' ? '+ ' : tone === 'removed' ? '− ' : ''}{item}
        </span>
      ))}
    </div>
  );
}

function FieldValue({ field, value }) {
  if (field.list) {
    if (!value?.length) return empty;
    if (field.link) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {value.map(link => (
            <a key={link} href={link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', wordBreak: 'break-all' }}>{link}</a>
          ))}
        </div>
      );
    }
    return <Chips items={value} />;
  }
  if (!value) return empty;
  if (field.link) {
    return <a href={value} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', wordBreak: 'break-all' }}>{value}</a>;
  }
  return <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{value}</span>;
}

function ReviewBanner({ review, status }) {
  let text;
  let tone = 'info';
  if (review.isFirstSubmission) {
    text = 'New listing — this vendor has never been approved. Review every detail below.';
  } else if (review.changes.length || review.newCatalogueCount) {
    const parts = [];
    if (review.changes.length) parts.push(`${review.changes.length} field${review.changes.length === 1 ? '' : 's'} changed`);
    if (review.newCatalogueCount) parts.push(`${review.newCatalogueCount} new catalogue product${review.newCatalogueCount === 1 ? '' : 's'}`);
    text = `Change request: ${parts.join(' and ')} since the last approval.`;
    tone = 'warn';
  } else if (review.hasApprovedVersion) {
    text = status === 'pending'
      ? 'Vendor re-saved the listing but nothing changed since the last approval.'
      : 'No changes since the last approval.';
  } else {
    text = 'No approval history for this listing (imported or approved before change tracking), so changes cannot be compared yet.';
  }

  const styles = tone === 'warn'
    ? { background: 'var(--tone-warning-bg)', border: '1px solid var(--tone-warning-border)', color: 'var(--tone-warning-text)' }
    : { background: 'var(--tone-purple-bg)', border: '1px solid var(--tone-purple-border)', color: 'var(--tone-purple-text)' };

  return <div style={{ ...styles, padding: '10px 12px', borderRadius: '8px', fontSize: '13px' }}>{text}</div>;
}

function ChangesTable({ changes }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {changes.map(change => (
        <div key={change.field} style={{ border: '1px solid var(--tone-warning-border)', borderRadius: '10px', padding: '10px 12px', fontSize: '13px' }}>
          <strong style={{ display: 'block', marginBottom: '8px' }}>{change.label}</strong>
          {change.list ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {change.added.length > 0 && <Chips items={change.added} tone="added" />}
              {change.removed.length > 0 && <Chips items={change.removed} tone="removed" />}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <span style={{ ...muted, fontSize: '11px', display: 'block', marginBottom: '2px' }}>Before (approved)</span>
                <span style={{ color: 'var(--tone-danger-text)', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{change.before || empty}</span>
              </div>
              <div>
                <span style={{ ...muted, fontSize: '11px', display: 'block', marginBottom: '2px' }}>Requested</span>
                <span style={{ color: 'var(--tone-success-text)', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{change.after || empty}</span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function VendorDetailModal({ admin }) {
  const { vendorDetail, closeVendorDetail, setVendorStatus, deleteVendor } = admin;
  const isOpen = Boolean(vendorDetail);

  useEffect(() => {
    if (!isOpen) return undefined;
    const { overflow, paddingRight } = document.body.style;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, [isOpen]);

  if (!vendorDetail) return null;

  const { vendor, owner, review, loading } = vendorDetail;
  const changedFields = new Set((review?.changes || []).map(change => change.field));

  // Portal to body: ancestors with a transform (e.g. .animate-fade-in) would otherwise anchor the fixed overlay
  return createPortal(
    <div className="modal-overlay modal-overlay-centered" onClick={closeVendorDetail}>
      <div className="modal-content vendor-detail-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={closeVendorDetail} aria-label="Close">
          <X size={18} />
        </button>

        {loading || !vendor ? (
          <p style={muted}>Loading vendor details…</p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', paddingRight: '40px' }}>
              <h2 style={{ margin: 0, fontSize: '22px' }}>{vendor.companyName}</h2>
              <span className={`badge ${isLiveStatus(vendor.contactStatus) ? '' : 'badge-purple'}`} style={{ fontSize: '10px' }}>
                {vendor.contactStatus?.toUpperCase()}
              </span>
            </div>
            <p style={{ ...muted, fontSize: '12px', margin: '6px 0 14px' }}>
              {[
                review.changeRequestedAt && `Last submitted ${formatDate(review.changeRequestedAt)}`,
                review.lastApprovedAt && `Last approved ${formatDate(review.lastApprovedAt)}`,
                vendor.createdAt && `Listed ${formatDate(vendor.createdAt)}`
              ].filter(Boolean).join(' · ')}
            </p>

            <ReviewBanner review={review} status={vendor.contactStatus} />

            {review.changes.length > 0 && (
              <>
                <h4 style={sectionTitle}>Requested changes</h4>
                <ChangesTable changes={review.changes} />
              </>
            )}

            <h4 style={sectionTitle}>Listing details</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px 18px', fontSize: '13px' }}>
              {DETAIL_FIELDS.map(field => (
                <div key={field.key} style={{ gridColumn: field.wide ? '1 / -1' : undefined }}>
                  <span style={{ ...muted, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    {field.label}
                    {changedFields.has(field.key) && <span className="badge badge-purple" style={{ fontSize: '9px', padding: '1px 6px' }}>CHANGED</span>}
                  </span>
                  <FieldValue field={field} value={vendor[field.key]} />
                </div>
              ))}
            </div>

            <h4 style={sectionTitle}>Product catalogue ({vendor.catalogue?.length || 0})</h4>
            {vendor.catalogue?.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                {vendor.catalogue.map(item => (
                  <div key={item._id} style={{ border: `1px solid ${item.isNew ? 'var(--tone-warning-border)' : 'var(--border-color)'}`, borderRadius: '10px', overflow: 'hidden', position: 'relative' }}>
                    <a href={assetUrl(item.imageUrl)} target="_blank" rel="noopener noreferrer">
                      <img src={assetUrl(item.imageUrl)} alt={item.title} style={{ width: '100%', height: '110px', objectFit: 'cover', display: 'block' }} />
                    </a>
                    {item.isNew && (
                      <span className="badge badge-purple" style={{ position: 'absolute', top: 6, left: 6, fontSize: '9px', padding: '2px 6px' }}>NEW</span>
                    )}
                    <div style={{ padding: '6px 8px', fontSize: '12px' }}>
                      <strong style={{ display: 'block' }}>{item.title}</strong>
                      <span style={{ ...muted, fontSize: '11px' }}>{[item.category, item.material].filter(Boolean).join(' · ') || '—'}</span>
                      {item.description && <p style={{ ...muted, fontSize: '11px', margin: '4px 0 0' }}>{item.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ ...muted, fontSize: '13px' }}>No catalogue products.</p>
            )}

            <h4 style={sectionTitle}>Vendor account</h4>
            {owner ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px 18px', fontSize: '13px' }}>
                <div><span style={{ ...muted, fontSize: '11px', display: 'block' }}>Account name</span>{owner.name}</div>
                <div><span style={{ ...muted, fontSize: '11px', display: 'block' }}>Login email</span><span style={{ wordBreak: 'break-all' }}>{owner.email}</span></div>
                <div>
                  <span style={{ ...muted, fontSize: '11px', display: 'block' }}>Phone</span>
                  {owner.phoneNumber || empty}{owner.phoneNumber && (owner.phoneVerified ? ' ✓ verified' : ' (unverified)')}
                </div>
                <div>
                  <span style={{ ...muted, fontSize: '11px', display: 'block' }}>Account status</span>
                  {[owner.isVerified ? 'Email verified' : 'Email unverified', owner.twoFactorEnabled && '2FA on', owner.isSuspended && 'Suspended', owner.isDeleted && 'Deleted']
                    .filter(Boolean).join(' · ')}
                </div>
                <div><span style={{ ...muted, fontSize: '11px', display: 'block' }}>Joined</span>{formatDate(owner.createdAt)}</div>
              </div>
            ) : (
              <p style={{ ...muted, fontSize: '13px' }}>No vendor account linked (imported or created by an admin).</p>
            )}

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              {!isLiveStatus(vendor.contactStatus) && (
                <button className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={() => setVendorStatus(vendor._id, 'approved')}>
                  Approve
                </button>
              )}
              {vendor.contactStatus !== 'rejected' && (
                <button className="btn btn-outline" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={() => setVendorStatus(vendor._id, 'rejected')}>
                  Reject
                </button>
              )}
              {vendor.contactStatus !== 'pending' && (
                <button className="btn btn-outline" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={() => setVendorStatus(vendor._id, 'pending')}>
                  Mark Pending
                </button>
              )}
              <button
                className="btn btn-outline"
                style={{ padding: '8px 14px', fontSize: '13px', borderColor: 'var(--color-danger)', color: 'var(--color-danger)', marginLeft: 'auto' }}
                onClick={() => deleteVendor(vendor._id)}
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

export default VendorDetailModal;
