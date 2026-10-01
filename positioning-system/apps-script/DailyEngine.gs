/**
 * Positioning OS — Daily Engine
 * -----------------------------
 * Proposes tasks. Never executes them. Every generated task lands in
 * Daily Tasks with Status = "Proposed" and Approved = blank; you approve or
 * reject in the morning. Nothing is sent, filed, or marked verified by a robot.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Positioning OS')
    .addItem("Generate today's tasks", 'generateDailyTasks')
    .addItem('Email me the morning brief', 'emailMorningBrief')
    .addSeparator()
    .addItem('Compute this week\'s score', 'computeWeeklyScore')
    .addItem('Flag stale verifications', 'flagStaleVerification')
    .addSeparator()
    .addItem('Set up daily trigger', 'setupDailyTrigger')
    .addItem('Remove all triggers', 'removeTriggers')
    .addToUi();
}

function ssz_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function today_() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function dOnly_(v) {
  if (!v || !(v instanceof Date)) return null;
  var d = new Date(v); d.setHours(0, 0, 0, 0); return d;
}
function rows_(name) {
  var sh = ssz_().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
}

/** Proposes 3-6 tasks across the three daily slots. Idempotent per day. */
function generateDailyTasks() {
  var ss = ssz_();
  var sh = ss.getSheetByName(SHEETS.TASKS);
  var t = today_();
  var stamp = Utilities.formatDate(t, ss.getSpreadsheetTimeZone(), 'yyyyMMdd');

  // Don't double-propose if already run today.
  var existing = rows_(SHEETS.TASKS).filter(function (r) {
    var d = dOnly_(r[0]); return d && d.getTime() === t.getTime();
  });
  if (existing.length > 0) {
    SpreadsheetApp.getUi().alert('Tasks already proposed for today (' + existing.length + '). ' +
      'Delete them first if you want to regenerate.');
    return;
  }

  var out = [], n = 0;
  function add(slot, task, link, mins) {
    n++;
    out.push([t, stamp + '-' + n, slot, task, link || '', mins, '', 'Proposed', '', '', '']);
  }

  // --- RELATIONSHIP: overdue and due-today follow-ups come first, always. ---
  var people = rows_(SHEETS.PEOPLE);
  var due = people.filter(function (r) {
    var nx = dOnly_(r[15]); // P Next Contact
    return nx && nx.getTime() <= t.getTime() && r[1];
  }).sort(function (a, b) {
    var ta = ({A: 0, B: 1, C: 2, D: 3})[a[7]]; var tb = ({A: 0, B: 1, C: 2, D: 3})[b[7]];
    return (ta === undefined ? 4 : ta) - (tb === undefined ? 4 : tb);
  });

  due.slice(0, 4).forEach(function (r) {
    add('RELATIONSHIP',
        'Follow up: ' + r[1] + ' (' + (r[3] || 'unknown org') + ') — last topic: ' +
        (r[19] || 'none logged') + '. Value you can give: ' + (r[21] || 'DECIDE BEFORE SENDING'),
        r[0], 12);
  });

  // Only prospect for new contacts once the follow-up queue is short.
  if (due.length < 3) {
    var fresh = people.filter(function (r) {
      return r[1] && !r[13] && r[27] === 'VERIFIED'; // named, never contacted, verified
    });
    if (fresh.length) {
      var pick = fresh[0];
      add('RELATIONSHIP',
          'First contact: ' + pick[1] + ' (' + (pick[2] || '') + ', ' + (pick[3] || '') +
          '). Use the Curiosity script. Warrant: ' + (pick[10] || pick[11] || 'geography only — weak'),
          pick[0], 15);
    } else {
      add('RELATIONSHIP',
          'No verified uncontacted people left. Run the People Sourcing Protocol: source 5 new rows ' +
          'from firm team pages (05-people-and-firms.md §3).', '', 45);
    }
  }

  // --- REPUTATION: advance the live project. ---
  var proj = rows_(requireSheet_(SHEETS.PROJ)).filter(function (r) { return r[9] === 'IN PROGRESS'; });
  if (proj.length) {
    var p = proj[0];
    add('REPUTATION',
        'Advance "' + p[1] + '" by one named deliverable. Logged ' + (p[7] || 0) + '/' +
        (p[6] || '?') + ' hrs, ' + (p[8] || 0) + '% complete. Target ' +
        (p[11] ? Utilities.formatDate(new Date(p[11]), ss.getSpreadsheetTimeZone(), 'd MMM') : 'unset'),
        p[0], 75);
  } else {
    add('REPUTATION',
        'No project IN PROGRESS. Start the next one from 07-investment-portfolio.md §3 and set a target date.',
        '', 75);
  }

  // --- Spaced repetition on skills (Cepeda et al. 2006; see 17-evidence-base.md). ---
  var skills = rows_(SHEETS.SKILLS).filter(function (r) {
    var nx = dOnly_(r[14]); return nx && nx.getTime() <= t.getTime() && r[1];
  });
  if (skills.length) {
    add('REPUTATION',
        'Spaced rep due: ' + skills[0][1] + ' (' + (skills[0][8] || 'method not set') +
        '). After the rep, set Last Rep Date = today and lengthen Interval Days.',
        skills[0][0], 20);
  }

  // --- OPPORTUNITY: event pre-briefs at the 48h mark, else radar building. ---
  var soon = rows_(SHEETS.EVENTS).filter(function (r) {
    var d = dOnly_(r[3]);
    if (!d) return false;
    var days = (d.getTime() - t.getTime()) / 86400000;
    return days >= 0 && days <= 2 && r[10] !== 'Yes';
  });
  if (soon.length) {
    add('OPPORTUNITY',
        'EVENT PRE-BRIEF for "' + soon[0][1] + '" — run the 48h checklist (09-networking-system.md §1): ' +
        'identify 5-10 priority people, narrow to 3 must-meets, write one question each.',
        soon[0][0], 45);
  } else if (t.getDay() === 3) { // Wednesday
    add('OPPORTUNITY',
        'Radar build: add 5 companies via Census CBP + Ohio SOS for your Project 1 NAICS ' +
        '(06-target-company-radar.md §4). Revenue Basis must be set honestly.', '', 45);
  } else {
    add('OPPORTUNITY',
        'Investment research question of the day — log it in Investment Research with a source URL ' +
        'and a Tier rating.', '', 45);
  }

  // --- Guardrails that override everything else. ---
  var opps = rows_(SHEETS.OPPS).filter(function (r) { return r[11] === 'Yes' && r[12] !== 'Dead'; });
  if (opps.length) {
    add('ADMIN',
        '⚠️ ' + opps.length + ' opportunity row(s) flagged COUNSEL REVIEW NEEDED. Do not act on them. ' +
        'Add the question to 18-immigration-counsel-questions.md and book the call.', '', 10);
  }

  sh.getRange(sh.getLastRow() + 1, 1, out.length, out[0].length).setValues(out);
  SpreadsheetApp.getUi().alert('Proposed ' + out.length + ' tasks. Approve or reject each in Daily Tasks.');
}

/** Guard so a missing sheet name fails loudly rather than silently. */
function requireSheet_(name) {
  if (!ssz_().getSheetByName(name)) throw new Error('Missing sheet: ' + name + '. Run buildWorkbook() first.');
  return name;
}

/** Emails the brief. Read-only: it reports, it does not act. */
function emailMorningBrief() {
  var ss = ssz_();
  var dash = ss.getSheetByName(SHEETS.DASH);
  var t = today_();
  var tasks = rows_(SHEETS.TASKS).filter(function (r) {
    var d = dOnly_(r[0]); return d && d.getTime() === t.getTime();
  });

  var red = dash.getRange('A6:C10').getValues()
    .filter(function (r) { return r[0] && Number(r[1]) > 0; })
    .map(function (r) { return '<li><b>' + r[0] + ': ' + r[1] + '</b> — ' + r[2] + '</li>'; }).join('');

  var lis = tasks.map(function (r) {
    return '<li><b>[' + r[2] + ']</b> ' + r[3] + ' <i>(' + r[5] + ' min)</i></li>';
  }).join('');

  var html =
    '<h2>Positioning OS — ' + Utilities.formatDate(t, ss.getSpreadsheetTimeZone(), 'EEEE d MMMM') + '</h2>' +
    (red ? '<h3 style="color:#b02a37">Needs action now</h3><ul>' + red + '</ul>' : '') +
    '<h3>Proposed today</h3>' + (lis ? '<ul>' + lis + '</ul>' :
      '<p>No tasks proposed. Run “Generate today’s tasks”.</p>') +
    '<hr><p style="color:#666"><i>Proposals only. Approve or reject each in the Daily Tasks sheet. ' +
    'Nothing has been sent on your behalf.</i></p>' +
    '<p><a href="' + ss.getUrl() + '">Open the workbook</a></p>';

  MailApp.sendEmail({
    to: Session.getActiveUser().getEmail(),
    subject: 'Positioning OS — ' + Utilities.formatDate(t, ss.getSpreadsheetTimeZone(), 'EEE d MMM'),
    htmlBody: html
  });
}

/** Appends a Weekly Review row with the counts the sheets can compute for themselves. */
function computeWeeklyScore() {
  var ss = ssz_();
  var sh = ss.getSheetByName(SHEETS.WEEKLY);
  var t = today_();
  var start = new Date(t.getTime() - 6 * 86400000);

  function inWeek(v) { var d = dOnly_(v); return d && d >= start && d <= t; }

  var people = rows_(SHEETS.PEOPLE);
  var newContacts   = people.filter(function (r) { return inWeek(r[13]); }).length;
  var conversations = people.filter(function (r) { return inWeek(r[14]); }).length;
  var intros        = people.filter(function (r) { return r[22] && inWeek(r[14]); }).length;

  var events   = rows_(SHEETS.EVENTS).filter(function (r) { return r[12] === 'Yes' && inWeek(r[3]); }).length;
  var research = rows_(SHEETS.RESEARCH).filter(function (r) { return inWeek(r[1]); });
  var hours    = research.reduce(function (a, r) { return a + (Number(r[13]) || 0); }, 0);
  var cos      = rows_(SHEETS.COS).filter(function (r) { return inWeek(r[18]); }).length;
  var apps     = rows_(SHEETS.APPS).filter(function (r) { return inWeek(r[6]); }).length;
  var done     = rows_(SHEETS.PROJ).filter(function (r) { return inWeek(r[12]); }).length;

  // B..Q; R is the score formula and is left alone.
  sh.getRange(sh.getLastRow() + 1, 1, 1, 17).setValues([[
    start, newContacts, conversations, 0, intros, events, hours, done, 0, 0, cos, apps, 0, 0, 0, 0, 0
  ]]);
  SpreadsheetApp.getUi().alert(
    'Week of ' + Utilities.formatDate(start, ss.getSpreadsheetTimeZone(), 'd MMM') +
    ' appended. Fill in the columns only you can judge (follow-ups sent, posts, hours, finances), ' +
    'then answer the five improvement questions in columns S-Y.');
}

/** Anything verified more than 90 days ago stops counting as verified. */
function flagStaleVerification() {
  var t = today_(), cutoff = new Date(t.getTime() - 90 * 86400000), n = 0;
  [[SHEETS.PEOPLE, 28, 30], [SHEETS.COS, 18, 19], [SHEETS.ORGS, 16, 17]].forEach(function (cfg) {
    var sh = ssz_().getSheetByName(cfg[0]);
    if (!sh || sh.getLastRow() < 2) return;
    var statusRange = sh.getRange(2, cfg[1], sh.getLastRow() - 1, 1);
    var status = statusRange.getValues();
    var dates  = sh.getRange(2, cfg[2], sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < status.length; i++) {
      var d = dOnly_(dates[i][0]);
      if (d && d < cutoff && status[i][0] === 'VERIFIED') { status[i][0] = 'OUTDATED'; n++; }
    }
    statusRange.setValues(status);
  });
  SpreadsheetApp.getUi().alert(n + ' row(s) moved to OUTDATED. Re-verify from primary sources or delete them.');
}

function setupDailyTrigger() {
  removeTriggers();
  ScriptApp.newTrigger('dailyRun_').timeBased().atHour(6).everyDays(1).create();
  SpreadsheetApp.getUi().alert('Daily trigger set for ~6am: generates tasks, flags stale verifications, emails the brief.');
}

function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (tr) { ScriptApp.deleteTrigger(tr); });
}

/** Trigger entry point. UI alerts are unavailable here, so failures are logged. */
function dailyRun_() {
  try { generateDailyTasksSilent_(); } catch (e) { Logger.log('task gen failed: ' + e); }
  try { flagStaleVerificationSilent_(); } catch (e) { Logger.log('verification sweep failed: ' + e); }
  // The reminder email is OFF by design. The daily agent (see agent/RUNBOOK.md)
  // runs ~90 min later, does the actual work, and sends one report instead.
  // Set EMAIL_BRIEF to true if you ever want the plain reminder back.
  var EMAIL_BRIEF = false;
  if (EMAIL_BRIEF) {
    try { emailMorningBrief(); } catch (e) { Logger.log('brief failed: ' + e); }
  }
}

function generateDailyTasksSilent_() {
  var ui = SpreadsheetApp.getUi;
  SpreadsheetApp.getUi = function () { return { alert: function () {} }; };
  try { generateDailyTasks(); } finally { SpreadsheetApp.getUi = ui; }
}

function flagStaleVerificationSilent_() {
  var ui = SpreadsheetApp.getUi;
  SpreadsheetApp.getUi = function () { return { alert: function () {} }; };
  try { flagStaleVerification(); } finally { SpreadsheetApp.getUi = ui; }
}
