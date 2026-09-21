/**
 * Client-side path ↔ view mapping (History API).
 *
 * Routes:
 *   /              → search
 *   /search        → search
 *   /plans         → pricing (alias: /pricing)
 *   /profile       → dashboard / account portal (alias: /dashboard)
 *   /boards        → boards list
 *   /boards/:id    → board details
 *   /admin         → admin console
 */

const AUTH_VIEWS = new Set(['dashboard', 'boards', 'board-details', 'admin']);

export function getPathname() {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

function normalizePath(pathname = getPathname()) {
  const raw = String(pathname || '/').replace(/\/+$/, '') || '/';
  return raw.toLowerCase();
}

/** Canonical browser path for a view. */
export function pathForView(view, { boardId } = {}) {
  switch (view) {
    case 'search':
      return '/';
    case 'pricing':
      return '/plans';
    case 'dashboard':
      return '/profile';
    case 'boards':
      return '/boards';
    case 'board-details':
      return boardId ? `/boards/${boardId}` : '/boards';
    case 'admin':
      return '/admin';
    default:
      return '/';
  }
}

/**
 * Parse the current (or given) pathname into { view, boardId }.
 */
export function parseLocation(pathname = getPathname()) {
  const path = normalizePath(pathname);

  if (path === '/admin' || path.startsWith('/admin/')) {
    return { view: 'admin', boardId: null };
  }

  if (path === '/plans' || path === '/pricing') {
    return { view: 'pricing', boardId: null };
  }

  if (path === '/profile' || path === '/dashboard') {
    return { view: 'dashboard', boardId: null };
  }

  if (path === '/boards') {
    return { view: 'boards', boardId: null };
  }

  const boardMatch = path.match(/^\/boards\/([^/]+)$/);
  if (boardMatch) {
    return { view: 'board-details', boardId: boardMatch[1] };
  }

  if (path === '/' || path === '/search') {
    return { view: 'search', boardId: null };
  }

  // Unknown path → home
  return { view: 'search', boardId: null };
}

/** @deprecated Prefer parseLocation().view */
export function viewFromPath(pathname = getPathname()) {
  return parseLocation(pathname).view;
}

export function isAdminPath(pathname = getPathname()) {
  const path = normalizePath(pathname);
  return path === '/admin' || path.startsWith('/admin/');
}

export function isAuthRequiredView(view) {
  return AUTH_VIEWS.has(view);
}

/**
 * Keep the browser URL in sync with the active view.
 * Uses replaceState when already on the same path to avoid noisy history.
 */
export function syncUrlForView(view, { boardId, replace = false } = {}) {
  const nextPath = pathForView(view, { boardId });
  const current = getPathname().toLowerCase() || '/';
  const target = nextPath.toLowerCase();

  if (current === target) return;

  const state = { view, boardId: boardId || null };
  if (replace) {
    window.history.replaceState(state, '', nextPath);
  } else {
    window.history.pushState(state, '', nextPath);
  }
}

export default {
  getPathname,
  pathForView,
  parseLocation,
  viewFromPath,
  isAdminPath,
  isAuthRequiredView,
  syncUrlForView
};
