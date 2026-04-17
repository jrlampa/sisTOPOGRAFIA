import { Request, Response } from "express";
import { extractCorrelationIds, setCorrelationResponseHeaders, formatCorrelationSuffix } from "../utils/correlationIds";

describe("correlationIds utilities", () => {
    describe("extractCorrelationIds", () => {
        it("should extract ids from headers (various formats)", () => {
            const req = {
                get: (name: string) => {
                    if (name === "x-operation-id") return "op-123";
                    if (name === "x-projeto-id") return "proj-456";
                    if (name === "x-ponto-id") return "pt-789";
                    return undefined;
                },
                query: {},
                params: {},
                body: {}
            } as unknown as Request;

            const ids = extractCorrelationIds(req);
            expect(ids).toEqual({
                operation_id: "op-123",
                projeto_id: "proj-456",
                ponto_id: "pt-789"
            });
        });

        it("should extract ids from query parameters", () => {
            const req = {
                get: () => undefined,
                query: {
                    operation_id: "op-q",
                    projeto_id: "proj-q",
                    ponto_id: "pt-q"
                },
                params: {},
                body: {}
            } as unknown as Request;

            const ids = extractCorrelationIds(req);
            expect(ids).toEqual({
                operation_id: "op-q",
                projeto_id: "proj-q",
                ponto_id: "pt-q"
            });
        });

        it("should extract ids from body (camelCase and snake_case)", () => {
            const req = {
                get: () => undefined,
                query: {},
                params: {},
                body: {
                    operationId: "op-b",
                    projectId: "proj-b",
                    pointId: "pt-b"
                }
            } as unknown as Request;

            const ids = extractCorrelationIds(req);
            expect(ids).toEqual({
                operation_id: "op-b",
                projeto_id: "proj-b",
                ponto_id: "pt-b"
            });
        });

        it("should normalize and sanitize ids (unsafe characters)", () => {
            const req = {
                get: (name: string) => (name === "x-operation-id" ? "unsafe!id@with#chars" : undefined),
                query: {},
                params: {},
                body: {}
            } as unknown as Request;

            const ids = extractCorrelationIds(req);
            expect(ids.operation_id).toBeUndefined(); // regex fail
        });

        it("should truncate long ids to ID_MAX_LEN (128)", () => {
            const longId = "a".repeat(200);
            const req = {
                get: (name: string) => (name === "x-operation-id" ? longId : undefined),
                query: {},
                params: {},
                body: {}
            } as unknown as Request;

            const ids = extractCorrelationIds(req);
            expect(ids.operation_id?.length).toBe(128);
        });

        it("should handle empty/missing inputs gracefully", () => {
            const req = {
                get: () => undefined,
                query: {},
                params: {},
                body: null
            } as unknown as Request;

            const ids = extractCorrelationIds(req);
            expect(ids).toEqual({});
        });
    });

    describe("setCorrelationResponseHeaders", () => {
        it("should set headers correctly on response", () => {
            const res = { setHeader: jest.fn() } as unknown as Response;
            const ids = { operation_id: "op-1", projeto_id: "proj-2", ponto_id: "pt-3" };
            
            setCorrelationResponseHeaders(res, ids);
            
            expect(res.setHeader).toHaveBeenCalledWith("x-operation-id", "op-1");
            expect(res.setHeader).toHaveBeenCalledWith("x-projeto-id", "proj-2");
            expect(res.setHeader).toHaveBeenCalledWith("x-ponto-id", "pt-3");
        });
    });

    describe("formatCorrelationSuffix", () => {
        it("should format a pipe-separated suffix string", () => {
            const ids = { operation_id: "op-1", projeto_id: "proj-2", ponto_id: "pt-3" };
            expect(formatCorrelationSuffix(ids)).toBe("|op=op-1|projeto=proj-2|ponto=pt-3");
        });

        it("should return empty string if no ids provided", () => {
            expect(formatCorrelationSuffix({})).toBe("");
        });
    });
});
