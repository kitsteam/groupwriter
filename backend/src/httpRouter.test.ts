import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";
import httpRouter from "./httpRouter";
import { onRequestPayload } from "@hocuspocus/server";
import {
  handleCreateDocumentRequest,
  handleDeleteDocumentRequest,
  handleDeleteImageRequest,
  handleGetImageRequest,
  handleUploadImageRequest,
  handleGetOwnDocumentsRequest,
  handleHealthRequest,
} from "./httpHandler";
import jwt from "jsonwebtoken";

vi.mock("./httpHandler");

describe("httpRouter", () => {
  it("responds with OK to health check", async () => {
    const payload = mock<onRequestPayload>();
    payload.request.method = "GET";
    payload.request.url = "/";
    payload.request.headers = {};

    await expect(httpRouter(payload, null)).rejects.toThrow();
    expect(handleHealthRequest).toHaveBeenCalled();
  });

  it("posts documents", async () => {
    const payload = mock<onRequestPayload>();
    payload.request.method = "POST";
    payload.request.url = "/documents";
    payload.request.headers = {};

    await expect(httpRouter(payload, null)).rejects.toThrow();
    expect(handleCreateDocumentRequest).toHaveBeenCalled();
  });

  it("deletes documents", async () => {
    const payload = mock<onRequestPayload>();
    payload.request.method = "DELETE";
    payload.request.url = "/documents";
    payload.request.headers = {};

    await expect(httpRouter(payload, null)).rejects.toThrow();
    expect(handleDeleteDocumentRequest).toHaveBeenCalled();
  });

  it("gets documents", async () => {
    const payload = mock<onRequestPayload>();
    payload.request.method = "GET";
    payload.request.url = "/documents";
    payload.request.headers = {};

    await expect(httpRouter(payload, null)).rejects.toThrow();
    expect(handleGetOwnDocumentsRequest).toHaveBeenCalled();
  });

  it("gets documents with person id", async () => {
    vi.stubEnv("JWT_SECRET", "test");
    const payload = mock<onRequestPayload>();
    const secret = jwt.sign({ pid: "12345" }, "test", {
      algorithm: "HS256",
    });
    payload.request.method = "GET";
    payload.request.url = "/documents";
    payload.request.headers = { cookie: `person_id=${secret}` };

    await expect(httpRouter(payload, null)).rejects.toThrow();
    expect(handleGetOwnDocumentsRequest).toHaveBeenCalledWith(
      expect.anything(),
      null,
      "12345",
    );
    vi.unstubAllEnvs();
  });

  it("creates images", async () => {
    const payload = mock<onRequestPayload>();
    payload.request.method = "POST";
    payload.request.url = "/documents/abc/images";
    payload.request.headers = {};

    await expect(httpRouter(payload, null)).rejects.toThrow();
    expect(handleUploadImageRequest).toHaveBeenCalled();
  });

  it("deletes images", async () => {
    const payload = mock<onRequestPayload>();
    payload.request.method = "DELETE";
    payload.request.url = "/images/123";
    payload.request.headers = {};

    await expect(httpRouter(payload, null)).rejects.toThrow();
    expect(handleDeleteImageRequest).toHaveBeenCalled();
  });

  it("gets images", async () => {
    const payload = mock<onRequestPayload>();
    payload.request.method = "GET";
    payload.request.url = "/images/123";
    payload.request.headers = {};

    await expect(httpRouter(payload, null)).rejects.toThrow();
    expect(handleGetImageRequest).toHaveBeenCalled();
  });
});
