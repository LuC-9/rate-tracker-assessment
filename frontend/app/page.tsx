'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchHistory, fetchLatestRates, Rate, thirtyDayWindow } from '@/lib/api';

type SortKey = 'rate_value' | 'ingestion_timestamp';

function formatRateType(type: string) {
  return type.replace(/_/g, ' ');
}

export default function Dashboard() {
  const [rates, setRates] = useState<Rate[]>([]);
  const [history, setHistory] = useState<Rate[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [anchorDate, setAnchorDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('rate_value');
  const [sortAsc, setSortAsc] = useState(true);
  const [loadingLatest, setLoadingLatest] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [errorLatest, setErrorLatest] = useState<string | null>(null);
  const [errorHistory, setErrorHistory] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(60);
  const selectionRef = useRef({ provider: '', type: '', date: '' });
  const historyRequestIdRef = useRef(0);

  const selectRate = useCallback((rate: Rate) => {
    selectionRef.current = {
      provider: rate.provider,
      type: rate.rate_type,
      date: rate.effective_date,
    };
    setSelectedProvider(rate.provider);
    setSelectedType(rate.rate_type);
    setAnchorDate(rate.effective_date);
  }, []);

  const loadHistory = useCallback(async (provider: string, type: string, effectiveDate: string) => {
    if (!provider || !type || !effectiveDate) return;
    const requestId = historyRequestIdRef.current + 1;
    historyRequestIdRef.current = requestId;
    setLoadingHistory(true);
    setErrorHistory(null);
    setHistory([]);
    try {
      const { from, to } = thirtyDayWindow(effectiveDate);
      let data = await fetchHistory(provider, type, { from, to, pageSize: 100 });

      if (data.results.length < 5) {
        data = await fetchHistory(provider, type, { pageSize: 30 });
      }

      if (requestId === historyRequestIdRef.current) {
        setHistory([...data.results].reverse());
      }
    } catch (err) {
      if (requestId === historyRequestIdRef.current) {
        setHistory([]);
        setErrorHistory(err instanceof Error ? err.message : 'Unknown error loading history');
      }
    } finally {
      if (requestId === historyRequestIdRef.current) {
        setLoadingHistory(false);
      }
    }
  }, []);

  const loadLatest = useCallback(async () => {
    setLoadingLatest(true);
    setErrorLatest(null);
    setSecondsUntilRefresh(60);
    try {
      const data = await fetchLatestRates(typeFilter || undefined);
      setRates(data.results);
      setLastRefreshed(new Date());

      if (data.results.length > 0) {
        const { provider, type } = selectionRef.current;
        const stillVisible = data.results.some(
          (r) => r.provider === provider && r.rate_type === type,
        );
        if (!provider || !stillVisible) {
          selectRate(data.results[0]);
        }
      }
    } catch (err) {
      setErrorLatest(err instanceof Error ? err.message : 'Unknown error loading rates');
    } finally {
      setLoadingLatest(false);
    }
  }, [typeFilter, selectRate]);

  useEffect(() => {
    loadLatest();
    const interval = setInterval(loadLatest, 60000);
    return () => clearInterval(interval);
  }, [loadLatest]);

  useEffect(() => {
    const countdown = setInterval(() => {
      setSecondsUntilRefresh((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(countdown);
  }, []);

  useEffect(() => {
    if (selectedProvider && selectedType && anchorDate) {
      loadHistory(selectedProvider, selectedType, anchorDate);
    }
  }, [selectedProvider, selectedType, anchorDate, loadHistory]);

  const rateTypes = useMemo(
    () => [...new Set(rates.map((r) => r.rate_type))].sort(),
    [rates],
  );

  const sortedRates = useMemo(() => {
    return [...rates].sort((a, b) => {
      const left = sortKey === 'rate_value' ? Number(a.rate_value) : new Date(a.ingestion_timestamp).getTime();
      const right = sortKey === 'rate_value' ? Number(b.rate_value) : new Date(b.ingestion_timestamp).getTime();
      return sortAsc ? left - right : right - left;
    });
  }, [rates, sortKey, sortAsc]);

  const summaryStats = useMemo(() => {
    if (rates.length === 0) return null;
    const providers = new Set(rates.map((r) => r.provider)).size;
    const avgRate = rates.reduce((acc, rate) => acc + Number(rate.rate_value), 0) / rates.length;
    return {
      providers,
      types: rateTypes.length,
      avgRate,
    };
  }, [rates, rateTypes]);

  const chartData = history.map((item) => ({
    date: item.effective_date,
    rate: Number(item.rate_value),
  }));

  const chartStats = useMemo(() => {
    if (chartData.length === 0) return null;
    const values = chartData.map((d) => d.rate);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      latest: values[values.length - 1],
      points: chartData.length,
    };
  }, [chartData]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return 'none';
    return sortAsc ? 'ascending' : 'descending';
  };

  const historyRangeLabel =
    anchorDate && chartData.length > 0
      ? `${chartData[0].date} → ${chartData[chartData.length - 1].date}`
      : null;

  const handleRowKeySelect = (event: React.KeyboardEvent<HTMLElement>, rate: Rate) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectRate(rate);
    }
  };

  const renderSortIcon = (key: SortKey) => {
    const direction = sortIndicator(key);
    return (
      <span className={`sort-icon ${direction}`} aria-hidden="true">
        <span className="chevron-up">▲</span>
        <span className="chevron-down">▼</span>
      </span>
    );
  };

  return (
    <main className="container">
      <header className="hero-strip">
        <div className="brand-block">
          <div className="brand-logo" aria-hidden="true">
            <svg viewBox="0 0 32 32" focusable="false">
              <rect x="3" y="3" width="26" height="26" rx="8" />
              <path d="M8 21l5-8 4 4 7-8" />
              <circle cx="13" cy="13" r="1.5" />
              <circle cx="17" cy="17" r="1.5" />
              <circle cx="24" cy="9" r="1.5" />
            </svg>
          </div>
          <div>
            <p className="eyebrow">Rate Tracker</p>
            <h1>Compare latest provider rates</h1>
            <p className="subtitle">
              Click a row to view its 30-day history chart. Auto-refreshes every 60 seconds.
            </p>
          </div>
        </div>
        <div className="hero-meta">
          <span className="countdown-chip" aria-live="polite">
            {loadingLatest ? 'Refreshing now' : `Refresh in ${secondsUntilRefresh}s`}
          </span>
          {lastRefreshed && (
            <span className="meta-item">Updated {lastRefreshed.toLocaleTimeString()}</span>
          )}
        </div>
      </header>

      <section className="summary-grid" aria-label="Latest rate summary">
        <article className="summary-card">
          <span className="summary-label">Providers tracked</span>
          {loadingLatest ? (
            <span className="summary-skeleton" />
          ) : (
            <span className="summary-value">{summaryStats?.providers ?? 0}</span>
          )}
        </article>
        <article className="summary-card">
          <span className="summary-label">Rate types</span>
          {loadingLatest ? (
            <span className="summary-skeleton" />
          ) : (
            <span className="summary-value">{summaryStats?.types ?? 0}</span>
          )}
        </article>
        <article className="summary-card">
          <span className="summary-label">Avg rate</span>
          {loadingLatest ? (
            <span className="summary-skeleton" />
          ) : (
            <span className="summary-value">
              {summaryStats ? `${summaryStats.avgRate.toFixed(3)}%` : '0.000%'}
            </span>
          )}
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Latest Rates</h2>
          <div className="filter-chips" role="group" aria-label="Filter by rate type">
            <button
              type="button"
              className={`filter-chip ${typeFilter === '' ? 'active' : ''}`}
              aria-pressed={typeFilter === ''}
              onClick={() => setTypeFilter('')}
            >
              All
            </button>
            {rateTypes.map((type) => {
              const active = typeFilter === type;
              return (
                <button
                  key={type}
                  type="button"
                  className={`filter-chip ${active ? 'active' : ''}`}
                  aria-pressed={active}
                  onClick={() => setTypeFilter(type)}
                >
                  {formatRateType(type)}
                </button>
              );
            })}
          </div>
        </div>

        {errorLatest && (
          <div className="error-banner" role="alert">
            <span>Failed to load rates: {errorLatest}</span>
            <button type="button" className="retry-btn" onClick={loadLatest}>
              Retry
            </button>
          </div>
        )}

        {!loadingLatest && !errorLatest && sortedRates.length === 0 && (
          <div className="empty">No rates yet. Run seed_data or wait for background seeding.</div>
        )}

        {loadingLatest && !errorLatest && (
          <>
            <div className="table-wrap">
              <table aria-hidden="true">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Type</th>
                    <th>Rate %</th>
                    <th>Currency</th>
                    <th>Effective</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <tr key={`skeleton-row-${index}`}>
                      <td><span className="skeleton-line" /></td>
                      <td><span className="skeleton-line" /></td>
                      <td><span className="skeleton-line short" /></td>
                      <td><span className="skeleton-line short" /></td>
                      <td><span className="skeleton-line" /></td>
                      <td><span className="skeleton-line" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rate-cards" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, index) => (
                <article key={`skeleton-card-${index}`} className="rate-card">
                  <span className="skeleton-line" />
                  <span className="skeleton-line short" />
                  <span className="skeleton-line short" />
                  <span className="skeleton-line" />
                </article>
              ))}
            </div>
          </>
        )}

        {!loadingLatest && !errorLatest && sortedRates.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Type</th>
                  <th aria-sort={sortIndicator('rate_value')}>
                    <button className="sort-btn" onClick={() => toggleSort('rate_value')}>
                      <span>Rate %</span>
                      {renderSortIcon('rate_value')}
                    </button>
                  </th>
                  <th>Currency</th>
                  <th>Effective</th>
                  <th aria-sort={sortIndicator('ingestion_timestamp')}>
                    <button className="sort-btn" onClick={() => toggleSort('ingestion_timestamp')}>
                      <span>Updated</span>
                      {renderSortIcon('ingestion_timestamp')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRates.map((rate) => {
                  const selected =
                    rate.provider === selectedProvider && rate.rate_type === selectedType;
                  return (
                    <tr
                      key={rate.id}
                      className={selected ? 'selected' : ''}
                      onClick={() => selectRate(rate)}
                      onKeyDown={(event) => handleRowKeySelect(event, rate)}
                      role="button"
                      tabIndex={0}
                      aria-selected={selected}
                    >
                      <td className="provider-cell">{rate.provider}</td>
                      <td><span className="type-pill">{formatRateType(rate.rate_type)}</span></td>
                      <td className="rate-cell">{Number(rate.rate_value).toFixed(3)}%</td>
                      <td>{rate.currency}</td>
                      <td>{rate.effective_date}</td>
                      <td>{new Date(rate.ingestion_timestamp).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loadingLatest && !errorLatest && sortedRates.length > 0 && (
          <div className="rate-cards">
            {sortedRates.map((rate) => {
              const selected =
                rate.provider === selectedProvider && rate.rate_type === selectedType;
              return (
                <article
                  key={`card-${rate.id}`}
                  className={`rate-card ${selected ? 'selected' : ''}`}
                  onClick={() => selectRate(rate)}
                  onKeyDown={(event) => handleRowKeySelect(event, rate)}
                  role="button"
                  tabIndex={0}
                  aria-selected={selected}
                >
                  <div className="rate-card-header">
                    <span className="provider-cell">{rate.provider}</span>
                    <span className="type-pill">{formatRateType(rate.rate_type)}</span>
                  </div>
                  <div className="rate-card-value-row">
                    <span className="rate-cell">{Number(rate.rate_value).toFixed(3)}%</span>
                    <span className="currency-pill">{rate.currency}</span>
                  </div>
                  <p className="rate-card-meta">Effective: {rate.effective_date}</p>
                  <p className="rate-card-meta">
                    Updated: {new Date(rate.ingestion_timestamp).toLocaleString()}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>30-Day History</h2>
            {selectedProvider && (
              <p className="panel-subtitle">
                {selectedProvider} · {formatRateType(selectedType)}
                {historyRangeLabel && ` · ${historyRangeLabel}`}
              </p>
            )}
          </div>
        </div>

        {errorHistory && (
          <div className="error-banner" role="alert">
            <span>Failed to load history: {errorHistory}</span>
            <button
              type="button"
              className="retry-btn"
              onClick={() => {
                if (selectedProvider && selectedType && anchorDate) {
                  loadHistory(selectedProvider, selectedType, anchorDate);
                }
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!selectedProvider && !loadingHistory && (
          <div className="empty">Select a row in the table above to view its rate history.</div>
        )}

        {selectedProvider && !loadingHistory && !errorHistory && chartData.length === 0 && (
          <div className="empty">No history found for this provider and rate type.</div>
        )}

        {chartStats && !loadingHistory && !errorHistory && (
          <div className="stats-row">
            <div className="stat">
              <span className="stat-label">Latest</span>
              <span className="stat-value">{chartStats.latest.toFixed(3)}%</span>
            </div>
            <div className="stat">
              <span className="stat-label">Low</span>
              <span className="stat-value">{chartStats.min.toFixed(3)}%</span>
            </div>
            <div className="stat">
              <span className="stat-label">High</span>
              <span className="stat-value">{chartStats.max.toFixed(3)}%</span>
            </div>
            <div className="stat">
              <span className="stat-label">Data points</span>
              <span className="stat-value">{chartStats.points}</span>
            </div>
          </div>
        )}

        {loadingHistory && (
          <div className="chart-wrap chart-skeleton" aria-hidden="true">
            <span className="skeleton-block" />
          </div>
        )}

        {!loadingHistory && !errorHistory && chartData.length > 0 && (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 12, right: 16, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="rateFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  unit="%"
                  padding={{ top: 12, bottom: 12 }}
                  domain={[
                    (dataMin: number) => Number((dataMin - 0.02).toFixed(3)),
                    (dataMax: number) => Number((dataMax + 0.02).toFixed(3)),
                  ]}
                />
                <Tooltip
                  cursor={{ stroke: '#1d4ed8', strokeDasharray: '4 4' }}
                  contentStyle={{
                    borderRadius: 10,
                    border: '1px solid #bfdbfe',
                    background: '#eff6ff',
                  }}
                  labelStyle={{ color: '#1e3a8a', fontWeight: 600 }}
                  formatter={(value: number | string) => [`${Number(value).toFixed(3)}%`, 'Rate']}
                />
                <ReferenceLine
                  y={chartStats?.latest}
                  stroke="#7c3aed"
                  strokeDasharray="5 5"
                  ifOverflow="extendDomain"
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#1d4ed8"
                  strokeWidth={2}
                  fill="url(#rateFill)"
                  dot={{ r: 3, fill: '#1d4ed8' }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </main>
  );
}
