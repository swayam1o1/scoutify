const ADMIN_PATH = '/admin';

export function getPathname() {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

export function isAdminPath(pathname = getPathname()) {
  return pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`);
}

export function viewFromPath(pathname = getPathname()) {
  return isAdminPath(pathname) ? 'admin' : null;
}

/** Keep the browser URL in sync when entering/leaving the admin console. */
export function syncUrlForView(view) {
  const onAdmin = isAdminPath();
  if (view === 'admin' && !onAdmin) {
    window.history.pushState({ view: 'admin' }, '', ADMIN_PATH);
  } else if (view !== 'admin' && onAdmin) {
    window.history.pushState({ view }, '', '/');
  }
}
