const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordVideo: {
      dir: 'docs/demo/',
      size: { width: 1280, height: 720 }
    },
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  console.log('Navigating to Dashboard...');
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);

  console.log('Interacting with table (sorting)...');
  // Assuming there's a header to click for sorting. 
  // I'll try to find a table header and click it.
  const header = await page.locator('th').first();
  if (await header.isVisible()) {
    await header.click();
    await page.waitForTimeout(1000);
  }

  console.log('Interacting with filters...');
  // Assuming there's a select or input for filtering.
  const filter = await page.locator('select, input[type="text"]').first();
  if (await filter.isVisible()) {
    await filter.focus();
    // If it's a select, choose an option. If it's an input, type something.
    const tagName = await filter.evaluate(el => el.tagName);
    if (tagName === 'SELECT') {
      await filter.selectOption({ index: 1 });
    } else {
      await filter.fill('USD');
    }
    await page.waitForTimeout(2000);
  }

  console.log('Clicking a row to show chart...');
  const row = await page.locator('tbody tr').first();
  if (await row.isVisible()) {
    await row.click();
    await page.waitForTimeout(3000); // Wait for chart to render
  }

  console.log('Waiting for auto-refresh (briefly)...');
  await page.waitForTimeout(2000);

  console.log('Navigating to API Health...');
  await page.goto('http://localhost:8000/health/');
  await page.waitForTimeout(2000);

  console.log('Navigating to API Latest Rates...');
  await page.goto('http://localhost:8000/rates/latest/');
  await page.waitForTimeout(2000);

  await context.close();
  await browser.close();

  console.log('Recording finished.');

  // Find the recorded video and rename it
  const files = fs.readdirSync('docs/demo/');
  const videoFile = files.find(f => f.endsWith('.webm'));
  if (videoFile) {
    const oldPath = path.join('docs/demo/', videoFile);
    const newPath = path.join('docs/demo/', 'walkthrough.webm');
    if (fs.existsSync(newPath)) {
      fs.unlinkSync(newPath);
    }
    fs.renameSync(oldPath, newPath);
    console.log(`Video saved to ${newPath}`);
  } else {
    console.error('No video file found.');
  }
})();
