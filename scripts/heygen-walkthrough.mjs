import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const API_KEY = process.env.HEYGEN_API_KEY;
const BASE = 'https://api.heygen.com';

const SCREENSHOTS = [
  { file: '01-dashboard.png', label: 'dashboard overview' },
  { file: '02-row-click-chart.png', label: 'row selection and 30-day chart' },
  { file: '03-api-latest.png', label: 'GET /rates/latest/ API response' },
  { file: '04-api-health.png', label: 'GET /health/ API response' },
];

function requireKey() {
  if (!API_KEY) {
    console.error('HEYGEN_API_KEY is required');
    process.exit(1);
  }
}

async function api(pathname, options = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    ...options,
    headers: {
      'X-Api-Key': API_KEY,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${pathname} failed (${res.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

async function uploadAsset(filePath) {
  const bytes = fs.readFileSync(filePath);
  const form = new FormData();
  form.append('file', new Blob([bytes]), path.basename(filePath));
  const res = await fetch(`${BASE}/v3/assets`, {
    method: 'POST',
    headers: { 'X-Api-Key': API_KEY },
    body: form,
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`upload failed (${res.status}): ${JSON.stringify(body)}`);
  }
  return body.data;
}

async function waitForVideoId(sessionId) {
  for (let i = 0; i < 60; i++) {
    const { data } = await api(`/v3/video-agents/${sessionId}`);
    if (data.video_id) return data.video_id;
    console.log(`Waiting for video_id... (${i + 1}) status=${data.status}`);
    await sleep(5000);
  }
  throw new Error('Timed out waiting for video_id');
}

async function waitForVideo(videoId) {
  for (let i = 0; i < 60; i++) {
    const { data } = await api(`/v3/videos/${videoId}`);
    console.log(`Video status: ${data.status}`);
    if (data.status === 'completed') return data;
    if (data.status === 'failed') {
      throw new Error(`Video failed: ${data.failure_message || JSON.stringify(data)}`);
    }
    await sleep(10000);
  }
  throw new Error('Timed out waiting for video completion');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

async function main() {
  requireKey();

  const screenshotDir = path.join(ROOT, 'docs', 'demo', 'screenshots');
  const assets = [];

  for (const shot of SCREENSHOTS) {
    const filePath = path.join(screenshotDir, shot.file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing screenshot: ${filePath}`);
    }
    console.log(`Uploading ${shot.file}...`);
    const uploaded = await uploadAsset(filePath);
    assets.push({ ...shot, asset_id: uploaded.asset_id });
    console.log(`Uploaded ${shot.file} -> ${uploaded.asset_id}`);
  }

  const prompt = [
    'Create a polished 60-second technical product walkthrough for "Rate Tracker", a full-stack interest rate ingestion platform.',
    'Use a professional, clear presenter tone suitable for a senior engineering assessment review.',
    'Structure the video in four scenes matching the attached screenshots in order:',
    '1) Dashboard overview — sortable latest-rates table, rate-type filters, auto-refresh every 60 seconds.',
    '2) Row selection — clicking a provider row loads a 30-day history chart anchored to that rate effective date.',
    '3) API latest endpoint — Django REST GET /rates/latest/ returns normalized provider keys and paginated latest rates.',
    '4) API health endpoint — GET /health/ confirms the backend stack is up.',
    'Mention the architecture briefly: Next.js dashboard, Django + PostgreSQL + Redis + Celery ingestion pipeline, Docker Compose local stack.',
    'Keep pacing brisk, use the screenshots as full-screen visuals during each scene, and end with a one-line summary that the project is ready for local review via docker compose up.',
  ].join(' ');

  const files = assets.map((a) => ({ type: 'asset_id', asset_id: a.asset_id }));

  console.log('Creating HeyGen video session...');
  const create = await api('/v3/video-agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      orientation: 'landscape',
      files,
    }),
  });

  const sessionId = create.data.session_id;
  console.log(`Session: ${sessionId}`);
  console.log(`Live preview: https://app.heygen.com/video-agent/${sessionId}`);

  const videoId = await waitForVideoId(sessionId);
  console.log(`Video ID: ${videoId}`);

  const video = await waitForVideo(videoId);
  const outPath = path.join(ROOT, 'docs', 'demo', 'walkthrough-heygen.mp4');
  console.log(`Downloading to ${outPath}`);
  await downloadFile(video.video_url, outPath);

  const meta = {
    session_id: sessionId,
    video_id: videoId,
    video_url: video.video_url,
    duration: video.duration,
    output: outPath,
    assets: assets.map(({ file, label, asset_id }) => ({ file, label, asset_id })),
    created_at: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(ROOT, 'docs', 'demo', 'heygen-meta.json'), JSON.stringify(meta, null, 2));
  console.log('Done.');
  console.log(JSON.stringify({ sessionId, videoId, outPath, duration: video.duration }, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
