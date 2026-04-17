import { Request, Response } from "express";
import { isBearerRequestAuthorized, setBearerChallenge } from "../utils/bearerAuth";

describe("bearerAuth utilities", () => {
    describe("isBearerRequestAuthorized", () => {
        it("should return true if no token is provided in config", () => {
            const req = { headers: {} } as Request;
            expect(isBearerRequestAuthorized(req, undefined)).toBe(true);
            expect(isBearerRequestAuthorized(req, "")).toBe(true);
        });

        it("should return false if header is missing but token is required", () => {
            const req = { headers: {} } as Request;
            expect(isBearerRequestAuthorized(req, "secret")).toBe(false);
        });

        it("should return false if header does not start with Bearer", () => {
            const req = { headers: { authorization: "Basic base64==" } } as Request;
            expect(isBearerRequestAuthorized(req, "secret")).toBe(false);
        });

        it("should return false if token length does not match", () => {
            const req = { headers: { authorization: "Bearer short" } } as Request;
            expect(isBearerRequestAuthorized(req, "long-secret-token")).toBe(false);
        });

        it("should return false if token content does not match", () => {
            const req = { headers: { authorization: "Bearer wrong-token" } } as Request;
            expect(isBearerRequestAuthorized(req, "right-token")).toBe(false);
        });

        it("should return true if token matches perfectly", () => {
            const req = { headers: { authorization: "Bearer valid-token" } } as Request;
            expect(isBearerRequestAuthorized(req, "valid-token")).toBe(true);
        });

        it("should handle UTF-8 tokens correctly", () => {
            const req = { headers: { authorization: "Bearer café" } } as Request;
            expect(isBearerRequestAuthorized(req, "café")).toBe(true);
        });
    });

    describe("setBearerChallenge", () => {
        it("should set the WWW-Authenticate header correctly", () => {
            const res = { set: jest.fn() } as unknown as Response;
            setBearerChallenge(res, "test-realm");
            expect(res.set).toHaveBeenCalledWith("WWW-Authenticate", 'Bearer realm="test-realm"');
        });
    });
});
