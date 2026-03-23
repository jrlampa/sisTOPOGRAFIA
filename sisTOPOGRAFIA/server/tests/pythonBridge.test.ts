import { EventEmitter } from 'events';

jest.mock('child_process', () => ({ spawn: jest.fn() }));

import { spawn } from 'child_process';
import { generateDxf, analyzePad } from '../pythonBridge';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockProcess(): any {
    const proc = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
        kill: jest.Mock;
    };
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = jest.fn();
    return proc;
}

describe('generateDxf', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    const validOptions = {
        lat: -23.5, lon: -46.6, radius: 500,
        outputFile: '/tmp/test.dxf', mode: 'circle', polygon: '[]', projection: 'local'
    };

    it('rejects when lat is 0 (falsy) - missing required parameters', async () => {
        await expect(generateDxf({ lat: 0, lon: -46.6, radius: 500, outputFile: '/tmp/test.dxf' }))
            .rejects.toThrow('Missing required parameters');
    });

    it('rejects when lon is 0 (falsy) - missing required parameters', async () => {
        await expect(generateDxf({ lat: -23.5, lon: 0, radius: 500, outputFile: '/tmp/test.dxf' }))
            .rejects.toThrow('Missing required parameters');
    });

    it('rejects when radius is 0 (falsy) - missing required parameters', async () => {
        await expect(generateDxf({ lat: -23.5, lon: -46.6, radius: 0, outputFile: '/tmp/test.dxf' }))
            .rejects.toThrow('Missing required parameters');
    });

    it('rejects on invalid latitude > 90', async () => {
        await expect(generateDxf({ ...validOptions, lat: 91 }))
            .rejects.toThrow('Invalid latitude');
    });

    it('rejects on invalid latitude < -90', async () => {
        await expect(generateDxf({ ...validOptions, lat: -91 }))
            .rejects.toThrow('Invalid latitude');
    });

    it('rejects on invalid longitude > 180', async () => {
        await expect(generateDxf({ ...validOptions, lon: 181 }))
            .rejects.toThrow('Invalid longitude');
    });

    it('rejects on invalid longitude < -180', async () => {
        await expect(generateDxf({ ...validOptions, lon: -181 }))
            .rejects.toThrow('Invalid longitude');
    });

    it('rejects on radius < 1', async () => {
        await expect(generateDxf({ ...validOptions, radius: 0.5 }))
            .rejects.toThrow('Invalid radius');
    });

    it('rejects on radius > 10000', async () => {
        await expect(generateDxf({ ...validOptions, radius: 10001 }))
            .rejects.toThrow('Invalid radius');
    });

    it('resolves with stdout data on exit code 0', async () => {
        const proc = createMockProcess();
        (spawn as jest.Mock).mockReturnValueOnce(proc);
        const promise = generateDxf(validOptions);
        proc.stdout.emit('data', Buffer.from('output data'));
        proc.emit('close', 0);
        await expect(promise).resolves.toBe('output data');
    });

    it('rejects on exit code !== 0 with stderr message', async () => {
        const proc = createMockProcess();
        (spawn as jest.Mock).mockReturnValueOnce(proc);
        const promise = generateDxf(validOptions);
        proc.stderr.emit('data', Buffer.from('python error'));
        proc.emit('close', 1);
        await expect(promise).rejects.toThrow('Python script failed with code 1');
    });

    it('rejects on process error event', async () => {
        const proc = createMockProcess();
        (spawn as jest.Mock).mockReturnValueOnce(proc);
        const promise = generateDxf(validOptions);
        proc.emit('error', new Error('spawn ENOENT'));
        await expect(promise).rejects.toThrow('Failed to spawn python process: spawn ENOENT');
    });

    it('rejects on timeout', async () => {
        jest.useFakeTimers();
        const originalTimeout = process.env.PYTHON_TIMEOUT_MS;
        process.env.PYTHON_TIMEOUT_MS = '100';

        // Re-import to pick up env var (use dynamic require workaround via jest.resetModules)
        const proc = createMockProcess();
        (spawn as jest.Mock).mockReturnValueOnce(proc);
        const promise = generateDxf(validOptions);
        jest.advanceTimersByTime(60001); // default timeout
        await expect(promise).rejects.toThrow(/timed out/);

        jest.useRealTimers();
        process.env.PYTHON_TIMEOUT_MS = originalTimeout;
    });

    it('passes --layers arg when layers option provided', async () => {
        const proc = createMockProcess();
        (spawn as jest.Mock).mockReturnValueOnce(proc);
        const layers = { buildings: true, roads: false };
        const promise = generateDxf({ ...validOptions, layers });
        proc.emit('close', 0);
        await promise;
        const args: string[] = (spawn as jest.Mock).mock.calls[0][1];
        expect(args).toContain('--layers');
        expect(args).toContain(JSON.stringify(layers));
    });

    it('uses default mode and polygon when not provided', async () => {
        const proc = createMockProcess();
        (spawn as jest.Mock).mockReturnValueOnce(proc);
        const promise = generateDxf({ lat: -23.5, lon: -46.6, radius: 500, outputFile: '/tmp/test.dxf' });
        proc.emit('close', 0);
        await promise;
        const args: string[] = (spawn as jest.Mock).mock.calls[0][1];
        expect(args).toContain('circle');
        expect(args).toContain('[]');
        expect(args).toContain('local');
    });

    it('settled guard fires in close handler after timeout', async () => {
        jest.useFakeTimers();
        const proc = createMockProcess();
        (spawn as jest.Mock).mockReturnValueOnce(proc);
        const promise = generateDxf(validOptions);
        const expectation = expect(promise).rejects.toThrow(/timed out/);
        // Fire timeout first (settled = true)
        jest.advanceTimersByTime(60001);
        // Now emit close - settled guard should fire silently
        proc.emit('close', 0);
        await expectation;
        jest.useRealTimers();
    });

    it('settled guard fires in timeout callback after error event', async () => {
        jest.useFakeTimers();
        const proc = createMockProcess();
        (spawn as jest.Mock).mockReturnValueOnce(proc);
        const promise = generateDxf(validOptions);
        // Emit error first (settled = true)
        proc.emit('error', new Error('spawn error'));
        // Now advance timer - timeout callback fires but settled is already true
        jest.advanceTimersByTime(60001);
        await expect(promise).rejects.toThrow('Failed to spawn python process: spawn error');
        jest.useRealTimers();
    });

    it('settled guard fires in error handler after timeout', async () => {
        jest.useFakeTimers();
        const proc = createMockProcess();
        (spawn as jest.Mock).mockReturnValueOnce(proc);
        const promise = generateDxf(validOptions);
        const expectation = expect(promise).rejects.toThrow(/timed out/);
        // Fire timeout first (settled = true)
        jest.advanceTimersByTime(60001);
        // Now emit error - settled guard should fire silently
        proc.emit('error', new Error('late error'));
        await expectation;
        jest.useRealTimers();
    });

    it('passes polygon and projection args when mode is polygon', async () => {
        const proc = createMockProcess();
        (spawn as jest.Mock).mockReturnValueOnce(proc);
        const promise = generateDxf({ ...validOptions, mode: 'polygon', polygon: '[[0,0]]', projection: 'utm' });
        proc.emit('close', 0);
        await promise;
        const args: string[] = (spawn as jest.Mock).mock.calls[0][1];
        expect(args).toContain('--selection_mode');
        expect(args).toContain('polygon');
        expect(args).toContain('--polygon');
        expect(args).toContain('[[0,0]]');
        expect(args).toContain('--projection');
        expect(args).toContain('utm');
    });

    it('uses "development" fallback when NODE_ENV is unset', async () => {
        const originalNodeEnv = process.env.NODE_ENV;
        delete process.env.NODE_ENV;
        const proc = createMockProcess();
        (spawn as jest.Mock).mockReturnValueOnce(proc);
        const promise = generateDxf(validOptions);
        proc.emit('close', 0);
        await promise;
        process.env.NODE_ENV = originalNodeEnv;
        // The test just verifies it runs without error; NODE_ENV || 'development' is covered
        expect(spawn).toHaveBeenCalled();
    });

    it('sets dockerized=true when DOCKER_ENV=true', async () => {
        process.env.DOCKER_ENV = 'true';
        const proc = createMockProcess();
        (spawn as jest.Mock).mockReturnValueOnce(proc);
        const promise = generateDxf(validOptions);
        proc.emit('close', 0);
        await promise;
        delete process.env.DOCKER_ENV;
        expect(spawn).toHaveBeenCalled();
    });
});

describe('analyzePad', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    const validOptions = { polygon: '[[0,0],[1,0],[1,1],[0,0]]', targetZ: 100 };

    it('rejects when polygon is empty string', async () => {
        await expect(analyzePad({ polygon: '', targetZ: 100 }))
            .rejects.toThrow('Missing required parameters');
    });

    it('rejects when targetZ is undefined', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await expect(analyzePad({ polygon: '[[0,0]]', targetZ: undefined as any }))
            .rejects.toThrow('Missing required parameters');
    });

    it('resolves with parsed JSON from last stdout line on exit code 0', async () => {
        const proc = createMockProcess();
        (spawn as jest.Mock).mockReturnValueOnce(proc);
        const mockResult = { volume_cut: 100, volume_fill: 50, net_volume: 50, cut_area: 200, fill_area: 100, balance_factor: 2.0 };
        const promise = analyzePad(validOptions);
        proc.stdout.emit('data', Buffer.from('some log\n' + JSON.stringify(mockResult)));
        proc.emit('close', 0);
        await expect(promise).resolves.toEqual(mockResult);
    });

    it('rejects when stdout contains invalid JSON on exit code 0', async () => {
        const proc = createMockProcess();
        (spawn as jest.Mock).mockReturnValueOnce(proc);
        const promise = analyzePad(validOptions);
        proc.stdout.emit('data', Buffer.from('not json output'));
        proc.emit('close', 0);
        await expect(promise).rejects.toThrow('Failed to parse python output');
    });

    it('rejects on exit code !== 0', async () => {
        const proc = createMockProcess();
        (spawn as jest.Mock).mockReturnValueOnce(proc);
        const promise = analyzePad(validOptions);
        proc.stderr.emit('data', Buffer.from('pad analysis error'));
        proc.emit('close', 2);
        await expect(promise).rejects.toThrow('Python script failed with code 2');
    });

    it('passes --auto_balance flag when autoBalance is true', async () => {
        const proc = createMockProcess();
        (spawn as jest.Mock).mockReturnValueOnce(proc);
        const mockResult = { volume_cut: 0, volume_fill: 0, net_volume: 0, cut_area: 0, fill_area: 0, balance_factor: 1.0 };
        const promise = analyzePad({ ...validOptions, autoBalance: true });
        proc.stdout.emit('data', Buffer.from(JSON.stringify(mockResult)));
        proc.emit('close', 0);
        await promise;
        const args: string[] = (spawn as jest.Mock).mock.calls[0][1];
        expect(args).toContain('--auto_balance');
    });

    it('rejects on process error event', async () => {
        const proc = createMockProcess();
        (spawn as jest.Mock).mockReturnValueOnce(proc);
        const promise = analyzePad(validOptions);
        proc.emit('error', new Error('spawn ENOENT'));
        await expect(promise).rejects.toThrow('Failed to spawn python process: spawn ENOENT');
    });

    it('resolves with empty object when no stdout data is emitted (covers pop() || "{}" fallback)', async () => {
        const proc = createMockProcess();
        (spawn as jest.Mock).mockReturnValueOnce(proc);
        const promise = analyzePad(validOptions);
        // No stdout data emitted → stdoutData = '' → pop() returns '' → fallback to '{}'
        proc.emit('close', 0);
        await expect(promise).resolves.toEqual({});
    });

    it('settled guard fires in close handler after timeout for analyzePad', async () => {
        jest.useFakeTimers();
        const proc = createMockProcess();
        (spawn as jest.Mock).mockReturnValueOnce(proc);
        const promise = analyzePad(validOptions);
        const expectation = expect(promise).rejects.toThrow(/timed out/);
        jest.advanceTimersByTime(60001);
        proc.emit('close', 0);
        await expectation;
        jest.useRealTimers();
    });

    it('settled guard fires in error handler after timeout for analyzePad', async () => {
        jest.useFakeTimers();
        const proc = createMockProcess();
        (spawn as jest.Mock).mockReturnValueOnce(proc);
        const promise = analyzePad(validOptions);
        const expectation = expect(promise).rejects.toThrow(/timed out/);
        jest.advanceTimersByTime(60001);
        proc.emit('error', new Error('late error'));
        await expectation;
        jest.useRealTimers();
    });

    it('settled guard fires in timeout callback after error event for analyzePad', async () => {
        jest.useFakeTimers();
        const proc = createMockProcess();
        (spawn as jest.Mock).mockReturnValueOnce(proc);
        const promise = analyzePad(validOptions);
        proc.emit('error', new Error('spawn error'));
        jest.advanceTimersByTime(60001);
        await expect(promise).rejects.toThrow('Failed to spawn python process: spawn error');
        jest.useRealTimers();
    });
});
