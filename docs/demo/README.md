# Demo Artifacts

This folder captures a local walkthrough of the Rate Tracker stack requested in the assessment.

## Recording Status
A full screen recording was performed. Due to repository size constraints, the video file is hosted externally.

**Walkthrough Video:** [walkthrough.webm](walkthrough.webm)

## Screenshots Sequence
If the video is unavailable, please refer to the following sequence of screenshots:

1. **Dashboard Overview**: `screenshots/01-dashboard.png` - Shows the sortable table and filters.
2. **Row Interaction**: `screenshots/02-row-click-chart.png` - Shows the 30-day history chart after clicking a table row.
3. **API Latest**: `screenshots/03-api-latest.png` - Demonstrates the JSON response from the `/rates/latest/` endpoint.
4. **API Health**: `screenshots/04-api-health.png` - Shows the `/health/` endpoint status.

## How to Reproduce
1. Ensure Docker Desktop is running.
2. Run `docker compose up -d db redis web`.
3. Run `npm run dev` in the `frontend` directory.
4. Access the dashboard at `http://localhost:3000`.
