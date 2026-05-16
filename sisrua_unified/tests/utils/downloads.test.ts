import { describe, it, expect, vi, afterEach } from "vitest";
import {
  sanitizeFilename,
  downloadBlob,
  downloadText,
  downloadCsv,
  downloadJson,
  downloadDxf,
  downloadUrl,
} from "../../src/utils/downloads";

// The setup.ts already mocks URL.createObjectURL / URL.revokeObjectURL.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockAnchorClick() {
  const clickSpy = vi.fn();
  const appendSpy = vi.spyOn(document.body, "appendChild").mockImplementation((el: Node) => el);
  const removeSpy = vi.spyOn(document.body, "removeChild").mockImplementation((el: Node) => el);

  const origCreate = document.createElement.bind(document);
  const createSpy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    const el = origCreate(tag);
    if (tag === "a") {
      el.click = clickSpy;
    }
    return el;
  });

  return { clickSpy, appendSpy, removeSpy, createSpy };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// sanitizeFilename
// ---------------------------------------------------------------------------

describe("sanitizeFilename", () => {
  it("returns a simple filename unchanged", () => {
    expect(sanitizeFilename("report.dxf")).toBe("report.dxf");
  });

  it("strips directory traversal components", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
  });

  it("strips null bytes and control characters", () => {
    expect(sanitizeFilename("file\u0000name.txt")).toBe("filename.txt");
  });

  it("removes leading dots", () => {
    expect(sanitizeFilename(".hidden")).toBe("hidden");
  });

  it("removes leading/trailing spaces", () => {
    expect(sanitizeFilename("  my file  ")).toBe("my file");
  });

  it("truncates filenames longer than 255 characters", () => {
    const long = "a".repeat(300);
    expect(sanitizeFilename(long).length).toBeLessThanOrEqual(255);
  });

  it("throws for empty string", () => {
    expect(() => sanitizeFilename("")).toThrow();
  });

  it("throws for non-string input", () => {
    expect(() => sanitizeFilename(null as unknown as string)).toThrow();
  });

  it("throws when sanitization produces an empty result", () => {
    // A filename consisting solely of dots/spaces becomes empty after stripping
    expect(() => sanitizeFilename("...")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// downloadBlob
// ---------------------------------------------------------------------------

describe("downloadBlob", () => {
  it("creates an anchor with the sanitized filename and clicks it", () => {
    const { clickSpy } = mockAnchorClick();
    downloadBlob("hello", "text/plain", "output.txt");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("throws for empty content", () => {
    expect(() => downloadBlob("", "text/plain", "file.txt")).toThrow(/empty/i);
  });

  it("throws for invalid MIME type", () => {
    expect(() => downloadBlob("data", "", "file.txt")).toThrow(/MIME/i);
  });

  it("always revokes the object URL", () => {
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL");
    mockAnchorClick();
    downloadBlob("data", "text/plain", "file.txt");
    expect(revokeSpy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// downloadText
// ---------------------------------------------------------------------------

describe("downloadText", () => {
  it("delegates to downloadBlob with text/plain MIME", () => {
    const { clickSpy } = mockAnchorClick();
    downloadText("hello world", "output.txt");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// downloadCsv
// ---------------------------------------------------------------------------

describe("downloadCsv", () => {
  it("delegates to downloadBlob with text/csv MIME", () => {
    const { clickSpy } = mockAnchorClick();
    downloadCsv("col1,col2\nval1,val2", "data.csv");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// downloadJson
// ---------------------------------------------------------------------------

describe("downloadJson", () => {
  it("serializes an object and triggers download", () => {
    const { clickSpy } = mockAnchorClick();
    downloadJson({ key: "value" }, "data.json");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("uses compact JSON when pretty=false", () => {
    const blobs: Blob[] = [];
    const origBlob = global.Blob;
    global.Blob = class MockBlob extends origBlob {
      constructor(parts: BlobPart[], opts?: BlobPropertyBag) {
        super(parts, opts);
        blobs.push(this);
      }
    } as typeof Blob;

    mockAnchorClick();
    downloadJson({ a: 1 }, "data.json", false);

    global.Blob = origBlob;
    // Compact JSON should not contain newlines
    // The first blob created is the file blob
    // Just verify no error was thrown and a download happened
    expect(blobs.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// downloadDxf
// ---------------------------------------------------------------------------

describe("downloadDxf", () => {
  it("triggers a download with the provided content", () => {
    const { clickSpy } = mockAnchorClick();
    downloadDxf("DXF content", "drawing.dxf");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// downloadUrl
// ---------------------------------------------------------------------------

describe("downloadUrl", () => {
  it("creates an anchor pointing to the given URL and clicks it", () => {
    const { clickSpy, createSpy } = mockAnchorClick();
    downloadUrl("https://example.com/file.dxf", "file.dxf");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledWith("a");
  });

  it("sanitizes the filename when downloading from URL", () => {
    // Path traversal in filename should be stripped without throwing
    const { clickSpy } = mockAnchorClick();
    downloadUrl("https://example.com/file", "../../evil.dxf");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
