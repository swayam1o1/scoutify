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

module.exports = { toList, buildSearchText };
