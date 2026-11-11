// Renders print/BAGGA_PRINT_PACK.html to PDF and PNG previews.
// Usage (from project folder): node print/render_pdf.js [--previews]
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const here = __dirname;
  const htmlPath = 'file://' + path.join(here, 'BAGGA_PRINT_PACK.html');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(htmlPath, { waitUntil: 'load' });
  await page.pdf({ path: path.join(here, 'BAGGA_PRINT_PACK.pdf'), preferCSSPageSize: true, printBackground: true });
  if (process.argv.includes('--previews')) {
    const out = process.argv[process.argv.indexOf('--previews') + 1] || here;
    const n = await page.$$eval('section.page', els => els.length);
    for (let i = 0; i < n; i++) {
      const el = (await page.$$('section.page'))[i];
      await el.screenshot({ path: path.join(out, `p${String(i + 1).padStart(2, '0')}.png`) });
    }
  }
  await browser.close();
  console.log('PDF written');
})();
