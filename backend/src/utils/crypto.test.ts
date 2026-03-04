import { afterEach, describe, expect, it, vi } from "vitest";
import { encrypt, decrypt } from "./crypto";
import { randomUUID } from "crypto";

describe("encrypt", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("encrypts data", () => {
    vi.stubEnv("VAULT_ENCRYPTION_KEY_BASE64", randomUUID().slice(0, 32));
    const iv = randomUUID();
    const encrypted = encrypt(Buffer.from("test"), iv.slice(0, 16));
    expect(encrypted).toBeDefined();
  });

  it("decrypts data", () => {
    vi.stubEnv("VAULT_ENCRYPTION_KEY_BASE64", randomUUID().slice(0, 32));
    const iv = randomUUID();
    const encrypted = encrypt(Buffer.from("test"), iv.slice(0, 16));
    const decrypted = decrypt(encrypted, iv.slice(0, 16));
    expect(decrypted).toEqual(Buffer.from("test"));
  });

  it("throws when encryption key is missing", () => {
    vi.stubEnv("VAULT_ENCRYPTION_KEY_BASE64", "");
    const iv = randomUUID().slice(0, 16);
    expect(() => encrypt(Buffer.from("test"), iv)).toThrow();
  });

  it("throws when encryption key has wrong length", () => {
    vi.stubEnv("VAULT_ENCRYPTION_KEY_BASE64", "too-short");
    const iv = randomUUID().slice(0, 16);
    expect(() => encrypt(Buffer.from("test"), iv)).toThrow(
      "must be exactly 32 bytes",
    );
  });
});
