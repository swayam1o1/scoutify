import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash, X } from 'lucide-react';
import { assetUrl, authFetch } from '../../api/client';
import { fileToResizedDataUrl, IMAGE_ACCEPT } from '../../utils/image';

const EMPTY_FORM = { title: '', category: '', material: '', description: '' };

export function CatalogueManager({ token, hasListing }) {
  const [catalogue, setCatalogue] = useState([]);
  const [maxItems, setMaxItems] = useState(30);
  const [form, setForm] = useState(EMPTY_FORM);
  const [image, setImage] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const fileInput = useRef(null);

  useEffect(() => {
    if (!token) return;
    authFetch('/artisan/catalogue', { token })
      .then(res => res.json())
      .then(data => {
        setCatalogue(data.catalogue || []);
        if (data.maxItems) setMaxItems(data.maxItems);
      })
      .catch(err => console.error(err));
  }, [token]);

  const setField = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  const pickImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setImage(await fileToResizedDataUrl(file));
      setMessage(null);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const addItem = async (event) => {
    event.preventDefault();
    if (!image) {
      setMessage({ type: 'error', text: 'Choose a product photo first.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await authFetch('/artisan/catalogue', {
        token,
        method: 'POST',
        body: { ...form, image }
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.message || 'Could not add this product.' });
        return;
      }
      setCatalogue(data.catalogue || []);
      setForm(EMPTY_FORM);
      setImage('');
      setMessage({ type: 'success', text: `${data.item?.title || 'Product'} added. Clients can now find you by photo.` });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Upload failed. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (itemId) => {
    if (!window.confirm('Remove this product from your catalogue?')) return;
    try {
      const res = await authFetch(`/artisan/catalogue/${itemId}`, { token, method: 'DELETE' });
      const data = await res.json();
      if (res.ok) setCatalogue(data.catalogue || []);
      else setMessage({ type: 'error', text: data.message || 'Could not remove this product.' });
    } catch (err) {
      console.error(err);
    }
  };

  const atLimit = catalogue.length >= maxItems;

  return (
    <div className="glass-card">
      <h3 style={{ marginBottom: '6px' }}>
        Product Catalogue <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>(optional)</span>
      </h3>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
        Clients can search with a photo of the item they want. You are matched from the Products, Specializations and
        Description in your listing, so photos are not required. Adding a few product photos (1–2 per product type) makes
        your matches more accurate and shows your products in results. Leave fields blank and Scoutify AI will fill them from the photo.
      </p>

      {!hasListing ? (
        <p style={{ fontSize: '13px', color: 'var(--tone-warning-text)' }}>Save your listing details above before adding catalogue products.</p>
      ) : (
        <form onSubmit={addItem} style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div
              onClick={() => !busy && !atLimit && fileInput.current?.click()}
              style={{
                width: '140px',
                height: '140px',
                flexShrink: 0,
                borderRadius: '10px',
                border: '1px dashed var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: atLimit ? 'not-allowed' : 'pointer',
                overflow: 'hidden',
                position: 'relative',
                background: 'var(--surface-1)'
              }}
            >
              {image ? (
                <>
                  <img src={image} alt="Selected product" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ position: 'absolute', top: 6, right: 6, padding: '2px 6px' }}
                    onClick={(e) => { e.stopPropagation(); setImage(''); }}
                    aria-label="Remove photo"
                  >
                    <X size={12} />
                  </button>
                </>
              ) : (
                <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  <ImagePlus size={22} style={{ display: 'block', margin: '0 auto 6px' }} />
                  Add photo
                </div>
              )}
            </div>
            <input ref={fileInput} type="file" accept={IMAGE_ACCEPT} onChange={pickImage} style={{ display: 'none' }} />

            <div style={{ flex: 1, minWidth: '220px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <input className="form-control" placeholder="Product name" value={form.title} onChange={setField('title')} />
              <input className="form-control" placeholder="Category" value={form.category} onChange={setField('category')} />
              <input className="form-control" placeholder="Material" value={form.material} onChange={setField('material')} />
              <input className="form-control" placeholder="Short description" value={form.description} onChange={setField('description')} />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px', justifyContent: 'center' }} disabled={busy || atLimit}>
            {busy ? 'Analysing photo…' : atLimit ? `Catalogue full (${maxItems} products)` : 'Add to Catalogue'}
          </button>
        </form>
      )}

      {message && (
        <p style={{ fontSize: '13px', marginBottom: '14px', color: message.type === 'error' ? 'var(--color-danger)' : 'var(--color-primary)' }}>
          {message.text}
        </p>
      )}

      {catalogue.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>No catalogue products yet.</p>
      ) : (
        <>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '10px' }}>
            {catalogue.length} / {maxItems} products
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
            {catalogue.map(item => (
              <div key={item._id} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
                <img src={assetUrl(item.imageUrl)} alt={item.title} style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block' }} />
                <div style={{ padding: '8px 10px' }}>
                  <strong style={{ fontSize: '13px', display: 'block' }}>{item.title}</strong>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    {[item.category, item.material].filter(Boolean).join(' · ') || '—'}
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ width: '100%', marginTop: '8px', padding: '4px 8px', justifyContent: 'center', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                    onClick={() => removeItem(item._id)}
                  >
                    <Trash size={12} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default CatalogueManager;
