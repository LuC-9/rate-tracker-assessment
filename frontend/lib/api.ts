export interface Rate {
  id: number;
  provider: string;
  provider_raw: string;
  rate_type: string;
  rate_value: string;
  effective_date: string;
  ingestion_timestamp: string;
  currency: string;
  source_url?: string;
}

export interface LatestResponse {
  count: number;
  results: Rate[];
}

export interface HistoryResponse {
  count: number;
  page: number;
  page_size: number;
  results: Rate[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function fetchLatestRates(type?: string): Promise<LatestResponse> {
  const url = type
    ? `${API_URL}/rates/latest/?type=${encodeURIComponent(type)}`
    : `${API_URL}/rates/latest/`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch latest rates (${res.status})`);
  return res.json();
}

export async function fetchHistory(
  provider: string,
  type: string,
  options?: { from?: string; to?: string; pageSize?: number },
): Promise<HistoryResponse> {
  const params = new URLSearchParams({ provider, type });
  if (options?.from) params.set('from', options.from);
  if (options?.to) params.set('to', options.to);
  if (options?.pageSize) params.set('page_size', String(options.pageSize));
  const res = await fetch(`${API_URL}/rates/history/?${params}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch history (${res.status})`);
  return res.json();
}

/** Build a 30-day window ending on the anchor effective date (handles future-dated seed data). */
export function thirtyDayWindow(anchorDate: string): { from: string; to: string } {
  const anchor = new Date(`${anchorDate}T00:00:00`);
  const from = new Date(anchor);
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: anchorDate,
  };
}
