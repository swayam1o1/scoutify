// Vendor listing moderation states.
// 'verified' is the legacy value written by the CSV importer and is treated as
// approved so bulk-imported vendors keep showing up in search.
const CONTACT_STATUSES = ['pending', 'approved', 'rejected', 'verified'];

// Statuses that are allowed to appear in public search results.
const PUBLIC_CONTACT_STATUSES = ['approved', 'verified'];

// Statuses an admin may assign by hand.
const ADMIN_ASSIGNABLE_STATUSES = ['pending', 'approved', 'rejected'];

const PUBLIC_STATUS_FILTER = { contactStatus: { $in: PUBLIC_CONTACT_STATUSES } };

module.exports = {
  CONTACT_STATUSES,
  PUBLIC_CONTACT_STATUSES,
  ADMIN_ASSIGNABLE_STATUSES,
  PUBLIC_STATUS_FILTER
};
