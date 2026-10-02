import { afterEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { TiptapTransformer } from "@hocuspocus/transformer";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import {
  newHocuspocus,
  newHocuspocusProvider,
} from "../helpers/hocuspocusHelpers";
import { Database } from "@hocuspocus/extension-database";
import { handleReadOnlyMode } from "../../src/utils/hooks";
import httpRouter from "../../src/httpRouter";
import { onRequestPayload } from "@hocuspocus/server";
import { Document } from "../../generated/prisma/client";
import {
  proseMirrorJson,
  proseMirrorYencodedStateUpdate,
} from "../helpers/e2eTestData";
import { prismaMock } from "../helpers/mockPrisma";
import { buildFullDocument } from "../helpers/documentHelpers";

describe("server", () => {
  it("should load a yjs document from the server", async () => {
    // Creates a Y.Doc from the ProseMirror editor JSON, see also:
    // https://github.com/ueberdosis/hocuspocus/blob/main/packages/transformer/src/Prosemirror.ts
    // https://github.com/yjs/y-prosemirror/blob/8033895b5d3c8397df2bbd1138d3d8ccb8557c95/README.md?plain=1#L152
    const ydoc = TiptapTransformer.toYdoc(proseMirrorJson, "default");
    const hocuspocus = await newHocuspocus({
      onLoadDocument() {
        return Promise.resolve(ydoc);
      },
    });
    const provider = await new Promise<HocuspocusProvider>((resolve) => {
      const p = newHocuspocusProvider(hocuspocus, {
        document: new Y.Doc(),
        name: "default",
        onSynced: () => {
          resolve(p);
        },
      });
    });
    expect(provider.document.getXmlFragment("default").toJSON()).toEqual(
      "<paragraph>Some test text</paragraph>",
    );
    await hocuspocus.server.destroy();
  });

  // This test should make sure, existing data can still be encoded, which might change at some point due to new protocols and updates
  it("should load an existing binary document from the server", async () => {
    const hocuspocus = await newHocuspocus({
      extensions: [
        new Database({
          fetch: () => {
            return Promise.resolve(proseMirrorYencodedStateUpdate);
          },
        }),
      ],
    });
    const provider = await new Promise<HocuspocusProvider>((resolve) => {
      const p = newHocuspocusProvider(hocuspocus, {
        document: new Y.Doc(),
        name: "default",
        onSynced: () => {
          resolve(p);
        },
      });
    });
    expect(provider.document.getXmlFragment("default").toJSON()).toEqual(
      "<paragraph>Some test text</paragraph>",
    );
    await hocuspocus.server.destroy();
  });

  it("sets the readOnly flag to false when the correct modification secret is provided", async () => {
    const doc = buildFullDocument();
    prismaMock.document.findFirst.mockResolvedValue({
      id: doc.id,
      data: doc.data,
      modificationSecret: doc.modificationSecret,
    });

    const hocuspocus = await newHocuspocus({
      onAuthenticate: async ({ documentName, connectionConfig, token }) => {
        await handleReadOnlyMode(
          prismaMock,
          documentName,
          connectionConfig,
          token,
        );
      },
      onLoadDocument: async ({ connectionConfig }) => {
        expect(connectionConfig.readOnly).toBe(false);
        return Promise.resolve();
      },
    });
    await new Promise<HocuspocusProvider>((resolve) => {
      const p = newHocuspocusProvider(hocuspocus, {
        document: new Y.Doc(),
        token: doc.modificationSecret,
        name: doc.id,
        onSynced: () => {
          resolve(p);
        },
      });
    });
    await hocuspocus.server.destroy();
  });

  it("sets the readOnly flag to true when the incorrect modification secret is provided", async () => {
    const doc = buildFullDocument();
    prismaMock.document.findFirst.mockResolvedValue({
      id: doc.id,
      data: doc.data,
      modificationSecret: doc.modificationSecret,
    });

    const hocuspocus = await newHocuspocus({
      onAuthenticate: async ({ documentName, connectionConfig, token }) => {
        await handleReadOnlyMode(
          prismaMock,
          documentName,
          connectionConfig,
          token,
        );
      },
      onLoadDocument: async ({ connectionConfig }) => {
        expect(connectionConfig.readOnly).toBe(true);
        return Promise.resolve();
      },
    });
    await new Promise<HocuspocusProvider>((resolve) => {
      const p = newHocuspocusProvider(hocuspocus, {
        document: new Y.Doc(),
        token: "wrong-token",
        name: doc.id,
        onSynced: () => {
          resolve(p);
        },
      });
    });
    await hocuspocus.server.destroy();
  });

  // tests if the extensions are loaded
  it("POST /documents", async () => {
    const doc = buildFullDocument();
    prismaMock.document.create.mockResolvedValue(doc);

    const hocuspocus = await newHocuspocus({
      onRequest: async (data: onRequestPayload) => {
        await httpRouter(data, prismaMock);
      },
    });
    const response = await fetch(`${hocuspocus.server.httpURL}/documents`, {
      method: "POST",
    });

    expect(((await response.json()) as Document).id).toBeDefined();
    expect(response.status).toBe(200);
    await hocuspocus.server.destroy();
  });

  describe("GET /documents (own documents via person_id cookie)", () => {
    const JWT_SECRET = "test-jwt-secret";

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    const getOwnDocuments = async (cookie?: string) => {
      const hocuspocus = await newHocuspocus({
        onRequest: async (data: onRequestPayload) => {
          await httpRouter(data, prismaMock);
        },
      });
      try {
        const response = await fetch(`${hocuspocus.server.httpURL}/documents`, {
          method: "GET",
          headers: cookie ? { cookie } : {},
        });
        return {
          status: response.status,
          body: (await response.json()) as unknown,
        };
      } finally {
        await hocuspocus.server.destroy();
      }
    };

    it("returns the owner's documents for a valid cookie", async () => {
      vi.stubEnv("JWT_SECRET", JWT_SECRET);
      prismaMock.document.findMany.mockResolvedValue([
        { id: "doc-1" },
      ] as never);
      const token = jwt.sign({ pid: "owner-1" }, JWT_SECRET, {
        algorithm: "HS256",
      });

      const { status, body } = await getOwnDocuments(`person_id=${token}`);

      expect(status).toBe(200);
      expect(body).toEqual([{ id: "doc-1" }]);
      expect(prismaMock.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerExternalId: "owner-1" } }),
      );
    });

    it.each([
      ["unset", undefined],
      ["empty", ""],
    ])(
      "returns an empty array when JWT_SECRET is %s, even for a signed cookie",
      async (_label, secret) => {
        vi.stubEnv("JWT_SECRET", secret);
        prismaMock.document.findMany.mockResolvedValue([
          { id: "doc-1" },
        ] as never);
        const token = jwt.sign({ pid: "owner-1" }, JWT_SECRET, {
          algorithm: "HS256",
        });

        const { status, body } = await getOwnDocuments(`person_id=${token}`);

        expect(status).toBe(200);
        expect(body).toEqual([]);
        expect(prismaMock.document.findMany).not.toHaveBeenCalled();
      },
    );

    it.each([
      ["null", { pid: null }],
      ["undefined (missing)", {}],
      ["an empty string", { pid: "" }],
      ["an object", { pid: { not: null } }],
    ])(
      "returns an empty array when the pid claim is %s",
      async (_label, payload) => {
        vi.stubEnv("JWT_SECRET", JWT_SECRET);
        prismaMock.document.findMany.mockResolvedValue([
          { id: "doc-1" },
        ] as never);
        const token = jwt.sign(payload, JWT_SECRET, { algorithm: "HS256" });

        const { status, body } = await getOwnDocuments(`person_id=${token}`);

        expect(status).toBe(200);
        expect(body).toEqual([]);
        expect(prismaMock.document.findMany).not.toHaveBeenCalled();
      },
    );

    it.each([
      ["no cookie header", undefined],
      ["no person_id cookie", "other=value"],
      ["a literal null person_id", "person_id=null"],
      ["a literal undefined person_id", "person_id=undefined"],
      [
        "a token signed with another secret",
        `person_id=${jwt.sign({ pid: "owner-1" }, "wrong-secret")}`,
      ],
      [
        "an unsigned (alg none) token",
        `person_id=${jwt.sign({ pid: "owner-1" }, "", { algorithm: "none" })}`,
      ],
    ])("returns an empty array for %s", async (_label, cookie) => {
      vi.stubEnv("JWT_SECRET", JWT_SECRET);
      prismaMock.document.findMany.mockResolvedValue([
        { id: "doc-1" },
      ] as never);

      const { status, body } = await getOwnDocuments(cookie);

      expect(status).toBe(200);
      expect(body).toEqual([]);
      expect(prismaMock.document.findMany).not.toHaveBeenCalled();
    });
  });
});
