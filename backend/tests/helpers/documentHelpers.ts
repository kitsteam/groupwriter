import { randomUUID } from "crypto";
import type { Document } from "../../generated/prisma/client";

export const buildExampleDocument = (
  lastAccessedAt?: Date,
): Omit<Document, "id" | "modificationSecret" | "createdAt" | "updatedAt"> &
  Partial<Document> => {
  const data = new TextEncoder().encode("example");
  return {
    data,
    lastAccessedAt: lastAccessedAt ?? new Date(),
    ownerExternalId: null,
  };
};

export const buildFullDocument = (
  overrides: Partial<Document> = {},
): Document => {
  const now = new Date();
  return {
    id: randomUUID(),
    modificationSecret: randomUUID(),
    ownerExternalId: null,
    data: new TextEncoder().encode("example"),
    createdAt: now,
    updatedAt: now,
    lastAccessedAt: now,
    ...overrides,
  };
};
