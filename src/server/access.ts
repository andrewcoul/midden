import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";

// Cloudflare Access signs in the user before a request gets to the Worker. Access then adds a
// signed JWT in the Cf-Access-Jwt-Assertion header. midden checks the signature, the team
// (issuer), and the application (audience). It does not use ctx.access: TanStack Start serves
// static assets, and Workers with static assets do not get ctx.access.
export const ACCESS_HEADER = "cf-access-jwt-assertion";

/** Accepts "myteam", "myteam.cloudflareaccess.com", or a full URL. */
export function teamUrl(value: string) {
  const v = value.trim().replace(/\/+$/, "");
  if (/^https?:\/\//.test(v)) return v;
  return `https://${v.includes(".") ? v : `${v}.cloudflareaccess.com`}`;
}

export function accessVerifier(teamDomain: string, aud: string) {
  const issuer = teamUrl(teamDomain);
  const keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
  return async (token: string): Promise<string | null> => {
    try {
      const { payload } = await jwtVerify(token, keys, { issuer, audience: aud });
      return typeof payload.email === "string" ? payload.email.toLowerCase() : null;
    } catch {
      return null;
    }
  };
}

/**
 * Reads the team and the audience from a token without a signature check. Use this only to show
 * the values on the setup page. Never use it to sign in.
 */
export function peekAccess(token: string) {
  try {
    const p = decodeJwt(token);
    const aud = Array.isArray(p.aud) ? p.aud[0] : p.aud;
    if (typeof p.iss === "string" && typeof aud === "string") return { teamDomain: p.iss, aud };
  } catch {
    // Not a JWT.
  }
  return null;
}
