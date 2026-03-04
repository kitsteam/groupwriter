import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// Node.js 22+ provides a native localStorage global, but without a valid
// --localstorage-file path its methods are undefined. This breaks jsdom's
// localStorage in vitest. Provide a working in-memory implementation.
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null
  };
};

Object.defineProperty(globalThis, 'localStorage', {
  value: createLocalStorageMock(),
  writable: true
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});
