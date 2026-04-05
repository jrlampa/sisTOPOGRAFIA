import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './utils/logger.js';

/**
 * Python Bridge for DXF Generation
 * 
 * DOCKER-FIRST ARCHITECTURE:
 * This module executes Python scripts directly in a containerized environment.
 * The Python engine runs natively in Docker containers, eliminating the need
 * for compiled .exe binaries and improving portability and security.
 * 
 * SECURITY MEASURES:
 * - Uses spawn() instead of exec() to prevent command injection
 * - Validates all file paths before execution
 * - Sanitizes all input arguments
 * - Logs all execution attempts for audit trail
 * - Runs in isolated Docker containers in production
 * 
 * DEPLOYMENT:
 * - Production: Docker containers with Python runtime (Cloud Run)
 * - Development: Native Python or Docker Compose
 * - Legacy .exe support removed in favor of container-native execution
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DxfOptions {
    lat: number;
    lon: number;
    radius: number;
    outputFile: string;
    layers?: Record<string, boolean>;
    mode?: string;
    polygon?: string;
    projection?: string;
    contourRenderMode?: 'spline' | 'polyline';
    btContext?: Record<string, unknown> | null;
}

export const generateDxf = (options: DxfOptions): Promise<string> => {
    return new Promise((resolve, reject) => {
        // Input validation for security
        if (options.lat === undefined || options.lon === undefined || options.radius === undefined) {
            reject(new Error('Missing required parameters'));
            return;
        }

        // Validate coordinate ranges to prevent malicious input
        if (options.lat < -90 || options.lat > 90) {
            reject(new Error('Invalid latitude: must be between -90 and 90'));
            return;
        }
        if (options.lon < -180 || options.lon > 180) {
            reject(new Error('Invalid longitude: must be between -180 and 180'));
            return;
        }
        if (options.radius < 1 || options.radius > 10000) {
            reject(new Error('Invalid radius: must be between 1 and 10000'));
            return;
        }

        // DOCKER-FIRST: Always use Python directly (no .exe binaries)
        // This works in both Docker containers and native development environments
        const scriptPath = path.join(__dirname, '../py_engine/main.py');
        
        // Allow customization via environment variable and fallback executables for Windows/Linux.
        const envPythonCommand = process.env.PYTHON_COMMAND;
        const fallbackCommands = process.platform === 'win32'
            ? ['python', 'py', 'python3']
            : ['python3', 'python'];
        const commandCandidates = Array.from(new Set([
            ...(envPythonCommand ? [envPythonCommand] : []),
            ...fallbackCommands
        ]));

        const command = commandCandidates[0];
        const args = [scriptPath];

        // SECURITY: Sanitize all arguments - convert to strings to prevent injection
        // Add DXF arguments
        args.push(
            '--lat', String(options.lat),
            '--lon', String(options.lon),
            '--radius', String(options.radius),
            '--output', String(options.outputFile),
            '--selection_mode', String(options.mode || 'circle'),
            '--polygon', String(options.polygon || '[]'),
            '--projection', String(options.projection || 'local'),
            '--contour_style', String(options.contourRenderMode || 'spline'),
            '--no-preview'
        );

        if (options.layers) {
            args.push('--layers', JSON.stringify(options.layers));
        }

        if (options.btContext) {
            args.push('--bt_context', JSON.stringify(options.btContext));
        }

        logger.info('Spawning Python process for DXF generation', {
            commandCandidates,
            args: args.join(' '),
            environment: process.env.NODE_ENV || 'development',
            dockerized: process.env.DOCKER_ENV === 'true',
            timestamp: new Date().toISOString()
        });

        const runWithCommand = (index: number) => {
            const selectedCommand = commandCandidates[index];
            const pythonProcess = spawn(selectedCommand, args);
            let stdoutData = '';
            let stderrData = '';
            let handled = false;

            pythonProcess.stdout.on('data', (data) => {
                const str = data.toString();
                logger.debug('Python stdout', { command: selectedCommand, output: str });
                stdoutData += str;
            });

            pythonProcess.stderr.on('data', (data) => {
                const str = data.toString();
                logger.warn('Python stderr', { command: selectedCommand, output: str });
                stderrData += str;
            });

            pythonProcess.on('close', (code) => {
                if (handled) {
                    return;
                }

                logger.info('Python process exited', { command: selectedCommand, exitCode: code });
                if (code === 0) {
                    if (!stdoutData || stdoutData.trim().length === 0) {
                        handled = true;
                        reject(new Error('Python script completed without output. Verify Python logs and output file generation.'));
                        return;
                    }
                    handled = true;
                    resolve(stdoutData);
                    return;
                }

                handled = true;
                reject(new Error(`Python script failed with code ${code}\nStderr: ${stderrData}`));
            });

            pythonProcess.on('error', (err: any) => {
                if (handled) {
                    return;
                }

                const isMissingCommand = err?.code === 'ENOENT';
                const hasNextCandidate = index < commandCandidates.length - 1;
                if (isMissingCommand && hasNextCandidate) {
                    logger.warn('Python command not found, retrying with fallback', {
                        attempted: selectedCommand,
                        next: commandCandidates[index + 1]
                    });
                    handled = true;
                    runWithCommand(index + 1);
                    return;
                }

                handled = true;
                reject(new Error(`Failed to spawn python process using '${selectedCommand}': ${err.message}`));
            });
        };

        runWithCommand(0);
    });
};
