import jwt from "jsonwebtoken";

/** Claims Clara's ID token carries, per the spec's contoh claims (Bagian B, "Validasi ID Token"). */
export interface ClaraIdTokenClaims {
  iss: string;
  aud: string;
  sub: string;
  name?: string;
  email?: string;
  role: string;
  organizationId: string;
  teamId?: string | null;
  isActive: boolean;
  scope?: string;
  token_use?: string;
  nonce: string;
  iat: number;
  exp: number;
  jti?: string;
}

export class ClaraIdTokenError extends Error {}

export interface ValidateClaraIdTokenParams {
  idToken: string;
  clientSecret: string;
  issuer: string;
  audience: string;
  expectedNonce: string;
  allowedRoles: string[];
  allowedOrganizationId?: string;
}

/**
 * Validates a Clara ID token exactly per Bagian B, "Validasi ID Token": HS256 only (never trust
 * an `alg` from the token itself), issuer/audience/expiry, nonce round-trip, and the business
 * checks (isActive, organizationId present, role allowed) before the caller may treat `sub` as
 * a trustworthy claraUserId.
 */
export function validateClaraIdToken(params: ValidateClaraIdTokenParams): ClaraIdTokenClaims {
  const { idToken, clientSecret, issuer, audience, expectedNonce, allowedRoles, allowedOrganizationId } = params;

  let decoded: ClaraIdTokenClaims;
  try {
    decoded = jwt.verify(idToken, clientSecret, { algorithms: ["HS256"] }) as ClaraIdTokenClaims;
  } catch (error) {
    throw new ClaraIdTokenError(`id_token_verify_failed: ${(error as Error).message}`);
  }

  if (decoded.iss !== issuer) throw new ClaraIdTokenError("id_token_issuer_mismatch");
  if (decoded.aud !== audience) throw new ClaraIdTokenError("id_token_audience_mismatch");
  if (decoded.nonce !== expectedNonce) throw new ClaraIdTokenError("id_token_nonce_mismatch");
  if (!decoded.sub) throw new ClaraIdTokenError("id_token_missing_sub");
  if (!decoded.organizationId) throw new ClaraIdTokenError("id_token_missing_organization");
  if (allowedOrganizationId && decoded.organizationId !== allowedOrganizationId) {
    throw new ClaraIdTokenError("id_token_organization_not_allowed");
  }
  if (decoded.isActive !== true) throw new ClaraIdTokenError("id_token_user_inactive");
  if (!allowedRoles.includes(decoded.role)) throw new ClaraIdTokenError("id_token_role_not_allowed");

  return decoded;
}
