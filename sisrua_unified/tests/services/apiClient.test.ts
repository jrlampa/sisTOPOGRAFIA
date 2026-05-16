import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  resolveRequestIdentity,
  buildApiHeaders,
  apiFetch,
} from "../../src/services/apiClient";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const clearLocalStorage = () => {
  localStorage.clear();
};

// ---------------------------------------------------------------------------
// resolveRequestIdentity
// ---------------------------------------------------------------------------

describe("resolveRequestIdentity", () => {
  beforeEach(() => {
    clearLocalStorage();
  });

  afterEach(() => {
    clearLocalStorage();
  });

  it("returns system-admin as fallback userId when nothing is set", () => {
    const { userId } = resolveRequestIdentity();
    expect(userId).toBeDefined();
    expect(userId.length).toBeGreaterThan(0);
  });

  it("uses userId from localStorage when present", () => {
    localStorage.setItem("sisrua_user_id", "test-user-123");
    const { userId } = resolveRequestIdentity();
    expect(userId).toBe("test-user-123");
  });

  it("uses token from localStorage when present", () => {
    localStorage.setItem("sisrua_token", "my-auth-token");
    const { token } = resolveRequestIdentity();
    expect(token).toBe("my-auth-token");
  });

  it("returns null token when no token is stored", () => {
    const { token } = resolveRequestIdentity();
    expect(token).toBeNull();
  });

  it("falls back to sisrua_userId key", () => {
    localStorage.setItem("sisrua_userId", "alt-user");
    const { userId } = resolveRequestIdentity();
    expect(userId).toBe("alt-user");
  });
});

// ---------------------------------------------------------------------------
// buildApiHeaders
// ---------------------------------------------------------------------------

describe("buildApiHeaders", () => {
  beforeEach(() => {
    clearLocalStorage();
  });

  afterEach(() => {
    clearLocalStorage();
  });

  it("always includes Content-Type and x-user-id headers", () => {
    const headers = buildApiHeaders();
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["x-user-id"]).toBeDefined();
    expect(headers["x-user-id"].length).toBeGreaterThan(0);
  });

  it("includes Authorization header when token is present", () => {
    localStorage.setItem("sisrua_token", "bearer-token-abc");
    const headers = buildApiHeaders();
    expect(headers.Authorization).toBe("Bearer bearer-token-abc");
  });

  it("does not include Authorization header when token is absent", () => {
    const headers = buildApiHeaders();
    expect(headers.Authorization).toBeUndefined();
  });

  it("merges extra headers correctly", () => {
    const headers = buildApiHeaders({ "X-Custom": "value" });
    expect(headers["X-Custom"]).toBe("value");
    expect(headers["Content-Type"]).toBe("application/json");
  });
});

// ---------------------------------------------------------------------------
// apiFetch
// ---------------------------------------------------------------------------

describe("apiFetch", () => {
  beforeEach(() => {
    clearLocalStorage();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearLocalStorage();
  });

  it("calls fetch with the correct URL when endpoint starts with /", async () => {
    await apiFetch("/test");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/test"),
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("calls fetch with full URL when endpoint starts with http", async () => {
    await apiFetch("https://example.com/api/data");
    expect(fetch).toHaveBeenCalledWith(
      "https://example.com/api/data",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("passes through RequestInit options (method, body)", async () => {
    await apiFetch("/endpoint", {
      method: "POST",
      body: JSON.stringify({ key: "val" }),
    });
    const call = (fetch as any).mock.calls[0];
    expect(call[1].method).toBe("POST");
    expect(call[1].body).toBe('{"key":"val"}');
  });

  it("returns the fetch Response", async () => {
    const response = await apiFetch("/ping");
    expect(response).toBeDefined();
    expect((response as any).ok).toBe(true);
  });

  it("prepends base URL when endpoint has no leading slash", async () => {
    await apiFetch("some/path");
    const calledUrl = (fetch as any).mock.calls[0][0];
    // The URL should contain "some/path"
    expect(calledUrl).toContain("some/path");
  });
});
