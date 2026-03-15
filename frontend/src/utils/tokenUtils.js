/**
 * JWT Token Utilities
 * Provides helpers to check token expiry and clear auth state.
 */

/**
 * Checks whether a JWT token is expired by decoding the payload
 * and comparing the `exp` claim against the current time.
 * Returns true if the token is expired or malformed.
 */
export function isTokenExpired(token) {
    if (!token) return true;

    try {
        // JWT structure: header.payload.signature
        const payload = token.split('.')[1];
        if (!payload) return true;

        // Base64url decode the payload
        const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));

        if (!decoded.exp) return true;

        // exp is in seconds, Date.now() is in milliseconds
        return decoded.exp * 1000 < Date.now();
    } catch {
        // If anything goes wrong parsing, treat the token as expired
        return true;
    }
}

/**
 * Clears all auth-related data from localStorage.
 */
export function clearAuth() {
    localStorage.removeItem('token');
    localStorage.removeItem('userType');
}
