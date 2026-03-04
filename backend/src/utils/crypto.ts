import crypto from "crypto";

// TODO: The IV is currently derived from the image UUID, which is publicly known.
// This is acceptable for now since images are accessible by ID anyway, but a
// random IV (stored alongside the ciphertext or in the DB) would be more robust.
const algorithm = "aes-256-cbc";

const getKey = (): string => {
  const key = process.env.VAULT_ENCRYPTION_KEY_BASE64;
  if (!key) {
    throw new Error(
      "VAULT_ENCRYPTION_KEY_BASE64 environment variable is not set",
    );
  }
  if (Buffer.byteLength(key, "utf-8") !== 32) {
    throw new Error(
      "VAULT_ENCRYPTION_KEY_BASE64 must be exactly 32 bytes for AES-256",
    );
  }
  return key;
};

export const encrypt = (data: Buffer, iv: string): Buffer => {
  const key = getKey();
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = cipher.update(data);
  return Buffer.concat([encrypted, cipher.final()]);
};

export const decrypt = (data: Buffer, iv: string): Buffer => {
  const key = getKey();
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  const decrypted = decipher.update(data);
  return Buffer.concat([decrypted, decipher.final()]);
};
