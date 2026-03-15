const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err));
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000);
    console.log("Waiting over");
    await browser.close();
})();
