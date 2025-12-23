import { describe, expect, it } from "vitest";
import { checkPermission } from "./permissions";
import { buildFullDocument } from "../tests/helpers/documentHelpers";
import { mock } from "vitest-mock-extended";
import { ServerResponse, IncomingMessage } from "http";
import { prismaMock } from "../tests/helpers/mockPrisma";

describe("checkPermission", () => {
  it("resolves if the secret is correct", async () => {
    const doc = buildFullDocument();
    prismaMock.document.findFirst.mockResolvedValue({
      id: doc.id,
      data: doc.data,
      modificationSecret: doc.modificationSecret,
    } as never);

    const response = mock<ServerResponse<IncomingMessage>>();
    await expect(
      checkPermission(prismaMock, doc.id, doc.modificationSecret, response),
    ).resolves.toBeUndefined();
    expect(response.writeHead.mock.calls.length).toEqual(0);
  });

  it("rejects if the secret is incorrect", async () => {
    const doc = buildFullDocument();
    prismaMock.document.findFirst.mockResolvedValue({
      id: doc.id,
      data: doc.data,
      modificationSecret: doc.modificationSecret,
    } as never);

    const response = mock<ServerResponse<IncomingMessage>>();
    await expect(
      checkPermission(prismaMock, doc.id, "wrong", response),
    ).rejects.toThrow();
    expect(response.writeHead.mock.calls[0][0]).toEqual(403);
  });
});
