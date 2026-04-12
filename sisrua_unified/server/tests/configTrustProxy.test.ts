describe('config TRUST_PROXY parsing', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  it('defaults to false in development when TRUST_PROXY is undefined', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
    };
    delete process.env.TRUST_PROXY;

    const { config } = await import('../config');
    expect(config.trustProxy).toBe(false);
  });

  it('defaults to 1 in production when TRUST_PROXY is undefined', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
    };
    delete process.env.TRUST_PROXY;

    const { config } = await import('../config');
    expect(config.trustProxy).toBe(1);
  });

  it('parses explicit TRUST_PROXY boolean values', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      TRUST_PROXY: 'false',
    };

    const { config } = await import('../config');
    expect(config.trustProxy).toBe(false);
  });

  it('parses explicit TRUST_PROXY hop count', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      TRUST_PROXY: '2',
    };

    const { config } = await import('../config');
    expect(config.trustProxy).toBe(2);
  });

  it('preserves TRUST_PROXY list string for express parser', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      TRUST_PROXY: 'loopback, linklocal, uniquelocal',
    };

    const { config } = await import('../config');
    expect(config.trustProxy).toBe('loopback, linklocal, uniquelocal');
  });
});
