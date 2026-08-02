import jwt from "jsonwebtoken";
import { createPublicKey, type KeyObject } from "crypto";

import { env } from "../config";
import { generateOpaqueToken } from "../utils/crypto";
import { UnauthorizedError } from "../utils/ApiError";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUER = "https://accounts.google.com";

export interface GoogleUserProfile {
  sub: string;
  email: string;
  name: string;
  picture: string | null;
  email_verified: boolean;
}

interface CachedJwks {
  keys: Array<{ kid: string; n: string; e: string; kty: string; alg: string }>;
  fetchedAt: number;
}

let cachedJwks: CachedJwks | null = null;

function requireGoogleCredentials(): { clientId: string; clientSecret: string; redirectUri: string } {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new UnauthorizedError("Google OAuth is not configured on this server.");
  }
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI || `${env.CLIENT_URL}/auth/callback`,
  };
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function buildGoogleAuthUrl(): { url: string; state: string } {
  const { clientId, redirectUri } = requireGoogleCredentials();
  const state = generateOpaqueToken(16);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state,
  });
  return { url: `${GOOGLE_AUTH_URL}?${params.toString()}`, state };
}

async function fetchJwks(): Promise<CachedJwks["keys"]> {
  if (cachedJwks && Date.now() - cachedJwks.fetchedAt < 5 * 60 * 1000) {
    return cachedJwks.keys;
  }
  const res = await fetch(GOOGLE_JWKS_URL, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new UnauthorizedError("Unable to fetch Google signing keys.");
  }
  const body = (await res.json()) as { keys: Array<{ kid: string; n: string; e: string; kty: string; alg: string }> };
  cachedJwks = { keys: body.keys, fetchedAt: Date.now() };
  return body.keys;
}

function jwkToPublicKey(jwk: { kty: string; n: string; e: string }): KeyObject {
  return createPublicKey({ key: jwk, format: "jwk" });
}

interface GoogleIdTokenPayload {
  sub: string;
  email: string;
  name: string;
  picture: string | null;
  email_verified: boolean;
}

export async function verifyGoogleIdToken(idToken: string, expectedClientId: string): Promise<GoogleIdTokenPayload> {
  const keys = await fetchJwks();
  const decoded = jwt.decode(idToken, { complete: true }) as { header?: { kid?: string } } | null;
  const kid = decoded?.header?.kid;
  const signingKey = keys.find((k) => k.kid === kid);

  if (!signingKey) {
    throw new UnauthorizedError("Google ID token was signed by an unknown key.");
  }

  try {
    const payload = jwt.verify(idToken, jwkToPublicKey(signingKey), {
      issuer: GOOGLE_ISSUER,
      audience: expectedClientId,
      algorithms: ["RS256"],
    }) as GoogleIdTokenPayload;

    return {
      sub: payload.sub,
      email: (payload.email ?? "").toLowerCase(),
      name: payload.name ?? "",
      picture: payload.picture ?? null,
      email_verified: payload.email_verified ?? false,
    };
  } catch {
    throw new UnauthorizedError("Google ID token verification failed.");
  }
}

export async function exchangeGoogleCode(code: string): Promise<GoogleUserProfile> {
  const { clientId, clientSecret, redirectUri } = requireGoogleCredentials();

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!tokenRes.ok) {
    throw new UnauthorizedError("Google authorization code is invalid or expired.");
  }

  const tokenBody = (await tokenRes.json()) as { id_token?: string; access_token?: string };

  if (tokenBody.id_token) {
    return verifyGoogleIdToken(tokenBody.id_token, clientId);
  }

  if (!tokenBody.access_token) {
    throw new UnauthorizedError("Google did not return a valid token.");
  }

  const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenBody.access_token}` },
  });
  if (!infoRes.ok) {
    throw new UnauthorizedError("Unable to fetch Google profile.");
  }
  const profile = (await infoRes.json()) as {
    sub: string;
    email?: string;
    name?: string;
    picture?: string | null;
    email_verified?: boolean;
  };
  return {
    sub: profile.sub,
    email: (profile.email ?? "").toLowerCase(),
    name: profile.name ?? "",
    picture: profile.picture ?? null,
    email_verified: profile.email_verified ?? false,
  };
}
