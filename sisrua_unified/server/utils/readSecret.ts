/**
 * FIXED: readSecret() now properly handles Docker Secrets
 * Supports both explicit _FILE env var and /run/secrets/ convention
 */
import fs from "fs";

function readSecret(name: string): string | undefined {
  // 1. Check if explicit _FILE env var is set (Docker Secrets pattern)
  const filePathEnv = process.env[`${name}_FILE`];
  
  // 2. Check default Docker Secrets path (/run/secrets/...)
  const defaultFilePath = `/run/secrets/${name.toLowerCase()}`;
  
  const filePath = filePathEnv || defaultFilePath;
  
  // Try to read from file
  if (fs.existsSync(filePath)) {
    try {
      return fs.readFileSync(filePath, "utf8").trim();
    } catch (err) {
      console.error(`[sisrua] Failed to read secret from ${filePath}:`, err);
      return undefined;  // Don't fallback to env var if file read fails
    }
  }
  
  // Fallback: check direct env var (for local development without Docker Secrets)
  return process.env[name];
}

export { readSecret };
