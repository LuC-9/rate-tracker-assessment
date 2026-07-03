import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import Dashboard from './page';
import { fetchHistory, fetchLatestRates } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  fetchLatestRates: vi.fn(),
  fetchHistory: vi.fn(),
  thirtyDayWindow: vi.fn(() => ({ from: '2026-01-01', to: '2026-01-31' })),
}));

vi.mock('recharts', () => {
  const Wrapper = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Wrapper,
    AreaChart: Wrapper,
    Area: () => null,
    CartesianGrid: () => null,
    ReferenceLine: () => null,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
  };
});

const latestRatesPayload = {
  count: 1,
  results: [
    {
      id: 1,
      provider: 'Acme Bank',
      provider_raw: 'Acme Bank',
      rate_type: 'fixed_rate',
      rate_value: '4.120',
      effective_date: '2026-01-31',
      ingestion_timestamp: '2026-01-31T10:20:30Z',
      currency: 'USD',
    },
  ],
};

const historyPayload = {
  count: 5,
  page: 1,
  page_size: 100,
  results: [
    {
      id: 10,
      provider: 'Acme Bank',
      provider_raw: 'Acme Bank',
      rate_type: 'fixed_rate',
      rate_value: '4.020',
      effective_date: '2026-01-27',
      ingestion_timestamp: '2026-01-27T10:20:30Z',
      currency: 'USD',
    },
    {
      id: 11,
      provider: 'Acme Bank',
      provider_raw: 'Acme Bank',
      rate_type: 'fixed_rate',
      rate_value: '4.050',
      effective_date: '2026-01-28',
      ingestion_timestamp: '2026-01-28T10:20:30Z',
      currency: 'USD',
    },
    {
      id: 12,
      provider: 'Acme Bank',
      provider_raw: 'Acme Bank',
      rate_type: 'fixed_rate',
      rate_value: '4.070',
      effective_date: '2026-01-29',
      ingestion_timestamp: '2026-01-29T10:20:30Z',
      currency: 'USD',
    },
    {
      id: 13,
      provider: 'Acme Bank',
      provider_raw: 'Acme Bank',
      rate_type: 'fixed_rate',
      rate_value: '4.090',
      effective_date: '2026-01-30',
      ingestion_timestamp: '2026-01-30T10:20:30Z',
      currency: 'USD',
    },
    {
      id: 14,
      provider: 'Acme Bank',
      provider_raw: 'Acme Bank',
      rate_type: 'fixed_rate',
      rate_value: '4.120',
      effective_date: '2026-01-31',
      ingestion_timestamp: '2026-01-31T10:20:30Z',
      currency: 'USD',
    },
  ],
};

describe('frontend/app/page smoke tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading indicator while latest rates are pending', () => {
    (fetchLatestRates as Mock).mockImplementation(() => new Promise(() => {}));
    (fetchHistory as Mock).mockResolvedValue(historyPayload);

    render(<Dashboard />);

    expect(screen.getByText('Refreshing now')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Latest Rates' })).toBeInTheDocument();
  });

  it('shows error banner when latest-rates request fails', async () => {
    (fetchLatestRates as Mock).mockRejectedValue(new Error('API offline'));
    (fetchHistory as Mock).mockResolvedValue(historyPayload);

    render(<Dashboard />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to load rates: API offline',
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('renders key latest-rate content and triggers history fetch', async () => {
    (fetchLatestRates as Mock).mockResolvedValue(latestRatesPayload);
    (fetchHistory as Mock).mockResolvedValue(historyPayload);

    render(<Dashboard />);

    expect(await screen.findAllByText('Acme Bank')).not.toHaveLength(0);
    expect(screen.getAllByText('4.120%')).not.toHaveLength(0);
    await waitFor(() => expect(fetchHistory as Mock).toHaveBeenCalled());
  });
});
