import { vi } from "vitest";

declare global {
  // eslint-disable-next-line no-var
  var jest: typeof vi;
}

globalThis.jest = vi;

vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
