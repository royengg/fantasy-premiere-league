import { randomBytes, scrypt as scryptCallback, scryptSync, timingSafeEqual } from "node:crypto";
const KEY_LENGTH = 64;
const PASSWORD_PREFIX = "scrypt";
const SCRYPT_OPTIONS = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024
} as const;

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
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, value) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(value as Buffer);
    });
  });
  return formatHash(salt, derivedKey);
}

export function hashPasswordSync(password: string) {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return formatHash(salt, derivedKey);
}

export async function verifyPassword(password: string, encodedHash: string) {
  const { salt, hash } = parseHash(encodedHash);
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, hash.length, SCRYPT_OPTIONS, (error, value) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(value as Buffer);
    });
  });
  return timingSafeEqual(hash, derivedKey);
}
