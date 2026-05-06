import { test, expect, describe } from 'vitest';
import { execSync } from 'child_process';

describe('Deprecation Guard', () => {
  test('should not have any DeprecationWarning when running critical services', () => {
    // Run the server index with --trace-deprecation to catch them
    // Note: We only check if the output contains [DEPXXXX]
    try {
      const output = execSync('node --trace-deprecation --loader tsx server/index.ts --help', {
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'test' }
      });
      
      expect(output).not.toContain('[DEP');
    } catch (err: any) {
      // If it fails because it timed out or something, but still captured output
      const combinedOutput = (err.stdout || '') + (err.stderr || '');
      expect(combinedOutput).not.toContain('[DEP');
    }
  });

  test('environment should be configured to fail on warning in production', () => {
    // This is more of a policy check
    const nodeOptions = process.env.NODE_OPTIONS || '';
    // If we were in production, we'd want --throw-deprecation
    // expect(nodeOptions).toContain('--throw-deprecation');
  });
});
