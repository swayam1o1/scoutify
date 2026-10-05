// Message a client sends a vendor. Keep it neutral: vendors don't know the client's board names.
export function vendorWhatsappMessage(vendor) {
  const name = vendor?.personOfContact || vendor?.companyName;
  return `Hi${name ? ` ${name}` : ''}, we found your profile on Scoutify and would like to discuss your services/products further.`;
}

// wa.me link for the first listed Indian number, or null when the vendor has no phone.
export function vendorWhatsappUrl(vendor) {
  const digits = String(vendor?.phoneNumber || '').split('/')[0].replace(/[^0-9]/g, '');
  if (!digits) return null;
  return `https://wa.me/91${digits}?text=${encodeURIComponent(vendorWhatsappMessage(vendor))}`;
}
