/**
 * Positioning OS — Analyst
 * ------------------------
 * Does the daily work inside Google's own infrastructure, which has run
 * reliably every day. Replaces the reminder email with a work report.
 *
 * Why here and not a scheduled Claude session: five scheduled sessions were
 * tested over 2026-10-01..06. Every one ended in 30-90 seconds having produced
 * nothing, because a fired session gets a single turn — not enough to read
 * state, research, write and send. Apps Script has no such limit, and it has
 * Gmail, Sheets, Drive and UrlFetchApp. Deterministic work belongs here;
 * judgment work stays with a human-triggered Claude session.
 */

var UA = 'Positioning OS research (siddharthbagga29@gmail.com)';

/** 4-digit NAICS rotated one per run. Commercial & industrial services. */
var NAICS_ROTATION = ['5617', '5613', '5614', '5616', '5619', '5611', '5615'];

/** Ohio = 39. Hamilton, Butler, Warren, Clermont. */
var COUNTIES = [
  { fips: '061', name: 'Hamilton' },
  { fips: '017', name: 'Butler'   },
  { fips: '165', name: 'Warren'   },
  { fips: '025', name: 'Clermont' }
];

var CBP_YEAR = '2022';   // latest CBP vintage with NAICS2017 variables
var CENSUS_SHEET = 'Investment Research';

function nextNaics_() {
  var p = PropertiesService.getScriptProperties();
  var i = Number(p.getProperty('naicsIdx') || 0) % NAICS_ROTATION.length;
  p.setProperty('naicsIdx', String(i + 1));
  return NAICS_ROTATION[i];
}

function cbpUrl_(naics, countyFips) {
  return 'https://api.census.gov/data/' + CBP_YEAR + '/cbp' +
         '?get=ESTAB,EMP,NAICS2017_LABEL' +
         '&for=county:' + countyFips +
         '&in=state:39' +
         '&NAICS2017=' + naics;
}

/**
 * Pulls establishment counts for one NAICS across the four counties and writes
 * one Investment Research row with the reproducible query URL.
 * Returns a result object for the report; never throws.
 */
function pullCensusCBP_() {
  var naics = nextNaics_();
  var out = { naics: naics, rows: [], errors: [], total: 0, label: '' };

  COUNTIES.forEach(function (c) {
    var url = cbpUrl_(naics, c.fips);
    try {
      var resp = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        headers: { 'User-Agent': UA }
      });
      if (resp.getResponseCode() !== 200) {
        out.errors.push(c.name + ': HTTP ' + resp.getResponseCode() + ' — ' + url);
        return;
      }
      var data = JSON.parse(resp.getContentText());   // [[header],[row]...]
      if (!data || data.length < 2) { out.errors.push(c.name + ': no rows — ' + url); return; }
      var head = data[0], estabI = head.indexOf('ESTAB'),
          empI = head.indexOf('EMP'), labI = head.indexOf('NAICS2017_LABEL');
      var estab = 0, emp = 0;
      for (var r = 1; r < data.length; r++) {
        estab += Number(data[r][estabI]) || 0;
        emp   += Number(data[r][empI])   || 0;
        if (!out.label && labI >= 0) out.label = data[r][labI];
      }
      out.total += estab;
      out.rows.push({ county: c.name, estab: estab, emp: emp, url: url });
    } catch (e) {
      out.errors.push(c.name + ': ' + e + ' — ' + url);
    }
  });

  if (out.rows.length) {
    var sh = ssz_().getSheetByName(CENSUS_SHEET);
    if (sh) {
      var detail = out.rows.map(function (r) {
        return r.county + ' ' + r.estab + ' estab / ' + r.emp + ' emp';
      }).join('; ');
      sh.appendRow([
        'CBP-' + Utilities.formatDate(new Date(), ssz_().getSpreadsheetTimeZone(), 'yyyyMMdd') + '-' + naics,
        new Date(),
        'NAICS ' + naics + (out.label ? ' — ' + out.label : ''),
        'Market sizing',
        'How many establishments in NAICS ' + naics + ' operate in the four-county Cincinnati region?',
        out.total + ' establishments across Hamilton, Butler, Warren, Clermont (CBP ' + CBP_YEAR + ')',
        detail,
        'Tier 1 - Primary/Gov/SEC',
        out.rows[0].url,
        new Date(),
        'High',
        'P1 sector thesis',
        'There are ' + out.total + ' establishments in NAICS ' + naics +
          ' across the four counties — that is the acquirable universe before any size filter.',
        0.25,
        'Auto-pulled by Analyst.gs. Per-county URLs in Key Numbers.'
      ]);
    }
  }
  return out;
}

/** CRM hygiene the agent kept failing to do: what is rotting, and why. */
function auditCRM_() {
  var ss = ssz_(), sh = ss.getSheetByName(SHEETS.PEOPLE);
  var res = { overdue: [], noValue: [], unverified: [], total: 0 };
  if (!sh || sh.getLastRow() < 2) return res;
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var today = new Date(); today.setHours(0, 0, 0, 0);

  rows.forEach(function (r) {
    if (!r[1]) return;
    res.total++;
    var nx = r[15] instanceof Date ? r[15] : null;
    if (nx && nx <= today) res.overdue.push(r[1] + ' (' + (r[3] || '?') + ')');
    var v = String(r[21] || '').trim().toLowerCase();
    if (!v || v.indexOf('nothing yet') === 0) res.noValue.push(r[1]);
    if (r[27] === 'UNVERIFIED') res.unverified.push(r[1]);
  });
  return res;
}

/** The daily work report. Leads with what was done, never with a task list. */
function emailWorkReport_(census, crm) {
  var ss = ssz_(), tz = ss.getSpreadsheetTimeZone(), now = new Date();
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };

  var did = [];
  if (census.rows.length) {
    did.push('<li><b>Pulled Census County Business Patterns ' + CBP_YEAR +
      ' for NAICS ' + esc(census.naics) + (census.label ? ' (' + esc(census.label) + ')' : '') +
      '</b> across Hamilton, Butler, Warren and Clermont. <b>' + census.total +
      ' establishments</b> in total. Written to Investment Research.</li>');
  }
  if (census.errors.length) {
    did.push('<li style="color:#b02a37">Census pull failed for ' + census.errors.length +
      ' county/counties. Errors below — the query URLs are included so you can check by hand.</li>');
  }

  var table = census.rows.map(function (r) {
    return '<tr><td>' + esc(r.county) + '</td><td align="right">' + r.estab +
      '</td><td align="right">' + r.emp + '</td><td><a href="' + esc(r.url) +
      '">verify</a></td></tr>';
  }).join('');

  var flags = [];
  if (crm.overdue.length)   flags.push('<li><b>' + crm.overdue.length + ' follow-ups overdue:</b> ' + esc(crm.overdue.join(', ')) + '</li>');
  if (crm.noValue.length)   flags.push('<li><b>' + crm.noValue.length + ' contacts have no "Value I Can Give".</b> ' + esc(crm.noValue.join(', ')) + ' — these cannot be written to until you decide what you are offering.</li>');
  if (crm.unverified.length) flags.push('<li><b>' + crm.unverified.length + ' UNVERIFIED rows:</b> ' + esc(crm.unverified.join(', ')) + ' — never use in conversation.</li>');

  var html =
    '<h2>Positioning OS — ' + Utilities.formatDate(now, tz, 'EEEE d MMMM') + '</h2>' +
    '<h3>What I did today</h3><ul>' + (did.join('') || '<li>Nothing. Every data pull failed; see errors.</li>') + '</ul>' +
    (table ?
      '<h3>Data added — verify this</h3>' +
      '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">' +
      '<tr><th>County</th><th>Establishments</th><th>Employees</th><th>Source</th></tr>' +
      table + '</table>' +
      '<p><i>Every figure above regenerates from its own Census API URL. Click one.</i></p>' : '') +
    (census.errors.length ? '<h3 style="color:#b02a37">Errors</h3><ul><li>' +
      census.errors.map(esc).join('</li><li>') + '</li></ul>' : '') +
    (flags.length ? '<h3>Flags</h3><ul>' + flags.join('') + '</ul>' : '') +
    '<hr><p style="color:#666"><i>Deterministic work, run in Apps Script. Judgment work — outreach drafts, ' +
    'sourcing people from firm team pages, memo writing — is not automated and is not claimed to be.</i></p>' +
    '<p><a href="' + ss.getUrl() + '">Open the workbook</a></p>';

  MailApp.sendEmail({
    to: Session.getActiveUser().getEmail(),
    subject: 'Positioning OS — ' + Utilities.formatDate(now, tz, 'EEE d MMM') +
             ' — ' + census.total + ' establishments pulled, ' + crm.overdue.length + ' follow-ups overdue',
    htmlBody: html
  });
}

/** One-shot test. Run this from the editor after pasting; check your inbox. */
function testAnalystNow() {
  var census = pullCensusCBP_();
  var crm = auditCRM_();
  emailWorkReport_(census, crm);
  SpreadsheetApp.getUi().alert(
    'Census: ' + census.rows.length + ' counties ok, ' + census.errors.length + ' errors, ' +
    census.total + ' establishments.\nCRM: ' + crm.overdue.length + ' overdue, ' +
    crm.noValue.length + ' with no value-to-give.\nReport emailed.');
}
