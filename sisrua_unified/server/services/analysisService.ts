/**
 * @deprecated Use OllamaService.analyzeArea() directly.
 * This shim exists only for backward compatibility with legacy test imports.
 * All production routes use OllamaService (local Ollama LLM).
 */
export { OllamaService as AnalysisService } from "./ollamaService.js";
