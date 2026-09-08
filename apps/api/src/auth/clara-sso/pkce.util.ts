import crypto from "node:crypto";

export interface PkceAttempt {
  state: string;
  nonce: string;
  codeVerifier: string;
  codeChallenge: string;
}

const base64url = (value: Buffer) => value.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");

/**
 * Generates a fresh state, nonce, and PKCE (S256) pair for one Clara SSO login attempt.
 * Mirrors the reference implementation in the spec (Bagian B, "Membuat PKCE, State, dan Nonce")
 * exactly: state/nonce from 32/32 random bytes, code_verifier from 64 random bytes (all
 * base64url, so state is ~43 chars and nonce ~43 chars — within the 16-512 / 16-255 ranges
 * Clara's authorization endpoint requires; code_verifier ~86 chars, within PKCE's 43-128).
 */
export function generatePkceAttempt(): PkceAttempt {
  const state = base64url(crypto.randomBytes(32));
  const nonce = base64url(crypto.randomBytes(32));
  const codeVerifier = base64url(crypto.randomBytes(64));
  const codeChallenge = base64url(crypto.createHash("sha256").update(codeVerifier, "ascii").digest());
  return { state, nonce, codeVerifier, codeChallenge };
}
