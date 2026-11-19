const { chromium } = require('playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:816,height:1056}, deviceScaleFactor:2 });
 await p.goto('file://'+path.join(__dirname,'daily_checklist.html'));
 await p.pdf({ path:path.join(__dirname,'DAILY_CHECKLIST.pdf'), width:'8.5in', height:'11in', printBackground:true });
 const pages = await p.$$('.page'); for (let i=0;i<pages.length;i++) await pages[i].screenshot({ path:path.join(__dirname,`checklist_p${i+1}.png`) });
 await b.close(); })();
