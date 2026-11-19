const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch();
  let p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  await p.goto('file://' + path.join(__dirname, 'wallpaper.html'));
  await p.screenshot({ path: path.join(__dirname, 'phone_wallpaper.png') });
  p = await b.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: 2 });
  await p.goto('file://' + path.join(__dirname, 'roadmap.html'));
  await p.pdf({ path: path.join(__dirname, 'ROADMAP_12_MONTHS.pdf'), width: '8.5in', height: '11in', printBackground: true });
  await p.screenshot({ path: path.join(__dirname, 'roadmap_preview.png') });
  await b.close();
})();
