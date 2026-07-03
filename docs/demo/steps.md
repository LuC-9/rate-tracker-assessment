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
9. Recorded a dashboard-focused video walkthrough (`walkthrough-dashboard.webm`) covering:
   - Smooth scrolling through the entire dashboard UI.
   - Interactive table sorting and filtering.
   - Row selection with animated 30-day history charts.
   - Auto-refresh behavior and loading states.
   - Desktop and mobile (375px) viewport responsiveness.
   - Recording timestamp: 2026-07-03 06:18 UTC.
   - Duration: ~56 seconds.

## Commands used

- `Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"`
- `docker compose up -d db redis web`
- `cd frontend; npm run dev`
- `npx playwright install chromium`
- `# Reused committed recordings in docs/demo/: walkthrough.webm, walkthrough-dashboard.webm, walkthrough-mobile.webm`
- `node take_hero_screenshot.js`

## Notes

- The walkthrough was performed using the `app-recorder` agent.
- Screenshots are saved in `docs/demo/screenshots/`.
