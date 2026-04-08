const mockConfig = {
  useDbConstantsConfig: false,
  DXF_FILE_TTL_MS: 600000,
  DXF_MAX_AGE_MS: 7200000,
  DXF_CLEANUP_INTERVAL_MS: 120000,
  DXF_DIRECTORY: './public/dxf'
};

const getSyncMock = jest.fn();

jest.mock('../config', () => ({
  config: mockConfig
}));

jest.mock('../services/constantsService', () => ({
  constantsService: {
    getSync: getSyncMock
  }
}));

describe('dxfCleanupService policy snapshot', () => {
  beforeEach(() => {
    mockConfig.useDbConstantsConfig = false;
    getSyncMock.mockReset();
    jest.resetModules();
  });

  it('uses env/config fallback when config namespace is disabled', async () => {
    const { getDxfCleanupPolicySnapshot } = await import('../services/dxfCleanupService');

    expect(getDxfCleanupPolicySnapshot()).toEqual({
      fileTtlMs: 600000,
      maxFileAgeMs: 7200000,
      cleanupCheckIntervalMs: 120000
    });
    expect(getSyncMock).not.toHaveBeenCalled();
  });

  it('uses DB-backed values when config namespace is enabled and cache is warm', async () => {
    mockConfig.useDbConstantsConfig = true;
    getSyncMock
      .mockReturnValueOnce(300000)
      .mockReturnValueOnce(3600000)
      .mockReturnValueOnce(45000);

    const { getDxfCleanupPolicySnapshot } = await import('../services/dxfCleanupService');

    expect(getDxfCleanupPolicySnapshot()).toEqual({
      fileTtlMs: 300000,
      maxFileAgeMs: 3600000,
      cleanupCheckIntervalMs: 45000
    });
  });
});