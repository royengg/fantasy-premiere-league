import { randomBytes, scrypt as scryptCallback, scryptSync, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const PASSWORD_PREFIX = "scrypt";

function formatHash(salt: Buffer, hash: Buffer) {
  return `${PASSWORD_PREFIX}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function parseHash(encodedHash: string) {
  const [algorithm, saltHex, hashHex] = encodedHash.split("$");
  if (algorithm !== PASSWORD_PREFIX || !saltHex || !hashHex) {
    throw new Error("Password hash format is invalid.");
  }

  return {
    salt: Buffer.from(saltHex, "hex"),
    hash: Buffer.from(hashHex, "hex")
  };
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return formatHash(salt, derivedKey);
}

export function hashPasswordSync(password: string) {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  return formatHash(salt, derivedKey);
}

export async function verifyPassword(password: string, encodedHash: string) {
  const { salt, hash } = parseHash(encodedHash);
  const derivedKey = (await scrypt(password, salt, hash.length)) as Buffer;
  return timingSafeEqual(hash, derivedKey);
}
