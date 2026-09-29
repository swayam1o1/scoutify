/**
 * Shared normalisation for vendor listing fields, used by the artisan
 * self-service route and the admin vendor endpoints.
 */

// Accepts an array or a comma separated string and returns a clean string list.
function toList(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (value === undefined || value === null || value === '') return [];
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function buildSearchText({ companyName, personOfContact, city, serviceArea, specialization, products, customTags }) {
  return [
    companyName,
    personOfContact,
    city,
    serviceArea,
    specialization?.join(', '),
    products?.join(', '),
    customTags?.join(', ')
  ].filter(Boolean).join(' | ');
}

// Vendor-editable listing fields, in the order admins review them.
const LISTING_FIELDS = [
  { key: 'companyName', label: 'Company name' },
  { key: 'phoneNumber', label: 'Phone number' },
  { key: 'email', label: 'Listing email' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'city', label: 'City' },
  { key: 'serviceArea', label: 'Service area' },
  { key: 'personOfContact', label: 'Person of contact' },
  { key: 'website', label: 'Website' },
  { key: 'description', label: 'Description' },
  { key: 'specialization', label: 'Specializations', list: true },
  { key: 'products', label: 'Products', list: true },
  { key: 'customTags', label: 'Custom tags', list: true },
  { key: 'portfolio', label: 'Portfolio links', list: true }
];

function pickListingSnapshot(listing = {}) {
  const snapshot = {};
  for (const { key, list } of LISTING_FIELDS) {
    const value = listing[key];
    snapshot[key] = list ? toList(value ? [...value] : []) : String(value ?? '').trim();
  }
  return snapshot;
}

function diffListing(before = {}, after = {}) {
  const changes = [];
  for (const { key, label, list } of LISTING_FIELDS) {
    if (list) {
      const oldList = toList(before[key]);
      const newList = toList(after[key]);
      const added = newList.filter(item => !oldList.includes(item));
      const removed = oldList.filter(item => !newList.includes(item));
      if (added.length || removed.length) changes.push({ field: key, label, list: true, before: oldList, after: newList, added, removed });
    } else {
      const oldValue = String(before[key] ?? '').trim();
      const newValue = String(after[key] ?? '').trim();
      if (oldValue !== newValue) changes.push({ field: key, label, before: oldValue, after: newValue });
    }
  }
  return changes;
}

module.exports = { toList, buildSearchText, LISTING_FIELDS, pickListingSnapshot, diffListing };
