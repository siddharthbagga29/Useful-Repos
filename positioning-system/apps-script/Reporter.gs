/**
 * Positioning OS — Reporter
 * -------------------------
 * Email lives here, not in Python, for one reason: Apps Script runs on Google's
 * servers 24/7 whether or not the MacBook is open. The Mac does the research;
 * Google does the delivery. Nothing is lost when the laptop is shut.
 *
 * Daily  : what the agent DID yesterday + KPIs. Never a task list.
 * Weekly : the narrative report Python wrote to the Weekly Report tab.
 * Urgent : any HIGH escalation goes out the same day it is raised.
 */

var T_LOG = 'Agent Log', T_ESC = 'Escalations', T_WEEK = 'Weekly Report';

function sh_(n) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n); }

function rows_(name) {
  var s = sh_(name);
  if (!s || s.getLastRow() < 2) return [];
  var v = s.getRange(1, 1, s.getLastRow(), s.getLastColumn()).getValues();
  var head = v[0];
  return v.slice(1).map(function (r) {
    var o = {}; head.forEach(function (h, i) { o[h] = r[i]; }); return o;
  });
}

function since_(d) { return new Date(Date.now() - d * 864e5); }

function esc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

/** DAILY: what was done + KPIs. Replaces the reminder email entirely. */
function emailDailyWorkReport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), tz = ss.getSpreadsheetTimeZone();
  var cutoff = since_(1);
  var logs = rows_(T_LOG).filter(function (r) { return r.Timestamp && new Date(r.Timestamp) >= cutoff; });
  var escs = rows_(T_ESC).filter(function (e) { return String(e.Status).toUpperCase() === 'OPEN'; });
  var high = escs.filter(function (e) { return String(e.Severity).toUpperCase() === 'HIGH'; });

  var estab = 0, pulls = 0, changed = 0, failed = 0, people = 0;
  logs.forEach(function (r) {
    if (r.Module === 'census' && r.Result === 'OK') { pulls++; estab += Number(r.Items) || 0; }
    if (r.Result === 'CHANGED') changed++;
    if (r.Result === 'FAILED' || r.Result === 'EXCEPTION') failed++;
    if (r.Action === 'person candidate') people++;
  });

  var ranSomething = logs.length > 0;
  var body =
    '<h2>Positioning OS — ' + Utilities.formatDate(new Date(), tz, 'EEEE d MMMM') + '</h2>' +
    (ranSomething ? '' :
      '<p style="color:#b02a37"><b>No agent run recorded in the last 24 hours.</b> ' +
      'The Mac was asleep or launchd did not fire. Check ~/.positioning-os/logs/daily.err.</p>') +
    '<h3>What was done</h3><ul>' +
    '<li><b>' + pulls + '</b> Census pulls → <b>' + estab + '</b> establishments logged</li>' +
    '<li><b>' + changed + '</b> watched pages changed</li>' +
    '<li><b>' + people + '</b> person candidates extracted (UNVERIFIED — confirm titles before use)</li>' +
    '<li><b>' + failed + '</b> module failures</li>' +
    '</ul>' +
    '<h3>KPIs</h3><ul>' +
    '<li>Open escalations: <b>' + escs.length + '</b> (' + high.length + ' HIGH)</li>' +
    '<li>Contacts in CRM: <b>' + (sh_('People CRM') ? Math.max(sh_('People CRM').getLastRow() - 1, 0) : 0) + '</b></li>' +
    '<li>Companies on radar: <b>' + (sh_('Target Companies') ? Math.max(sh_('Target Companies').getLastRow() - 1, 0) : 0) + '</b></li>' +
    '<li>Research entries: <b>' + (sh_('Investment Research') ? Math.max(sh_('Investment Research').getLastRow() - 1, 0) : 0) + '</b></li>' +
    '</ul>';

  if (high.length) {
    body += '<h3 style="color:#b02a37">Needs a decision from you</h3><ul>' +
      high.map(function (e) {
        return '<li><b>' + esc_(e.Category) + ':</b> ' + esc_(e['What happened']) +
               '<br><i>' + esc_(e['Why it needs you']) + '</i>' +
               '<br>→ ' + esc_(e['Suggested action']) +
               (e['Source URL'] ? ' <a href="' + esc_(e['Source URL']) + '">open</a>' : '') + '</li>';
      }).join('') + '</ul>';
  } else {
    body += '<p>Nothing needs you today.</p>';
  }

  body += '<hr><p style="color:#666"><i>Research and scraping run on the MacBook; this email is sent ' +
          'from Apps Script so it arrives whether or not the laptop is open.</i></p>' +
          '<p><a href="' + ss.getUrl() + '">Open the workbook</a></p>';

  MailApp.sendEmail({
    to: Session.getActiveUser().getEmail(),
    subject: 'Positioning OS — ' + Utilities.formatDate(new Date(), tz, 'EEE d MMM') +
             ' — ' + estab + ' establishments, ' + changed + ' page changes, ' +
             high.length + ' need you',
    htmlBody: body
  });
}

/** WEEKLY: emails any unsent Weekly Report row, then marks it sent. */
function emailWeeklyReport() {
  var s = sh_(T_WEEK);
  if (!s || s.getLastRow() < 2) return;
  var v = s.getRange(1, 1, s.getLastRow(), s.getLastColumn()).getValues();
  var head = v[0], sentCol = head.indexOf('Emailed') + 1;
  if (sentCol < 1) return;

  for (var i = v.length - 1; i >= 1; i--) {
    if (String(v[i][sentCol - 1]).toUpperCase() === 'YES') continue;
    var o = {}; head.forEach(function (h, j) { o[h] = v[i][j]; });

    var escs = rows_(T_ESC).filter(function (e) { return String(e.Status).toUpperCase() === 'OPEN'; });
    var html =
      '<h2>Positioning OS — week ending ' + esc_(o['Week ending']) + '</h2>' +
      '<p>' + esc_(o.Narrative) + '</p>' +
      '<h3>Numbers</h3><table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">' +
      ['Runs', 'Census pulls', 'Establishments logged', 'Form D filings',
       'Sources watched', 'Changes detected', 'Dead sources'].map(function (k) {
        return '<tr><td>' + k + '</td><td align="right"><b>' + esc_(o[k]) + '</b></td></tr>';
      }).join('') + '</table>' +
      (escs.length ?
        '<h3>Open escalations</h3><ul>' + escs.slice(0, 20).map(function (e) {
          return '<li><b>[' + esc_(e.Severity) + '] ' + esc_(e.Category) + '</b> — ' +
                 esc_(e['What happened']) + '<br>→ ' + esc_(e['Suggested action']) +
                 (e['Source URL'] ? ' <a href="' + esc_(e['Source URL']) + '">open</a>' : '') + '</li>';
        }).join('') + '</ul>' : '<p>No open escalations.</p>') +
      '<hr><p><a href="' + SpreadsheetApp.getActiveSpreadsheet().getUrl() + '">Open the workbook</a></p>';

    MailApp.sendEmail({
      to: Session.getActiveUser().getEmail(),
      subject: 'Positioning OS — weekly — ' + esc_(o['Week ending']) +
               ' — ' + esc_(o['Open escalations (HIGH)']) + ' need you',
      htmlBody: html
    });
    s.getRange(i + 1, sentCol).setValue('YES');
    break;
  }
}

/** Triggers. Run once from the editor. */
function setupReporterTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === 'emailDailyWorkReport' || f === 'emailWeeklyReport') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('emailDailyWorkReport').timeBased().atHour(8).everyDays(1).create();
  ScriptApp.newTrigger('emailWeeklyReport').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(18).create();
  SpreadsheetApp.getUi().alert('Daily work report ~8am, weekly report Sunday ~6pm.');
}
