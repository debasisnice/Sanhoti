/** Default landing path after login/register (admins → admin portal, members → profile). */
export function getDefaultAuthenticatedPath(isAdmin: boolean): string {
  return isAdmin ? '/admin' : '/dashboard';
}

/** Post-login destination: honor a safe internal `from` path, else role default. */
export function getPostLoginPath(isAdmin: boolean, from?: string | null): string {
  if (from && from.startsWith('/') && !from.startsWith('//') && from !== '/login' && from !== '/register') {
    return from;
  }
  return getDefaultAuthenticatedPath(isAdmin);
}
