/** Mirrors backend/utils/vendorVerification.js for live UI checks. */

export function normalizeVendorType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (['firm', 'architectural_firm', 'design_firm', 'company'].includes(raw)) return 'firm';
  if (['individual', 'freelancer', 'artisan'].includes(raw)) return 'individual';
  return 'individual';
}

function hasText(value) {
  return Boolean(String(value || '').trim());
}

function listLen(value) {
  return Array.isArray(value) ? value.filter(Boolean).length : 0;
}

function requiredChecks(listing, vendorType) {
  const type = normalizeVendorType(vendorType || listing.vendorType);
  const checks = [
    { key: 'companyName', label: type === 'firm' ? 'Company / firm name' : 'Studio or trade name', ok: hasText(listing.companyName) },
    { key: 'city', label: 'City', ok: hasText(listing.city) },
    { key: 'phoneNumber', label: 'Phone number', ok: hasText(listing.phoneNumber) }
  ];

  if (type === 'firm') {
    checks.push({
      key: 'specialization',
      label: 'At least one specialization',
      ok: listLen(listing.specialization) > 0
    });
    return checks;
  }

  checks.push(
    { key: 'personOfContact', label: 'Person of contact', ok: hasText(listing.personOfContact) },
    { key: 'specialization', label: 'At least one specialization', ok: listLen(listing.specialization) > 0 },
    { key: 'description', label: 'Studio description (min 40 characters)', ok: String(listing.description || '').trim().length >= 40 },
    {
      key: 'proof',
      label: 'Portfolio link, products list, or catalogue photo',
      ok: listLen(listing.portfolio) > 0
        || listLen(listing.products) > 0
        || listLen(listing.catalogue) > 0
        || Number(listing.catalogueCount) > 0
    }
  );
  return checks;
}

function recommendedChecks(listing, vendorType) {
  const type = normalizeVendorType(vendorType || listing.vendorType);
  if (type === 'firm') {
    return [
      { key: 'websiteOrInstagram', label: 'Website or Instagram', ok: hasText(listing.website) || hasText(listing.instagram) },
      { key: 'description', label: 'Short description', ok: String(listing.description || '').trim().length >= 20 },
      { key: 'serviceArea', label: 'Service area', ok: hasText(listing.serviceArea) }
    ];
  }
  return [
    { key: 'instagram', label: 'Instagram', ok: hasText(listing.instagram) },
    { key: 'website', label: 'Website', ok: hasText(listing.website) },
    {
      key: 'catalogue',
      label: 'Catalogue photo',
      ok: listLen(listing.catalogue) > 0 || Number(listing.catalogueCount) > 0
    }
  ];
}

export function assessVendorListing(listing = {}, vendorType) {
  const type = normalizeVendorType(vendorType || listing.vendorType);
  const required = requiredChecks(listing, type);
  const recommended = recommendedChecks(listing, type);
  const missingRequired = required.filter(item => !item.ok).map(item => item.label);
  const missingRecommended = recommended.filter(item => !item.ok).map(item => item.label);
  return {
    vendorType: type,
    verificationTier: type === 'firm' ? 'light' : 'strict',
    readyForReview: missingRequired.length === 0,
    missingRequired,
    missingRecommended,
    required,
    recommended
  };
}
