import { createRemoteJWKSet, jwtVerify } from "jose";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);

export function googleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}

/**
 * The origin the browser actually reached us on — honoring proxy headers
 * (Vercel/any reverse proxy). This is what keeps OAuth on the SAME domain the
 * user started from, so multi-domain deployments each hold their own session.
 */
export function originFromRequest(request: Request): string {
  const url = new URL(request.url);
  const proto = (request.headers.get("x-forwarded-proto") || url.protocol.replace(/:$/, ""))
    .split(",")[0]
    .trim();
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host)
    .split(",")[0]
    .trim();
  return `${proto}://${host}`;
}

export function redirectUri(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/api/auth/callback/google`;
}

export function buildAuthUrl(state: string, origin: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export type GoogleProfile = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
};

export async function exchangeCode(code: string, origin: string): Promise<GoogleProfile> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      // MUST match the redirect_uri used to obtain the code (same origin)
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data: { id_token?: string } = await res.json();
  if (!data.id_token) throw new Error("No id_token in token response");

  const { payload } = await jwtVerify(data.id_token, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: process.env.GOOGLE_CLIENT_ID!,
  });

  const { sub, email, email_verified, name, picture } = payload as {
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };
  if (!sub || !email) throw new Error("Google profile missing sub/email");
  // The email is used as an authorization key: it claims invited accounts.
  // An unverified address must never be allowed to claim anything — Google's
  // own guidance is to treat email as an identifier only when verified.
  if (email_verified === false) throw new Error("Google account email is not verified");
  // one identity model: emails are compared lowercase everywhere
  return { sub, email: email.toLowerCase(), name: name || email.split("@")[0], picture };
}
