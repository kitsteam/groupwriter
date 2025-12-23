import { randomUUID } from "crypto";
import type { Image } from "../../generated/prisma/client";

export const buildExampleImage = (
  documentId: string,
): Omit<Image, "id" | "createdAt" | "updatedAt"> => {
  return {
    documentId,
    name: "test.png",
    mimetype: "image/png",
  };
};

export const buildFullExampleImage = (
  documentId: string,
  overrides: Partial<Image> = {},
): Image => {
  const now = new Date();
  return {
    id: randomUUID(),
    documentId,
    name: "test.png",
    mimetype: "image/png",
    updatedAt: now,
    createdAt: now,
    ...overrides,
  };
};
