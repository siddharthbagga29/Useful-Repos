/**
 * POSITIONING OS — single consolidated Apps Script file
 * =====================================================
 * Everything the sheet needs, in ONE file. Paste this into Code.gs, delete
 * every other .gs in the project, save, and run setupEverything once.
 *
 * Why one file: this project has now been broken three separate times by a
 * stale paste — EMAIL_BRIEF sat undeployed for six days, Ingest.gs was a
 * version behind, and Code.gs still held the first DailyEngine. Multiple files
 * that must be kept in sync by hand is the defect. One file cannot drift.
 *
 * What runs here (Google's servers, every day, laptop or no laptop):
 *   - Census CBP pull, if the Mac has not already done it today
 *   - Dashboard formula repair
 *   - CRM audit (overdue, no value-to-give, unverified)
 *   - Daily email: WHAT WAS DONE + KPIs. Never a task list.
 *   - Sunday email: weekly narrative
 *   - /exec endpoint the Mac posts research rows to
 */

var SHEET_ID = '1CximFWly4sb8l8YtFq-bXMXNcBxHeWLUfgJFydcfEEY';
var TOKEN_PROP = 'INGEST_TOKEN';

var T = {
  DASH: 'Dashboard', PEOPLE: 'People CRM', ORGS: 'Organizations',
  COS: 'Target Companies', EVENTS: 'Events', RESEARCH: 'Investment Research',
  PROJ: 'Portfolio Projects', APPS: 'Applications', OPPS: 'Opportunities',
  SOURCES: 'Sources & Verification',
  LOG: 'Agent Log', ESC: 'Escalations', MEM: 'Agent Memory', WEEK: 'Weekly Report'
};

var HEADERS = {};
HEADERS[T.LOG] = ['Run ID','Timestamp','Module','Action','Result','Items','Source URL','Duration (s)','Notes'];
HEADERS[T.ESC] = ['Escalation ID','Raised','Severity','Category','What happened','Why it needs you','Suggested action','Source URL','Status','Resolved','Notes'];
HEADERS[T.MEM] = ['Source ID','Kind','Org','URL','Last Success','Last Failure','Consecutive Failures','Total Runs','Items Found (last)','Items Found (total)','Content Hash','Priority','Notes'];
HEADERS[T.WEEK] = ['Week ending','Runs','Census pulls','Establishments logged','Form D filings','Sources watched','Changes detected','Open escalations (HIGH)','Open escalations (MEDIUM)','Dead sources','Narrative','Emailed'];

function book_() { return SpreadsheetApp.openById(SHEET_ID); }
function sh_(n) { return book_().getSheetByName(n); }
function esc_(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
function now_() { return new Date(); }

function rows_(name) {
  var s = sh_(name);
  if (!s || s.getLastRow() < 2) return [];
  var v = s.getRange(1, 1, s.getLastRow(), s.getLastColumn()).getValues();
  var head = v[0].map(String);
  return v.slice(1).map(function (r) {
    var o = {}; head.forEach(function (h, i) { o[h] = r[i]; }); return o;
  });
}

function ensureTab_(name) {
  var ss = book_(), s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    if (HEADERS[name]) {
      s.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]])
        .setFontWeight('bold').setBackground('#1f3a5f').setFontColor('#ffffff');
      s.setFrozenRows(1);
    }
  }
  return s;
}

/* ============================ MENU ============================ */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Positioning OS')
    .addItem('Run the daily job now', 'runDailyNow')
    .addItem('Email me the daily report', 'emailDailyReport')
    .addItem('Email me the weekly report', 'emailWeeklyReport')
    .addSeparator()
    .addItem('Repair Dashboard formulas', 'repairDashboard')
    .addItem('Show ingest token', 'setupIngestToken')
    .addItem('Test ingest endpoint', 'testIngestLocally')
    .addSeparator()
    .addItem('SET UP EVERYTHING (run once)', 'setupEverything')
    .addToUi();
}

function setupEverything() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('dailyRun_').timeBased().atHour(7).everyDays(1).create();
  ScriptApp.newTrigger('emailDailyReport').timeBased().atHour(8).everyDays(1).create();
  ScriptApp.newTrigger('emailWeeklyReport').timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(18).create();
  var tok = setupIngestToken();
  ensureTab_(T.LOG); ensureTab_(T.ESC); ensureTab_(T.MEM); ensureTab_(T.WEEK);
  Logger.log('Triggers set: work 7am, daily report 8am, weekly Sunday 6pm.');
  Logger.log('Ingest token: ' + tok);
  Logger.log('Now deploy: Deploy > New deployment > Web app > Execute as Me, Access Anyone.');
}

/* ======================= INGEST ENDPOINT ======================= */

/** Prints the token to the Execution log. Never getUi().alert() — an alert
 *  run from the editor hangs forever waiting for a dialog that cannot draw. */
function setupIngestToken() {
  var p = PropertiesService.getScriptProperties();
  var t = p.getProperty(TOKEN_PROP);
  if (!t) {
    t = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    p.setProperty(TOKEN_PROP, t);
  }
  Logger.log('=============== INGEST TOKEN ===============');
  Logger.log(t);
  Logger.log('===========================================');
  return t;
}

function doPost(e) {
  var out = function (o) {
    return ContentService.createTextOutput(JSON.stringify(o))
      .setMimeType(ContentService.MimeType.JSON);
  };
  try {
    if (!e || !e.postData || !e.postData.contents) return out({ ok: false, error: 'empty body' });
    var body = JSON.parse(e.postData.contents);
    var expected = PropertiesService.getScriptProperties().getProperty(TOKEN_PROP);
    if (!expected) return out({ ok: false, error: 'no token configured' });
    if (body.token !== expected) return out({ ok: false, error: 'bad token' });

    var written = 0, created = [];
    (body.writes || []).forEach(function (w) {
      if (!w.tab || !w.rows || !w.rows.length) return;
      var existed = !!book_().getSheetByName(w.tab);
      var s = ensureTab_(w.tab);
      if (!existed) {
        created.push(w.tab);
        if (!HEADERS[w.tab] && w.headers && w.headers.length) {
          s.getRange(1, 1, 1, w.headers.length).setValues([w.headers])
            .setFontWeight('bold').setBackground('#1f3a5f').setFontColor('#ffffff');
          s.setFrozenRows(1);
        }
      }
      var width = 0;
      w.rows.forEach(function (r) { if (r.length > width) width = r.length; });
      var padded = w.rows.map(function (r) {
        var c = r.slice(); while (c.length < width) c.push(''); return c;
      });
      s.getRange(s.getLastRow() + 1, 1, padded.length, width).setValues(padded);
      written += padded.length;
    });
    return out({ ok: true, written: written, tabs_created: created });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  var out = function (o) {
    return ContentService.createTextOutput(JSON.stringify(o))
      .setMimeType(ContentService.MimeType.JSON);
  };
  try {
    var expected = PropertiesService.getScriptProperties().getProperty(TOKEN_PROP);
    if (!e || !e.parameter || e.parameter.token !== expected) return out({ ok: false, error: 'bad token' });
    if (!e.parameter.tab) return out({ ok: false, error: 'no tab' });
    return out({ ok: true, rows: rows_(e.parameter.tab) });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

/** Proves the endpoint reaches the sheet before Python is ever blamed. */
function testIngestLocally() {
  Logger.log('Spreadsheet: ' + book_().getName());
  var token = PropertiesService.getScriptProperties().getProperty(TOKEN_PROP);
  Logger.log('Token: ' + (token ? 'configured (' + token.length + ' chars)' : 'MISSING — run setupIngestToken'));
  var fake = { postData: { contents: JSON.stringify({ token: token, writes: [{
    tab: T.LOG, headers: HEADERS[T.LOG],
    rows: [['SELFTEST-GS', new Date().toISOString(), 'ingest', 'local test', 'OK', 1, '', 0,
            'Written by testIngestLocally — the endpoint can reach the sheet.']]
  }] }) } };
  Logger.log('doPost: ' + doPost(fake).getContent());
}

/* ===================== DASHBOARD SELF-REPAIR ===================== */

function repairDashboard() { Logger.log('Restored ' + repairDashboard_() + ' formula(s).'); }

function repairDashboard_() {
  var s = sh_(T.DASH); if (!s) return 0;
  var P = "'" + T.PEOPLE + "'", E = "'" + T.EVENTS + "'", R = "'" + T.RESEARCH + "'",
      J = "'" + T.PROJ + "'", A = "'" + T.APPS + "'", O = "'" + T.OPPS + "'",
      C = "'" + T.COS + "'", S = "'" + T.SOURCES + "'";
  var F = {
    6:'=COUNTIFS('+P+'!P2:P,"<="&TODAY(),'+P+'!P2:P,"<>")',
    7:'=COUNTIF('+P+'!AB2:AB,"UNVERIFIED")',
    8:'=COUNTIF('+P+'!AB2:AB,"OUTDATED")+COUNTIF('+C+'!R2:R,"OUTDATED")',
    9:'=COUNTIF('+O+'!L2:L,"Yes")',
    10:'=COUNTIFS('+J+'!L2:L,"<"&TODAY(),'+J+'!J2:J,"<>COMPLETE",'+J+'!L2:L,"<>")',
    13:'=COUNTA('+P+'!B2:B)', 14:'=COUNTIFS('+P+'!N2:N,">="&TODAY()-7)',
    15:'=COUNTIFS('+P+'!O2:O,">="&TODAY()-7)', 16:'=COUNTIF('+P+'!H2:H,"A")',
    17:'=COUNTIF('+P+'!H2:H,"B")', 18:'=SUMPRODUCT(--('+P+'!W2:W<>""))',
    19:'=IFERROR(ROUND(AVERAGE('+P+'!Z2:Z),2),0)',
    22:'=IFERROR(SUM('+J+'!H2:H),0)', 23:'=COUNTIF('+J+'!J2:J,"COMPLETE")',
    24:'=COUNTA('+R+'!A2:A)',
    25:'=IFERROR(SUMIFS('+R+'!N2:N,'+R+'!B2:B,">="&TODAY()-7),0)',
    26:'=COUNTA('+C+'!B2:B)', 29:'=COUNTIF('+E+'!H2:H,"REGISTERED")',
    30:'=IFERROR(TEXT(MINIFS('+E+'!D2:D,'+E+'!D2:D,">="&TODAY()),"ddd d mmm"),"none scheduled")',
    31:'=COUNTIF('+E+'!M2:M,"Yes")', 32:'=COUNTA('+A+'!A2:A)',
    33:'=COUNTIFS('+O+'!F2:F,"<>Dead",'+O+'!F2:F,"<>")',
    42:'=COUNTA('+S+'!A2:A)',
    43:'=IFERROR(TEXT(COUNTIF('+S+'!E2:E,"Tier 1*")/COUNTA('+S+'!A2:A),"0%"),"-")',
    44:'=COUNTIFS('+S+'!K2:K,"<="&TODAY(),'+S+'!K2:K,"<>")'
  };
  var fixed = 0;
  Object.keys(F).forEach(function (row) {
    var c = s.getRange(Number(row), 2);
    if (c.getFormula() === '') { c.setFormula(F[row]); fixed++; }
  });
  return fixed;   // rows 36-39 are hand-entered baseline scores; never touched
}

/* ========================= CENSUS FALLBACK ========================= */

var NAICS_ROTATION = ['5617','5613','5614','5616','5619','5611','5615'];
var COUNTIES = [{f:'061',n:'Hamilton'},{f:'017',n:'Butler'},{f:'165',n:'Warren'},{f:'025',n:'Clermont'}];

/** Runs only if the Mac has not already logged a CBP pull today, so the two
 *  halves never duplicate each other. */
function pullCensus_() {
  var out = { naics:'', label:'', rows:[], errors:[], total:0, skipped:false };
  var today = Utilities.formatDate(now_(), book_().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  var already = rows_(T.RESEARCH).some(function (r) {
    return String(r['Research ID'] || '').indexOf('CBP-') === 0 &&
           String(r['Date'] || '').indexOf(today) === 0;
  });
  if (already) { out.skipped = true; return out; }

  var p = PropertiesService.getScriptProperties();
  var i = Number(p.getProperty('naicsIdx') || 0) % NAICS_ROTATION.length;
  p.setProperty('naicsIdx', String(i + 1));
  out.naics = NAICS_ROTATION[i];

  var key = p.getProperty('CENSUS_API_KEY') || '';
  COUNTIES.forEach(function (c) {
    var u = 'https://api.census.gov/data/2022/cbp?get=ESTAB,EMP,NAICS2017_LABEL' +
            '&for=county:' + c.f + '&in=state:39&NAICS2017=' + out.naics +
            (key ? '&key=' + key : '');
    try {
      var r = UrlFetchApp.fetch(u, { muteHttpExceptions: true });
      if (r.getResponseCode() !== 200) { out.errors.push(c.n + ': HTTP ' + r.getResponseCode()); return; }
      var d = JSON.parse(r.getContentText());
      if (!d || d.length < 2) { out.errors.push(c.n + ': no rows'); return; }
      var h = d[0], ei = h.indexOf('ESTAB'), mi = h.indexOf('EMP'), li = h.indexOf('NAICS2017_LABEL');
      var es = 0, em = 0;
      for (var k = 1; k < d.length; k++) {
        es += Number(d[k][ei]) || 0; em += Number(d[k][mi]) || 0;
        if (li >= 0 && !out.label) out.label = d[k][li];
      }
      out.total += es;
      out.rows.push({ county:c.n, estab:es, emp:em, url:u });
    } catch (err) { out.errors.push(c.n + ': ' + err); }
  });

  if (out.rows.length) {
    var detail = out.rows.map(function (r) { return r.county+' '+r.estab+' estab / '+r.emp+' emp'; }).join('; ');
    sh_(T.RESEARCH).appendRow([
      'CBP-' + Utilities.formatDate(now_(), book_().getSpreadsheetTimeZone(), 'yyyyMMdd') + '-' + out.naics,
      today, 'NAICS ' + out.naics + (out.label ? ' — ' + out.label : ''), 'Market sizing',
      'How many establishments in NAICS ' + out.naics + ' operate in the four-county region?',
      out.total + ' establishments across Hamilton, Butler, Warren, Clermont (CBP 2022)',
      detail, 'Tier 1 - Primary/Gov/SEC', out.rows[0].url, today, 'High', 'P1 sector thesis',
      'There are ' + out.total + ' establishments in NAICS ' + out.naics +
      ' across the four counties — that is the acquirable universe before any size filter.',
      0.25, 'Pulled by Apps Script (Mac had not run today)'
    ]);
  }
  return out;
}

/** Store the Census key once: setCensusKey() after editing the literal below. */
function setCensusKey() {
  var KEY = 'PASTE_YOUR_CENSUS_KEY_HERE';
  if (KEY.indexOf('PASTE_') === 0) { Logger.log('Edit KEY in setCensusKey first.'); return; }
  PropertiesService.getScriptProperties().setProperty('CENSUS_API_KEY', KEY);
  Logger.log('Census key stored in Script Properties (not in the code).');
}

/* ============================ CRM AUDIT ============================ */

function auditCRM_() {
  var res = { overdue:[], noValue:[], unverified:[], total:0 };
  var s = sh_(T.PEOPLE); if (!s || s.getLastRow() < 2) return res;
  var v = s.getRange(2, 1, s.getLastRow() - 1, s.getLastColumn()).getValues();
  var today = new Date(); today.setHours(0,0,0,0);
  v.forEach(function (r) {
    if (!r[1]) return;
    res.total++;
    if (r[15] instanceof Date && r[15] <= today) res.overdue.push(r[1] + ' (' + (r[3] || '?') + ')');
    var val = String(r[21] || '').trim().toLowerCase();
    if (!val || val.indexOf('nothing yet') === 0) res.noValue.push(r[1]);
    if (r[27] === 'UNVERIFIED') res.unverified.push(r[1]);
  });
  return res;
}

/* ============================ DAILY JOB ============================ */

function runDailyNow() { dailyRun_(); Logger.log('Daily job complete.'); }

function dailyRun_() {
  try { repairDashboard_(); } catch (e) { Logger.log('repair: ' + e); }
  try {
    var c = pullCensus_();
    ensureTab_(T.LOG).appendRow(['AS-' + Utilities.formatDate(now_(), 'GMT', 'yyyyMMdd'),
      new Date().toISOString(), 'census',
      c.skipped ? 'skipped (Mac already pulled)' : 'CBP NAICS ' + c.naics,
      c.skipped ? 'SKIP' : (c.rows.length ? 'OK' : 'FAILED'),
      c.total, c.rows.length ? c.rows[0].url : '', 0, c.errors.join('; ').slice(0, 400)]);
  } catch (e) { Logger.log('census: ' + e); }
}

/* =========================== DAILY EMAIL =========================== */

function emailDailyReport() {
  var ss = book_(), tz = ss.getSpreadsheetTimeZone();
  var cut = new Date(Date.now() - 864e5);
  var logs = rows_(T.LOG).filter(function (r) {
    return r.Timestamp && new Date(r.Timestamp) >= cut; });
  var escs = rows_(T.ESC).filter(function (e) {
    return String(e.Status).toUpperCase() === 'OPEN'; });
  var high = escs.filter(function (e) { return String(e.Severity).toUpperCase() === 'HIGH'; });

  var estab = 0, pulls = 0, changed = 0, failed = 0, people = 0, macRan = false;
  logs.forEach(function (r) {
    if (r.Module === 'census' && r.Result === 'OK') { pulls++; estab += Number(r.Items) || 0; }
    if (r.Result === 'CHANGED') changed++;
    if (r.Result === 'FAILED' || r.Result === 'EXCEPTION') failed++;
    if (r.Action === 'person candidate') people++;
    if (String(r['Run ID']).indexOf('AS-') !== 0) macRan = true;
  });

  var cnt = function (t) { var s = sh_(t); return s ? Math.max(s.getLastRow() - 1, 0) : 0; };

  var html = '<h2>Positioning OS — ' + Utilities.formatDate(now_(), tz, 'EEEE d MMMM') + '</h2>' +
    (macRan ? '' : '<p style="color:#b02a37"><b>The Mac did not run in the last 24 hours.</b> ' +
      'Browser research paused; Census still ran on Google. Check ~/.positioning-os/logs/daily.err.</p>') +
    '<h3>What was done</h3><ul>' +
      '<li><b>' + pulls + '</b> Census pulls → <b>' + estab + '</b> establishments logged</li>' +
      '<li><b>' + changed + '</b> watched pages changed</li>' +
      '<li><b>' + people + '</b> person candidates (UNVERIFIED — confirm titles before use)</li>' +
      '<li><b>' + failed + '</b> module failures</li></ul>' +
    '<h3>KPIs</h3><ul>' +
      '<li>Contacts in CRM: <b>' + cnt(T.PEOPLE) + '</b></li>' +
      '<li>Companies on radar: <b>' + cnt(T.COS) + '</b></li>' +
      '<li>Research entries: <b>' + cnt(T.RESEARCH) + '</b></li>' +
      '<li>Open escalations: <b>' + escs.length + '</b> (' + high.length + ' HIGH)</li></ul>';

  if (high.length) {
    html += '<h3 style="color:#b02a37">Needs a decision from you</h3><ul>' +
      high.map(function (e) {
        return '<li><b>' + esc_(e.Category) + ':</b> ' + esc_(e['What happened']) +
          '<br><i>' + esc_(e['Why it needs you']) + '</i><br>→ ' + esc_(e['Suggested action']) +
          (e['Source URL'] ? ' <a href="' + esc_(e['Source URL']) + '">open</a>' : '') + '</li>';
      }).join('') + '</ul>';
  } else { html += '<p>Nothing needs you today.</p>'; }

  html += '<hr><p><a href="' + ss.getUrl() + '">Open the workbook</a></p>';

  MailApp.sendEmail({ to: Session.getActiveUser().getEmail(),
    subject: 'Positioning OS — ' + Utilities.formatDate(now_(), tz, 'EEE d MMM') +
      ' — ' + estab + ' establishments, ' + changed + ' changes, ' + high.length + ' need you',
    htmlBody: html });
}

/* =========================== WEEKLY EMAIL =========================== */

function emailWeeklyReport() {
  var s = sh_(T.WEEK);
  if (!s || s.getLastRow() < 2) { Logger.log('No weekly rows yet.'); return; }
  var v = s.getRange(1, 1, s.getLastRow(), s.getLastColumn()).getValues();
  var head = v[0].map(String), sentCol = head.indexOf('Emailed') + 1;
  if (sentCol < 1) return;

  for (var i = v.length - 1; i >= 1; i--) {
    if (String(v[i][sentCol - 1]).toUpperCase() === 'YES') continue;
    var o = {}; head.forEach(function (h, j) { o[h] = v[i][j]; });
    var escs = rows_(T.ESC).filter(function (e) { return String(e.Status).toUpperCase() === 'OPEN'; });

    var html = '<h2>Positioning OS — week ending ' + esc_(o['Week ending']) + '</h2>' +
      '<p>' + esc_(o.Narrative) + '</p>' +
      '<h3>Numbers</h3><table border="1" cellpadding="6" style="border-collapse:collapse">' +
      ['Runs','Census pulls','Establishments logged','Form D filings','Sources watched',
       'Changes detected','Dead sources'].map(function (k) {
        return '<tr><td>' + k + '</td><td align="right"><b>' + esc_(o[k]) + '</b></td></tr>';
      }).join('') + '</table>' +
      (escs.length ? '<h3>Open escalations</h3><ul>' + escs.slice(0, 20).map(function (e) {
        return '<li><b>[' + esc_(e.Severity) + '] ' + esc_(e.Category) + '</b> — ' +
          esc_(e['What happened']) + '<br>→ ' + esc_(e['Suggested action']) + '</li>';
      }).join('') + '</ul>' : '<p>No open escalations.</p>') +
      '<hr><p><a href="' + book_().getUrl() + '">Open the workbook</a></p>';

    MailApp.sendEmail({ to: Session.getActiveUser().getEmail(),
      subject: 'Positioning OS — weekly — ' + esc_(o['Week ending']) +
        ' — ' + esc_(o['Open escalations (HIGH)']) + ' need you', htmlBody: html });
    s.getRange(i + 1, sentCol).setValue('YES');
    return;
  }
  Logger.log('Latest weekly row already emailed.');
}
