import path from 'path';
import { config } from '../config.js';

/**
 * Single source of truth for the DXF workspace directory.
 * Always resolves to an absolute path from process cwd.
 */
export function resolveDxfDirectory(): string {
    return path.resolve(process.cwd(), config.DXF_DIRECTORY);
}
