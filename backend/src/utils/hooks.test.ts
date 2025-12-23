import { describe, it, expect } from "vitest";
import { ConnectionConfiguration } from "@hocuspocus/server";
import { handleReadOnlyMode } from "./hooks";
import { buildFullDocument } from "../../tests/helpers/documentHelpers";
import { randomUUID } from "crypto";
import { prismaMock } from "../../tests/helpers/mockPrisma";

describe("handleReadOnlyMode", () => {
  it("should set readOnly mode to true when modificationSecret is empty", async () => {
    const connectionConfiguration = buildConnectionConfiguration();

    await handleReadOnlyMode(
      prismaMock,
      "documentName",
      connectionConfiguration,
      null,
    );

    expect(connectionConfiguration.readOnly).toBeTruthy();
  });

  it("should set readOnly mode to true when modificationSecret is invalid", async () => {
    const connectionConfiguration = buildConnectionConfiguration();

    await handleReadOnlyMode(
      prismaMock,
      "documentName",
      connectionConfiguration,
      "invalid",
    );

    expect(connectionConfiguration.readOnly).toBeTruthy();
  });

  it("should set readOnly mode to true when modificationSecret is set to readOnly", async () => {
    const connectionConfiguration = buildConnectionConfiguration();

    await handleReadOnlyMode(
      prismaMock,
      "documentName",
      connectionConfiguration,
      "readOnly",
    );

    expect(connectionConfiguration.readOnly).toBeTruthy();
  });

  it("should set readOnly mode to false when modificationSecret is valid", async () => {
    const doc = buildFullDocument();
    prismaMock.document.findFirst.mockResolvedValue({
      id: doc.id,
      data: doc.data,
      modificationSecret: doc.modificationSecret,
    } as never);

    const connectionConfiguration = buildConnectionConfiguration();

    await handleReadOnlyMode(
      prismaMock,
      doc.id,
      connectionConfiguration,
      doc.modificationSecret,
    );

    expect(connectionConfiguration.readOnly).toBeFalsy();
  });

  it("should throw if the document is missing", async () => {
    prismaMock.document.findFirst.mockResolvedValue(null);

    const connectionConfiguration = buildConnectionConfiguration();

    await expect(
      handleReadOnlyMode(
        prismaMock,
        randomUUID(),
        connectionConfiguration,
        randomUUID(),
      ),
    ).rejects.toThrowError(
      expect.objectContaining({ message: "Document not found!" }) as Error,
    );
  });
});

const buildConnectionConfiguration = (): ConnectionConfiguration => {
  return {
    readOnly: false,
    isAuthenticated: false,
  };
};
