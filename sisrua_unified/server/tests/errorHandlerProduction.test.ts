import { errorHandler, ApiError, ErrorCategory } from "../errorHandler";
import { config } from "../config";

// Mock config for production environment
jest.mock("../config", () => ({
  config: {
    NODE_ENV: "production"
  }
}));

describe("errorHandler in Production mode", () => {
    let mockReq: any;
    let mockRes: any;
    let mockNext: any;
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
        mockReq = { id: "test-req-id" };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        mockNext = jest.fn();
        consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();
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
        
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining("[ValidationError] Bad input"),
            expect.objectContaining({
                statusCode: 400,
                requestId: "test-req-id"
            })
        );
        // Ensure stack trace was NOT logged
        const logArg = consoleSpy.mock.calls[0][1];
        expect(logArg).not.toHaveProperty("stack");
    });
});
