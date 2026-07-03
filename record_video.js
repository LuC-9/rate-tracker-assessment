const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('Starting browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordVideo: {
      dir: 'docs/demo/',
      size: { width: 1280, height: 720 }
    },
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  try {
    console.log('1. Navigating to http://localhost:3000');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForSelector('table', { timeout: 10000 });
    await page.waitForTimeout(2000);

    console.log('2. Demonstrate sorting the table by clicking on column headers');
    // Sort by Rate %
    const rateHeader = page.locator('th:has-text("Rate %") button.sort-btn');
    if (await rateHeader.isVisible()) {
      await rateHeader.click();
      await page.waitForTimeout(1500);
      await rateHeader.click(); // Toggle sort direction
      await page.waitForTimeout(1500);
    }

    // Sort by Updated
    const updatedHeader = page.locator('th:has-text("Updated") button.sort-btn');
    if (await updatedHeader.isVisible()) {
      await updatedHeader.click();
      await page.waitForTimeout(1500);
    }

    console.log('3. Demonstrate filtering by clicking on filter chips');
    // The filter chips are formatted: "30yr_fixed_mortgage" -> "30yr fixed mortgage"
    const mortgageFilter = page.locator('button.filter-chip:has-text("30yr fixed mortgage")');
    if (await mortgageFilter.isVisible()) {
      await mortgageFilter.click();
      await page.waitForTimeout(2000);
    }

    console.log('4. Demonstrate viewing a row chart by clicking on a rate row');
    const firstRow = page.locator('tbody tr[role="button"]').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForTimeout(4000); // Wait for chart to render and be visible
    }

    console.log('5. Demonstrate the auto-refresh');
    // Wait to show the countdown chip changing
    await page.waitForTimeout(5000);

    console.log('6. Navigate to http://localhost:8000/health/');
    await page.goto('http://localhost:8000/health/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('7. Navigate to http://localhost:8000/rates/latest/');
    await page.goto('http://localhost:8000/rates/latest/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

  } catch (error) {
    console.error('Error during walkthrough:', error);
  } finally {
    await context.close();
    await browser.close();
  }

  console.log('Recording finished.');

  // Find the recorded video and rename it
  const dir = 'docs/demo/';
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const files = fs.readdirSync(dir);
  // Playwright saves with a random name, we want the most recent .webm that isn't our target
  const videoFiles = files
    .filter(f => f.endsWith('.webm') && f !== 'walkthrough.webm')
    .map(f => ({ name: f, time: fs.statSync(path.join(dir, f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);

  if (videoFiles.length > 0) {
    const videoFile = videoFiles[0].name;
    const oldPath = path.join(dir, videoFile);
    const newPath = path.join(dir, 'walkthrough.webm');
    
    // Ensure the target directory exists
    const targetDir = path.dirname(newPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    if (fs.existsSync(newPath)) {
      fs.unlinkSync(newPath);
    }
    fs.renameSync(oldPath, newPath);
    console.log(`Video saved to ${newPath}`);
  } else {
    console.error('No video file found.');
  }
})();
