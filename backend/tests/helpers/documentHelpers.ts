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

// The shape POST /documents returns: ownerExternalId is stripped by the
// model's `omit`, so it never reaches the client.
export const buildCreatedDocument = (
  overrides: Partial<Document> = {},
): Omit<Document, "ownerExternalId"> => {
  const doc: Partial<Document> = buildFullDocument(overrides);
  delete doc.ownerExternalId;
  return doc as Omit<Document, "ownerExternalId">;
};

// The shape each element of GET /documents returns: both ownerExternalId and
// the heavy `data` blob are stripped by the model's `omit`.
export const buildListedDocument = (
  overrides: Partial<Document> = {},
): Omit<Document, "ownerExternalId" | "data"> => {
  const doc: Partial<Document> = buildFullDocument(overrides);
  delete doc.ownerExternalId;
  delete doc.data;
  return doc as Omit<Document, "ownerExternalId" | "data">;
};
