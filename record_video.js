const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const dir = 'docs/demo/';
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log('Starting browser...');
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Recording
  console.log('--- Starting Desktop Recording ---');
  const desktopContext = await browser.newContext({
    recordVideo: {
      dir: dir,
      size: { width: 1280, height: 720 }
    },
    viewport: { width: 1280, height: 720 }
  });

  const desktopPage = await desktopContext.newPage();

  try {
    console.log('1. Navigating to http://localhost:3000');
    await desktopPage.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    // Wait for skeleton/loading state if possible, or just wait for table
    console.log('Waiting for table to load...');
    await desktopPage.waitForSelector('table', { timeout: 15000 });
    await desktopPage.waitForTimeout(2000);

    console.log('2. Smooth scroll down');
    await desktopPage.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        let distance = 100;
        let timer = setInterval(() => {
          let scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    await desktopPage.waitForTimeout(1000);

    console.log('3. Smooth scroll back up');
    await desktopPage.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = document.body.scrollHeight;
        let distance = 100;
        let timer = setInterval(() => {
          window.scrollBy(0, -distance);
          totalHeight -= distance;
          if (totalHeight <= 0) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    await desktopPage.waitForTimeout(1000);

    console.log('4. Demonstrate sorting');
    const rateHeader = desktopPage.locator('th:has-text("Rate %") button.sort-btn, th:has-text("Rate %")');
    if (await rateHeader.count() > 0) {
      await rateHeader.first().click();
      await desktopPage.waitForTimeout(2000);
      await rateHeader.first().click();
      await desktopPage.waitForTimeout(2000);
    }

    console.log('5. Demonstrate filtering');
    const filters = desktopPage.locator('button.filter-chip, [role="tab"]');
    if (await filters.count() > 1) {
      await filters.nth(1).click();
      await desktopPage.waitForTimeout(3000);
      await filters.nth(0).click();
      await desktopPage.waitForTimeout(2000);
    }

    console.log('6. Row click -> 30-day history chart');
    const firstRow = desktopPage.locator('tbody tr[role="button"], tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      console.log('Waiting for chart animation...');
      await desktopPage.waitForTimeout(6000); // Give time for chart animation
      
      // Scroll to chart if needed
      await desktopPage.evaluate(() => {
        const chart = document.querySelector('.chart-container, canvas');
        if (chart) chart.scrollIntoView({ behavior: 'smooth' });
      });
      await desktopPage.waitForTimeout(3000);
    }

    console.log('7. Observe auto-refresh countdown');
    await desktopPage.waitForTimeout(10000);

  } catch (error) {
    console.error('Error during desktop walkthrough:', error);
  } finally {
    await desktopContext.close();
  }

  // 2. Mobile Recording (Optional but requested)
  console.log('--- Starting Mobile Recording ---');
  const iPhone13 = devices['iPhone 13'];
  const mobileContext = await browser.newContext({
    ...iPhone13,
    recordVideo: {
      dir: dir,
      size: { width: 375, height: 667 }
    }
  });

  const mobilePage = await mobileContext.newPage();

  try {
    console.log('Navigating to http://localhost:3000 (Mobile)');
    await mobilePage.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await mobilePage.waitForSelector('table', { timeout: 15000 });
    await mobilePage.waitForTimeout(2000);

    console.log('Mobile scroll');
    await mobilePage.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        let distance = 50;
        let timer = setInterval(() => {
          let scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 50);
      });
    });
    await mobilePage.waitForTimeout(2000);

  } catch (error) {
    console.error('Error during mobile walkthrough:', error);
  } finally {
    await mobileContext.close();
  }

  await browser.close();
  console.log('Recording finished.');

  // Process videos
  const files = fs.readdirSync(dir);
  const videoFiles = files
    .filter(f => f.endsWith('.webm') && f !== 'walkthrough.webm' && f !== 'walkthrough-dashboard.webm')
    .map(f => ({ name: f, time: fs.statSync(path.join(dir, f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);

  if (videoFiles.length >= 2) {
    // We have at least two videos (desktop and mobile)
    // For now, we'll just rename the desktop one (the first one recorded is actually the last in the list if sorted by mtime descending)
    // Wait, the mobile one was closed last, so it might be the newest.
    
    const mobileVideo = videoFiles[0].name;
    const desktopVideo = videoFiles[1].name;

    const desktopPath = path.join(dir, desktopVideo);
    const finalPath = path.join(dir, 'walkthrough-dashboard.webm');

    if (fs.existsSync(finalPath)) {
      fs.unlinkSync(finalPath);
    }
    fs.renameSync(desktopPath, finalPath);
    console.log(`Desktop video saved to ${finalPath}`);
    
    // Also save mobile one separately
    const mobilePath = path.join(dir, mobileVideo);
    const mobileFinalPath = path.join(dir, 'walkthrough-mobile.webm');
    if (fs.existsSync(mobileFinalPath)) {
      fs.unlinkSync(mobileFinalPath);
    }
    fs.renameSync(mobilePath, mobileFinalPath);
    console.log(`Mobile video saved to ${mobileFinalPath}`);

    // Cleanup other random webm files if any
    videoFiles.slice(2).forEach(f => {
      try { fs.unlinkSync(path.join(dir, f.name)); } catch(e) {}
    });
  } else if (videoFiles.length === 1) {
    const oldPath = path.join(dir, videoFiles[0].name);
    const newPath = path.join(dir, 'walkthrough-dashboard.webm');
    if (fs.existsSync(newPath)) {
      fs.unlinkSync(newPath);
    }
    fs.renameSync(oldPath, newPath);
    console.log(`Video saved to ${newPath}`);
  } else {
    console.error('No video files found.');
  }
})();
