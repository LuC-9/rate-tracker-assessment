import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('frontend/lib/api', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('builds default latest-rates URL without type filter', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ count: 0, results: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchLatestRates } = await import('./api');
    await fetchLatestRates();

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/rates/latest/', {
      cache: 'no-store',
    });
  });

  it('builds URL with custom API base and encoded type filter', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ count: 0, results: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchLatestRates } = await import('./api');
    await fetchLatestRates('fixed rate');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/rates/latest/?type=fixed%20rate',
      { cache: 'no-store' },
    );
  });

  it('throws a descriptive error when latest-rates request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      }),
    );

    const { fetchLatestRates } = await import('./api');

    await expect(fetchLatestRates()).rejects.toThrow('Failed to fetch latest rates (503)');
  });

  it('builds history URL with required and optional query params', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ count: 1, page: 1, page_size: 100, results: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchHistory } = await import('./api');
    await fetchHistory('ACME Bank', 'fixed_rate', {
      from: '2026-01-01',
      to: '2026-01-31',
      pageSize: 100,
    });

    const calledUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(calledUrl.origin).toBe('http://localhost:8000');
    expect(calledUrl.pathname).toBe('/rates/history/');
    expect(calledUrl.searchParams.get('provider')).toBe('ACME Bank');
    expect(calledUrl.searchParams.get('type')).toBe('fixed_rate');
    expect(calledUrl.searchParams.get('from')).toBe('2026-01-01');
    expect(calledUrl.searchParams.get('to')).toBe('2026-01-31');
    expect(calledUrl.searchParams.get('page_size')).toBe('100');
  });
});
