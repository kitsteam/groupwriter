import {
  handleCreateDocumentRequest,
  handleDeleteDocumentRequest,
  handleDeleteImageRequest,
  handleGetImageRequest,
  handleUploadImageRequest,
  handleGetOwnDocumentsRequest,
} from "./httpHandler";
import { PrismaClient } from "../generated/prisma/client";
import { onRequestPayload } from "@hocuspocus/server";
import jwt from "jsonwebtoken";
import { parse } from "cookie";

/*
  This very basic router is used to handle the http requests to the server.
  The reject pattern is used as it is needed for hocuspocus control flow.
*/
const httpRouter = async (data: onRequestPayload, prisma: PrismaClient) => {
  const { request, response } = data;
  const method = request.method;
  const splittedUrl = request.url?.split("/");
  const resource = splittedUrl[1];
  const subResource = splittedUrl.length > 3 ? splittedUrl[3] : null;
  const resourceId = splittedUrl.length > 2 ? splittedUrl[2] : null;
  const modificationSecret = request.headers.authorization;
  const personId = extractPersonIdFromCookies(request.headers.cookie);

  if (method === "POST" && resource === "documents" && !subResource) {
    await handleCreateDocumentRequest(response, prisma, personId);
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    return Promise.reject();
  }

  if (method === "GET" && resource === "documents" && !subResource) {
    await handleGetOwnDocumentsRequest(response, prisma, personId);
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    return Promise.reject();
  }

  if (method === "DELETE" && resource === "documents" && !subResource) {
    await handleDeleteDocumentRequest(
      resourceId,
      modificationSecret,
      response,
      prisma,
    );
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    return Promise.reject();
  }

  if (
    method === "POST" &&
    resource === "documents" &&
    subResource === "images"
  ) {
    await handleUploadImageRequest(
      resourceId,
      modificationSecret,
      request,
      response,
      prisma,
    );
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    return Promise.reject();
  }

  if (method === "GET" && resource === "images") {
    await handleGetImageRequest(resourceId, response, prisma);
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    return Promise.reject();
  }

  if (method === "DELETE" && resource === "images") {
    await handleDeleteImageRequest(
      resourceId,
      modificationSecret,
      response,
      prisma,
    );
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    return Promise.reject();
  }
};

function extractPersonIdFromCookies(cookies?: string): string | null {
  if (!cookies) {
    return null;
  }
  const parsedCookies = parse(cookies);
  let personId = parsedCookies["person_id"];
  const secret = process.env.JWT_SECRET;

  try {
    const decoded = jwt.verify(personId, secret, {
      algorithms: ["HS256"],
    }) as { pid: string };
    personId = decoded.pid;
  } catch {
    console.error("JWT verification failed for person_id cookie");
    return null;
  }
  return personId || null;
}

export default httpRouter;
