import {
  completeJob,
  createJob,
  failJob,
  getJob,
  shouldProcessJob,
  stopCleanupInterval,
  updateJobStatus
} from '../services/jobStatusService';

describe('jobStatusService', () => {
  afterAll(() => {
    stopCleanupInterval();
  });

  it('creates and reads a queued job', () => {
    const id = `job-${Date.now()}-create`;
    const job = createJob(id);

    expect(job.id).toBe(id);
    expect(job.status).toBe('queued');
    expect(job.progress).toBe(0);

    const loaded = getJob(id);
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe(id);
  });

  it('updates processing and completion state', async () => {
    const id = `job-${Date.now()}-complete`;
    createJob(id);

    await updateJobStatus(id, 'processing', 55);
    expect(getJob(id)?.status).toBe('processing');
    expect(getJob(id)?.progress).toBe(55);

    await completeJob(id, {
      url: 'http://localhost:3001/downloads/test.dxf',
      filename: 'test.dxf'
    });

    expect(getJob(id)?.status).toBe('completed');
    expect(getJob(id)?.progress).toBe(100);
    expect(getJob(id)?.result?.filename).toBe('test.dxf');
  });

  it('tracks failed attempts and processing guard', async () => {
    const id = `job-${Date.now()}-fail`;
    createJob(id);

    expect(shouldProcessJob(id)).toBe(true);

    await failJob(id, 'simulated failure 1');
    expect(getJob(id)?.status).toBe('failed');
    expect(getJob(id)?.attempts).toBe(1);

    await failJob(id, 'simulated failure 2');
    await failJob(id, 'simulated failure 3');

    expect(getJob(id)?.attempts).toBe(3);
    expect(shouldProcessJob(id)).toBe(false);
  });
});
