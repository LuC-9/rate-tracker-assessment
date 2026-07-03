# Demo Steps

1. Started Docker Desktop on the Windows host.
2. Started the database and redis services with `docker compose up -d db redis`.
3. Started the backend API service with `docker compose up -d web`.
4. Started the frontend dashboard locally in development mode with `npm run dev`.
5. Verified services are healthy:
   - Dashboard: http://localhost:3000
   - API Latest: http://localhost:8000/rates/latest/
   - API Health: http://localhost:8000/health/
6. Performed walkthrough of the Dashboard:
   - Verified sortable table functionality.
   - Tested filtering by rate type.
   - Clicked a row to verify the 30-day history chart.
   - Observed auto-refresh behavior (60s interval).
7. Captured screenshots for the walkthrough sequence using Playwright.
8. Updated documentation with recording notes and instructions.

## Commands used

- `Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"`
- `docker compose up -d db redis web`
- `cd frontend; npm run dev`
- `npx playwright install chromium`
- `node take_screenshots.js`

## Notes

- The walkthrough was performed using the `app-recorder` agent.
- Screenshots are saved in `docs/demo/screenshots/`.
- Frontend was run locally due to a TypeScript build error in the production Docker image.
