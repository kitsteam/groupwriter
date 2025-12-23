import { onRequestPayload, Server } from "@hocuspocus/server";
import { Database } from "@hocuspocus/extension-database";
import { Logger } from "@hocuspocus/extension-logger";
import { scheduleRemoveOldDocumentsCronJob } from "./crons/remove_old_documents_cron";
import {
  fetchDocument,
  updateLastAccessedAt,
  updateDocument,
} from "./model/document";
import { handleReadOnlyMode } from "./utils/hooks";
import httpRouter from "./httpRouter";
import * as Y from "yjs";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const server = new Server({
  port: parseInt(process.env.PORT, 10) || 3000,
  timeout: 30000,
  debounce: 5000,
  maxDebounce: 30000,
  extensions: [
    new Logger({
      onRequest: false,
      onChange: false,
      onConnect: false,
      onDisconnect: false,
      onUpgrade: false,
      onLoadDocument: false,
    }),
    new Database({
      fetch: async ({ documentName }) => {
        console.debug(`Fetching ${documentName}`);
        const data = (await fetchDocument(prisma, documentName))?.data;
        if (!data) {
          const doc = new Y.Doc();
          const sharedMap = doc.getMap("data");
          sharedMap.set("editor", new Y.XmlFragment());
          sharedMap.set("editorSecond", new Y.XmlFragment());
          return Y.encodeStateAsUpdate(doc);
        } else {
          return data;
        }
      },
      store: async ({ documentName, state }) => {
        console.debug(`Storing ${documentName}`);
        await updateDocument(prisma, documentName, state);
      },
    }),
  ],
  onConnect: async (context) => {
    const result = await fetchDocument(prisma, context.documentName);
    if (!result) {
      throw new Error("Document not found!");
    }
  },
  onAuthenticate: async ({ documentName, connectionConfig, token }) => {
    await handleReadOnlyMode(prisma, documentName, connectionConfig, token);
  },
  afterLoadDocument: async ({ documentName }) => {
    console.debug(`Updating lastAccessedAt for ${documentName}`);
    await updateLastAccessedAt(prisma, documentName);
  },
  onRequest: async (data: onRequestPayload) => {
    await httpRouter(data, prisma);
  },
});

scheduleRemoveOldDocumentsCronJob(prisma);

void server.listen();
