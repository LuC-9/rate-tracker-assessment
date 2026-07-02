# Demo Steps

1. Started stack with `docker compose up --build`.
2. Opened dashboard at `http://localhost:3000`.
3. Confirmed backend API response at `http://localhost:8000/rates/latest/`.
4. Captured dashboard/API screenshots with Playwright CLI (full-page snapshots).
5. Saved the chart-state screenshot as `02-row-click-chart.png` for reviewer walkthrough reference.

## Commands used

- `docker compose up --build`
- `curl http://localhost:8000/rates/latest/`
- Playwright scripted screenshots from `http://localhost:3000`
