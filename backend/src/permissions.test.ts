import { describe, expect, it } from "vitest";
import { checkPermission } from "./permissions";
import { buildFullDocument } from "../tests/helpers/documentHelpers";
import { prismaMock } from "../tests/helpers/mockPrisma";

describe("checkPermission", () => {
  it("returns true if the secret is correct", async () => {
    const doc = buildFullDocument();
    prismaMock.document.findFirst.mockResolvedValue({
      id: doc.id,
      data: doc.data,
      modificationSecret: doc.modificationSecret,
    } as never);

    const result = await checkPermission(
      prismaMock,
      doc.id,
      doc.modificationSecret,
    );
    expect(result).toBe(true);
  });

  it("returns false if the secret is incorrect", async () => {
    const doc = buildFullDocument();
    prismaMock.document.findFirst.mockResolvedValue({
      id: doc.id,
      data: doc.data,
      modificationSecret: doc.modificationSecret,
    } as never);

    const result = await checkPermission(prismaMock, doc.id, "wrong");
    expect(result).toBe(false);
  });
});
