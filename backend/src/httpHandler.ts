import { PrismaClient } from "../generated/prisma/client";
import {
  createDocument,
  deleteDocument,
  getDocumentsByOwner,
} from "./model/document";
import { IncomingMessage, ServerResponse } from "http";
import formidable from "formidable";
import { createImage, deleteImage, getImage } from "./model/image";
import {
  downloadEncryptedImage,
  uploadEncryptedImage,
} from "./utils/uploaderDownloader";
import { checkPermission } from "./permissions";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { deleteImageFromBucket } from "./utils/s3";

const DEFAULT_MAX_IMAGE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB default

export const handleHealthRequest = (
  response: ServerResponse<IncomingMessage>,
): void => {
  response.writeHead(200, { "Content-Type": "text/plain" });
  response.end("OK");
};

export const handleCreateDocumentRequest = async (
  response: ServerResponse<IncomingMessage>,
  prisma: PrismaClient,
  personId: string | null,
): Promise<void> => {
  console.debug(`Creating new document`);
  // return a new document:
  const document = await createDocument(prisma, personId).catch(
    (error: Error) => {
      console.error(error);
      throw error;
    },
  );

  response.writeHead(200, { "Content-Type": "text/json" });
  response.end(JSON.stringify(document));
};

export const handleGetOwnDocumentsRequest = async (
  response: ServerResponse<IncomingMessage>,
  prisma: PrismaClient,
  personId: string,
): Promise<void> => {
  if (!personId) {
    response.writeHead(200, { "Content-Type": "text/json" });
    response.end(JSON.stringify([]));
    return;
  }
  console.debug(`Fetching documents for ownerExternalId=${personId}`);
  const documents = await getDocumentsByOwner(prisma, personId).catch(
    (error: Error) => {
      console.error(error);
      throw error;
    },
  );
  response.writeHead(200, { "Content-Type": "text/json" });
  response.end(JSON.stringify(documents));
};

export const handleDeleteDocumentRequest = async (
  documentId: string,
  modificationSecret: string,
  response: ServerResponse<IncomingMessage>,
  prisma: PrismaClient,
): Promise<void> => {
  const result = await deleteDocument(prisma, documentId, modificationSecret);
  if (result) {
    response.writeHead(200);
  } else {
    response.writeHead(404);
  }
  response.end();
};

export const handleUploadImageRequest = async (
  documentId: string,
  modificationSecret: string,
  request: IncomingMessage,
  response: ServerResponse<IncomingMessage>,
  prisma: PrismaClient,
): Promise<void> => {
  const hasPermission = await checkPermission(
    prisma,
    documentId,
    modificationSecret,
  );
  if (!hasPermission) {
    response.writeHead(403);
    response.end();
    return;
  }
  try {
    const parsed = parseInt(process.env.UPLOAD_IMAGE_MAX_SIZE_BYTES ?? "", 10);
    const maxFileSize = Number.isNaN(parsed)
      ? DEFAULT_MAX_IMAGE_SIZE_BYTES
      : parsed;

    const form = formidable({ multiples: false, maxFileSize });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_fields, files] = await form.parse(request);
    if (!files["file"] || files["file"].length === 0) {
      response.writeHead(400);
      response.end();
      return;
    }
    const file = files["file"][0];
    const image = await createImage(
      prisma,
      documentId,
      file?.mimetype,
      file?.originalFilename,
    );
    if (!image) {
      response.writeHead(422);
      response.end();
      return;
    }
    try {
      await uploadEncryptedImage(image.id, image.mimetype, file?.filepath);
    } catch (uploadError) {
      await deleteImage(prisma, image.id);
      throw uploadError;
    }
    response.writeHead(200, { "Content-Type": "text/json" });
    response.end(JSON.stringify({ imageUrl: `images/${image.id}` }));
  } catch (error) {
    if (error instanceof Error && error.message.includes("maxTotalFileSize")) {
      response.writeHead(413, { "Content-Type": "text/json" });
      response.end(
        JSON.stringify({ error: "File size exceeds maximum allowed size" }),
      );
      return;
    }
    console.error(error);
    response.writeHead(500);
    response.end();
  }
};

export const handleGetImageRequest = async (
  imageId: string,
  response: ServerResponse<IncomingMessage>,
  prisma: PrismaClient,
): Promise<void> => {
  const getImageResult = await getImage(prisma, imageId);
  const downloadedImage = getImageResult
    ? await downloadEncryptedImage(imageId)
    : null;
  if (getImageResult && downloadedImage) {
    response.writeHead(200, {
      "Content-Type": getImageResult.mimetype,
      "Content-Disposition": `inline; filename="${getImageResult.name.replace(/["\\\r\n]/g, "_")}"`,
      "Content-Length": downloadedImage.length,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    });
    try {
      await pipeline(Readable.from(downloadedImage), response);
    } catch (error) {
      if (
        error instanceof Error &&
        (error as NodeJS.ErrnoException).code === "ERR_STREAM_PREMATURE_CLOSE"
      ) {
        return;
      }
      throw error;
    }
  } else {
    response.writeHead(404);
  }
  response.end();
};

export const handleDeleteImageRequest = async (
  imageId: string,
  modificationSecret: string,
  response: ServerResponse<IncomingMessage>,
  prisma: PrismaClient,
): Promise<void> => {
  const image = await getImage(prisma, imageId);

  const hasPermission = await checkPermission(
    prisma,
    image?.documentId,
    modificationSecret,
  );
  if (!hasPermission) {
    response.writeHead(403);
    response.end();
    return;
  }
  // Delete bucket file first so DB record remains as reference if this fails
  const bucketResult = image ? await deleteImageFromBucket(imageId) : null;
  const deletedImageResult = bucketResult
    ? await deleteImage(prisma, imageId)
    : null;
  if (bucketResult && deletedImageResult) {
    response.writeHead(204);
  } else {
    response.writeHead(404);
  }
  response.end();
};
