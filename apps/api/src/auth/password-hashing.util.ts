import { randomBytes } from "node:crypto";
import { hash, verify, type Options } from "@node-rs/argon2";

const PASSWORD_HASH_OPTIONS: Options = {
  // @node-rs/argon2 exports ambient const enums that cannot be referenced with
  // isolatedModules. These are the library's documented values for Argon2id
  // and Argon2 version 19 respectively.
  algorithm: 2,
  version: 1,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

/**
 * Hashes a password with Argon2id and a fresh 128-bit salt. The encoded Argon2
 * string stores the salt and work parameters, so no separate database column is
 * needed and two users with the same password still receive different hashes.
 */
export function hashPassword(password: string): Promise<string> {
  return hash(password, {
    ...PASSWORD_HASH_OPTIONS,
    salt: randomBytes(16),
  });
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}
