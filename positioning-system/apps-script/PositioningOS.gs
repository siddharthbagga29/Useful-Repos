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
  SOURCES: 'Sources & Verification', TRADES: 'Trade Ideas',
  LOG: 'Agent Log', ESC: 'Escalations', MEM: 'Agent Memory', WEEK: 'Weekly Report'
};

var HEADERS = {};
HEADERS[T.LOG] = ['Run ID','Timestamp','Module','Action','Result','Items','Source URL','Duration (s)','Notes'];
HEADERS[T.ESC] = ['Escalation ID','Raised','Severity','Category','What happened','Why it needs you','Suggested action','Source URL','Status','Resolved','Notes'];
HEADERS[T.MEM] = ['Source ID','Kind','Org','URL','Last Success','Last Failure','Consecutive Failures','Total Runs','Items Found (last)','Items Found (total)','Content Hash','Priority','Notes'];
HEADERS[T.WEEK] = ['Week ending','Runs','Census pulls','Establishments logged','Form D filings','Sources watched','Changes detected','Open escalations (HIGH)','Open escalations (MEDIUM)','Dead sources','Narrative','Emailed'];
HEADERS[T.TRADES] = ['Idea ID','Received','Source','Platform','Market','Direction','Entry','Stop','Target','Size Hint','Timeframe','Rationale','Confidence','Valid Until','Status','Decided At','Fill Price','Actual Size','Result','Notes'];

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
    .addItem('Send me a Telegram now', 'notifyTelegram')
    .addItem('TradingView: show webhook URL', 'setupTradingView')
    .addItem('Telegram: check the bot first', 'telegramStatus')
    .addItem('Telegram: find my chat ID', 'telegramFindChatId')
    .addItem('Telegram: register webhook', 'telegramRegisterWebhook')
    .addItem('Telegram: send a test', 'telegramTest')
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
  ScriptApp.newTrigger('notifyTelegram').timeBased().atHour(8).everyDays(1).create();
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
    // Telegram cannot send our JSON token, and Apps Script cannot read request
    // headers, so the webhook carries its secret in the query string instead.
    if (e && e.parameter && e.parameter.tg) return handleTelegram_(e);
    if (e && e.parameter && e.parameter.tv) return handleTradingView_(e);

    if (!e || !e.postData || !e.postData.contents) return out({ ok: false, error: 'empty body' });
    var body = JSON.parse(e.postData.contents);
    var expected = PropertiesService.getScriptProperties().getProperty(TOKEN_PROP);
    if (!expected) return out({ ok: false, error: 'no token configured' });
    if (body.token !== expected) return out({ ok: false, error: 'bad token' });

    // Writes are append-only on purpose: the agent must never overwrite a cell
    // a human filled in. The one exception is its own bookkeeping — marking an
    // approved opportunity as queued so the next run does not redo the work.
    // It appends to the Notes cell rather than replacing it, and touches no
    // other column.
    // Decisions coming back from whatever surface showed them — Nexus, a
    // Telegram button, anything. The caller does not need to know the sheet
    // layout, only the Opp ID it was given.
    // Goals ticked off from whatever surface recited them.
    var completed = [];
    (body.complete || []).forEach(function (c) {
      completed.push({ day: c.day, block: c.block,
                       applied: completeGoal_(c.day, c.block, c.minutes, c.notes) });
    });

    // Outcomes of trades the owner placed by hand.
    var trades = [];
    (body.trade_decision || []).forEach(function (t) {
      trades.push({ id: t.id, applied: decideTrade_(t) });
    });

    var decided = [];
    (body.decide || []).forEach(function (d) {
      var r = decide_(d.id, d.decision, d.by || 'api', d.note || '');
      decided.push({ id: d.id, applied: r });
    });

    var marked = 0;
    (body.marks || []).forEach(function (m) {
      var sheet = sh_(m.tab || T.OPPS);
      if (!sheet || sheet.getLastRow() < 2 || !m.id) return;
      var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) !== String(m.id)) continue;
        var cell = sheet.getRange(i + 2, m.col || 14);
        var cur = String(cell.getValue() || '');
        if (cur.indexOf(m.text) === -1) {
          cell.setValue(cur ? cur + ' | ' + m.text : m.text);
          marked++;
        }
        break;
      }
    });

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
    return out({ ok: true, written: written, marked: marked,
                 decided: decided, completed: completed, trades: trades,
                 tabs_created: created });
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
    if (!e || !e.parameter || e.parameter.token !== expected) {
      return out({ ok: false, error: 'bad token' });
    }
    var action = e.parameter.action || 'tab';
    if (action === 'trades')  return out({ ok: true,
                                            trades: trades_(e.parameter.claim === '1') });
    if (action === 'today')   return out(today_());
    if (action === 'week')     return out(week_());
    if (action === 'digest')  return out(digest_(e.parameter.since || ''));
    if (action === 'pending') return out({ ok: true, pending: pending_(e.parameter.claim === '1') });
    if (action === 'ping')    return out({ ok: true, system: 'positioning-os',
                                           sheet: book_().getName(), url: book_().getUrl() });
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

  var estab = 0, pulls = 0, changed = 0, failed = 0, people = 0, filings = 0,
      macRan = false;
  logs.forEach(function (r) {
    if (r.Module === 'census' && r.Result === 'OK') { pulls++; estab += Number(r.Items) || 0; }
    if (r.Module === 'edgar' && r.Result === 'OK') filings += Number(r.Items) || 0;
    if (r.Result === 'CHANGED') changed++;
    if (r.Result === 'FAILED' || r.Result === 'EXCEPTION') failed++;
    if (r.Action === 'person candidate') people++;
    if (String(r['Run ID']).indexOf('AS-') !== 0) macRan = true;
  });

  // getLastRow() counts every pre-formatted blank row, so People CRM reported
  // 998 contacts when there were 4. Count non-empty values in the key column,
  // which is what the Dashboard formulas already do.
  var plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };

  var cnt = function (tab, col) {
    var sheet = sh_(tab);
    if (!sheet || sheet.getLastRow() < 2) return 0;
    var vals = sheet.getRange(2, col, sheet.getLastRow() - 1, 1).getValues();
    var n = 0;
    for (var i = 0; i < vals.length; i++) if (String(vals[i][0]).trim()) n++;
    return n;
  };

  var html = '<h2>Positioning OS — ' + Utilities.formatDate(now_(), tz, 'EEEE d MMMM') + '</h2>' +
    (macRan ? '' : '<p style="color:#b02a37"><b>The Mac did not run in the last 24 hours.</b> ' +
      'Browser research paused; Census still ran on Google. Check ~/.positioning-os/logs/daily.err.</p>') +
    '<h3>What was done</h3><ul>' +
      '<li><b>' + plural(pulls, 'Census pull', 'Census pulls') + '</b> → <b>'
        + plural(estab, 'establishment', 'establishments') + '</b> logged</li>' +
      '<li><b>' + plural(filings, 'new Form D filing', 'new Form D filings')
        + '</b> in OH/KY/IN'
        + (filings ? ' — a manager that just closed a vehicle has capital to '
                   + 'deploy, and small firms add junior headcount when they do'
                   : '') + '</li>' +
      '<li><b>' + plural(changed, 'watched page', 'watched pages') + '</b> changed</li>' +
      '<li><b>' + plural(people, 'person candidate', 'person candidates')
        + '</b> (UNVERIFIED — confirm titles before use)</li>' +
      '<li><b>' + plural(failed, 'module failure', 'module failures') + '</b></li></ul>' +
    '<h3>KPIs</h3><ul>' +
      '<li>Contacts in CRM: <b>' + cnt(T.PEOPLE, 2) + '</b></li>' +
      '<li>Companies on radar: <b>' + cnt(T.COS, 2) + '</b></li>' +
      '<li>Research entries: <b>' + cnt(T.RESEARCH, 1) + '</b></li>' +
      '<li>Open opportunities: <b>' + cnt(T.OPPS, 1) + '</b></li>' +
      '<li>Open escalations: <b>' + escs.length + '</b> (' + high.length + ' HIGH)</li></ul>';

  // Previously only HIGH was listed, so a MEDIUM was counted in the KPIs and
  // then contradicted by "Nothing needs you today" on the next line. An email
  // that argues with itself is one you stop reading.
  var render = function (list) {
    return '<ul>' + list.map(function (e) {
      return '<li><b>' + esc_(e.Category) + ':</b> ' + esc_(e['What happened']) +
        '<br><i>' + esc_(e['Why it needs you']) + '</i><br>→ ' + esc_(e['Suggested action']) +
        (e['Source URL'] ? ' <a href="' + esc_(e['Source URL']) + '">open</a>' : '') + '</li>';
    }).join('') + '</ul>';
  };
  var med = escs.filter(function (e) { return String(e.Severity).toUpperCase() !== 'HIGH'; });

  if (high.length) {
    html += '<h3 style="color:#b02a37">Needs a decision from you</h3>' + render(high);
  }
  if (med.length) {
    html += '<h3>Worth a look</h3>' + render(med);
  }
  if (!escs.length) {
    html += '<p>Nothing is open. Every source answered and nothing changed.</p>';
  }

  html += '<hr><p><a href="' + ss.getUrl() + '">Open the workbook</a></p>';

  MailApp.sendEmail({ to: Session.getActiveUser().getEmail(),
    subject: 'Positioning OS — ' + Utilities.formatDate(now_(), tz, 'EEE d MMM') +
      ' — ' + plural(estab, 'establishment', 'establishments') + ', '
      + plural(filings, 'filing', 'filings') + ', '
      + (high.length ? high.length + (high.length === 1 ? ' needs' : ' need') + ' you'
         : escs.length ? escs.length + ' to review' : 'nothing open'),
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


/* ======================= TELEGRAM =======================
 * Email is the record; Telegram is the tap on the shoulder. The same run
 * produces both, and both are sent by Google rather than the Mac, so they
 * arrive with the laptop shut.
 *
 * Opportunities arrive as decisions, not reading. Each new one is sent with
 * Approve / Skip buttons; the tap writes straight back into the sheet, so the
 * pipeline is worked from a phone instead of a spreadsheet.
 */

var TG_TOKEN = 'TELEGRAM_TOKEN', TG_CHAT = 'TELEGRAM_CHAT_ID',
    TG_SECRET = 'TELEGRAM_SECRET', TG_LAST = 'TELEGRAM_LAST_ESC';

function props_() { return PropertiesService.getScriptProperties(); }

/** Paste the token from @BotFather below, run once, then blank it again and
 *  save. The token lives in Script Properties, never in the file or in git. */
function setupTelegram() {
  var TOKEN = 'PASTE_YOUR_BOT_TOKEN_HERE';
  if (TOKEN.indexOf('PASTE_') === 0) {
    Logger.log('Edit TOKEN inside setupTelegram first, then run it again.');
    return;
  }
  var p = props_();
  p.setProperty(TG_TOKEN, TOKEN.trim());
  if (!p.getProperty(TG_SECRET)) {
    p.setProperty(TG_SECRET, Utilities.getUuid().replace(/-/g, ''));
  }
  Logger.log('Token stored. Next: message your bot once, then run telegramFindChatId.');
}

function tg_(method, payload) {
  var token = props_().getProperty(TG_TOKEN);
  if (!token) throw new Error('No Telegram token. Run setupTelegram first.');
  var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(payload || {}), muteHttpExceptions: true
  });
  var body = JSON.parse(r.getContentText() || '{}');
  if (!body.ok) throw new Error(method + ' failed: ' + (body.description || r.getContentText()));
  return body.result;
}

/** Run this BEFORE anything else.
 *
 *  Telegram allows exactly one webhook per bot. If this bot already serves
 *  another project, registering ours takes it over silently and the other one
 *  simply stops receiving updates — no error, on either side. A bot costs
 *  nothing and takes thirty seconds to create, so sharing one is a bad trade.
 */
function telegramStatus() {
  var me = tg_('getMe', {});
  Logger.log('Bot: @' + me.username + '  (' + me.first_name + ')');

  var info = tg_('getWebhookInfo', {});
  if (info.url) {
    Logger.log('');
    Logger.log('⚠️  THIS BOT ALREADY HAS A WEBHOOK:');
    Logger.log('    ' + info.url);
    Logger.log('    pending updates: ' + (info.pending_update_count || 0));
    if (info.last_error_message) {
      Logger.log('    last error: ' + info.last_error_message);
    }
    Logger.log('');
    if (info.url.indexOf('script.google.com') === 0) {
      Logger.log('It points at Apps Script, so it is most likely ours already.');
      Logger.log('Safe to continue.');
    } else {
      Logger.log('It points somewhere else — another project is using this bot.');
      Logger.log('Running telegramRegisterWebhook WILL break that project.');
      Logger.log('Create a separate bot in @BotFather (/newbot) and use its token here.');
    }
  } else {
    Logger.log('');
    Logger.log('No webhook set. Nothing to break — safe to continue.');
    Logger.log('Next: message the bot from your phone, then run telegramFindChatId.');
  }
  return info;
}

/** Message the bot once from your phone, then run this. */
function telegramFindChatId() {
  // getUpdates and a webhook are mutually exclusive; without this the call
  // just fails with a message that does not explain why.
  var info = tg_('getWebhookInfo', {});
  if (info.url) {
    Logger.log('This bot has a webhook set, so getUpdates cannot read messages.');
    Logger.log('Webhook: ' + info.url);
    Logger.log('Run telegramStatus to see whether it is ours or another project\'s.');
    Logger.log('If it is ours, the chat id is already stored: '
               + (props_().getProperty(TG_CHAT) || '(none yet)'));
    return;
  }
  var ups = tg_('getUpdates', {});
  if (!ups.length) {
    Logger.log('No messages yet. Open Telegram, send your bot any message, then run this again.');
    return;
  }
  var seen = {};
  ups.forEach(function (u) {
    var m = u.message || u.edited_message || (u.callback_query || {}).message;
    if (m && m.chat) seen[m.chat.id] = (m.chat.title || m.chat.first_name || m.chat.type);
  });
  Object.keys(seen).forEach(function (id) {
    Logger.log('chat ' + id + '  —  ' + seen[id]);
    props_().setProperty(TG_CHAT, id);   // one chat is the normal case
  });
  Logger.log('Stored chat id: ' + props_().getProperty(TG_CHAT));
  Logger.log('Next: Deploy > Manage deployments > Edit > New version > Deploy,');
  Logger.log('then run telegramRegisterWebhook.');
}

/** Points Telegram at this Web App so button taps come back here. */
function telegramRegisterWebhook() {
  var existing = tg_('getWebhookInfo', {});
  if (existing.url && existing.url.indexOf('script.google.com') !== 0) {
    throw new Error(
      'This bot already has a webhook pointing at ' + existing.url +
      ' — another project is using it. Registering ours would silently break ' +
      'that one. Create a separate bot with /newbot in @BotFather and run ' +
      'setupTelegram with its token instead.');
  }
  var url = ScriptApp.getService().getUrl();
  if (!url) throw new Error('Deploy as a Web App first (Execute as Me, Access Anyone).');
  var secret = props_().getProperty(TG_SECRET);
  if (!secret) throw new Error('Run setupTelegram first.');
  var hook = url + '?tg=' + secret;
  tg_('setWebhook', { url: hook, allowed_updates: ['message', 'callback_query'] });
  Logger.log('Webhook registered.');
  Logger.log('IMPORTANT: re-run this after every new deployment — the /exec URL changes.');
}

function telegramTest() {
  tgSend_('Positioning OS is connected. You will get one message a day: what was '
        + 'done, and anything that needs a decision.');
  Logger.log('Sent. Check Telegram.');
}

function tgSend_(text, keyboard) {
  var chat = props_().getProperty(TG_CHAT);
  if (!chat) throw new Error('No chat id. Run telegramFindChatId first.');
  var payload = { chat_id: chat, text: text, parse_mode: 'HTML',
                  disable_web_page_preview: true };
  if (keyboard) payload.reply_markup = { inline_keyboard: keyboard };
  return tg_('sendMessage', payload);
}

/* ---------------- the daily message + approval queue ---------------- */

function notifyTelegram() {
  // Default is 'nexus': Nexus owns the bot and does the messaging, and this
  // system is a data source it reads. Set TELEGRAM_MODE to 'direct' only if
  // Positioning OS is given a bot of its own.
  var mode = props_().getProperty('TELEGRAM_MODE') || 'nexus';
  if (mode !== 'direct') {
    Logger.log('TELEGRAM_MODE=' + mode + ' — Nexus handles messaging. Nothing sent.');
    return;
  }
  if (!props_().getProperty(TG_CHAT)) { Logger.log('Telegram not set up; skipped.'); return; }

  var cut = new Date(Date.now() - 864e5);
  var logs = rows_(T.LOG).filter(function (r) {
    return r.Timestamp && new Date(r.Timestamp) >= cut; });

  var estab = 0, filings = 0, changed = 0, failed = 0, people = 0, macRan = false;
  logs.forEach(function (r) {
    if (r.Module === 'census' && r.Result === 'OK') estab += Number(r.Items) || 0;
    if (r.Module === 'edgar' && r.Result === 'OK') filings += Number(r.Items) || 0;
    if (r.Result === 'CHANGED') changed++;
    if (r.Result === 'FAILED' || r.Result === 'EXCEPTION') failed++;
    if (r.Action === 'person candidate') people++;
    if (String(r['Run ID']).indexOf('AS-') !== 0) macRan = true;
  });

  var msg = '<b>Positioning OS</b> — ' +
    Utilities.formatDate(now_(), book_().getSpreadsheetTimeZone(), 'EEE d MMM') + '\n\n' +
    estab + ' establishments · ' + filings + ' Form D · ' + changed + ' page changes · ' +
    people + ' people' + (failed ? ' · <b>' + failed + ' failures</b>' : '');
  if (!macRan) msg += '\n\n⚠️ The Mac did not run. Browser research paused.';
  var waiting = countStatus_(T.OPPS, 13, 'PENDING');
  if (waiting) msg += '\n\n' + waiting + ' awaiting your decision.';
  tgSend_(msg);

  pushEscalations_();
  pushApprovals_();
}

/** HIGH and MEDIUM escalations raised since the last push. */
function pushEscalations_() {
  var since = props_().getProperty(TG_LAST) || '';
  var newest = since;
  var fresh = rows_(T.ESC).filter(function (e) {
    var raised = String(e.Raised || '');
    if (String(e.Status).toUpperCase() !== 'OPEN') return false;
    if (since && raised <= since) return false;
    if (raised > newest) newest = raised;
    return true;
  });
  fresh.slice(0, 10).forEach(function (e) {
    tgSend_((String(e.Severity).toUpperCase() === 'HIGH' ? '🔴 ' : '🟡 ') +
      '<b>' + esc_(e.Category) + '</b>\n' + esc_(e['What happened']) +
      '\n\n<i>' + esc_(e['Why it needs you']) + '</i>\n\n→ ' + esc_(e['Suggested action']) +
      (e['Source URL'] ? '\n' + esc_(e['Source URL']) : ''));
  });
  if (newest) props_().setProperty(TG_LAST, newest);
}

/** Opportunities still marked OPEN become one message each, with buttons.
 *  Sending flips OPEN to PENDING so nothing is ever asked twice. */
function pushApprovals_() {
  var sheet = sh_(T.OPPS);
  if (!sheet || sheet.getLastRow() < 2) return;
  var last = sheet.getLastRow();
  var vals = sheet.getRange(2, 1, last - 1, 14).getValues();
  var sent = 0;

  for (var i = 0; i < vals.length && sent < 8; i++) {
    if (String(vals[i][12]).toUpperCase() !== 'OPEN') continue;   // M = Status
    var id = String(vals[i][0]);
    tgSend_(
      '🏦 <b>' + esc_(vals[i][1] || 'Opportunity') + '</b>\n' + esc_(vals[i][2]) +
      '\n\n<i>' + esc_(vals[i][7]) + '</i>' +
      (vals[i][13] ? '\n\n' + esc_(vals[i][13]) : '') +
      '\n\n<b>Not work authorization advice.</b> Approving queues research only.',
      [[{ text: '✅ Research this', callback_data: 'ok|' + id },
        { text: '✖️ Skip', callback_data: 'no|' + id }]]);
    sheet.getRange(i + 2, 13).setValue('PENDING');
    sent++;
  }
  if (sent) Logger.log('Sent ' + sent + ' approval request(s).');
}

/* ---------------- inbound: button taps ---------------- */

function handleTelegram_(e) {
  var ok = ContentService.createTextOutput('ok').setMimeType(ContentService.MimeType.TEXT);
  try {
    if (e.parameter.tg !== props_().getProperty(TG_SECRET)) return ok;   // not Telegram
    var u = JSON.parse(e.postData.contents);
    var cq = u.callback_query;
    if (!cq) return ok;

    var parts = String(cq.data || '').split('|');
    var decision = parts[0] === 'ok' ? 'APPROVED' : 'SKIPPED';
    var oppId = parts.slice(1).join('|');
    var row = findOppRow_(oppId);

    if (row > 0) {
      var sheet = sh_(T.OPPS);
      sheet.getRange(row, 13).setValue(decision);
      var note = String(sheet.getRange(row, 14).getValue() || '');
      sheet.getRange(row, 14).setValue(
        (note ? note + ' | ' : '') + decision + ' via Telegram ' +
        Utilities.formatDate(now_(), book_().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm'));
    }

    tg_('answerCallbackQuery', { callback_query_id: cq.id,
         text: row > 0 ? decision : 'Row not found — open the sheet' });
    if (cq.message) {
      tg_('editMessageText', {
        chat_id: cq.message.chat.id, message_id: cq.message.message_id,
        text: cq.message.text + '\n\n' + (decision === 'APPROVED' ? '✅ ' : '✖️ ') + decision,
        parse_mode: 'HTML', disable_web_page_preview: true });
    }
  } catch (err) {
    Logger.log('telegram: ' + err);
  }
  return ok;
}

function countStatus_(tab, col, want) {
  var sheet = sh_(tab);
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var v = sheet.getRange(2, col, sheet.getLastRow() - 1, 1).getValues();
  var n = 0;
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]).toUpperCase() === want) n++;
  }
  return n;
}

function findOppRow_(oppId) {
  var sheet = sh_(T.OPPS);
  if (!sheet || sheet.getLastRow() < 2) return -1;
  var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === oppId) return i + 2;
  }
  return -1;
}


/* ==================== READ API (for Nexus Control Center) ====================
 * Positioning OS does not own a Telegram bot. Nexus does, and one bot can hold
 * one webhook, so a second system registering its own would silently cut the
 * first one off. Instead this exposes what Nexus needs and accepts decisions
 * back, which also means every other surface — a phone, a dashboard, a cron —
 * works through the same contract.
 *
 *   GET  ?token=T&action=ping
 *   GET  ?token=T&action=digest[&since=ISO8601]
 *   GET  ?token=T&action=pending[&claim=1]
 *   POST {token:T, decide:[{id, decision:"APPROVED"|"SKIPPED", by, note}]}
 *
 * Full contract: positioning-system/NEXUS-INTEGRATION.md
 */

var OPP_STATUS_COL = 13, OPP_NOTES_COL = 14;

function digest_(since) {
  var tz = book_().getSpreadsheetTimeZone();
  var cut = new Date(Date.now() - 864e5);
  var logs = rows_(T.LOG).filter(function (r) {
    return r.Timestamp && new Date(r.Timestamp) >= cut; });

  var d = { establishments: 0, form_d: 0, changes: 0, people: 0,
            failures: 0, mac_ran: false };
  logs.forEach(function (r) {
    if (r.Module === 'census' && r.Result === 'OK') d.establishments += Number(r.Items) || 0;
    if (r.Module === 'edgar'  && r.Result === 'OK') d.form_d += Number(r.Items) || 0;
    if (r.Result === 'CHANGED') d.changes++;
    if (r.Result === 'FAILED' || r.Result === 'EXCEPTION') d.failures++;
    if (r.Action === 'person candidate') d.people++;
    if (String(r['Run ID']).indexOf('AS-') !== 0) d.mac_ran = true;
  });

  var escs = rows_(T.ESC).filter(function (e) {
    if (String(e.Status).toUpperCase() !== 'OPEN') return false;
    return !since || String(e.Raised || '') > since;
  }).slice(0, 25).map(function (e) {
    return { id: e['Escalation ID'], severity: e.Severity, category: e.Category,
             what: e['What happened'], why: e['Why it needs you'],
             action: e['Suggested action'], url: e['Source URL'], raised: e.Raised };
  });

  return {
    ok: true, system: 'positioning-os',
    generated: Utilities.formatDate(now_(), tz, "yyyy-MM-dd'T'HH:mm:ssXXX"),
    sheet_url: book_().getUrl(),
    today: d,
    counts: {
      contacts: colCount_(T.PEOPLE, 2), companies: colCount_(T.COS, 2),
      research: colCount_(T.RESEARCH, 1), opportunities: colCount_(T.OPPS, 1),
      awaiting_decision: countStatus_(T.OPPS, OPP_STATUS_COL, 'PENDING')
    },
    escalations: escs,
    pending: pending_(false)
  };
}

function colCount_(tab, col) {
  var sheet = sh_(tab);
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var v = sheet.getRange(2, col, sheet.getLastRow() - 1, 1).getValues();
  var n = 0;
  for (var i = 0; i < v.length; i++) if (String(v[i][0]).trim()) n++;
  return n;
}

/** Opportunities awaiting a decision.
 *  claim=true flips OPEN to PENDING, so whichever surface shows an item takes
 *  ownership of it and no other surface shows it again. Without that, Nexus
 *  and any second reader would both present the same filing. */
function pending_(claim) {
  var sheet = sh_(T.OPPS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var last = sheet.getLastRow();
  var vals = sheet.getRange(2, 1, last - 1, OPP_NOTES_COL).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var st = String(vals[i][OPP_STATUS_COL - 1]).toUpperCase();
    if (st !== 'OPEN' && !(st === 'PENDING' && !claim)) continue;
    out.push({
      id: String(vals[i][0]), type: vals[i][1], title: vals[i][2],
      organization: vals[i][4], why: vals[i][7], next_action: vals[i][8],
      authorization_cleared: vals[i][10], counsel_reviewed: vals[i][11],
      status: st, source: vals[i][OPP_NOTES_COL - 1],
      actions: ['APPROVED', 'SKIPPED']
    });
    if (claim && st === 'OPEN') sheet.getRange(i + 2, OPP_STATUS_COL).setValue('PENDING');
  }
  return out;
}

/** Records a decision. Returns 'ok', 'not found' or 'bad decision'. */
function decide_(oppId, decision, by, note) {
  var want = String(decision || '').toUpperCase();
  if (want !== 'APPROVED' && want !== 'SKIPPED') return 'bad decision';
  var row = findOppRow_(oppId);
  if (row < 1) return 'not found';
  var sheet = sh_(T.OPPS);
  sheet.getRange(row, OPP_STATUS_COL).setValue(want);
  var cur = String(sheet.getRange(row, OPP_NOTES_COL).getValue() || '');
  var stamp = want + ' via ' + (by || 'api') + ' ' +
    Utilities.formatDate(now_(), book_().getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm') +
    (note ? ' — ' + note : '');
  sheet.getRange(row, OPP_NOTES_COL).setValue(cur ? cur + ' | ' + stamp : stamp);
  return 'ok';
}

/** Prints everything Nexus needs, ready to paste into its config. */
function nexusCredentials() {
  var url = ScriptApp.getService().getUrl();
  var tok = PropertiesService.getScriptProperties().getProperty(TOKEN_PROP);
  if (!url) { Logger.log('Deploy as a Web App first.'); return; }
  Logger.log('base_url : ' + url);
  Logger.log('token    : ' + tok);
  Logger.log('');
  Logger.log('digest   : ' + url + '?token=' + tok + '&action=digest');
  Logger.log('pending  : ' + url + '?token=' + tok + '&action=pending&claim=1');
  Logger.log('ping     : ' + url + '?token=' + tok + '&action=ping');
  Logger.log('');
  Logger.log('decide   : POST ' + url);
  Logger.log('           {"token":"' + tok + '","decide":[{"id":"OPP-…",'
             + '"decision":"APPROVED","by":"nexus"}]}');
}


/* ======================= THE DAILY SCRIPT =======================
 * The 90-day plan (acquisition-research/10) lives in the Plan 90 tab, three
 * goals a day, each with the time it should take and the condition that means
 * it is done. These endpoints read today's three back and record them ticked.
 *
 *   GET  ?token=T&action=today
 *   GET  ?token=T&action=week
 *   POST {token:T, complete:[{day, block, minutes, notes}]}
 *
 * Exactly three goals is the point, not a simplification of it. File 11 is
 * explicit that a fourth goal is the failure mode, so nothing here ever
 * returns more than the day holds.
 */

var PLAN_COLS = { DAY: 1, DATE: 2, DOW: 3, WEEK: 4, BLOCK: 5, ACTION: 6,
                  MIN: 7, DELIVERABLE: 8, DONE_WHEN: 9, STATUS: 10,
                  COMPLETED: 11, MIN_ACTUAL: 12, BLOCKER: 13, NOTES: 14 };

function planRows_() {
  var sheet = sh_('Plan 90');
  if (!sheet || sheet.getLastRow() < 2) return { sheet: null, vals: [] };
  return { sheet: sheet,
           vals: sheet.getRange(2, 1, sheet.getLastRow() - 1, PLAN_COLS.NOTES).getValues() };
}

function isoToday_() {
  return Utilities.formatDate(now_(), book_().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
}

function cellDate_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, book_().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  }
  return String(v || '').slice(0, 10);
}

function today_() {
  var iso = isoToday_();
  var p = planRows_();
  if (!p.sheet) {
    return { ok: false, error: 'Plan 90 is empty — run load_plan.py on the Mac' };
  }
  var goals = [], day = null, week = null;
  for (var i = 0; i < p.vals.length; i++) {
    if (cellDate_(p.vals[i][PLAN_COLS.DATE - 1]) !== iso) continue;
    day = p.vals[i][PLAN_COLS.DAY - 1];
    week = p.vals[i][PLAN_COLS.WEEK - 1];
    goals.push({
      day: day, block: String(p.vals[i][PLAN_COLS.BLOCK - 1]),
      action: String(p.vals[i][PLAN_COLS.ACTION - 1]),
      minutes: p.vals[i][PLAN_COLS.MIN - 1],
      deliverable: String(p.vals[i][PLAN_COLS.DELIVERABLE - 1]),
      done_when: String(p.vals[i][PLAN_COLS.DONE_WHEN - 1]),
      status: String(p.vals[i][PLAN_COLS.STATUS - 1] || 'OPEN')
    });
  }
  if (!goals.length) {
    return { ok: true, in_plan: false, date: iso,
             note: 'Today is outside the 90-day window. The plan ran '
                 + planSpan_() + '.' };
  }
  var mins = 0;
  goals.forEach(function (g) { mins += Number(g.minutes) || 0; });

  return {
    ok: true, in_plan: true, date: iso, day: day, week: week, of: 90,
    total_minutes: mins, goals: goals,
    done_today: goals.filter(function (g) { return g.status === 'DONE'; }).length,
    // File 11: a fourth goal is the failure mode, not ambition.
    rule: 'Exactly three goals. A new idea goes on the parking lot, not into today.',
    counsel_gate: 'Anything touching ownership, fees, officer roles or guarantees '
                + 'waits for written counsel clearance (IC rule 8).'
  };
}

function planSpan_() {
  var p = planRows_();
  if (!p.vals.length) return 'not loaded';
  return cellDate_(p.vals[0][PLAN_COLS.DATE - 1]) + ' to '
       + cellDate_(p.vals[p.vals.length - 1][PLAN_COLS.DATE - 1]);
}

function week_() {
  var p = planRows_();
  if (!p.sheet) return { ok: false, error: 'Plan 90 is empty' };
  var iso = isoToday_(), wk = null;
  for (var i = 0; i < p.vals.length; i++) {
    if (cellDate_(p.vals[i][PLAN_COLS.DATE - 1]) === iso) {
      wk = p.vals[i][PLAN_COLS.WEEK - 1];
      break;
    }
  }
  if (wk === null) return { ok: true, in_plan: false, date: iso };

  var total = 0, done = 0, minutes = 0, blocked = [];
  for (var j = 0; j < p.vals.length; j++) {
    if (p.vals[j][PLAN_COLS.WEEK - 1] !== wk) continue;
    total++;
    if (String(p.vals[j][PLAN_COLS.STATUS - 1]) === 'DONE') {
      done++;
      minutes += Number(p.vals[j][PLAN_COLS.MIN_ACTUAL - 1]) || 0;
    }
    var b = String(p.vals[j][PLAN_COLS.BLOCKER - 1] || '').trim();
    if (b) blocked.push({ day: p.vals[j][PLAN_COLS.DAY - 1], blocker: b });
  }
  return { ok: true, in_plan: true, week: wk, goals_total: total,
           goals_done: done, focused_minutes: minutes, blockers: blocked,
           // File 11 section 3.
           targets: { goals: 21, focused_minutes: 500, new_contacts: 2,
                      conversations: 1, case_studies: 1, counsel_breaches: 0 } };
}

/** Ticks one goal. Returns 'ok', 'not found' or 'already done'. */
function completeGoal_(day, block, minutes, notes) {
  var p = planRows_();
  if (!p.sheet) return 'no plan';
  var want = String(block || '').toUpperCase();
  for (var i = 0; i < p.vals.length; i++) {
    if (String(p.vals[i][PLAN_COLS.DAY - 1]) !== String(day)) continue;
    if (String(p.vals[i][PLAN_COLS.BLOCK - 1]).toUpperCase() !== want) continue;
    if (String(p.vals[i][PLAN_COLS.STATUS - 1]) === 'DONE') return 'already done';
    var r = i + 2;
    p.sheet.getRange(r, PLAN_COLS.STATUS).setValue('DONE');
    p.sheet.getRange(r, PLAN_COLS.COMPLETED).setValue(isoToday_());
    if (minutes) p.sheet.getRange(r, PLAN_COLS.MIN_ACTUAL).setValue(minutes);
    if (notes) p.sheet.getRange(r, PLAN_COLS.NOTES).setValue(String(notes).slice(0, 500));
    return 'ok';
  }
  return 'not found';
}


/* ==================== TRADE IDEAS ====================
 * Signals come from TradingView. Nothing here invents one.
 *
 * TradingView posts its alert to this Web App with ?tv=<secret> on the URL,
 * so the alert body stays pure signal. The row lands with status NEW and is
 * presented once, by whichever surface claims it.
 *
 * EXPIRY IS THE POINT. An entry is a statement about a price now. Showing a
 * two-day-old level as though it were live is the one way this tab could
 * actively lose money, so every idea carries Valid Until and anything past it
 * is marked EXPIRED and never presented. Default window is 12 hours; an alert
 * can send valid_minutes to set its own.
 *
 * Execution is manual, on Kalshi / Tradovate / wherever. This system places
 * nothing and holds no brokerage credential.
 */

var TV_SECRET = 'TRADINGVIEW_SECRET', TRADE_WINDOW_MIN = 720;

function setupTradingView() {
  var p = props_();
  if (!p.getProperty(TV_SECRET)) {
    p.setProperty(TV_SECRET, Utilities.getUuid().replace(/-/g, ''));
  }
  var url = ScriptApp.getService().getUrl();
  Logger.log('TradingView webhook URL (paste into the alert):');
  Logger.log('  ' + (url || '(deploy as a Web App first)') + '?tv=' + p.getProperty(TV_SECRET));
  Logger.log('');
  Logger.log('Alert message body — JSON, all fields optional except market:');
  Logger.log('  {"platform":"Kalshi","market":"{{ticker}}","direction":"YES",');
  Logger.log('   "entry":"{{close}}","stop":"","target":"","size_hint":"",');
  Logger.log('   "timeframe":"{{interval}}","rationale":"{{strategy.order.comment}}",');
  Logger.log('   "confidence":"","valid_minutes":720}');
}

function handleTradingView_(e) {
  var ok = ContentService.createTextOutput('ok').setMimeType(ContentService.MimeType.TEXT);
  try {
    if (e.parameter.tv !== props_().getProperty(TV_SECRET)) return ok;

    var raw = (e.postData && e.postData.contents) || '';
    var a = {};
    try { a = JSON.parse(raw); } catch (ignored) { a = { rationale: raw }; }

    var market = String(a.market || a.ticker || '').trim();
    if (!market) return ok;      // nothing identifiable to act on

    var tz = book_().getSpreadsheetTimeZone();
    var now = now_();
    var mins = Number(a.valid_minutes) > 0 ? Number(a.valid_minutes) : TRADE_WINDOW_MIN;
    var until = new Date(now.getTime() + mins * 60000);
    var stamp = function (d) { return Utilities.formatDate(d, tz, "yyyy-MM-dd'T'HH:mm:ss"); };

    // A second-resolution stamp is NOT unique: TradingView fires several
    // alerts in the same second, and two ideas sharing an id means a decision
    // recorded against one lands on the other - a fill written onto the wrong
    // trade. That is the one bug in this file that could cost money, so the id
    // carries the row sequence, which cannot repeat within a run, as well as a
    // random suffix covering the case where rows were deleted.
    var sheet = ensureTab_(T.TRADES);
    var seq = Math.max(sheet.getLastRow(), 1);
    var suffix = Utilities.getUuid().replace(/-/g, '').slice(0, 6);
    sheet.appendRow([
      'TI-' + Utilities.formatDate(now, tz, 'yyyyMMdd-HHmmss')
            + '-' + seq + '-' + suffix,
      stamp(now), String(a.source || 'TradingView'), String(a.platform || ''),
      market, String(a.direction || ''), String(a.entry || ''), String(a.stop || ''),
      String(a.target || ''), String(a.size_hint || ''), String(a.timeframe || ''),
      String(a.rationale || '').slice(0, 500), String(a.confidence || ''),
      stamp(until), 'NEW', '', '', '', '', ''
    ]);
  } catch (err) {
    Logger.log('tradingview: ' + err);
  }
  return ok;
}

/** Live ideas only. Anything past Valid Until is marked EXPIRED in passing and
 *  never returned, because a stale entry presented as live is the real hazard. */
function trades_(claim) {
  var sheet = sh_(T.TRADES);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var last = sheet.getLastRow();
  var v = sheet.getRange(2, 1, last - 1, 20).getValues();
  var now = now_(), out = [];

  for (var i = 0; i < v.length; i++) {
    var status = String(v[i][14]).toUpperCase();
    if (status !== 'NEW' && !(status === 'PRESENTED' && !claim)) continue;

    var until = v[i][13] ? new Date(v[i][13]) : null;
    if (until && !isNaN(until.getTime()) && until < now) {
      sheet.getRange(i + 2, 15).setValue('EXPIRED');
      continue;
    }
    out.push({
      id: String(v[i][0]), received: String(v[i][1]), source: String(v[i][2]),
      platform: String(v[i][3]), market: String(v[i][4]), direction: String(v[i][5]),
      entry: v[i][6], stop: v[i][7], target: v[i][8], size_hint: v[i][9],
      timeframe: String(v[i][10]), rationale: String(v[i][11]),
      confidence: String(v[i][12]), valid_until: String(v[i][13]),
      status: status, actions: ['TAKEN', 'SKIPPED'],
      execution: 'Manual. This system places no orders and holds no brokerage credential.'
    });
    if (claim && status === 'NEW') sheet.getRange(i + 2, 15).setValue('PRESENTED');
  }
  return out;
}

function decideTrade_(t) {
  var want = String(t.decision || '').toUpperCase();
  if (want !== 'TAKEN' && want !== 'SKIPPED') return 'bad decision';
  var sheet = sh_(T.TRADES);
  if (!sheet || sheet.getLastRow() < 2) return 'no tab';
  var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) !== String(t.id)) continue;
    var r = i + 2;
    sheet.getRange(r, 15).setValue(want);
    sheet.getRange(r, 16).setValue(Utilities.formatDate(
      now_(), book_().getSpreadsheetTimeZone(), "yyyy-MM-dd'T'HH:mm:ss"));
    if (t.fill)   sheet.getRange(r, 17).setValue(t.fill);
    if (t.size)   sheet.getRange(r, 18).setValue(t.size);
    if (t.result) sheet.getRange(r, 19).setValue(t.result);
    if (t.note)   sheet.getRange(r, 20).setValue(String(t.note).slice(0, 500));
    return 'ok';
  }
  return 'not found';
}
