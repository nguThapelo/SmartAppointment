import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

const COST = 12;

export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

// A real hash of a random string, so a login for an unknown email still spends
// the same bcrypt time as a wrong password (no user enumeration by timing).
let dummyHash: Promise<string> | undefined;
export function burnPasswordCheck(plain: string) {
  dummyHash ??= bcrypt.hash(randomBytes(16).toString("hex"), COST);
  return dummyHash.then((h) => bcrypt.compare(plain, h)).then(() => false);
}

/** Random URL-safe token for emailed links; only its sha256 is stored. */
export function createOpaqueToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: sha256(token) };
}

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
