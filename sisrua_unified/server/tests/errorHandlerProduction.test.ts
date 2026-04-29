import { vi } from "vitest";
import { errorHandler, ApiError, ErrorCategory } from "../errorHandler";

// Mock config for production environment
vi.mock("../config", () => ({
  config: {
    NODE_ENV: "production"
  }
}));

vi.mock("../utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { logger } from "../utils/logger";

describe("errorHandler in Production mode", () => {
    let mockReq: any;
    let mockRes: any;
    let mockNext: any;

    beforeEach(() => {
        mockReq = {};
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
            locals: { requestId: "test-req-id" }
        };
        mockNext = vi.fn();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("should hide details in production for ApiError", () => {
        const error = new ApiError("Detailed message", 400, ErrorCategory.VALIDATION, { internal: "secret" });
        
        errorHandler(error, mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(400);
        const responseBody = mockRes.json.mock.calls[0][0];
        expect(responseBody.error).toBe("Detailed message");
        expect(responseBody.details).toBeUndefined(); // Hidden in production
    });

    it("should hide error message in production for unknown errors", () => {
        const error = new Error("Very sensitive database error");
        
        errorHandler(error, mockReq, mockRes, mockNext);
        
        expect(mockRes.status).toHaveBeenCalledWith(500);
        const responseBody = mockRes.json.mock.calls[0][0];
        expect(responseBody.error).toBe("Internal server error"); // Generic message
    });

    it("should log only safe info in production", () => {
        const error = new ApiError("Bad input", 400, ErrorCategory.VALIDATION);
        
        errorHandler(error, mockReq, mockRes, mockNext);
        
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining("[ValidationError] Bad input"),
            expect.objectContaining({
                statusCode: 400,
                requestId: "test-req-id"
            })
        );
        // Ensure stack trace was NOT logged
        const logArg = (logger.warn as vi.Mock).mock.calls[0][1];
        expect(logArg.stack).toBeUndefined();
    });
});

