/**
 * Positioning OS — website webhook.
 *
 * Receives events from siddharthbagga29.github.io (and the Strategy Lab) and writes them into the
 * "Positioning OS" Google Sheet:
 *   • every event              → "Web Activity" (raw log; created on first run)
 *   • a "Get in touch" message  → People CRM (new person, UNVERIFIED) + Target Companies (new firm,
 *                                 UNVERIFIED) + Opportunities (Job / Deal / Introduction)
 *   • a Calendly booking        → Opportunities (Active conversation)
 *   • hourly / after each post  → Dashboard: "Follow-ups overdue", "Unverified people rows"
 *                                 (only where those cells are plain values, never formulas) and a
 *                                 "WEB (portfolio)" block with sessions, engaged sessions, inbound,
 *                                 bookings and CPI; one row per day in "Web Metrics".
 *
 * CPI (Conversion & Profile Index) = 1,000 × (inbound messages + Calendly bookings) / sessions,
 * over the last 30 days. It reads as "conversations started per 1,000 visits".
 *
 * Deploy: see positioning-os/README.md. Add this as its own file (e.g. "Webhook.gs") next to an
 * existing Code.gs: everything lives inside one namespace, so names like SHEETS or ensureSheet_ in
 * other files of the project can't clash with it. Run `webhookSelfTest` from the editor to try it.
 */

var PositioningWebhook = (function () {

  const CFG = {
    SPREADSHEET_ID: '1CximFWly4sb8l8YtFq-bXMXNcBxHeWLUfgJFydcfEEY',
    TZ: 'America/New_York',
    WINDOW_DAYS: 30,
    ENGAGED_SCORE: 8,
    MAX_BODY: 20000,
    MAX_EVENTS_PER_SESSION_PER_10MIN: 80,
    UPDATE_FOLLOWUP_COLUMNS: true, // recompute Days Since Contact / Follow-Up Due where they are plain values
    SCORES: { section_view: 1, jarvis_ask: 2, lab_run: 2, resume_open: 2, connect_open: 3, calendly_view: 3, lead: 10, calendly_booked: 10 },
  };

  const SHEETS = {
    activity: 'Web Activity',
    metrics: 'Web Metrics',
    people: 'People CRM',
    companies: 'Target Companies',
    opps: 'Opportunities',
    dashboard: 'Dashboard',
  };

  // ---------------------------------------------------------------- entry points

  function doGet() {
    return json_({ ok: true, service: 'positioning-os-webhook', version: 1 });
  }

  function doPost(e) {
    try {
      const raw = (e && e.postData && e.postData.contents) || '';
      if (!raw || raw.length > CFG.MAX_BODY) return json_({ ok: false, error: 'bad size' });
      const body = JSON.parse(raw);
      const sid = clip_(String(body.sid || 'unknown'), 40);
      const events = Array.isArray(body.events) ? body.events.slice(0, 50) : [];
      if (!events.length) return json_({ ok: true, stored: 0 });
      if (!allow_(sid, events.length)) return json_({ ok: false, error: 'rate limited' });

      const lock = LockService.getScriptLock();
      lock.waitLock(15000);
      try {
        const ss = book_();
        const activity = ensureSheet_(ss, SHEETS.activity, ['Timestamp', 'Session', 'Page', 'Event', 'Detail', 'Referrer', 'Score']);
        const page = clip_(String(body.page || ''), 120);
        const ref = clip_(String(body.ref || ''), 200);
        const rows = [];
        for (const ev of events) {
          const name = clip_(String(ev.event || ''), 40);
          if (!CFG.SCORES.hasOwnProperty(name) && name !== 'page_view') continue;
          const detail = Object.assign({}, ev);
          delete detail.event;
          delete detail.at;
          if (detail.lead) detail.lead = { company: detail.lead.company || '', reason: detail.lead.reason || '' }; // keep PII out of the raw log
          rows.push([new Date(), sid, page, name, clip_(JSON.stringify(detail), 500), ref, CFG.SCORES[name] || 0]);
          try {
            if (name === 'lead' && ev.lead) handleLead_(ss, ev.lead, page);
            if (name === 'calendly_booked') handleBooking_(ss, ev, sid);
          } catch (err) {
            // Keep the event in Web Activity even if a CRM tab has been renamed or restructured.
            console.error(err);
            rows[rows.length - 1][4] = clip_(rows[rows.length - 1][4] + ' | CRM write failed: ' + err.message, 500);
          }
        }
        if (rows.length) activity.getRange(activity.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows.map(safeRow_));
        try {
          refreshDashboard_(ss);
        } catch (err) {
          console.error(err);
        }
        return json_({ ok: true, stored: rows.length });
      } finally {
        lock.releaseLock();
      }
    } catch (err) {
      console.error(err);
      return json_({ ok: false, error: 'server' });
    }
  }

  /** Hourly trigger target. */
  function refreshDashboard() {
    refreshDashboard_(book_());
  }

  /** Run once from the editor after deploying. Creates the hourly dashboard refresh. */
  function installTriggers() {
    ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'webhookRefreshDashboard').forEach((t) => ScriptApp.deleteTrigger(t));
    ScriptApp.newTrigger('webhookRefreshDashboard').timeBased().everyHours(1).create();
    refreshDashboard();
  }

  /** Safe end-to-end check from the editor: posts a clearly-labelled test lead. Delete the rows afterwards. */
  function selfTest() {
    const payload = {
      sid: 'selftest',
      page: '/',
      events: [
        { event: 'page_view', at: new Date().toISOString() },
        { event: 'section_view', section: 'hero' },
        { event: 'lead', lead: { name: 'TEST — delete me', email: 'test@example.com', company: 'TEST Family Office', role: 'Analyst', reason: "I'm hiring", message: 'Self-test from Apps Script' } },
      ],
    };
    const res = doPost({ postData: { contents: JSON.stringify(payload) } });
    Logger.log(res.getContent());
  }

  // ---------------------------------------------------------------- leads

  function handleLead_(ss, lead, page) {
    const name = clip_(String(lead.name || '').trim(), 120);
    const email = clip_(String(lead.email || '').trim().toLowerCase(), 160);
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return;
    const company = clip_(String(lead.company || '').trim(), 160);
    const role = clip_(String(lead.role || '').trim(), 160);
    const reason = clip_(String(lead.reason || '').trim(), 60);
    const message = clip_(String(lead.message || '').trim(), 900);
    const today = dateOnly_(new Date());

    // People CRM — dedupe on the email we store in Notes.
    const people = table_(ss, SHEETS.people, 'Person ID');
    const existing = people.rows.findIndex((r) => String(r[people.col('Notes')] || '').toLowerCase().indexOf('email: ' + email) >= 0);
    let personId;
    if (existing >= 0) {
      const rowNum = people.firstDataRow + existing;
      personId = people.rows[existing][people.col('Person ID')];
      people.set(rowNum, { 'Last Contact': today, 'Next Contact': today, 'Follow-Up Due': 'DUE', 'Days Since Contact': 0 });
      appendNote_(people, rowNum, `${fmt_(today)} inbound again via portfolio: ${reason}${role ? ' — ' + role : ''}`);
    } else {
      personId = nextId_(people.rows.map((r) => r[people.col('Person ID')]), 'P-', 3);
      const priority = { "I'm hiring": 75, 'Compare notes': 60, "Let's connect": 50 }[reason] || 40;
      people.append({
        'Person ID': personId,
        'Full Name': name,
        Organization: company,
        Tier: 'C',
        'Priority Score': priority,
        'Source Type': 'Portfolio website (inbound)',
        'First Contact': today,
        'Last Contact': today,
        'Next Contact': today,
        'Cadence Days': 14,
        'Days Since Contact': 0,
        'Follow-Up Due': 'DUE',
        'Conversation Topic': `${reason}${role ? ': ' + role : ''}`,
        'Value I Can Give': 'Reply within 24h',
        'Relationship Strength': 1,
        Opportunity: role ? `${reason}: ${role}` : reason,
        'Verification Status': 'UNVERIFIED',
        Confidence: 'Low',
        Notes: `email: ${email} · self-reported via ${page || '/'} on ${fmt_(today)}. Verify identity and firm before using in conversation. Message: ${message}`,
      });
    }

    // Target Companies — add the firm if it isn't already on the radar.
    let firmNote = '';
    if (company) {
      const cos = table_(ss, SHEETS.companies, 'Company ID');
      const hit = cos.rows.findIndex((r) => norm_(r[cos.col('Name')]) === norm_(company));
      if (hit < 0) {
        cos.append({
          'Company ID': nextId_(cos.rows.map((r) => r[cos.col('Company ID')]), 'FIRM-', 3),
          Name: company,
          'Revenue Basis': 'UNKNOWN',
          'Strategic Relevance': reason === "I'm hiring" ? 4 : 3,
          'Likely Decision Maker': 'UNVERIFIED',
          'Linked Person ID': personId,
          Source: 'Portfolio website (inbound)',
          'Verification Status': 'UNVERIFIED',
          Confidence: 'Low',
          'Next Action': 'Verify the firm and the sender; reply to the inbound',
          Notes: `Added automatically from an inbound message on ${fmt_(today)}.`,
        });
        firmNote = ' New firm added to Target Companies.';
      } else {
        const rowNum = cos.firstDataRow + hit;
        if (!cos.rows[hit][cos.col('Linked Person ID')]) cos.set(rowNum, { 'Linked Person ID': personId });
      }
    }

    // Opportunities — hiring and deal conversations are pipeline; networking is an introduction.
    const type = { "I'm hiring": 'Job', 'Compare notes': 'Deal', "Let's connect": 'Introduction' }[reason] || 'Other';
    addOpportunity_(ss, {
      Type: type,
      Description: `${reason}${role ? ': ' + role : ''}${company ? ' — ' + company : ''} (portfolio inbound)`,
      'Source Person ID': personId,
      Organization: company,
      Stage: 'Identified',
      'Probability %': type === 'Job' ? 15 : 5,
      'Why It Matters': 'Inbound from someone who read the portfolio and chose to write',
      'Next Action': 'Reply within 24h; verify sender and firm',
      'Next Action Date': today,
      'Authorization Required': type === 'Job' || type === 'Deal' ? 'Yes' : 'No',
      Status: 'Identified',
      Notes: `Auto-logged.${firmNote}`,
    });
  }

  function handleBooking_(ss, ev, sid) {
    const today = dateOnly_(new Date());
    addOpportunity_(ss, {
      Type: 'Introduction',
      Description: 'Calendly booking from the portfolio',
      Stage: 'Active conversation',
      'Probability %': 20,
      'Why It Matters': 'A visitor booked time directly',
      'Next Action': 'Check Calendly for the attendee; prepare a 1-page brief',
      'Next Action Date': today,
      'Authorization Required': 'No',
      Status: 'Active conversation',
      Notes: `session ${sid}; event ${clip_(String(ev.event_uri || ev.event || ''), 200)}; invitee ${clip_(String(ev.invitee || ''), 200)}`,
    });
  }

  function addOpportunity_(ss, values) {
    const opps = table_(ss, SHEETS.opps, 'Opp ID');
    values['Opp ID'] = nextId_(opps.rows.map((r) => r[opps.col('Opp ID')]), 'OPP-', 3);
    opps.append(values);
  }

  // ---------------------------------------------------------------- dashboard

  function refreshDashboard_(ss) {
    const tz = CFG.TZ;
    const today = dateOnly_(new Date());
    const people = table_(ss, SHEETS.people, 'Person ID');

    // Keep the People CRM follow-up columns current where they hold plain values.
    let overdue = 0;
    let unverified = 0;
    people.rows.forEach((r, i) => {
      if (!r[people.col('Person ID')]) return;
      const rowNum = people.firstDataRow + i;
      const last = asDate_(r[people.col('Last Contact')]) || asDate_(r[people.col('First Contact')]);
      const next = asDate_(r[people.col('Next Contact')]);
      const cadence = Number(r[people.col('Cadence Days')]) || 0;
      const days = last ? Math.floor((today - last) / 864e5) : '';
      const due = (next && next <= today) || (cadence && days !== '' && days >= cadence) ? 'DUE' : '';
      if (CFG.UPDATE_FOLLOWUP_COLUMNS) people.setIfValue(rowNum, { 'Days Since Contact': days, 'Follow-Up Due': due });
      const shownDue = people.read(rowNum, 'Follow-Up Due');
      if (String(shownDue).toUpperCase() === 'DUE') overdue++;
      const v = String(r[people.col('Verification Status')] || '').toUpperCase();
      if (v === 'UNVERIFIED' || v === '') unverified++;
    });

    const dash = ss.getSheetByName(SHEETS.dashboard);
    if (!dash) return;
    writeMetric_(dash, 'Follow-ups overdue', overdue, false);
    writeMetric_(dash, 'Unverified people rows', unverified, false);

    // Web metrics over the last 30 days.
    const act = ss.getSheetByName(SHEETS.activity);
    const since = new Date(today.getTime() - CFG.WINDOW_DAYS * 864e5);
    const sessions = {};
    let leads = 0;
    let bookings = 0;
    if (act && act.getLastRow() > 1) {
      const data = act.getRange(2, 1, act.getLastRow() - 1, 7).getValues();
      data.forEach((r) => {
        const ts = r[0] instanceof Date ? r[0] : new Date(r[0]);
        if (!(ts >= since) || r[1] === 'selftest') return;
        const s = (sessions[r[1]] = sessions[r[1]] || 0);
        sessions[r[1]] = s + (Number(r[6]) || 0);
        if (r[3] === 'lead') leads++;
        if (r[3] === 'calendly_booked') bookings++;
      });
    }
    const nSessions = Object.keys(sessions).length;
    const engaged = Object.keys(sessions).filter((k) => sessions[k] >= CFG.ENGAGED_SCORE).length;
    const cpi = nSessions ? Math.round((1000 * (leads + bookings)) / nSessions * 10) / 10 : 0;

    ensureBlock_(dash, '🌐 WEB (portfolio, last 30 days)', [
      ['Sessions', nSessions, 'Unique visits'],
      ['Engaged sessions', engaged, `Score ≥ ${CFG.ENGAGED_SCORE}: sections, Jarvis, Lab, contact`],
      ['Inbound messages', leads, 'Each one is in People CRM as UNVERIFIED'],
      ['Calendly bookings', bookings, 'Logged in Opportunities'],
      ['CPI — conversations per 1,000 sessions', cpi, 'Higher is better'],
      ['Engagement rate', nSessions ? Math.round((engaged / nSessions) * 1000) / 10 + '%' : '-', 'Engaged ÷ sessions'],
    ]);

    // One row per day of history.
    const m = ensureSheet_(ss, SHEETS.metrics, ['Date', 'Sessions (30d)', 'Engaged (30d)', 'Inbound (30d)', 'Bookings (30d)', 'CPI', 'Follow-ups overdue', 'Unverified people']);
    const key = Utilities.formatDate(today, tz, 'yyyy-MM-dd');
    const last = m.getLastRow();
    const row = [key, nSessions, engaged, leads, bookings, cpi, overdue, unverified];
    if (last > 1 && Utilities.formatDate(new Date(m.getRange(last, 1).getValue()), tz, 'yyyy-MM-dd') === key) m.getRange(last, 1, 1, row.length).setValues([row]);
    else m.appendRow(row);
  }

  /** Writes value into column B next to an existing label in column A, unless B holds a formula. */
  function writeMetric_(sheet, label, value, create) {
    const labels = sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), 1).getValues().map((r) => String(r[0]).trim());
    let row = labels.findIndex((l) => l === label) + 1;
    if (!row) {
      if (!create) return;
      row = sheet.getLastRow() + 1;
      sheet.getRange(row, 1).setValue(label);
    }
    const cell = sheet.getRange(row, 2);
    if (cell.getFormula()) return; // the sheet already computes it — leave it alone
    cell.setValue(value);
  }

  function ensureBlock_(sheet, title, rows) {
    const labels = sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), 1).getValues().map((r) => String(r[0]).trim());
    let start = labels.findIndex((l) => l === title) + 1;
    if (!start) {
      start = sheet.getLastRow() + 2;
      sheet.getRange(start, 1, 1, 3).setValues([[title, 'Value', 'Rule']]).setFontWeight('bold');
    }
    rows.forEach((r, i) => {
      const rr = start + 1 + i;
      sheet.getRange(rr, 1).setValue(r[0]);
      if (!sheet.getRange(rr, 2).getFormula()) sheet.getRange(rr, 2).setValue(r[1]);
      sheet.getRange(rr, 3).setValue(r[2]);
    });
  }

  // ---------------------------------------------------------------- table helper

  /** Header-name based access, robust to column order and to the duplicated header rows in this sheet. */
  function table_(ss, name, idHeader) {
    const sh = ss.getSheetByName(name);
    if (!sh) throw new Error('Missing sheet: ' + name);
    const lastRow = Math.max(sh.getLastRow(), 1);
    const lastCol = sh.getLastColumn();
    const all = sh.getRange(1, 1, lastRow, lastCol).getValues();
    let headerRow = all.findIndex((r) => r.some((c) => String(c).trim() === idHeader));
    if (headerRow < 0) throw new Error(`No "${idHeader}" header in ${name}`);
    const headers = all[headerRow].map((h) => String(h).trim());
    let first = headerRow + 1;
    while (first < all.length && String(all[first][headers.indexOf(idHeader)]).trim() === idHeader) first++; // skip duplicate header rows
    const rows = all.slice(first);
    const col = (h) => {
      const i = headers.indexOf(h);
      if (i < 0) throw new Error(`No "${h}" column in ${name}`);
      return i;
    };
    let lastDataIndex = (() => {
      for (let i = rows.length - 1; i >= 0; i--) if (String(rows[i][col(idHeader)]).trim()) return i;
      return -1;
    })();
    return {
      rows,
      firstDataRow: first + 1,
      col,
      read: (rowNum, h) => sh.getRange(rowNum, col(h) + 1).getValue(),
      set: (rowNum, values) => Object.keys(values).forEach((h) => sh.getRange(rowNum, col(h) + 1).setValue(safe_(values[h]))),
      setIfValue: (rowNum, values) =>
        Object.keys(values).forEach((h) => {
          const cell = sh.getRange(rowNum, col(h) + 1);
          if (!cell.getFormula() && cell.getValue() !== values[h]) cell.setValue(values[h]);
        }),
      append: (values) => {
        const target = first + 1 + lastDataIndex + 1; // first empty row after the last ID
        const row = headers.map((h) => (h in values ? safe_(values[h]) : ''));
        // Fill only the columns we know, so formulas elsewhere in the row survive.
        headers.forEach((h, i) => {
          if (h in values) sh.getRange(target, i + 1).setValue(row[i]);
        });
        lastDataIndex += 1;
        rows[lastDataIndex] = row;
      },
    };
  }

  function ensureSheet_(ss, name, headers) {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    return sh;
  }

  // ---------------------------------------------------------------- utilities

  function book_() {
    try {
      const active = SpreadsheetApp.getActiveSpreadsheet();
      if (active) return active;
    } catch (e) {
      /* standalone script */
    }
    return SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  }

  function allow_(sid, n) {
    const cache = CacheService.getScriptCache();
    const key = 'rl_' + sid;
    const used = Number(cache.get(key) || 0);
    if (used + n > CFG.MAX_EVENTS_PER_SESSION_PER_10MIN) return false;
    cache.put(key, String(used + n), 600);
    return true;
  }

  function nextId_(ids, prefix, width) {
    let max = 0;
    ids.forEach((id) => {
      const m = String(id || '').match(new RegExp('^' + prefix + '(\\d+)$'));
      if (m) max = Math.max(max, Number(m[1]));
    });
    return prefix + String(max + 1).padStart(width, '0');
  }

  function appendNote_(t, rowNum, text) {
    const cur = String(t.read(rowNum, 'Notes') || '');
    t.set(rowNum, { Notes: (cur ? cur + ' | ' : '') + text });
  }

  /** Neutralise spreadsheet formula injection from visitor-supplied text. */
  function safe_(v) {
    if (typeof v !== 'string') return v;
    return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
  }
  function safeRow_(r) {
    return r.map(safe_);
  }
  function clip_(s, n) {
    return s.length > n ? s.slice(0, n) : s;
  }
  function norm_(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  function dateOnly_(d) {
    return new Date(Utilities.formatDate(d, CFG.TZ, "yyyy-MM-dd'T'00:00:00"));
  }
  function asDate_(v) {
    if (v instanceof Date && !isNaN(v)) return dateOnly_(v);
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return dateOnly_(new Date(v + 'T12:00:00'));
    return null;
  }
  function fmt_(d) {
    return Utilities.formatDate(d, CFG.TZ, 'yyyy-MM-dd');
  }
  function json_(o) {
    return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
  }

    return { doGet: doGet, doPost: doPost, refreshDashboard: refreshDashboard, installTriggers: installTriggers, selfTest: selfTest };
})();

// ---------------------------------------------------------------- global entry points
// doGet/doPost must be global for the web app. The rest are prefixed so they can't collide with
// functions in other files of the same project (for example a workbook builder).

function doGet(e) {
  return PositioningWebhook.doGet(e);
}
function doPost(e) {
  return PositioningWebhook.doPost(e);
}
/** Hourly trigger target. */
function webhookRefreshDashboard() {
  PositioningWebhook.refreshDashboard();
}
/** Run once from the editor: creates the hourly dashboard refresh. */
function webhookInstallTriggers() {
  PositioningWebhook.installTriggers();
}
/** Run from the editor: posts a clearly-labelled TEST lead. Delete the TEST rows afterwards. */
function webhookSelfTest() {
  PositioningWebhook.selfTest();
}
