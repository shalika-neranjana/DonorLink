"""Generate the three blank usability-study workbooks (openpyxl).

    python build_workbooks.py [output_dir]          # default: ..\\results\\templates? no -> ..\\ (usability root)

Outputs (blank templates, NO participant data, NO fabricated results):
    observation-sheet.xlsx   data entry during sessions (Workbook A)
    results-analysis.xlsx    metrics + SUS + charts from pasted data (Workbook B)
    issue-log.xlsx           usability issue register + severity scale (Workbook C)

Layout contract: the "Sessions", "Observations", "SUS" and "Issues" sheets are built
by the same functions in every workbook, so a whole-sheet copy from A/C into B keeps
every formula reference valid.  Requires: pip install openpyxl
"""
from __future__ import annotations

import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

FONT = "Arial"
F_BASE = Font(name=FONT, size=10)
F_BOLD = Font(name=FONT, size=10, bold=True)
F_HEAD = Font(name=FONT, size=10, bold=True, color="FFFFFF")
F_TITLE = Font(name=FONT, size=14, bold=True)
F_NOTE = Font(name=FONT, size=9, italic=True, color="555555")
F_INPUT = Font(name=FONT, size=10, color="0000FF")  # blue = typed input
FILL_HEAD = PatternFill("solid", fgColor="1F3864")
FILL_INPUT = PatternFill("solid", fgColor="FFF9DB")  # pale yellow = fill me in
FILL_CALC = PatternFill("solid", fgColor="EEF2F7")  # grey-blue = formula, do not edit
FILL_WARN = PatternFill("solid", fgColor="FDE9E7")
THIN = Side(style="thin", color="BBBBBB")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical="top")
CENTER = Alignment(horizontal="center", vertical="top", wrap_text=True)

MAX_P = 8  # PDF §9.2: five to eight participants
SESS_LAST = 1 + 15  # Sessions rows 2..16 (room for replacements)
OBS_LAST = 200  # bounded ranges used by all formulas
SUS_LAST = 16
ISS_LAST = 100

TASKS = [
    ("T1", "Sign in", "You are new to DonorLink. Sign in with the test account you were given.", "Reaches Home without help", "NFR08"),
    ("T2", "Create emergency request", "Your uncle needs 2 units of O+ blood urgently at a hospital in Colombo. Ask for help using the app.", "Request submitted and listed as waiting for verification", "FR01, NFR01"),
    ("T3", "Check status and response count", "Find out whether your request has been verified and how many donors have responded.", "States the correct status and response count", "FR03, FR07, UI-03"),
    ("T4", "Set donor availability", "You can donate today until 6 pm. Make sure the app knows this.", "Availability set to available with an end time", "FR04, UI-01"),
    ("T5", "Respond to an alert", "You received an alert asking for your blood group. Look at it and agree to donate.", "Opens the alert and accepts the right request", "FR05, FR06, UI-05"),
    ("T6", "Find history", "Find your donation and request history.", "History opened and a past record identified", "FR10, UI-04"),
]
OUTCOMES = ["Completed unaided", "Completed with assistance", "Abandoned", "Application-blocked", "Not attempted"]
SEV = [
    (0, "Not a usability problem", "None", "Disagreement among evaluators; no effect on any participant."),
    (1, "Cosmetic problem", "Low", "Noticed by participants but caused no error, delay or comment about difficulty."),
    (2, "Minor problem", "Medium", "Caused hesitation, a wrong tap or a recovery without help; low priority to fix."),
    (3, "Major problem", "High", "Needed assistance, or many participants made errors; important to fix before release."),
    (4, "Usability catastrophe", "High", "Prevented task completion for one or more participants; must be fixed."),
]
SUS_ITEMS = [
    "I think that I would like to use this system frequently.",
    "I found the system unnecessarily complex.",
    "I thought the system was easy to use.",
    "I think that I would need the support of a technical person to be able to use this system.",
    "I found the various functions in this system were well integrated.",
    "I thought there was too much inconsistency in this system.",
    "I would imagine that most people would learn to use this system very quickly.",
    "I found the system very cumbersome to use.",
    "I felt very confident using the system.",
    "I needed to learn a lot of things before I could get going with this system.",
]


# ---------------------------------------------------------------- helpers
def header(ws, row: int, titles: list[str], widths: list[float] | None = None, height: float = 42):
    for i, t in enumerate(titles, start=1):
        c = ws.cell(row=row, column=i, value=t)
        c.font, c.fill, c.alignment, c.border = F_HEAD, FILL_HEAD, CENTER, BORDER
    ws.row_dimensions[row].height = height
    if widths:
        for i, w in enumerate(widths, start=1):
            ws.column_dimensions[get_column_letter(i)].width = w


def style_range(ws, first_row: int, last_row: int, ncols: int, calc_cols: set[int] = frozenset()):
    for r in range(first_row, last_row + 1):
        for c in range(1, ncols + 1):
            cell = ws.cell(row=r, column=c)
            calc = c in calc_cols
            cell.font = F_BASE if calc else F_INPUT
            cell.fill = FILL_CALC if calc else FILL_INPUT
            cell.border = BORDER
            cell.alignment = WRAP


def add_list_dv(ws, ref: str, options: list[str] | str, prompt: str | None = None):
    formula = options if isinstance(options, str) else '"' + ",".join(options) + '"'
    dv = DataValidation(type="list", formula1=formula, allow_blank=True, showErrorMessage=True,
                        errorTitle="Invalid value", error="Pick a value from the drop-down list.")
    if prompt:
        dv.promptTitle, dv.prompt, dv.showInputMessage = "Hint", prompt, True
    ws.add_data_validation(dv)
    dv.add(ref)


def add_num_dv(ws, ref: str, lo: int, hi: int | None, msg: str):
    if hi is None:
        dv = DataValidation(type="whole", operator="greaterThanOrEqual", formula1=str(lo), allow_blank=True)
    else:
        dv = DataValidation(type="whole", operator="between", formula1=str(lo), formula2=str(hi), allow_blank=True)
    dv.showErrorMessage, dv.errorTitle, dv.error = True, "Invalid number", msg
    ws.add_data_validation(dv)
    dv.add(ref)


def title_block(ws, title: str, lines: list[str]):
    ws["A1"], ws["A1"].font = title, F_TITLE
    for i, t in enumerate(lines, start=3):
        ws.cell(row=i, column=1, value=t).font = F_BASE
        ws.cell(row=i, column=1).alignment = Alignment(wrap_text=True, vertical="top")
    ws.sheet_view.showGridLines = False


# ---------------------------------------------------------------- shared sheets
def sheet_lists(wb):
    ws = wb.create_sheet("Lists")
    cols = {
        "A": ("Outcomes", OUTCOMES),
        "B": ("Task IDs", [t[0] for t in TASKS]),
        "C": ("Environment", ["Android physical device", "Android emulator", "Expo web preview", "Other (note below)"]),
        "D": ("Impact", ["None", "Slowed participant", "Caused errors", "Required assistance", "Prevented completion"]),
        "E": ("Reproducibility", ["Always", "Sometimes", "Once only", "Not reproduced"]),
        "F": ("Status", ["Needs verification", "Confirmed", "Fixed - awaiting re-test", "Fixed - verified", "Won't fix", "Duplicate"]),
        "G": ("Prototype issue", ["None", "UI-01", "UI-02", "UI-03", "UI-04", "UI-05"]),
        "H": ("Source", ["Observed in participant session", "Automated test", "Code inspection (not yet observed)", "Facilitator observation (no participant)"]),
    }
    for col, (name, vals) in cols.items():
        ws[f"{col}1"] = name
        ws[f"{col}1"].font = F_BOLD
        for i, v in enumerate(vals, start=2):
            ws[f"{col}{i}"] = v
            ws[f"{col}{i}"].font = F_BASE
        ws.column_dimensions[col].width = 34
    ws.sheet_state = "hidden"
    return ws


LIST_RANGES = {
    "outcomes": "=Lists!$A$2:$A$6", "env": "=Lists!$C$2:$C$5", "impact": "=Lists!$D$2:$D$6",
    "repro": "=Lists!$E$2:$E$5", "status": "=Lists!$F$2:$F$7", "proto": "=Lists!$G$2:$G$7",
    "source": "=Lists!$H$2:$H$5", "tasks": "=Lists!$B$2:$B$7",
}


def sheet_tasks(wb):
    ws = wb.create_sheet("Tasks")
    header(ws, 1, ["Task ID", "Title", "Scenario given to participant (PDF Table 15, abridged)", "Success criterion (PDF Table 15)", "Reqs / issue"], [9, 30, 62, 46, 20])
    for r, t in enumerate(TASKS, start=2):
        for c, v in enumerate(t, start=1):
            cell = ws.cell(row=r, column=c, value=v)
            cell.font, cell.border, cell.alignment = F_BASE, BORDER, WRAP
    ws["A9"] = "Source: IT3060 Milestones 01-03 Final Report, Table 15. Full facilitator wording and observable criteria: task-scenarios.md and task-success-criteria.md."
    ws["A9"].font = F_NOTE
    return ws


SESS_COLS = [
    ("Participant ID", 12), ("Session date", 13), ("Environment", 22), ("Device model + OS version", 26),
    ("App build / commit", 20), ("Viewport / screen", 16), ("Backend used", 22), ("Age band", 11),
    ("Smartphone use", 12), ("Has donated blood? (Y/N)", 12), ("Has searched for blood for someone? (Y/N)", 15),
    ("Used M02 Figma prototype? (Y/N)", 14), ("Group member? (Y/N)", 11), ("Consent to take part", 12),
    ("Consent to screen recording", 13), ("Facilitator (initials)", 11), ("Note-taker (initials)", 11),
    ("Participant category (auto)", 18), ("Eligibility check (auto)", 26), ("Session notes", 36),
]


def sheet_sessions(wb, prefill_ids: bool):
    ws = wb.create_sheet("Sessions")
    header(ws, 1, [c[0] for c in SESS_COLS], [c[1] for c in SESS_COLS], height=58)
    calc = {18, 19}
    style_range(ws, 2, SESS_LAST, len(SESS_COLS), calc)
    for r in range(2, SESS_LAST + 1):
        if prefill_ids and r <= MAX_P + 1:
            ws.cell(row=r, column=1, value=f"P{r - 1:02d}")
        ws.cell(row=r, column=18, value=f'=IF(A{r}="","",IF(AND(J{r}="Y",K{r}="Y"),"Donor + searcher",IF(J{r}="Y","Donor",IF(K{r}="Y","Searcher","Neither"))))')
        ws.cell(row=r, column=19, value=f'=IF(A{r}="","",IF(N{r}<>"Yes","NO CONSENT - do not use data",IF(M{r}="Y","GROUP MEMBER - exclude",IF(L{r}="Y","Prior prototype exposure","OK"))))')
    add_list_dv(ws, f"C2:C{SESS_LAST}", LIST_RANGES["env"])
    add_list_dv(ws, f"H2:H{SESS_LAST}", ["18-24", "25-34", "35+"])
    add_list_dv(ws, f"I2:I{SESS_LAST}", ["Daily", "Weekly"])
    for col in "JKLM":
        add_list_dv(ws, f"{col}2:{col}{SESS_LAST}", ["Y", "N"])
    add_list_dv(ws, f"N2:O{SESS_LAST}", ["Yes", "No"])
    ws["B2"].comment = Comment("Enter as a date, e.g. 2026-10-14. No names or contact details anywhere in this workbook.", "usability-package")
    ws.freeze_panes = "B2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(SESS_COLS))}{SESS_LAST}"
    return ws


OBS_COLS = [
    ("Participant ID", 11), ("Participant category (auto)", 16), ("Task ID", 8), ("Task title (auto)", 24),
    ("Task outcome", 24), ("Start time (hh:mm:ss)", 12), ("End time (hh:mm:ss)", 12), ("Elapsed s (auto from start/end)", 12),
    ("Manual time s (if no start/end)", 12), ("Time used s (auto)", 10), ("Errors (off-path actions / wrong taps)", 11),
    ("Recoveries (back on path unaided)", 12), ("Assists given (count)", 9), ("Hesitation >5 s? (Y/N)", 11),
    ("Assistance given (what was said)", 30), ("SEQ (1-7)", 8), ("Think-aloud / quotes", 40),
    ("Application or environment issue", 30), ("Issue ID (issue-log)", 11), ("Screenshot / recording ref", 22), ("Facilitator notes", 34),
]
OBS = {name: get_column_letter(i) for i, (name, _) in enumerate(OBS_COLS, start=1)}


def sheet_observations(wb, prefill: bool):
    ws = wb.create_sheet("Observations")
    header(ws, 1, [c[0] for c in OBS_COLS], [c[1] for c in OBS_COLS], height=70)
    calc = {2, 4, 8, 10}
    style_range(ws, 2, OBS_LAST, len(OBS_COLS), calc)
    r = 2
    for r in range(2, OBS_LAST + 1):
        ws.cell(row=r, column=2, value=f'=IF(A{r}="","",IFERROR(INDEX(Sessions!$R$2:$R${SESS_LAST},MATCH(A{r},Sessions!$A$2:$A${SESS_LAST},0)),"?"))')
        ws.cell(row=r, column=4, value=f'=IF(C{r}="","",IFERROR(INDEX(Tasks!$B$2:$B$7,MATCH(C{r},Tasks!$A$2:$A$7,0)),"?"))')
        ws.cell(row=r, column=8, value=f'=IF(AND(ISNUMBER(F{r}),ISNUMBER(G{r})),ROUND((G{r}-F{r})*86400,0),"")')
        ws.cell(row=r, column=10, value=f'=IF(ISNUMBER(I{r}),I{r},IF(ISNUMBER(H{r}),H{r},""))')
        ws.cell(row=r, column=6).number_format = "hh:mm:ss"
        ws.cell(row=r, column=7).number_format = "hh:mm:ss"
    if prefill:  # participant x task skeleton so nothing is forgotten; values stay blank
        row = 2
        for p in range(1, MAX_P + 1):
            for t in TASKS:
                ws.cell(row=row, column=1, value=f"P{p:02d}")
                ws.cell(row=row, column=3, value=t[0])
                row += 1
    add_list_dv(ws, f"C2:C{OBS_LAST}", LIST_RANGES["tasks"])
    add_list_dv(ws, f"E2:E{OBS_LAST}", LIST_RANGES["outcomes"],
                "Unaided = no hint. Assisted = a neutral hint was given (stuck 60 s or asked twice). Abandoned = gave up or >3 min. Application-blocked = a defect stopped the task.")
    add_list_dv(ws, f"N2:N{OBS_LAST}", ["Y", "N"])
    add_num_dv(ws, f"K2:M{OBS_LAST}", 0, None, "Enter a whole number 0 or more.")
    add_num_dv(ws, f"P2:P{OBS_LAST}", 1, 7, "SEQ is 1 (very difficult) to 7 (very easy).")
    ws["F1"].comment = Comment("Time on task runs from the end of the facilitator reading the scenario to the success state (PDF §9.3). Either enter start+end, or a stopwatch value in 'Manual time'.", "usability-package")
    ws.freeze_panes = "E2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(OBS_COLS))}{OBS_LAST}"
    return ws


def sheet_sus(wb, prefill: bool):
    ws = wb.create_sheet("SUS")
    titles = ["Participant ID"] + [f"Q{i}" for i in range(1, 11)] + ["SUS score 0-100 (auto)", "All 10 answered? (auto)", "Notes"]
    header(ws, 1, titles, [12] + [7] * 10 + [16, 14, 30], height=40)
    for i, s in enumerate(SUS_ITEMS, start=2):
        ws.cell(row=1, column=i).comment = Comment(f"Q{i - 1}: {s}  (1 = strongly disagree ... 5 = strongly agree)", "usability-package")
    style_range(ws, 2, SUS_LAST, len(titles), {12, 13})
    for r in range(2, SUS_LAST + 1):
        if prefill and r <= MAX_P + 1:
            ws.cell(row=r, column=1, value=f"P{r - 1:02d}")
        ws.cell(row=r, column=13, value=f'=IF(A{r}="","",IF(COUNT(B{r}:K{r})=10,"Yes","No"))')
        ws.cell(row=r, column=12, value=f'=IF(COUNT(B{r}:K{r})=10,2.5*((B{r}-1)+(5-C{r})+(D{r}-1)+(5-E{r})+(F{r}-1)+(5-G{r})+(H{r}-1)+(5-I{r})+(J{r}-1)+(5-K{r})),"")')
        ws.cell(row=r, column=12).number_format = "0.0"
    add_num_dv(ws, f"B2:K{SUS_LAST}", 1, 5, "SUS answers are whole numbers 1 to 5.")
    ws["A19"] = "Scoring (Brooke, 1996): odd items score-1, even items 5-score, sum the ten values, multiply by 2.5 (0-100). It is NOT a percentage and NOT the mean of the raw answers."
    ws["A19"].font = F_NOTE
    for i, s in enumerate(SUS_ITEMS, start=1):
        ws.cell(row=20 + i, column=1, value=f"Q{i}").font = F_BOLD
        ws.cell(row=20 + i, column=2, value=s).font = F_BASE
    ws.freeze_panes = "B2"
    return ws


ISS_COLS = [
    ("Issue ID", 10), ("Related task", 9), ("Source", 26), ("Issue description", 52), ("Evidence (screenshot / video ref / file:line)", 36),
    ("Participants affected (n)", 11), ("Frequency (auto = n / N)", 11), ("Severity 0-4 (Nielsen)", 10), ("Severity label (auto)", 22),
    ("Impact on task completion", 20), ("Reproducibility", 14), ("Recommended improvement", 44), ("Status", 18),
    ("Related prototype issue", 12), ("Date logged", 12), ("Notes", 30),
]


def sheet_scale(wb, n_formula: str | None):
    ws = wb.create_sheet("Severity Scale")
    ws["A1"], ws["A1"].font = "Severity scale and participant count", F_TITLE
    ws["A2"] = "Participants tested (N)"
    ws["A2"].font = F_BOLD
    ws["B2"] = n_formula if n_formula else None
    ws["B2"].font, ws["B2"].fill, ws["B2"].border = (F_BASE if n_formula else F_INPUT), (FILL_CALC if n_formula else FILL_INPUT), BORDER
    ws["C2"] = "Denominator for 'Frequency'. " + ("Linked to the participant count in Summary." if n_formula else "Type the number of participants who completed a session.")
    ws["C2"].font = F_NOTE
    header(ws, 4, ["Level", "Nielsen label (PDF §9.3: Nielsen 0-4)", "Low / Medium / High", "How it is assigned"], [10, 40, 18, 90])
    for i, (lvl, label, tier, rule) in enumerate(SEV, start=5):
        for c, v in enumerate((lvl, label, tier, rule), start=1):
            cell = ws.cell(row=i, column=c, value=v)
            cell.font, cell.border, cell.alignment = F_BASE, BORDER, WRAP
    notes = [
        "Rate by combining three factors (Nielsen): how often it happens, how big the impact is when it happens, and whether people can get past it once they know.",
        "Frequency alone never sets severity: one participant who could not finish a task is still level 4 for that participant; say so in the description.",
        "Candidate rows (ID CAND-nn) come from reading the code, not from watching people. They stay 'Needs verification' with no severity until observed.",
        "With n = 5 to 8, report counts (e.g. 3/6) rather than percentages, and state the small-sample caveat (PDF §9.3).",
    ]
    for i, n in enumerate(notes, start=11):
        ws.cell(row=i, column=1, value=n).font = F_BASE
    return ws


def sheet_issues(wb, rows: list[tuple] | None = None):
    ws = wb.create_sheet("Issues")
    header(ws, 1, [c[0] for c in ISS_COLS], [c[1] for c in ISS_COLS], height=58)
    style_range(ws, 2, ISS_LAST, len(ISS_COLS), {7, 9})
    for r in range(2, ISS_LAST + 1):
        ws.cell(row=r, column=7, value=f"=IF(OR(F{r}=\"\",N(\'Severity Scale\'!$B$2)=0),\"\",F{r}/'Severity Scale'!$B$2)")
        ws.cell(row=r, column=7).number_format = "0%"
        ws.cell(row=r, column=9, value=f'=IF(H{r}="","",IFERROR(INDEX(\'Severity Scale\'!$B$5:$B$9,H{r}+1)&" ("&INDEX(\'Severity Scale\'!$C$5:$C$9,H{r}+1)&")",""))')
        ws.cell(row=r, column=15).number_format = "yyyy-mm-dd"
    add_list_dv(ws, f"B2:B{ISS_LAST}", LIST_RANGES["tasks"])
    add_list_dv(ws, f"C2:C{ISS_LAST}", LIST_RANGES["source"])
    add_list_dv(ws, f"H2:H{ISS_LAST}", ["0", "1", "2", "3", "4"])
    add_list_dv(ws, f"J2:J{ISS_LAST}", LIST_RANGES["impact"])
    add_list_dv(ws, f"K2:K{ISS_LAST}", LIST_RANGES["repro"])
    add_list_dv(ws, f"M2:M{ISS_LAST}", LIST_RANGES["status"])
    add_list_dv(ws, f"N2:N{ISS_LAST}", LIST_RANGES["proto"])
    add_num_dv(ws, f"F2:F{ISS_LAST}", 0, None, "Whole number of participants affected.")
    for r, row in enumerate(rows or [], start=2):
        for c, v in enumerate(row, start=1):
            if v is not None:
                ws.cell(row=r, column=c, value=v)
    # Severity entered as text list values: normalise to numbers for INDEX()
    ws.freeze_panes = "B2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(ISS_COLS))}{ISS_LAST}"
    return ws


# Candidate issues from reading the code. NOT observed in participant sessions.
CANDIDATES = [
    ("CAND-01", "T4", "Code inspection (not yet observed)",
     "An exact 'available until 6 pm' time cannot be entered in the Expo web preview: the 'Pick date & time' chip is hidden when Platform.OS is 'web', leaving only relative chips (2 hours, 8 hours, 24 hours, 3 days). On Android the picker is two consecutive system dialogs (date, then time). Possible hesitation or errors for T4, which asks for a clock time.",
     "src/components/ui/DonorLinkPickers.tsx:436-477", None, None, None, None, None, None,
     "Observe T4 on Android. If participants struggle, add a clock-time quick option such as 'Until 6 pm today' or a single time-only picker.",
     "Needs verification", "UI-01", None, "Web sessions cannot test T4 as worded; use Android."),
    ("CAND-02", "T4", "Code inspection (not yet observed)",
     "Availability saving rejects an end time that is not in the future ('Available-until time must be in the future.'). A session run after 6 pm local time makes T4 impossible as worded, so the facilitator must adjust the scenario time.",
     "src/domain/validation.ts:266-269", None, None, None, None, None, None,
     "Schedule sessions before 18:00, or reword the card with a time later than the current time and record the wording used.",
     "Needs verification", "None", None, "Protocol step added (participant-protocol.md)."),
    ("CAND-03", "T3", "Code inspection (not yet observed)",
     "The task asks 'how many donors have responded', but the app shows 'N of M donors accepted' plus Contacted / Accepted / Waiting / Declined counters. There is no single 'responded' number, so participants may give different but defensible answers.",
     "src/features/requester/RequestDetailsScreen.tsx:161; src/components/requests/ResponseSummary.tsx:41-48", None, None, None, None, None, None,
     "Agree the correct answer before sessions (see task-success-criteria.md) and record exactly what each participant says. Consider a 'Responded' counter if confusion is observed.",
     "Needs verification", "UI-03", None, None),
    ("CAND-04", "T2/T3", "Code inspection (not yet observed)",
     "Pending-verification wording differs between screens: status badge 'Awaiting verification', reviewer card 'This request is waiting for verification', verification badge 'Not yet verified'. The report's success criterion says 'waiting for verification'.",
     "src/domain/statuses.ts:28; src/features/requester/RequestDetailsScreen.tsx:121,144", None, None, None, None, None, None,
     "Observe whether participants read these as the same state; align wording if they do not.",
     "Needs verification", "UI-03", None, None),
    ("CAND-05", "T2", "Code inspection (not yet observed)",
     "'Who is this for' (the uncle in the scenario) is optional and hidden behind 'Add ward, notes or who it's for'; its options are Myself / Family member / Friend / Patient in my care / Other. No 'uncle' option.",
     "src/app/(app)/requests/create.tsx:28,148-173", None, None, None, None, None, None,
     "Observe whether participants look for it. Acceptable if the request succeeds without it.",
     "Needs verification", "None", None, None),
    ("CAND-06", "T6", "Code inspection (not yet observed)",
     "History is not one of the four tabs. It is reachable from Home > Quick actions > History and Profile > 'Request & donation history'. First-time users may hesitate (prototype issue UI-04).",
     "src/app/(app)/(tabs)/index.tsx:29-34; src/app/(app)/(tabs)/profile.tsx:82", None, None, None, None, None, None,
     "Observe the first tap on T6; record whether participants use Home, Profile, or the Requests tab.",
     "Needs verification", "UI-04", None, None),
]


def sheet_legend(wb, title: str, purpose: str, extra: list[str]):
    ws = wb.active
    ws.title = "Legend"
    title_block(ws, title, [purpose, ""] + extra)
    ws.column_dimensions["A"].width = 120
    r = 3 + len(extra) + 3
    ws.cell(row=r, column=1, value="Colour key").font = F_BOLD
    c1 = ws.cell(row=r + 1, column=1, value="Pale yellow, blue text = you type here")
    c1.fill, c1.font = FILL_INPUT, F_INPUT
    c2 = ws.cell(row=r + 2, column=1, value="Grey-blue, black text = formula, do not type here")
    c2.fill, c2.font = FILL_CALC, F_BASE
    return ws, r + 4


# ---------------------------------------------------------------- workbooks
def build_observation(path: Path):
    wb = Workbook()
    ws, r = sheet_legend(
        wb, "DonorLink usability study - Observation sheet (Workbook A)",
        "Data entry during sessions. Blank template: participant IDs P01-P08 and task IDs are pre-listed; every value is empty. No fabricated data.",
        [
            "1. Sessions: one row per participant. Record consent FIRST. Use the anonymous ID only (P01...). No names, phone numbers, e-mail addresses or faces.",
            "2. Observations: one row per participant x task (pre-listed). Pick the outcome from the drop-down; enter start/end times or a stopwatch value; count errors, recoveries, assists.",
            "3. SUS: enter each participant's ten answers (1-5). The score is calculated for you.",
            "4. Log problems in issue-log.xlsx (Issue ID there; reference it in column 'Issue ID').",
            "5. To analyse: copy the Sessions, Observations and SUS sheets (whole sheet, values) into results-analysis.xlsx - the layouts are identical on purpose.",
            "Outcome definitions (PDF Appendix C.3): unaided = no hint; assisted = one neutral hint after 60 s stuck or asked twice; abandoned = gave up or not finished in 3 min; application-blocked = a defect, not the design, stopped the task.",
            "Error = any action that leaves the success path (wrong tab, wrong button, invalid submission). Recovery = returning to the path without help.",
        ],
    )
    ws.cell(row=r, column=1, value="Example of a filled Observations row (illustration only - not in the data range, not a real result)").font = F_BOLD
    ws.cell(row=r + 1, column=1, value="Participant P99 | Task T2 | Completed unaided | start 00:00:00 end 00:01:12 | errors 1 | recoveries 1 | assists 0 | hesitation Y | SEQ 6 | quote: \"where do I say it is for my uncle?\"").font = F_NOTE
    ws.cell(row=r + 1, column=1).alignment = WRAP
    sheet_sessions(wb, True)
    sheet_observations(wb, True)
    sheet_sus(wb, True)
    sheet_tasks(wb)
    sheet_lists(wb)
    wb.save(path)


def build_issue_log(path: Path):
    wb = Workbook()
    ws, _ = sheet_legend(
        wb, "DonorLink usability study - Issue log (Workbook C)",
        "Register of usability problems. Rows CAND-01..06 were found by READING the code and are NOT observed findings: status 'Needs verification', no severity, no participant counts.",
        [
            "Observed problems get IDs WA-01, WA-02, ... (the PDF's Appendix C.5 scheme). Fill participants affected, severity, evidence, recommendation.",
            "Severity uses Nielsen's 0-4 scale (PDF §9.3); the 'Severity Scale' sheet maps it to Low / Medium / High and explains how to assign it.",
            "Set 'Participants tested (N)' on the Severity Scale sheet (cell B2) so frequency is calculated.",
            "Link each issue to a prototype issue UI-01..UI-05 where relevant (research question RQ2).",
        ],
    )
    sheet_issues(wb, CANDIDATES)
    sheet_scale(wb, None)
    sheet_tasks(wb)
    sheet_lists(wb)
    wb.save(path)


def build_results(path: Path):
    wb = Workbook()
    ws, _ = sheet_legend(
        wb, "DonorLink usability study - Results and analysis (Workbook B)",
        "Metrics calculated from data pasted into Sessions / Observations / SUS / Issues. Empty until real session data is pasted in. Nothing here is a finding yet.",
        [
            "1. Paste VALUES (Paste Special > Values) of the whole Sessions, Observations and SUS sheets from observation-sheet.xlsx, and the Issues sheet from issue-log.xlsx.",
            "2. Read Summary (recruitment check, SUS), Task Metrics (per task) and Table 16 (same columns as the report's Table 16).",
            "Denominators are explicit: 'Attempted' = rows whose outcome is not blank and not 'Not attempted'. Application-blocked attempts stay in 'Attempted' but never count as completed.",
            "Completion rate follows the report: unaided completions / participants who attempted (PDF §9.3). Assisted completion and abandonment are reported separately.",
            "Mean time = mean seconds of COMPLETED attempts only, shown for unaided and for all completions. Abandoned and blocked attempts are excluded from time.",
            "SUS = Brooke scoring on the SUS sheet. With fewer than 10 participants treat the mean as indicative; the reference point ~68 is a commonly cited average.",
        ],
    )
    sheet_sessions(wb, False)
    sheet_observations(wb, False)
    sheet_sus(wb, False)
    sheet_issues(wb, None)
    sheet_scale(wb, "=Summary!B4")
    sheet_tasks(wb)

    # ---- Task Metrics
    tm = wb.create_sheet("Task Metrics")
    heads = ["Task", "Title", "Attempted (N)", "Completed unaided", "Completed with assistance", "Abandoned", "Application-blocked",
             "Unaided completion rate (PDF def.)", "Assisted completion rate", "Total completion rate (unaided + assisted)", "Abandoned rate",
             "Unaided rate excl. blocked attempts", "Mean time, unaided (s)", "Mean time, all completed (s)", "Total errors", "Mean errors per attempt",
             "Total assists", "Mean SEQ (1-7)", "Valid SEQ responses (n)"]
    header(tm, 1, heads, [7, 28] + [13] * 17, height=70)
    O = f"Observations!$C$2:$C${OBS_LAST}"          # task
    OC = f"Observations!$E$2:$E${OBS_LAST}"          # outcome
    OT = f"Observations!$J$2:$J${OBS_LAST}"          # time used
    OE = f"Observations!$K$2:$K${OBS_LAST}"          # errors
    OA = f"Observations!$M$2:$M${OBS_LAST}"          # assists
    OS = f"Observations!$P$2:$P${OBS_LAST}"          # SEQ
    for i, t in enumerate(TASKS):
        r = 2 + i
        tm.cell(row=r, column=1, value=t[0])
        tm.cell(row=r, column=2, value=t[1])
        tm.cell(row=r, column=3, value=f'=COUNTIFS({O},$A{r},{OC},"<>",{OC},"<>Not attempted")')
        tm.cell(row=r, column=4, value=f'=COUNTIFS({O},$A{r},{OC},"Completed unaided")')
        tm.cell(row=r, column=5, value=f'=COUNTIFS({O},$A{r},{OC},"Completed with assistance")')
        tm.cell(row=r, column=6, value=f'=COUNTIFS({O},$A{r},{OC},"Abandoned")')
        tm.cell(row=r, column=7, value=f'=COUNTIFS({O},$A{r},{OC},"Application-blocked")')
        tm.cell(row=r, column=8, value=f'=IF(C{r}=0,"",D{r}/C{r})')
        tm.cell(row=r, column=9, value=f'=IF(C{r}=0,"",E{r}/C{r})')
        tm.cell(row=r, column=10, value=f'=IF(C{r}=0,"",(D{r}+E{r})/C{r})')
        tm.cell(row=r, column=11, value=f'=IF(C{r}=0,"",F{r}/C{r})')
        tm.cell(row=r, column=12, value=f'=IF(C{r}-G{r}<=0,"",D{r}/(C{r}-G{r}))')
        # mean = SUMIFS / COUNTIFS over rows that have a numeric time (explicit denominator)
        n_un = f'COUNTIFS({O},$A{r},{OC},"Completed unaided",{OT},">=0")'
        n_all = f'COUNTIFS({O},$A{r},{OC},"Completed*",{OT},">=0")'
        tm.cell(row=r, column=13, value=f'=IF({n_un}=0,"",SUMIFS({OT},{O},$A{r},{OC},"Completed unaided")/{n_un})')
        tm.cell(row=r, column=14, value=f'=IF({n_all}=0,"",SUMIFS({OT},{O},$A{r},{OC},"Completed*")/{n_all})')
        tm.cell(row=r, column=15, value=f'=SUMIFS({OE},{O},$A{r})')
        tm.cell(row=r, column=16, value=f'=IF(C{r}=0,"",O{r}/C{r})')
        tm.cell(row=r, column=17, value=f'=SUMIFS({OA},{O},$A{r})')
        tm.cell(row=r, column=18, value=f'=IF(S{r}=0,"",SUMIFS({OS},{O},$A{r},{OS},">=1")/S{r})')
        tm.cell(row=r, column=19, value=f'=COUNTIFS({O},$A{r},{OS},">=1")')
        for c in (8, 9, 10, 11, 12):
            tm.cell(row=r, column=c).number_format = "0%"
        for c in (13, 14, 16, 18):
            tm.cell(row=r, column=c).number_format = "0.0"
    for r in range(2, 8):
        for c in range(1, 20):
            cell = tm.cell(row=r, column=c)
            cell.font, cell.border, cell.fill = F_BASE, BORDER, FILL_CALC
    tm["A9"] = "Rates are shown blank until at least one participant attempted the task. Report counts (e.g. 4/6) with the small-sample caveat."
    tm["A9"].font = F_NOTE
    tm.freeze_panes = "C2"

    # ---- Table 16 (same columns as the PDF)
    t16 = wb.create_sheet("Table 16")
    header(t16, 1, ["Task", "Completed unaided (n/N)", "Mean time (s)", "Errors (total)", "Assists (total)", "Mean SEQ"], [8, 24, 16, 14, 14, 12])
    for i, t in enumerate(TASKS):
        r = 2 + i
        m = 2 + i
        t16.cell(row=r, column=1, value=t[0])
        t16.cell(row=r, column=2, value=f"=IF('Task Metrics'!C{m}=0,\"\",'Task Metrics'!D{m}&\"/\"&'Task Metrics'!C{m})")
        t16.cell(row=r, column=3, value=f"=IF('Task Metrics'!M{m}=\"\",\"\",ROUND('Task Metrics'!M{m},1))")
        t16.cell(row=r, column=4, value=f"=IF('Task Metrics'!C{m}=0,\"\",'Task Metrics'!O{m})")
        t16.cell(row=r, column=5, value=f"=IF('Task Metrics'!C{m}=0,\"\",'Task Metrics'!Q{m})")
        t16.cell(row=r, column=6, value=f"=IF('Task Metrics'!R{m}=\"\",\"\",ROUND('Task Metrics'!R{m},1))")
    t16.cell(row=8, column=1, value="SUS (mean, range)")
    t16.cell(row=8, column=2, value='=IF(Summary!B14="","",ROUND(Summary!B14,1)&" ("&ROUND(Summary!B16,1)&" - "&ROUND(Summary!B17,1)&")")')
    for r in range(2, 9):
        for c in range(1, 7):
            cell = t16.cell(row=r, column=c)
            cell.font, cell.border, cell.fill = F_BASE, BORDER, FILL_CALC
    t16["A10"] = "Columns mirror the report's Table 16. 'Mean time' is for tasks completed unaided only; N = participants who attempted. 'Completed unaided' excludes assisted, abandoned and blocked attempts."
    t16["A10"].font = F_NOTE

    # ---- Summary
    sm = wb.create_sheet("Summary", 1)
    sm.column_dimensions["A"].width = 58
    sm.column_dimensions["B"].width = 22
    sm.column_dimensions["C"].width = 70
    sm["A1"], sm["A1"].font = "Summary", F_TITLE
    S = f"Sessions!$A$2:$A${SESS_LAST}"
    rows = [
        (3, "RECRUITMENT (PDF §9.2)", None, None),
        (4, "Participants who consented and took part (N)", f'=COUNTIFS(Sessions!$N$2:$N${SESS_LAST},"Yes")', "Count of rows with 'Yes' consent."),
        (5, "... who have donated blood", f'=COUNTIFS(Sessions!$N$2:$N${SESS_LAST},"Yes",Sessions!$J$2:$J${SESS_LAST},"Y")', "Target: at least 2."),
        (6, "... who have searched for blood for someone", f'=COUNTIFS(Sessions!$N$2:$N${SESS_LAST},"Yes",Sessions!$K$2:$K${SESS_LAST},"Y")', "Target: at least 2."),
        (7, "... who are group members (must be 0)", f'=COUNTIFS(Sessions!$N$2:$N${SESS_LAST},"Yes",Sessions!$M$2:$M${SESS_LAST},"Y")', "Group members are excluded."),
        (8, "... who used the M02 prototype (learning effect)", f'=COUNTIFS(Sessions!$N$2:$N${SESS_LAST},"Yes",Sessions!$L$2:$L${SESS_LAST},"Y")', "Excluded 'where possible'; report if >0."),
        (9, "Recruitment criteria met?", '=IF(AND(B4>=5,B4<=8,B5>=2,B6>=2,B7=0),"Met","NOT met (5-8 participants, >=2 donors, >=2 searchers, 0 group members)")', "Evaluates live as data is pasted."),
        (11, "SYSTEM USABILITY SCALE", None, None),
        (12, "SUS questionnaires fully answered (n)", f'=COUNT(SUS!$L$2:$L${SUS_LAST})', "Only complete questionnaires are scored."),
        (14, "SUS mean (0-100)", f'=IF(B12=0,"",AVERAGE(SUS!$L$2:$L${SUS_LAST}))', "Mean of per-participant SUS scores."),
        (15, "SUS standard deviation", f'=IF(B12<2,"",STDEV(SUS!$L$2:$L${SUS_LAST}))', "Needs at least 2 scores."),
        (16, "SUS minimum", f'=IF(B12=0,"",MIN(SUS!$L$2:$L${SUS_LAST}))', None),
        (17, "SUS maximum", f'=IF(B12=0,"",MAX(SUS!$L$2:$L${SUS_LAST}))', None),
        (18, "Reading (indicative only)", '=IF(B14="","",IF(B14>=80.3,"Well above the ~68 average",IF(B14>=68,"At or above the ~68 average",IF(B14>=51,"Below the ~68 average","Poor (below ~51)"))))&IF(B12<10," - small sample (n<10), interpret with caution","")', "Cut-offs after Sauro & Lewis (report ref. [5]); not a pass/fail."),
        (20, "TASKS (details on 'Task Metrics')", None, None),
        (21, "Tasks with at least one attempt", "=COUNTIF('Task Metrics'!$C$2:$C$7,\">0\")", "Out of 6 required tasks."),
        (22, "Application-blocked attempts (all tasks)", "=SUM('Task Metrics'!$G$2:$G$7)", "Defects that stopped a task; not counted as completion."),
        (24, "ISSUES (details on 'Issues')", None, None),
        (25, "Observed issues logged (IDs starting WA-)", f'=COUNTIF(Issues!$A$2:$A${ISS_LAST},"WA-*")', None),
        (26, "... severity 3-4 (High)", f'=COUNTIFS(Issues!$A$2:$A${ISS_LAST},"WA-*",Issues!$H$2:$H${ISS_LAST},">=3")', None),
        (27, "... severity 2 (Medium)", f'=COUNTIFS(Issues!$A$2:$A${ISS_LAST},"WA-*",Issues!$H$2:$H${ISS_LAST},2)', None),
        (28, "... severity 0-1 (Low / none)", f'=COUNTIFS(Issues!$A$2:$A${ISS_LAST},"WA-*",Issues!$H$2:$H${ISS_LAST},"<=1",Issues!$H$2:$H${ISS_LAST},"<>")', None),
        (29, "Candidate issues still unverified (CAND-)", f'=COUNTIFS(Issues!$A$2:$A${ISS_LAST},"CAND-*",Issues!$M$2:$M${ISS_LAST},"Needs verification")', "From code reading; not findings."),
    ]
    for r, label, formula, note in rows:
        a = sm.cell(row=r, column=1, value=label)
        if formula is None:
            a.font = F_BOLD
            continue
        a.font = F_BASE
        b = sm.cell(row=r, column=2, value=formula)
        b.font, b.fill, b.border = F_BASE, FILL_CALC, BORDER
        if r in (14, 15, 16, 17):
            b.number_format = "0.0"
        if note:
            sm.cell(row=r, column=3, value=note).font = F_NOTE
    sm.sheet_view.showGridLines = False

    # ---- Charts (read from Task Metrics / SUS)
    ch = wb.create_sheet("Charts")
    ch["A1"], ch["A1"].font = "Charts (fill from pasted data)", F_TITLE
    bar = BarChart()
    bar.type, bar.title, bar.y_axis.title, bar.x_axis.title = "col", "Unaided completion rate by task", "Rate", "Task"
    bar.add_data(Reference(tm, min_col=8, min_row=1, max_row=7), titles_from_data=True)
    bar.set_categories(Reference(tm, min_col=1, min_row=2, max_row=7))
    bar.y_axis.scaling.min, bar.y_axis.scaling.max = 0, 1
    bar.y_axis.number_format = "0%"
    bar.height, bar.width = 8, 16
    bar.y_axis.delete = False
    bar.x_axis.delete = False
    ch.add_chart(bar, "A3")
    seq = BarChart()
    seq.type, seq.title, seq.y_axis.title, seq.x_axis.title = "col", "Mean SEQ by task (1-7)", "Mean SEQ", "Task"
    seq.add_data(Reference(tm, min_col=18, min_row=1, max_row=7), titles_from_data=True)
    seq.set_categories(Reference(tm, min_col=1, min_row=2, max_row=7))
    seq.y_axis.scaling.min, seq.y_axis.scaling.max = 1, 7
    seq.height, seq.width = 8, 16
    seq.y_axis.delete = False
    seq.x_axis.delete = False
    ch.add_chart(seq, "A21")
    sus = BarChart()
    sus.type, sus.title, sus.y_axis.title, sus.x_axis.title = "col", "SUS score by participant (0-100)", "SUS", "Participant"
    susws = wb["SUS"]
    sus.add_data(Reference(susws, min_col=12, min_row=1, max_row=MAX_P + 1), titles_from_data=True)
    sus.set_categories(Reference(susws, min_col=1, min_row=2, max_row=MAX_P + 1))
    sus.y_axis.scaling.min, sus.y_axis.scaling.max = 0, 100
    sus.height, sus.width = 8, 16
    sus.y_axis.delete = False
    sus.x_axis.delete = False
    ch.add_chart(sus, "A39")

    sheet_lists(wb)
    order = ["Legend", "Summary", "Task Metrics", "Table 16", "Charts", "Sessions", "Observations", "SUS", "Issues", "Severity Scale", "Tasks", "Lists"]
    wb._sheets = [wb[n] for n in order]
    wb.save(path)


if __name__ == "__main__":
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
    out.mkdir(parents=True, exist_ok=True)
    build_observation(out / "observation-sheet.xlsx")
    build_results(out / "results-analysis.xlsx")
    build_issue_log(out / "issue-log.xlsx")
    print("written:", *(p.name for p in sorted(out.glob("*.xlsx"))))
