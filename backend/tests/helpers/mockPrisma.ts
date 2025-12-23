import { beforeEach, vi } from "vitest";
import type {
  Document,
  Image,
  PrismaClient,
} from "../../generated/prisma/client";

// Define mock function types that match what we use in tests
type MockFn<TReturn> = ReturnType<typeof vi.fn> & {
  mockResolvedValue: (value: TReturn) => void;
  mockRejectedValue: (value: unknown) => void;
};

// Document delegate mock interface
interface MockDocumentDelegate {
  findFirst: MockFn<Partial<Document> | null>;
  findMany: MockFn<Partial<Document>[]>;
  create: MockFn<Document>;
  update: MockFn<Document>;
  delete: MockFn<Document>;
}

// Image delegate mock interface
interface MockImageDelegate {
  findUnique: MockFn<Image | null>;
  findMany: MockFn<Image[]>;
  create: MockFn<Image>;
  delete: MockFn<Image>;
}

// Combined mock client interface
interface MockPrismaClientType {
  document: MockDocumentDelegate;
  image: MockImageDelegate;
}

// Create the mock - cast to PrismaClient for use in production code
// but also expose mock methods for test assertions
export const prismaMock = {
  document: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  image: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
} as MockPrismaClientType & PrismaClient;

beforeEach(() => {
  vi.resetAllMocks();
});

export function createMockPrismaClient() {
  return prismaMock;
}
