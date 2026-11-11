"""Builds print/BAGGA_PRINT_PACK.html (then render to PDF with print/render_pdf.js).

Printer-friendly: works in black & white; one accent colour. US Letter.
Run from the project folder:  python3 print/build_print_pack.py && node print/render_pdf.cjs
"""
import datetime as dt
import html
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
cal = json.loads((HERE / "calendar.json").read_text())
E = html.escape

CSS = r"""
@page { size: Letter; margin: 0.45in; }
@page land { size: Letter landscape; margin: 0.4in; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; font-size: 11pt; background: #fff; }
.page { page-break-after: always; break-after: page; position: relative; min-height: 9.9in; }
.page.land { page: land; min-height: 7.5in; }
.page:last-child { page-break-after: auto; break-after: auto; }
h1 { font-size: 24pt; margin: 0 0 4px; color: #1F3864; letter-spacing: .3px; }
h2 { font-size: 17pt; margin: 0 0 4px; color: #1F3864; }
h3 { font-size: 12pt; margin: 10px 0 4px; }
.sub { color: #444; font-size: 10pt; margin-bottom: 12px; }
.tag { display:inline-block; background:#1F3864; color:#fff; font-weight:700; font-size:9pt; padding:3px 8px; border-radius:4px; letter-spacing:.5px; }
.foot { position:absolute; bottom:0; left:0; right:0; font-size:8pt; color:#777; border-top:1px solid #ccc; padding-top:3px; display:flex; justify-content:space-between; }
/* flow components */
.flow { display:flex; flex-direction:column; align-items:center; gap:0; }
.node { border:2px solid #1F3864; border-radius:10px; padding:8px 14px; text-align:center; background:#fff; min-width:2.4in; max-width:6.6in; font-size:10.5pt; }
.node b { display:block; font-size:11.5pt; }
.node.start { background:#1F3864; color:#fff; border-radius:30px; }
.node.good { background:#E2EFDA; border-color:#3a7d22; }
.node.stop { background:#F8CBAD; border-color:#c00000; }
.node.warn { background:#FFF2CC; border-color:#b08900; }
.arrow { font-size:18pt; line-height:20px; color:#1F3864; height:22px; }
.dec { width:2.5in; height:1.15in; background:#D9E1F2; clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); display:flex; align-items:center; justify-content:center; text-align:center; font-weight:700; font-size:10pt; padding:0 .45in; }
.branch { display:grid; grid-template-columns: 1fr 1fr; gap:18px; width:100%; margin-top:2px; }
.branch > div { display:flex; flex-direction:column; align-items:center; }
.yes, .no { font-weight:700; font-size:9.5pt; letter-spacing:.5px; padding:1px 8px; border-radius:3px; margin:2px 0; }
.yes { background:#3a7d22; color:#fff; } .no { background:#c00000; color:#fff; }
.row { display:flex; gap:10px; align-items:stretch; justify-content:center; }
.harrow { font-size:20pt; color:#1F3864; align-self:center; }
.row.op .node { min-width:1.15in; font-size:9pt; padding:6px 8px; }
.row.op .harrow { font-size:14pt; }
.row.op.tight { gap:4px; }
.row.op.tight .node { min-width:0.82in; font-size:8.5pt; padding:5px 6px; }
.row.op.tight .harrow { font-size:11pt; }
.ladder { display:grid; grid-template-columns: 3.3in 0.7in 2.7in; align-items:center; row-gap:0; }
.ladder .q { background:#D9E1F2; border:2px solid #1F3864; border-radius:8px; padding:7px 10px; font-weight:700; font-size:10.5pt; }
.ladder .lab { text-align:center; font-weight:800; font-size:9pt; }
.ladder .down { grid-column:1; text-align:center; font-size:9pt; font-weight:800; color:#3a7d22; padding:3px 0; }
/* checklists */
.chk { list-style:none; padding:0; margin:0; }
.chk li { display:flex; gap:10px; align-items:flex-start; padding:6px 0; border-bottom:1px dotted #bbb; font-size:11pt; }
.box { flex:0 0 auto; width:16px; height:16px; border:2px solid #111; border-radius:3px; margin-top:2px; }
.bigbox { width:26px; height:26px; border:3px solid #111; border-radius:5px; flex:0 0 auto; }
.goal { border:2.5px solid #111; border-radius:10px; padding:8px 12px; margin-bottom:9px; }
.goal .hd { display:flex; align-items:center; gap:10px; font-size:14pt; font-weight:800; }
.goal .hd .num { background:#1F3864; color:#fff; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14pt; }
.line { border-bottom:1.5px solid #888; height:21px; margin:1px 0; }
.small { font-size:8.5pt; color:#444; }
.grid2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
table { border-collapse:collapse; width:100%; }
th, td { border:1px solid #777; padding:4px 5px; vertical-align:top; }
th { background:#1F3864; color:#fff; font-size:9pt; text-align:left; }
.wk td { font-size:8.8pt; line-height:1.25; height:0.9in; }
.wk td.d { width:0.75in; font-weight:700; font-size:9pt; text-align:center; }
.wk .cb { display:inline-block; width:11px; height:11px; border:1.6px solid #111; border-radius:2px; margin-right:4px; vertical-align:-1px; }
.wk .dn { color:#3a7d22; font-style:italic; display:block; margin-top:2px; }
.wk .mn { color:#555; font-weight:700; }
.wk tr.ms td { background:#FFF2CC; }
.pill { display:inline-block; border:1.5px solid #1F3864; border-radius:14px; padding:2px 9px; margin:2px; font-size:9.5pt; }
.stack { display:flex; flex-direction:column-reverse; width:2.6in; border:2px solid #111; }
.stack div { display:flex; align-items:center; justify-content:space-between; padding:0 8px; font-size:9.5pt; border-top:1px solid #fff; color:#fff; font-weight:700; }
.big { font-size:30pt; font-weight:800; color:#1F3864; }
.poster li { font-size:13pt; padding:9px 0; }
.stopx { font-weight:800; color:#c00000; width:1.4in; flex:0 0 auto; }
.insteadx { color:#3a7d22; font-weight:700; }
.score td { height:22px; }
.dash td { height:24px; text-align:center; font-size:9pt; }
.steps { display:flex; align-items:flex-end; gap:6px; height:3.2in; }
.steps div { flex:1; border:2px solid #1F3864; border-radius:6px 6px 0 0; background:#D9E1F2; padding:6px; font-size:9pt; display:flex; flex-direction:column; justify-content:flex-start; }
.steps div b { font-size:10.5pt; color:#1F3864; }
"""


def foot(label):
    return f'<div class="foot"><span>Bagga Holdings · {E(label)}</span><span>Print pack v1 · generated {dt.date(2026, 11, 9):%d %b %Y}</span></div>'


def page(inner, label, land=False):
    return f'<section class="page{" land" if land else ""}">{inner}{foot(label)}</section>'


pages = []

# 1 — Plan on one page
pages.append(page("""
<span class="tag">THE PLAN ON ONE PAGE</span>
<h1>90 days. Three goals a day. One industry.</h1>
<div class="sub">Day 1 = Tue 10 Nov 2026 · Day 90 = Sun 7 Feb 2027 · Full detail: files 01, 10, 11</div>
<div class="row" style="margin:10px 0 14px">
  <div class="node start"><b>DAYS 1-30</b>FOUNDATION<br><span class="small" style="color:#fff">counsel · résumé · thesis · target list · model</span></div>
  <div class="harrow">➜</div>
  <div class="node"><b>DAYS 31-60</b>CONVERSATIONS<br><span class="small">field test · industry locked · operators</span></div>
  <div class="harrow">➜</div>
  <div class="node good"><b>DAYS 61-90</b>PIPELINE-READY<br><span class="small">thesis memo · packets queued · review</span></div>
</div>
<div class="grid3">
  <div class="goal"><div class="hd"><span class="num">1</span>CAREER</div><div class="small">Prepare &amp; queue. M&amp;A advisory role on EAD day.</div></div>
  <div class="goal"><div class="hd"><span class="num">2</span>ACQUISITION</div><div class="small">Fire &amp; life-safety ITM. Alternate: commercial pest.</div></div>
  <div class="goal"><div class="hd"><span class="num">3</span>NETWORK / $</div><div class="small">Follow-ups first. Reserves before deals.</div></div>
</div>
<h3>Milestones</h3>
<table>
<tr><th style="width:.6in">Day</th><th style="width:1.1in">Date</th><th>Milestone</th><th style="width:.5in">✔</th></tr>
""" + "".join(f'<tr><td><b>{d}</b></td><td>{(dt.date(2026,11,10)+dt.timedelta(days=int(d)-1)):%a %d %b}</td><td>{E(t)}</td><td><span class="box" style="display:inline-block"></span></td></tr>' for d, t in cal["milestones"].items()) + """
</table>
<div class="grid2" style="margin-top:14px">
 <div class="goal" style="border-color:#c00000"><div class="hd" style="color:#c00000">🔒 THE ONE RULE</div>
 Anything of value for another party, any signature, any fee, any equity → <b>counsel first, in writing.</b></div>
 <div class="goal" style="border-color:#3a7d22"><div class="hd" style="color:#3a7d22">✔ THE TARGET</div>
 Cincinnati · $0.6-1.5m EBITDA · ≥50% inspection revenue · 4.5-6.0x · signed operator · DSCR ≥1.25x.</div>
</div>
""", "Plan on one page"))

# 2 — Daily card
goal_block = lambda n, t: f"""
<div class="goal"><div class="hd"><span class="bigbox"></span><span class="num">{n}</span>{t}<span style="margin-left:auto;font-size:11pt;font-weight:400">⏱ ______ min</span></div>
<div class="small" style="margin-top:6px">ACTION</div><div class="line"></div><div class="line"></div>
<div class="small">DELIVERABLE</div><div class="line"></div>
<div class="small">DONE WHEN …</div><div class="line"></div></div>"""
pages.append(page(f"""
<div style="display:flex;justify-content:space-between;align-items:flex-end">
<div><span class="tag">DAILY CARD</span><h1>Today: exactly three.</h1></div>
<div style="text-align:right;font-size:12pt">DAY <b>____</b> / 90 &nbsp;&nbsp; DATE ____________<br><span class="small">Energy:</span> ① ② ③ ④ ⑤</div></div>
{goal_block(1, "CAREER / INCOME")}
{goal_block(2, "ACQUISITION INTELLIGENCE")}
{goal_block(3, "NETWORK / FINANCIAL FOUNDATION")}
<div class="grid2">
 <div class="goal"><b>Score today</b> &nbsp; ⓪ ① ② ③<div class="small" style="margin-top:6px">Blocker</div><div class="line"></div></div>
 <div class="goal" style="border-color:#c00000"><b>🔒 Counsel needed today?</b><br><span class="box" style="display:inline-block"></span> No &nbsp; <span class="box" style="display:inline-block"></span> Yes → added to counsel list</div>
</div>
<div class="goal" style="border-style:dashed"><b>PARKING LOT</b> <span class="small">— ideas I am NOT starting today</span><div class="line"></div><div class="line"></div></div>
""", "Daily card — print one per day or laminate"))

# 3 — Daily routine flow
pages.append(page("""
<span class="tag">DAILY ROUTINE</span><h1>How every day runs</h1><div class="sub">60–120 focused minutes. Stop at the third tick.</div>
<div class="flow">
 <div class="node start"><b>MORNING · 5 min</b>Read today's three goals (file 10 / weekly page)</div><div class="arrow">▼</div>
 <div class="dec">Do I have 60+ minutes today?</div>
 <div class="branch">
  <div><span class="yes">YES</span><div class="arrow">▼</div>
    <div class="node"><b>① CAREER · 20-45 min</b>résumé · answers · employer research</div><div class="arrow">▼</div>
    <div class="node"><b>② ACQUISITION · 30-60 min</b>case · target list · skill · thesis</div><div class="arrow">▼</div>
    <div class="node"><b>③ NETWORK / $ · 15-30 min</b>follow-ups · contacts · money task</div></div>
  <div><span class="no">NO — 30 min day</span><div class="arrow">▼</div>
    <div class="node warn"><b>MINIMUM VIABLE DAY</b>Send every follow-up that's due. Nothing else.</div><div class="arrow">▼</div>
    <div class="node">Move ① and ② to tomorrow's Parking Lot<br><span class="small">Missing a day doesn't break the habit — skipping the restart does.</span></div></div>
 </div>
 <div class="arrow">▼</div>
 <div class="node"><b>CLOSE · 5 min</b>Tick boxes · write blocker · glance at tomorrow</div><div class="arrow">▼</div>
 <div class="dec">New idea or project popped up?</div>
 <div class="branch">
  <div><span class="yes">YES</span><div class="arrow">▼</div><div class="node warn">Write it in the PARKING LOT.<br><b>Do not start it.</b></div></div>
  <div><span class="no">NO</span><div class="arrow">▼</div><div class="node good"><b>DONE. STOP.</b><br>Time with family / health</div></div>
 </div>
</div>
""", "Daily routine flowchart"))

# 4 — Counsel gate
pages.append(page("""
<span class="tag" style="background:#c00000">🔒 COUNSEL GATE</span><h1>Before you act — check this</h1>
<div class="sub">Not legal advice. A sorting tool so you never act first and ask later. File 08.</div>
<div class="flow">
 <div class="node start"><b>I want to take a step</b>(meet, send, sign, help, own, invest, receive)</div><div class="arrow">▼</div>
 <div class="dec">Is it ONLY reading, studying, modelling or planning for myself?</div>
 <div class="branch">
  <div><span class="yes">YES</span><div class="arrow">▼</div><div class="node good"><b>PREPARATION</b>Go ahead.</div></div>
  <div><span class="no">NO</span><div class="arrow">▼</div>
   <div class="dec" style="width:3.0in;height:1.3in;padding:0 .6in">Value for someone? Signing, money, equity or fees?</div>
   <div class="branch">
    <div><span class="no">NO / UNSURE</span><div class="arrow">▼</div><div class="node warn">Treat as 🔒 if unsure</div></div>
    <div><span class="yes">YES</span><div class="arrow">▼</div><div class="node warn">Has counsel answered THIS activity in writing?</div></div>
   </div></div>
 </div>
 <div class="arrow">▼</div>
 <div class="grid2" style="width:100%">
  <div class="node good"><b>Written YES</b>Proceed exactly within the answer</div>
  <div class="node stop"><b>NO written answer → STOP</b>Add to counsel list · batch for next consult</div>
 </div>
</div>
<h3 style="margin-top:16px">Always 🔒 — never without counsel</h3>
<div class="grid2">
<ul class="chk">
 <li><span class="box"></span>"Sample", "trial" or "take a look at this deal" work for a firm</li>
 <li><span class="box"></span>Any fee: closing, management, finder, success</li>
 <li><span class="box"></span>Equity, carry, options, reimbursement</li>
 <li><span class="box"></span>Forming an LLC, EIN, business bank account</li></ul>
<ul class="chk">
 <li><span class="box"></span>Signing an NDA or LOI as a principal</li>
 <li><span class="box"></span>Officer / manager / director roles</li>
 <li><span class="box"></span>Personal guarantees</li>
 <li><span class="box"></span>Any job application or offer before the EAD</li></ul>
</div>
<div class="node stop" style="max-width:none;margin-top:10px"><b>NEVER</b> nominee ownership via spouse/relative · never say "authorised to work" · never personal credit for deal equity</div>
""", "Counsel gate flowchart"))

# 5 — Deal screen
steps=[("Inside Cincinnati MSA (or within 2 hours)?","NO","Park for later hubs","warn"),
       ("At least 50% inspection / service / monitoring revenue?","NO","Construction contractor — KILL","stop"),
       ("Adjusted EBITDA $0.6-1.5m AFTER paying a market-rate GM?","NO","Too small for GM + debt, or too big to win — KILL","stop"),
       ("Certified #2 (licence holder) who will stay?","NO","Only with licence-transfer plan as a closing condition","warn"),
       ("No customer above 10% of revenue?","NO","Concentration — re-price or KILL","stop"),
       ("No AFFF / foam / PFAS history?","NO","KILL, or counsel + escrow + asset deal","stop"),
       ("Add-backs under 20% of EBITDA, all documented?","NO","Re-price on documented EBITDA only","warn"),
       ("Price at or below 6.0x and Base DSCR at least 1.25x?","NO","Re-price or WALK","stop")]
lad=""
for i,(q,no,out,cls) in enumerate(steps):
    lad+=f'<div class="q">{i+1}. {E(q)}</div><div class="lab"><span class="no">{no}</span> ➜</div><div class="node {cls}" style="min-width:0">{E(out)}</div>'
    lad+='<div class="down">YES ▼</div><div></div><div></div>'
pages.append(page(f"""
<span class="tag">DEAL SCREEN</span><h1>Kill or keep — in 10 minutes</h1><div class="sub">Run every target through this before spending an hour on it. One red box = stop.</div>
<div class="node start" style="max-width:3.3in">NEW TARGET · name · city · source URL</div><div style="width:3.3in;text-align:center;font-weight:800;color:#3a7d22">▼</div>
<div class="ladder">{lad}</div>
<div class="node good" style="max-width:3.3in;min-width:0"><b>KEEP → full model</b>file 06 · Deal_Template · then the six gates</div>
<h3>Write the answers here</h3>
<table class="score"><tr><th>Target</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>Verdict</th></tr>
""" + "".join("<tr><td style='width:2in'></td>"+"<td></td>"*9+"</tr>" for _ in range(4)) + """</table>
""", "Deal screening flowchart"))

# 6 — Six gates before LOI
pages.append(page("""
<span class="tag">BEFORE ANY LOI</span><h1>Six gates. All green, or no LOI.</h1><div class="sub">File 08 §4 · Realistic first LOI ≈ 2029-30</div>
<div class="steps">
 <div style="height:35%"><b>1 LEGAL</b>Written counsel answers on ownership, fees, officer role, guarantees</div>
 <div style="height:47%"><b>2 STATUS</b>EAD with 12+ months left, or green card</div>
 <div style="height:59%"><b>3 PERSONAL</b>6+ months reserves untouched; spouse agrees</div>
 <div style="height:71%"><b>4 OPERATOR</b>Signed operator; references verified</div>
 <div style="height:83%"><b>5 CAPITAL</b>2+ written equity indications + 1 lender conversation</div>
 <div style="height:100%;background:#E2EFDA;border-color:#3a7d22"><b>6 TARGET</b>Passes screen; DSCR ≥1.25x Base, ≥1.0x Downside; price ≤6.0x</div>
</div>
<h3>Gate checklist</h3>
<table class="score"><tr><th>Gate</th><th>Evidence (document / date)</th><th style="width:.8in">Green?</th></tr>
""" + "".join(f"<tr><td>{g}</td><td></td><td></td></tr>" for g in ["1 Legal", "2 Status", "3 Personal", "4 Operator", "5 Capital", "6 Target"]) + """</table>
<h3>IC rules (written before deal #1)</h3>
<div class="grid2"><ul class="chk">
<li><span class="box"></span>Entry ≤ 6.0x adjusted EBITDA</li><li><span class="box"></span>Owner replacement cost subtracted</li>
<li><span class="box"></span>Senior ≤ 2.25x · total ≤ 3.25x</li><li><span class="box"></span>Min DSCR ≥ 1.25x Base / ≥ 1.0x Downside</li><li><span class="box"></span>Investor net IRR ≥ 20% Base</li></ul>
<ul class="chk"><li><span class="box"></span>Guarantee capped; ≤ liquid net worth</li><li><span class="box"></span>No deal without a signed operator</li>
<li><span class="box"></span>No action outside written counsel clearance</li><li><span class="box"></span>Add-backs ≤ 20% unless documented</li><li><span class="box"></span>No unresolved AFFF/PFAS history</li></ul></div>
""", "Six gates before an LOI"))

# 7 — Capital stack
stack = [("Senior term loan", 39, "#1F3864", "$2.25m"), ("Seller note", 16, "#2F5597", "$0.92m"), ("Seller rollover", 9, "#548235", "$0.53m"),
         ("Operator + your fee", 2, "#7F6000", "$0.13m"), ("Investor equity", 34, "#3a7d22", "$1.93m")]
stack_html = "".join(f'<div style="height:{max(h,4)*0.055}in;background:{c}"><span>{E(n)}</span><span>{v}</span></div>' for n, h, c, v in stack)
pages.append(page(f"""
<span class="tag">CAPITAL STACK</span><h1>How a $5.25m deal gets paid for</h1><div class="sub">Base case, file 06 · total uses $5.75m incl. fees and cash · NO SBA (citizens only since 1-Mar-2026)</div>
<div class="row" style="justify-content:flex-start;gap:30px;margin-top:10px">
 <div class="stack">{stack_html}</div>
 <div style="flex:1">
  <div class="big">$0</div><div><b>your cash at close.</b> Your stake = rolled 1% fee + promote.</div>
  <h3>Scenario check</h3>
  <table><tr><th></th><th>Cons.</th><th>Base</th><th>Aggr.</th><th>Down</th></tr>
  <tr><td>Price</td><td>$3.56m</td><td><b>$5.25m</b></td><td>$9.00m</td><td>$5.25m</td></tr>
  <tr><td>Min DSCR</td><td>1.41x</td><td><b>1.26x</b></td><td style="background:#F8CBAD">1.19x</td><td style="background:#F8CBAD">0.93x</td></tr>
  <tr><td>Investor net IRR</td><td>13.8%</td><td><b>21.9%</b></td><td>27.8%</td><td>7.7%</td></tr>
  <tr><td>You, pre-tax 5 yrs</td><td>$0.48m</td><td><b>$1.61m</b></td><td>$3.53m</td><td>$0.52m</td></tr>
  <tr><td>IC gate</td><td>PASS</td><td><b>PASS</b></td><td>FAIL</td><td>FAIL</td></tr></table>
 </div>
</div>
<h3>Three things the model says</h3>
<ul class="chk">
<li><span class="box"></span><b>More debt fails.</b> 2.75x senior can't clear 1.25x DSCR even if everything goes right.</li>
<li><span class="box"></span><b>Year 3 is the pinch</b> — the seller note starts amortising. Negotiate 3 interest-only years or springing standby.</li>
<li><span class="box"></span><b>A 25% EBITDA loss breaks it.</b> Protect the licence holder and key techs before close.</li></ul>
<h3>Rule of thumb (Year-3 DSCR)</h3>
<table><tr><th>EBITDA change</th><th>1.50x senior</th><th>1.75x</th><th>2.00x</th><th>2.25x</th><th>2.50x</th></tr>
<tr><td>0%</td><td>1.57</td><td>1.45</td><td>1.34</td><td>1.25</td><td>1.17</td></tr>
<tr><td>−10%</td><td>1.41</td><td>1.29</td><td>1.20</td><td style="background:#FFF2CC">1.12</td><td style="background:#FFF2CC">1.05</td></tr>
<tr><td>−20%</td><td>1.24</td><td>1.14</td><td style="background:#FFF2CC">1.06</td><td style="background:#F8CBAD">0.99</td><td style="background:#F8CBAD">0.92</td></tr>
<tr><td>−30%</td><td>1.08</td><td style="background:#F8CBAD">0.99</td><td style="background:#F8CBAD">0.92</td><td style="background:#F8CBAD">0.86</td><td style="background:#F8CBAD">0.80</td></tr></table>
""", "Capital stack and scenarios"))

# 8 — Operator
pages.append(page("""
<span class="tag">OPERATING PARTNER</span><h1>Find, test, verify</h1><div class="sub">File 07 · No signing or paid work until counsel clears it</div>
<div class="row op">
 <div class="node"><b>1 SOURCE</b>Managers at recently acquired local firms</div><div class="harrow">➜</div>
 <div class="node"><b>2 SCREEN</b>Must-haves below</div><div class="harrow">➜</div>
 <div class="node"><b>3 INTERVIEW</b>20 questions</div><div class="harrow">➜</div>
 <div class="node"><b>4 VERIFY</b>Licences · P&amp;L · backdoor refs</div><div class="harrow">➜</div>
 <div class="node good"><b>5 TERMS</b>Via counsel</div>
</div>
<div class="grid2" style="margin-top:12px">
<div><h3>Must-haves</h3><ul class="chk">
<li><span class="box"></span>10+ yrs fire &amp; life safety</li><li><span class="box"></span>3+ yrs owning a branch P&amp;L ≥ $3m, 15+ techs</li>
<li><span class="box"></span>NFPA 25 / 72 / 10 fluency; Ohio certification</li><li><span class="box"></span>Has hired AND retained technicians here</li>
<li><span class="box"></span>Priced inspection contracts; drove repair conversion</li><li><span class="box"></span>Will co-invest $50-100k</li><li><span class="box"></span>Lives ≤45 min from Cincinnati</li></ul></div>
<div><h3>Verification</h3><ul class="chk">
<li><span class="box"></span>Ohio SFM / KY / NICET records checked</li><li><span class="box"></span>Employment dates &amp; titles in writing</li>
<li><span class="box"></span>Redacted P&amp;L or budget they authored</li><li><span class="box"></span>2 backdoor references (tech, customer)</li>
<li><span class="box"></span>Background &amp; litigation check (consent)</li><li><span class="box"></span>Story consistent everywhere</li></ul></div></div>
<h3>Starting terms</h3>
<div><span class="pill">~$175k loaded pay</span><span class="pill">0-30% bonus on EBITDA + retention</span><span class="pill">$50-100k co-invest</span><span class="pill">7.5% profits interest</span><span class="pill">4-5 yr vesting, 1-yr cliff</span><span class="pill">Good/bad leaver</span><span class="pill">Board removal rights</span><span class="pill">NOT 50/50 by default</span></div>
<h3>Reference call — 5 questions</h3><ol style="font-size:10.5pt;margin-top:2px"><li>In what capacity, for how long?</li><li>What would you hire them for again?</li><li>What would you never hire them for?</li><li>How did their team do after they left?</li><li>1-10 recommendation — what makes it a 10?</li></ol>
""", "Operating partner checklist"))

# 9 — Case study card
pages.append(page("""
<span class="tag">CASE STUDY CARD</span><h1>One case, 45-60 minutes</h1><div class="sub">File 05 · Rule: no source = write "n/d"</div>
<div style="font-size:11pt">CASE: __________________________________________ &nbsp; YEAR: ______ &nbsp; SOURCE IDs: ____________</div>
<div class="row op tight" style="margin:10px 0">
 <div class="node"><b>1 FACTS</b>10 min</div><div class="harrow">➜</div><div class="node"><b>2 ECONOMICS</b>10 min</div><div class="harrow">➜</div>
 <div class="node"><b>3 SELLER</b>5 min</div><div class="harrow">➜</div><div class="node"><b>4 BUYER EDGE</b>10 min</div><div class="harrow">➜</div>
 <div class="node"><b>5 RISKS</b>10 min</div><div class="harrow">➜</div><div class="node good"><b>6 VERDICT</b>10 min</div></div>
<table class="score">
<tr><th style="width:2.2in">Economics</th><th>Value</th><th>Source / n/d</th></tr>
""" + "".join(f"<tr><td>{x}</td><td></td><td></td></tr>" for x in ["Enterprise value", "Revenue", "Adjusted EBITDA", "EV / EBITDA", "Synergy-adjusted multiple", "Financing (debt / equity / seller / earn-out)"]) + """</table>
<table class="score" style="margin-top:8px"><tr><th style="width:.4in"></th><th>Question</th><th>My answer</th></tr>
""" + "".join(f"<tr><td><b>{k}</b></td><td style='width:2.4in'>{E(q)}</td><td></td></tr>" for k, q in [("A", "What was acquired?"), ("B", "Why was the seller selling?"), ("C", "What made it attractive?"), ("F", "Buyer's competitive advantage?"), ("G", "Operational improvements possible?"), ("H", "Risks overlooked?"), ("I", "Would I have bought it? ☐Y ☐N  Deciding number:"), ("J", "What would I negotiate differently?")]) + """</table>
<div class="goal" style="margin-top:8px"><b>ONE LESSON TO KEEP:</b><div class="line"></div></div>
""", "Case study card"))

# 10 — Weekly review + scorecard
rows = ["Goals completed (of 21)", "Focused minutes (500+)", "New contacts (2)", "Follow-ups on time (100%)", "Conversations (1)", "Case study (1)", "Target rows (per plan)", "🔒 Counsel-gate breaches (0)", "Sleep ≥7h nights (6)", "Time with spouse (≥1 block)"]
pages.append(page("""
<span class="tag">SUNDAY · WEEKLY REVIEW</span><h1>Score the week — 25 minutes</h1><div class="sub">WEEK ____ &nbsp;&nbsp; DATES ______________ · Score each 0 / 1 / 2 · 16+ green · 12-15 amber · &lt;12 red</div>
<table class="score"><tr><th>Metric (target)</th><th>M</th><th>T</th><th>W</th><th>T</th><th>F</th><th>S</th><th>S</th><th>Total</th><th>0/1/2</th></tr>
""" + "".join(f"<tr><td>{E(r)}</td>" + "<td></td>" * 9 + "</tr>" for r in rows) + """
<tr><td><b>WEEK SCORE / 20</b></td><td colspan="8"></td><td></td></tr></table>
<h3>Eight questions</h3><ol style="font-size:10.5pt;line-height:1.75">
<li>Did I do exactly three goals each day? Where did I add a fourth? ______________________</li>
<li>Which goal did I avoid, and why? ______________________________________________</li>
<li>What did I learn that changes the thesis (fire vs pest, price, operator)? ____________</li>
<li>Which relationship moved forward? Which went cold? __________________________</li>
<li>Anything near the 🔒 line? On the counsel list? ☐ Yes ☐ None</li>
<li>Risk register: any score changed? ☐ No ☐ Yes → __________________________</li>
<li>Money: reserve bucket on track? ______ % of goal</li>
<li>What will I STOP doing next week? _______________________________________</li></ol>
<div class="grid2"><div class="goal"><b>Next week's case:</b><div class="line"></div><b>5 names for outreach:</b><div class="line"></div></div>
<div class="goal"><b>Protected family block (day/time):</b><div class="line"></div><b>One win this week:</b><div class="line"></div></div></div>
""", "Weekly review and scorecard"))

# 11 — Dashboard (landscape)
dash_rows = [("Target list rows", "100"), ("Case studies done", "13"), ("Contacts in CRM", "30"), ("Conversations held", "10"), ("Operator candidates", "10"), ("Application packets queued", "10"), ("Interview answers ready", "12"), ("Reserve % of goal", "—"), ("Weekly score /20", "16+")]
pages.append(page("""
<span class="tag">WALL DASHBOARD</span><h1>Progress — update every Sunday</h1>
<table class="dash"><tr><th style="width:2.2in">Metric</th><th>Target</th>""" + "".join(f"<th>W{i}</th>" for i in range(1, 14)) + "</tr>" +
"".join(f"<tr><td style='text-align:left'><b>{E(m)}</b></td><td><b>{t}</b></td>" + "<td></td>" * 13 + "</tr>" for m, t in dash_rows) + """
</table>
<div class="grid3" style="margin-top:14px">
<div class="goal"><b>Industry status</b><br><span class="box" style="display:inline-block"></span> Fire locked (Day 43) &nbsp; <span class="box" style="display:inline-block"></span> Switched to pest</div>
<div class="goal"><b>Counsel status</b><br><span class="box" style="display:inline-block"></span> Consult booked &nbsp; <span class="box" style="display:inline-block"></span> Held &nbsp; <span class="box" style="display:inline-block"></span> Answers filed</div>
<div class="goal"><b>EAD status</b><br><span class="box" style="display:inline-block"></span> Pending &nbsp; <span class="box" style="display:inline-block"></span> Received → run EAD-day kit</div></div>
""", "Wall dashboard", land=True))

# 12 — Stop-doing poster
stops = [("A 4th goal in a day", "Park it. Tomorrow's list."), ("Checking a new industry", "One alternate only (pest)."), ("Building tools before using them", "Use the sheet you have."),
         ("Reading without output", "Every read → 3 bullets."), ("Asking for jobs in outreach", "Ask about their judgment."), ("Numbers without a source", "\"n/d\" or S-xx. Always."),
         ("Saying \"authorised to work\"", "Approved phrasing only."), ("\"Sample work\" for a firm", "🔒 Counsel first."), ("Late nights that cost sleep", "Stop at the 3rd tick."),
         ("Reserves for deal costs", "Capped deal fund only."), ("Talking about $25m", "Talk about the next 90 days.")]
pages.append(page("""
<span class="tag" style="background:#c00000">✋ STOP-DOING LIST</span><h1>Post this where you work</h1>
<ul class="chk poster">""" + "".join(f'<li><span class="stopx">✋ STOP</span><span style="flex:1"><b>{E(a)}</b></span><span class="insteadx">➜ {E(b)}</span></li>' for a, b in stops) + """</ul>
<div class="node stop" style="max-width:none;margin-top:16px;font-size:13pt"><b>Non-negotiables</b>health · marriage · time with parents · financial safety · integrity · no reckless leverage · never one business = all our wealth</div>
""", "Stop-doing poster"))

# 13 — Money waterfall
pages.append(page("""
<span class="tag">HOUSEHOLD MONEY</span><h1>Fill the buckets in order</h1><div class="sub">File 14 · Liquid, after-tax dollars only count for safety</div>
<div class="flow">
""" + '<div class="arrow">▼</div>'.join(f'<div class="node{c}" style="min-width:5in"><b>{n}</b>{t}</div>' for n, t, c in [
    ("1 · One-month buffer", "checking account", ""), ("2 · Kill debt above ~7%", "", ""), ("3 · Emergency fund — 6 months", "separate account", ""),
    ("4 · Insurance", "health · term life ×2 · disability · umbrella", ""), ("5 · Spouse's goal: 2-3 YEARS of expenses", "high-yield savings / T-bills", " good"),
    ("6 · Retirement accounts", "match first", ""), ("7 · Parents' fund", "named, dated goal", ""), ("8 · Deal-readiness fund — CAPPED", "never from reserves", " warn"),
    ("9 · Children (529) when planned", "", ""), ("10 · Taxable index investing", "", "")]) + """
</div>
<h3>Protection checklist</h3><div class="grid2"><ul class="chk">
<li><span class="box"></span>Term life — both</li><li><span class="box"></span>Disability insurance</li><li><span class="box"></span>Umbrella liability</li></ul>
<ul class="chk"><li><span class="box"></span>Wills, POA, healthcare directives</li><li><span class="box"></span>Beneficiaries on every account</li><li><span class="box"></span>Estate attorney: QDOT question (non-citizen spouse)</li></ul></div>
""", "Household money waterfall"))

# 14+ — weekly calendar pages (landscape)
days = cal["days"]
weeks = {}
for d in days:
    weeks.setdefault(d["week"], []).append(d)
ms = {int(k): v for k, v in cal["milestones"].items()}
for w, dlist in weeks.items():
    rows_html = ""
    for d in dlist:
        date = dt.date.fromisoformat(d["date"])
        cls = ' class="ms"' if d["day"] in ms else ""
        cells = ""
        for gl in d["goals"]:
            cells += f'<td><span class="cb"></span>{E(gl["action"])} <span class="mn">· {gl["min"]}m</span><span class="dn">✔ {E(gl["done"])}</span></td>'
        star = f'<br><span style="color:#b08900">★</span>' if d["day"] in ms else ""
        rows_html += f'<tr{cls}><td class="d">Day {d["day"]}<br>{date:%a}<br>{date:%d %b}<br><span class="small">{d["total"]} min</span>{star}</td>{cells}</tr>'
    first, last = dt.date.fromisoformat(dlist[0]["date"]), dt.date.fromisoformat(dlist[-1]["date"])
    mtxt = " · ".join(f"Day {k}: {v}" for k, v in ms.items() if dlist[0]["day"] <= k <= dlist[-1]["day"])
    pages.append(page(f"""
<div style="display:flex;justify-content:space-between;align-items:flex-end">
<div><span class="tag">WEEK {w} OF 13</span> <h2 style="display:inline;margin-left:8px">{first:%a %d %b} – {last:%a %d %b %Y}</h2></div>
<div class="small" style="text-align:right">Case: <b>{E(cal['cases'][str(w)])}</b><br>Skill: <b>{E(cal['skills'][str(w)])}</b></div></div>
{f'<div class="small" style="background:#FFF2CC;padding:3px 6px;margin:4px 0">★ {E(mtxt)}</div>' if mtxt else '<div style="height:6px"></div>'}
<table class="wk"><tr><th style="width:.75in">Day</th><th>① CAREER / INCOME</th><th>② ACQUISITION INTELLIGENCE</th><th>③ NETWORK / FINANCIAL FOUNDATION</th></tr>{rows_html}</table>
<div class="small" style="margin-top:4px">Week score: ____ / 20 &nbsp;·&nbsp; 🔒 counsel items this week: ____ &nbsp;·&nbsp; Exactly three goals a day — anything else goes in the Parking Lot.</div>
""", f"90-day calendar · week {w}", land=True))

doc = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bagga Print Pack</title><style>{CSS}</style></head><body>{''.join(pages)}</body></html>"""
(HERE / "BAGGA_PRINT_PACK.html").write_text(doc)
print("pages:", len(pages))
