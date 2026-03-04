import crypto from "crypto";
import { PrismaClient } from "../generated/prisma/client";
import { fetchDocument } from "./model/document";

const checkModificationSecret = async (
  prisma: PrismaClient,
  documentId: string,
  modificationSecret: string,
) => {
  const document = await fetchDocument(prisma, documentId);
  if (!document) return false;

  const a = Buffer.from(document.modificationSecret);
  const b = Buffer.from(modificationSecret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const checkPermission = async (
  prisma: PrismaClient,
  documentId: string,
  modificationSecret: string,
): Promise<boolean> => {
  return !!(await checkModificationSecret(
    prisma,
    documentId,
    modificationSecret,
  ));
};
