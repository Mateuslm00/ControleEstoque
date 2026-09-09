import argon2 from "argon2";

const ARGON2_OPTS = {
  type: argon2.argon2id,
  memoryCost: 19456, // ~19 MB, recomendacao OWASP para argon2id
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
