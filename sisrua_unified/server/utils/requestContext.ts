import { AsyncLocalStorage } from "async_hooks";

// Storage for request-specific context (like requestId)
export const requestContext = new AsyncLocalStorage<Map<string, string>>();
