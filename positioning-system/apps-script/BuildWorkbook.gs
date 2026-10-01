/**
 * Positioning OS — Workbook Builder
 * ---------------------------------
 * Creates the full 15-sheet workbook: headers, dropdowns, formulas,
 * conditional formatting, and the Dashboard.
 *
 * Run buildWorkbook() once. Safe to re-run: it rebuilds structure without
 * deleting data rows in sheets that already exist.
 */

var SHEETS = {
  DASH:    'Dashboard',
  PEOPLE:  'People CRM',
  ORGS:    'Organizations',
  COS:     'Target Companies',
  EVENTS:  'Events',
  RESEARCH:'Investment Research',
  PROJ:    'Portfolio Projects',
  APPS:    'Applications',
  SKILLS:  'Skills Gap',
  TASKS:   'Daily Tasks',
  WEEKLY:  'Weekly Review',
  OPPS:    'Opportunities',
  FIN:     'Personal Financial Profile',
  IDEAS:   'Business Ideas',
  SOURCES: 'Sources & Verification',
  CONFIG:  'Config'
};

var HEADERS = {};
HEADERS[SHEETS.PEOPLE] = ['Person ID','Full Name','Title','Organization','Org Type','City',
  'Focus / Sector','Tier','Priority Score','Source Type','Shared Connection','UC Connection',
  'Association','First Contact','Last Contact','Next Contact','Cadence Days','Days Since Contact',
  'Follow-Up Due','Conversation Topic','Their Interests','Value I Can Give','Intros Received',
  'Intros Given','Events Together','Relationship Strength','Opportunity','Verification Status',
  'Source URL','Date Verified','Confidence','Notes'];

HEADERS[SHEETS.ORGS] = ['Org ID','Name','Type','Location','Purpose','Approx Members','Why I Fit',
  'Cost Per Year','Event Cadence','Tier','Join Status','Applied Date','Joined Date','Key Contacts',
  'URL','Verification Status','Date Verified','Confidence','Notes'];

HEADERS[SHEETS.COS] = ['Company ID','Name','City','Sector','NAICS','Ownership Type','Employee Band',
  'Revenue Estimate','Revenue Basis','Estimate Method','Growth Signal','Acquisition Relevance',
  'Strategic Relevance','Likely Decision Maker','Linked Person ID','Source','URL',
  'Verification Status','Date Verified','Confidence','Next Action','Notes'];

HEADERS[SHEETS.EVENTS] = ['Event ID','Name','Host Org','Date','City','Format','Cost',
  'Registration Status','Registered Date','Target People IDs','Pre-Brief Done','Questions Prepared',
  'Attended','People Met','Follow-Ups Sent','ROI Score','URL','Verification Status','Notes'];

HEADERS[SHEETS.RESEARCH] = ['Research ID','Date','Subject','Type','Question','Key Finding',
  'Key Numbers','Source Tier','Source URL','Date Verified','Confidence','Feeds Project',
  'Reusable Talking Point','Hours','Notes'];

HEADERS[SHEETS.PROJ] = ['Project ID','Title','Type','Subject','Sector','Difficulty','Est Hours',
  'Hours Logged','% Complete','Status','Start Date','Target Date','Completed Date',
  'Skills Demonstrated','Output Format','Publicly Shareable','Confidentiality Note',
  'Verification Method','Reviewer','Discussion Points','Link','Notes'];

HEADERS[SHEETS.APPS] = ['App ID','Company','Role','City','Route','Referrer Person ID',
  'Prepared Date','Ready To Submit','Submitted Date','Status','Stage','Materials Version',
  'JD URL','Comp Range (public)','Source','Notes'];

HEADERS[SHEETS.SKILLS] = ['Skill ID','Skill','Domain','Current Level','Target Level','Gap',
  'Priority','Evidence Of Level','Practice Method','Resource','Hours This Week','Hours Total',
  'Last Rep Date','Interval Days','Next Rep Date','Status'];

HEADERS[SHEETS.TASKS] = ['Date','Task ID','Slot','Task','Linked Record','Est Min','Approved',
  'Status','Actual Min','Output Produced','Notes'];

HEADERS[SHEETS.WEEKLY] = ['Week Start','New Contacts','Conversations','Follow-Ups Sent',
  'Intros Received','Events Attended','Research Hours','Models Completed','Memos Completed',
  'Posts / Shares','Target Cos Added','Apps Prepared','Technical Hours','Communication Hours',
  'Savings Added','Utilization %','Emergency Fund Months','WEEKLY SCORE',
  'What produced conversations','What produced intros','What produced opportunities',
  'Wasted effort','Automation failures','Remove','Double down'];

HEADERS[SHEETS.OPPS] = ['Opp ID','Type','Description','Source Person ID','Organization','Stage',
  'Probability %','Why It Matters','Next Action','Next Action Date','Authorization Required',
  'Counsel Review Needed','Status','Notes'];

HEADERS[SHEETS.FIN] = ['Line Item','Current','6-Mo Target','12-Mo Target','24-Mo Target','Notes'];

HEADERS[SHEETS.IDEAS] = ['Idea ID','Name','Thesis','Customer','Problem','Offer','Revenue Model',
  'Startup Capital','Skills Required','My Gap','Authorization Gate','Validation Step (non-commercial)',
  'Evidence Gathered','Go/No-Go Date','Score','Notes'];

HEADERS[SHEETS.SOURCES] = ['Source ID','Claim','Category','Source Name','Source Tier','URL',
  'Date Accessed','Date Verified','Verification Status','Confidence','Re-Verify Due','Notes'];

/** Dropdown vocabularies. Column letter in Config -> list. */
var CONFIG_LISTS = [
  ['Tier',            ['A','B','C','D']],
  ['Verification',    ['VERIFIED','SECONDARY VERIFIED','UNVERIFIED','OUTDATED']],
  ['Confidence',      ['High','Medium','Low']],
  ['Org Tier',        ['Tier 1','Tier 2','Tier 3','Tier 4']],
  ['Join Status',     ['Not started','Researching','Inquiry sent','Applied','Member','Declined']],
  ['Org Type',        ['LMM PE','Independent Sponsor','Family Office','Search Fund','Private Credit',
                       'M&A Boutique','Investment Bank','Corp Dev','Valuation / TAS','Wealth Mgmt',
                       'Asset Mgmt','VC','Bank','University','Association','Company','Other']],
  ['Ownership',       ['Founder-owned','Family-owned','PE-backed','ESOP','Public','Subsidiary','Unknown']],
  ['Revenue Basis',   ['REPORTED','RANGE-PUBLIC','ESTIMATE','UNKNOWN']],
  ['Project Status',  ['NOT STARTED','IN PROGRESS','DRAFT','IN REVIEW','COMPLETE','SHELVED']],
  ['App Status',      ['Prepared','Held (not authorized)','Submitted','Screen','Interview',
                       'Final','Offer','Rejected','Withdrawn']],
  ['Event Status',    ['Identified','REGISTERED','Attended','Missed','Cancelled']],
  ['Skill Status',    ['Not started','Learning','Practicing','Proficient','Maintained']],
  ['Opp Stage',       ['Identified','Exploring','Active conversation','Advanced','Won','Dead']],
  ['Opp Type',        ['Job','Deal','Project','Introduction','Business','Other']],
  ['Task Slot',       ['RELATIONSHIP','REPUTATION','OPPORTUNITY','ADMIN']],
  ['Task Status',     ['Proposed','Approved','Done','Skipped']],
  ['Yes/No',          ['Yes','No']],
  ['Source Tier',     ['Tier 1 - Primary/Gov/SEC','Tier 2 - Institutional','Tier 3 - Trade','Tier 4 - Social']],
  ['Route',           ['Referral','Direct','Recruiter','Alumni','Event']]
];

function buildWorkbook() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  buildConfig_(ss);
  Object.keys(HEADERS).forEach(function (name) { buildSheet_(ss, name, HEADERS[name]); });
  buildDashboard_(ss);
  applyValidations_(ss);
  applyConditionalFormats_(ss);
  applyRowFormulas_(ss);
  seedFinancial_(ss);
  ss.setActiveSheet(ss.getSheetByName(SHEETS.DASH));
  SpreadsheetApp.getUi().alert('Positioning OS built. Reload the sheet to get the menu.');
}

function getOrCreate_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function buildSheet_(ss, name, headers) {
  var sh = getOrCreate_(ss, name);
  if (sh.getMaxColumns() < headers.length) {
    sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
  }
  if (sh.getMaxRows() < LAST) { sh.insertRowsAfter(sh.getMaxRows(), LAST - sh.getMaxRows()); }
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#1f3a5f').setFontColor('#ffffff')
    .setVerticalAlignment('middle').setWrap(true);
  sh.setFrozenRows(1);
  sh.setRowHeight(1, 42);
  if (sh.getMaxColumns() > headers.length) {
    sh.deleteColumns(headers.length + 1, sh.getMaxColumns() - headers.length);
  }
  sh.autoResizeColumns(1, Math.min(headers.length, 12));
}

function buildConfig_(ss) {
  var sh = getOrCreate_(ss, SHEETS.CONFIG);
  sh.clear();
  CONFIG_LISTS.forEach(function (pair, i) {
    var col = i + 1;
    sh.getRange(1, col).setValue(pair[0]).setFontWeight('bold').setBackground('#e8eef5');
    sh.getRange(2, col, pair[1].length, 1).setValues(pair[1].map(function (v) { return [v]; }));
  });
  sh.setFrozenRows(1);
}

function listRange_(ss, label) {
  var sh = ss.getSheetByName(SHEETS.CONFIG);
  var headerRow = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var idx = headerRow.indexOf(label);
  if (idx < 0) throw new Error('Config list not found: ' + label);
  var col = idx + 1;
  var n = sh.getRange(2, col, sh.getMaxRows() - 1, 1).getValues()
            .filter(function (r) { return r[0] !== ''; }).length;
  return sh.getRange(2, col, n, 1);
}

function dv_(ss, label) {
  return SpreadsheetApp.newDataValidation()
    .requireValueInRange(listRange_(ss, label), true)
    .setAllowInvalid(false).build();
}

var LAST = 1000; // rows to pre-format

function applyValidations_(ss) {
  function set(sheetName, colLetterIdx, listLabel) {
    var sh = ss.getSheetByName(sheetName);
    sh.getRange(2, colLetterIdx, LAST - 1, 1).setDataValidation(dv_(ss, listLabel));
  }
  // People CRM
  set(SHEETS.PEOPLE, 5, 'Org Type');       // E Org Type
  set(SHEETS.PEOPLE, 8, 'Tier');           // H Tier
  set(SHEETS.PEOPLE, 28, 'Verification');  // AB
  set(SHEETS.PEOPLE, 31, 'Confidence');    // AE
  // Organizations
  set(SHEETS.ORGS, 3, 'Org Type');
  set(SHEETS.ORGS, 10, 'Org Tier');
  set(SHEETS.ORGS, 11, 'Join Status');
  set(SHEETS.ORGS, 16, 'Verification');
  set(SHEETS.ORGS, 18, 'Confidence');
  // Target Companies
  set(SHEETS.COS, 6, 'Ownership');
  set(SHEETS.COS, 9, 'Revenue Basis');
  set(SHEETS.COS, 18, 'Verification');
  set(SHEETS.COS, 20, 'Confidence');
  // Events
  set(SHEETS.EVENTS, 8, 'Event Status');
  set(SHEETS.EVENTS, 11, 'Yes/No');
  set(SHEETS.EVENTS, 12, 'Yes/No');
  set(SHEETS.EVENTS, 13, 'Yes/No');
  set(SHEETS.EVENTS, 18, 'Verification');
  // Research
  set(SHEETS.RESEARCH, 8, 'Source Tier');
  set(SHEETS.RESEARCH, 11, 'Confidence');
  // Projects
  set(SHEETS.PROJ, 10, 'Project Status');
  set(SHEETS.PROJ, 16, 'Yes/No');
  // Applications
  set(SHEETS.APPS, 5, 'Route');
  set(SHEETS.APPS, 8, 'Yes/No');
  set(SHEETS.APPS, 10, 'App Status');
  // Skills
  set(SHEETS.SKILLS, 16, 'Skill Status');
  // Tasks
  set(SHEETS.TASKS, 3, 'Task Slot');
  set(SHEETS.TASKS, 7, 'Yes/No');
  set(SHEETS.TASKS, 8, 'Task Status');
  // Opportunities
  set(SHEETS.OPPS, 2, 'Opp Type');
  set(SHEETS.OPPS, 6, 'Opp Stage');
  set(SHEETS.OPPS, 11, 'Yes/No');
  set(SHEETS.OPPS, 12, 'Yes/No');
  // Sources
  set(SHEETS.SOURCES, 5, 'Source Tier');
  set(SHEETS.SOURCES, 9, 'Verification');
  set(SHEETS.SOURCES, 10, 'Confidence');
}

function rule_(formula, bg, ranges) {
  return SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(formula).setBackground(bg).setRanges(ranges).build();
}

var RED = '#f8d7da', AMBER = '#fff3cd', GREEN = '#d4edda', BLUE = '#d6e4f7';

function applyConditionalFormats_(ss) {
  // People CRM: overdue follow-ups red, A-tier blue, unverified amber
  var p = ss.getSheetByName(SHEETS.PEOPLE);
  p.setConditionalFormatRules([
    rule_('=AND($P2<>"",$P2<=TODAY())', RED,   [p.getRange('A2:AF' + LAST)]),
    rule_('=$H2="A"',                    BLUE,  [p.getRange('B2:B' + LAST)]),
    rule_('=$AB2="UNVERIFIED"',          AMBER, [p.getRange('AB2:AB' + LAST)]),
    rule_('=$AB2="OUTDATED"',            RED,   [p.getRange('AB2:AB' + LAST)]),
    rule_('=$AB2="VERIFIED"',            GREEN, [p.getRange('AB2:AB' + LAST)])
  ]);

  // Target Companies: any non-UNKNOWN revenue without a basis is a red flag
  var c = ss.getSheetByName(SHEETS.COS);
  c.setConditionalFormatRules([
    rule_('=AND($H2<>"",OR($I2="",$I2="UNKNOWN"))', RED, [c.getRange('H2:I' + LAST)]),
    rule_('=$I2="ESTIMATE"', AMBER, [c.getRange('I2:I' + LAST)]),
    rule_('=$R2="VERIFIED"', GREEN, [c.getRange('R2:R' + LAST)])
  ]);

  // Opportunities: authorization gate is the loudest thing on the sheet
  var o = ss.getSheetByName(SHEETS.OPPS);
  o.setConditionalFormatRules([
    rule_('=$K2="Yes"', RED,   [o.getRange('A2:N' + LAST)]),
    rule_('=$L2="Yes"', AMBER, [o.getRange('L2:L' + LAST)])
  ]);

  // Projects: overdue target date
  var pr = ss.getSheetByName(SHEETS.PROJ);
  pr.setConditionalFormatRules([
    rule_('=AND($L2<>"",$L2<TODAY(),$J2<>"COMPLETE")', RED,   [pr.getRange('A2:V' + LAST)]),
    rule_('=$J2="COMPLETE"',                            GREEN, [pr.getRange('J2:J' + LAST)])
  ]);

  // Skills: overdue spaced-repetition rep
  var sk = ss.getSheetByName(SHEETS.SKILLS);
  sk.setConditionalFormatRules([
    rule_('=AND($O2<>"",$O2<=TODAY())', AMBER, [sk.getRange('A2:P' + LAST)])
  ]);

  // Sources: re-verification overdue
  var so = ss.getSheetByName(SHEETS.SOURCES);
  so.setConditionalFormatRules([
    rule_('=AND($K2<>"",$K2<=TODAY())', AMBER, [so.getRange('A2:L' + LAST)]),
    rule_('=$I2="UNVERIFIED"',          RED,   [so.getRange('I2:I' + LAST)])
  ]);
}

function applyRowFormulas_(ss) {
  var p = ss.getSheetByName(SHEETS.PEOPLE);
  p.getRange('R2').setFormula(
    '=ARRAYFORMULA(IF($O$2:$O$' + LAST + '="","",TODAY()-$O$2:$O$' + LAST + '))');
  p.getRange('S2').setFormula(
    '=ARRAYFORMULA(IF($P$2:$P$' + LAST + '="","",IF($P$2:$P$' + LAST + '<=TODAY(),"DUE","")))');

  var sk = ss.getSheetByName(SHEETS.SKILLS);
  sk.getRange('F2').setFormula(
    '=ARRAYFORMULA(IF($B$2:$B$' + LAST + '="","",$E$2:$E$' + LAST + '-$D$2:$D$' + LAST + '))');
  sk.getRange('O2').setFormula(
    '=ARRAYFORMULA(IF($M$2:$M$' + LAST + '="","",$M$2:$M$' + LAST + '+$N$2:$N$' + LAST + '))');

  var so = ss.getSheetByName(SHEETS.SOURCES);
  so.getRange('K2').setFormula(
    '=ARRAYFORMULA(IF($H$2:$H$' + LAST + '="","",$H$2:$H$' + LAST + '+90))');

  // Weekly score (0-100). Caps stop any single metric from carrying the week.
  // NOTE: MIN() is not array-aware inside ARRAYFORMULA, so caps use IF().
  var w = ss.getSheetByName(SHEETS.WEEKLY);
  var R = function (c) { return '$' + c + '$2:$' + c + '$' + LAST; };
  var cap = function (expr, max) { return 'IF(' + expr + '>' + max + ',' + max + ',' + expr + ')'; };
  w.getRange('R2').setFormula(
    '=ARRAYFORMULA(IF(' + R('A') + '="","",' +
    cap(R('B') + '*2', 20) + '+' +
    cap(R('C') + '*2', 20) + '+' +
    cap(R('D'), 10) + '+' +
    cap(R('E') + '*5', 10) + '+' +
    cap(R('F') + '*5', 10) + '+' +
    cap(R('G') + '*1.5', 15) + '+' +
    cap('(' + R('H') + '+' + R('I') + ')*5', 10) + '+' +
    cap(R('J') + '*2.5', 5) + '))');
}

function buildDashboard_(ss) {
  var sh = getOrCreate_(ss, SHEETS.DASH);
  sh.clear();
  ss.setActiveSheet(sh);
  ss.moveActiveSheet(1);

  var P = "'" + SHEETS.PEOPLE + "'";
  var E = "'" + SHEETS.EVENTS + "'";
  var R = "'" + SHEETS.RESEARCH + "'";
  var J = "'" + SHEETS.PROJ + "'";
  var A = "'" + SHEETS.APPS + "'";
  var O = "'" + SHEETS.OPPS + "'";
  var C = "'" + SHEETS.COS + "'";
  var S = "'" + SHEETS.SOURCES + "'";

  var rows = [
    ['POSITIONING OS — DASHBOARD', '', ''],
    ['', '', ''],
    ['TODAY', '=TEXT(TODAY(),"ddd d mmm yyyy")', ''],
    ['', '', ''],
    ['🔴 NEEDS ACTION NOW', 'Count', 'Rule'],
    ['Follow-ups overdue',      '=COUNTIFS(' + P + '!P2:P,"<="&TODAY(),' + P + '!P2:P,"<>")', 'Do these first, always'],
    ['Unverified people rows',  '=COUNTIF(' + P + '!AB2:AB,"UNVERIFIED")', 'Never use in conversation'],
    ['Outdated verifications',  '=COUNTIF(' + P + '!AB2:AB,"OUTDATED")+COUNTIF(' + C + '!R2:R,"OUTDATED")', 'Re-verify or delete'],
    ['Opportunities needing counsel', '=COUNTIF(' + O + '!L2:L,"Yes")', 'Do not act until cleared'],
    ['Projects past target date','=COUNTIFS(' + J + '!L2:L,"<"&TODAY(),' + J + '!J2:J,"<>COMPLETE",' + J + '!L2:L,"<>")', 'Cut scope, do not extend'],
    ['', '', ''],
    ['📈 NETWORK', 'Value', 'Target'],
    ['Total contacts',          '=COUNTA(' + P + '!B2:B)', '110 by month 6'],
    ['New contacts this week',  '=COUNTIFS(' + P + '!N2:N,">="&TODAY()-7)', '5'],
    ['Conversations this week', '=COUNTIFS(' + P + '!O2:O,">="&TODAY()-7)', '5'],
    ['A-tier relationships',    '=COUNTIF(' + P + '!H2:H,"A")', '15-20'],
    ['B-tier (connectors)',     '=COUNTIF(' + P + '!H2:H,"B")', '30-40'],
    ['Intros received (total)', '=SUMPRODUCT(--(' + P + '!W2:W<>""))', 'Lagging indicator that it works'],
    ['Avg relationship strength','=IFERROR(ROUND(AVERAGE(' + P + '!Z2:Z),2),0)', 'Rising, not high'],
    ['', '', ''],
    ['🧠 EVIDENCE & REPUTATION', 'Value', 'Target'],
    ['Portfolio hours logged',  '=IFERROR(SUM(' + J + '!H2:H),0)', '186 total'],
    ['Projects complete',       '=COUNTIF(' + J + '!J2:J,"COMPLETE")', '6'],
    ['Research entries',        '=COUNTA(' + R + '!A2:A)', '5/week'],
    ['Research hours this week','=IFERROR(SUMIFS(' + R + '!N2:N,' + R + '!B2:B,">="&TODAY()-7),0)', '7.5'],
    ['Companies on radar',      '=COUNTA(' + C + '!B2:B)', '120 by month 6'],
    ['', '', ''],
    ['🎟️ EVENTS & PIPELINE', 'Value', ''],
    ['Events registered',       '=COUNTIF(' + E + '!H2:H,"REGISTERED")', ''],
    ['Next event',              '=IFERROR(TEXT(MINIFS(' + E + '!D2:D,' + E + '!D2:D,">="&TODAY()),"ddd d mmm"),"none scheduled")', ''],
    ['Events attended',         '=COUNTIF(' + E + '!M2:M,"Yes")', ''],
    ['Applications prepared',   '=COUNTA(' + A + '!A2:A)', 'Prepared, not submitted'],
    ['Live opportunities',      '=COUNTIFS(' + O + '!F2:F,"<>Dead",' + O + '!F2:F,"<>")', ''],
    ['', '', ''],
    ['🧭 BASELINE SCORES (from 01-diagnosis.md §H)', 'Now', 'Month 6 target'],
    ['Technical capability',    68, 82],
    ['Evidence / portfolio',    34, 80],
    ['Network depth',           18, 70],
    ['Reputation / public signal', 12, 62],
    ['', '', ''],
    ['✅ VERIFICATION HEALTH', 'Value', ''],
    ['Sources logged',          '=COUNTA(' + S + '!A2:A)', ''],
    ['Tier 1 sources %',        '=IFERROR(TEXT(COUNTIF(' + S + '!E2:E,"Tier 1*")/COUNTA(' + S + '!A2:A),"0%"),"-")', 'Higher is better'],
    ['Re-verifications due',    '=COUNTIFS(' + S + '!K2:K,"<="&TODAY(),' + S + '!K2:K,"<>")', '']
  ];

  sh.getRange(1, 1, rows.length, 3).setValues(rows);
  sh.getRange('A1').setFontSize(16).setFontWeight('bold');
  [5, 12, 21, 28, 35, 41].forEach(function (r) {
    sh.getRange(r, 1, 1, 3).setFontWeight('bold').setBackground('#1f3a5f').setFontColor('#ffffff');
  });
  sh.getRange('B36:B39').setBackground('#fff8e1'); // baseline scores are hand-entered (rows 36-39, NOT 22-25)
  sh.setColumnWidth(1, 300);
  sh.setColumnWidth(2, 130);
  sh.setColumnWidth(3, 260);
  sh.setFrozenRows(1);

  sh.setConditionalFormatRules([
    rule_('=AND($A6<>"",N($B6)>0)', RED, [sh.getRange('A6:C10')])
  ]);
}

function seedFinancial_(ss) {
  var sh = ss.getSheetByName(SHEETS.FIN);
  if (sh.getLastRow() > 1) return; // don't overwrite real data
  var rows = [
    ['CASH FLOW', '', '', '', '', ''],
    ['Monthly expenses', 1600, '', '', '', 'Stated by you 2026-09-08'],
    ['Monthly income (household)', '', '', '', '', 'Enter'],
    ['Monthly surplus / deficit', '=B4-B3', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['LIQUIDITY', '', '', '', '', ''],
    ['Cash on hand', '', '', '', '', 'Enter'],
    ['Emergency fund (months)', '=IFERROR(B8/B3,"")', 3, 6, 6, 'Months of expenses covered'],
    ['Desired emergency credit buffer', 1500, '', '', '', 'Stated by you'],
    ['Runway (months, no income)', '=IFERROR(B8/B3,"")', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['CREDIT', '', '', '', '', ''],
    ['Total credit limit', '=B15+B17', '', '', '', ''],
    ['Chase Freedom Rise — limit', '', '', '', '', 'Enter current limit'],
    ['Chase Freedom Rise — statement balance', '', '', '', '', ''],
    ['Citi Costco Anywhere Visa — limit', '', '', '', '', 'Enter current limit'],
    ['Citi Costco — statement balance', '', '', '', '', ''],
    ['Aggregate utilization %', '=IFERROR((B16+B18)/B14,"")', '<0.09', '<0.09', '<0.09', 'Reported at statement date'],
    ['Highest single-card utilization %', '', '<0.29', '<0.29', '<0.29', 'FICO scores this separately'],
    ['Credit score (issuer-provided)', '', '', '', '', 'Note which score model'],
    ['Accounts opened in last 24 months', '', '', '', '', 'Chase 5/24 counter'],
    ['', '', '', '', '', ''],
    ['DEBT & INVESTMENT', '', '', '', '', ''],
    ['Revolving debt carried (interest-bearing)', 0, 0, 0, 0, 'Target is always 0'],
    ['Student / other debt', '', '', '', '', ''],
    ['Retirement / brokerage', '', '', '', '', ''],
    ['Future business capital set aside', 0, '', '', '', 'See 15-business-preparation.md']
  ];
  sh.getRange(2, 1, rows.length, 6).setValues(rows);
  ['A2','A7','A13','A24'].forEach(function (a) {
    sh.getRange(a).offset(0, 0, 1, 6).setFontWeight('bold').setBackground('#e8eef5');
  });
  sh.setColumnWidth(1, 300);
  sh.setColumnWidth(6, 300);
}
