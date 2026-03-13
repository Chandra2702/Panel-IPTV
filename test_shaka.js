const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
    
    await page.goto('http://localhost:3000/live');
    console.log("Page loaded. Waiting 3 seconds...");
    await new Promise(r => setTimeout(r, 3000));
    
    console.log("Clicking Server button...");
    await page.evaluate(() => {
        document.getElementById('server-btn').click();
    });
    
    await new Promise(r => setTimeout(r, 1000));
    console.log("Clicking second server...");
    await page.evaluate(() => {
        const items = document.querySelectorAll('.server-item');
        if (items.length > 1) items[1].click();
    });
    
    console.log("Waiting 5 seconds for buffer...");
    await new Promise(r => setTimeout(r, 5000));
    
    await browser.close();
})();
