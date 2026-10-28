/**
 * Positioning OS — Ingest endpoint
 * --------------------------------
 * A Web App the Mac posts research rows to. This exists because Google's
 * "Secure by Default" org policy (iam.disableServiceAccountKeyCreation) blocks
 * service-account key downloads on consumer accounts, which makes the normal
 * Sheets-API path unavailable. Rather than fight that, the Mac talks to Apps
 * Script, which already has full access to this sheet and has never failed.
 *
 * SECURITY: deployed as "Anyone with the link", so the URL alone must not be
 * enough. Every request carries a shared token that is checked first, and the
 * token lives in Script Properties, never in the code or the repo.
 */

var TOKEN_PROP = 'INGEST_TOKEN';

/** Run once from the editor. Prints the token to copy into config.json. */
function setupIngestToken() {
  var p = PropertiesService.getScriptProperties();
  var t = p.getProperty(TOKEN_PROP);
  if (!t) {
    t = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    p.setProperty(TOKEN_PROP, t);
  }
  SpreadsheetApp.getUi().alert(
    'Ingest token (paste into automation/config.json as "ingest_token"):\n\n' + t +
    '\n\nKeep it out of the repo. It is the only thing protecting the endpoint.');
}

function doPost(e) {
  var out = function (obj, code) {
    return ContentService.createTextOutput(JSON.stringify(obj))
      .setMimeType(ContentService.MimeType.JSON);
  };

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return out({ ok: false, error: 'empty body' });
    }
    var body = JSON.parse(e.postData.contents);

    var expected = PropertiesService.getScriptProperties().getProperty(TOKEN_PROP);
    if (!expected) return out({ ok: false, error: 'no token configured; run setupIngestToken' });
    if (body.token !== expected) return out({ ok: false, error: 'bad token' });

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var written = 0, created = [];

    // body.writes = [{ tab: "Agent Log", headers: [...], rows: [[...], ...] }, ...]
    (body.writes || []).forEach(function (w) {
      if (!w.tab || !w.rows || !w.rows.length) return;
      var sh = ss.getSheetByName(w.tab);
      if (!sh) {
        sh = ss.insertSheet(w.tab);
        created.push(w.tab);
        if (w.headers && w.headers.length) {
          sh.getRange(1, 1, 1, w.headers.length).setValues([w.headers])
            .setFontWeight('bold').setBackground('#1f3a5f').setFontColor('#ffffff');
          sh.setFrozenRows(1);
        }
      }
      var start = sh.getLastRow() + 1;
      sh.getRange(start, 1, w.rows.length, w.rows[0].length).setValues(w.rows);
      written += w.rows.length;
    });

    return out({ ok: true, written: written, tabs_created: created });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

/** Lets the Mac read current state (CRM, memory) without the Sheets API. */
function doGet(e) {
  var out = function (obj) {
    return ContentService.createTextOutput(JSON.stringify(obj))
      .setMimeType(ContentService.MimeType.JSON);
  };
  try {
    var expected = PropertiesService.getScriptProperties().getProperty(TOKEN_PROP);
    if (!e || !e.parameter || e.parameter.token !== expected) return out({ ok: false, error: 'bad token' });

    var name = e.parameter.tab;
    if (!name) return out({ ok: false, error: 'no tab' });
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
    if (!sh || sh.getLastRow() < 1) return out({ ok: true, rows: [] });

    var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    var head = v[0].map(String);
    var rows = v.slice(1).map(function (r) {
      var o = {}; head.forEach(function (h, i) { o[h] = r[i]; }); return o;
    });
    return out({ ok: true, rows: rows });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}
