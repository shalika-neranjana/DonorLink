import fs from 'node:fs/promises';
import path from 'node:path';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const root = path.resolve(import.meta.dirname, '..');
const date = new Date('2026-10-12T00:00:00');
const proxyNote = 'SYNTHETIC PROXY EVALUATION ONLY — not a human participant session; validate with real Android users.';
const sessions = [
  ['P01', date, 'Proxy evaluation (synthetic; not participant)', 'Representative Android 13, 6.1-inch', 'fd7f81b', '390 × 844', 'No live backend', '18–24', 'Several times daily', 'Y', 'N', 'N', 'N', 'Yes', 'N/A', 'N/A', 'Proxy: frequent mobile user and blood donor.', 'Proxy donor', 'Yes', proxyNote],
  ['P02', date, 'Proxy evaluation (synthetic; not participant)', 'Representative Android 12, 6.4-inch', 'fd7f81b', '390 × 844', 'No live backend', '25–34', 'Daily', 'N', 'Y', 'N', 'N', 'Yes', 'N/A', 'N/A', 'Proxy: family blood-search experience.', 'Proxy searcher', 'Yes', proxyNote],
  ['P03', date, 'Proxy evaluation (synthetic; not participant)', 'Representative Android 14, 6.2-inch', 'fd7f81b', '390 × 844', 'No live backend', '25–34', 'Daily', 'Y', 'Y', 'N', 'N', 'Yes', 'N/A', 'N/A', 'Proxy: donor and family searcher.', 'Proxy donor + searcher', 'Yes', proxyNote],
  ['P04', date, 'Proxy evaluation (synthetic; not participant)', 'Representative Android 13, 6.7-inch', 'fd7f81b', '390 × 844', 'No live backend', '35–44', 'Several times daily', 'N', 'Y', 'N', 'N', 'Yes', 'N/A', 'N/A', 'Proxy: experienced smartphone user.', 'Proxy searcher', 'Yes', proxyNote],
  ['P05', date, 'Proxy evaluation (synthetic; not participant)', 'Representative Android 12, 6.0-inch', 'fd7f81b', '390 × 844', 'No live backend', '18–24', 'Daily', 'Y', 'N', 'N', 'N', 'Yes', 'N/A', 'N/A', 'Proxy: regular donor-app user.', 'Proxy donor', 'Yes', proxyNote],
];

const outcomes = [
  ['Completed unaided', 24, 0, 0, 0, 'N', 7, '', '', ''], ['Completed unaided', 71, 1, 1, 0, 'Y', 5, '', 'Looked for “uncle” as a required field.', 'WA-P03'], ['Completed with assistance', 82, 1, 1, 1, 'Y', 4, 'Use the accepted count shown in the request details.', '“Responded” is unclear beside accepted/waiting counters.', 'WA-P01'], ['Completed with assistance', 95, 2, 1, 1, 'Y', 3, 'Open the date/time control to choose an exact time.', 'Exact 18:00 needs an unfamiliar multi-step picker.', 'WA-P02'], ['Completed unaided', 48, 0, 0, 0, 'N', 6, '', '', ''], ['Completed with assistance', 58, 1, 1, 1, 'Y', 4, 'Try Home quick actions or Profile.', 'History is not a tab destination.', 'WA-P04'],
  ['Completed unaided', 20, 0, 0, 0, 'N', 7, '', '', ''], ['Completed unaided', 63, 0, 0, 0, 'N', 6, '', '', ''], ['Completed with assistance', 76, 1, 1, 1, 'Y', 4, 'Read the status and acceptance wording on the request.', 'Initially treated “responded” as contacted.', 'WA-P01'], ['Completed with assistance', 88, 2, 1, 1, 'Y', 3, 'Use the exact date/time option.', 'Relative time chips did not match “until 6 pm.”', 'WA-P02'], ['Completed unaided', 43, 0, 0, 0, 'N', 6, '', '', ''], ['Completed unaided', 44, 0, 0, 0, 'N', 6, '', '', ''],
  ['Completed unaided', 18, 0, 0, 0, 'N', 7, '', '', ''], ['Completed unaided', 58, 0, 0, 0, 'N', 6, '', '', ''], ['Completed unaided', 55, 0, 0, 0, 'N', 5, '', 'Read accepted donors as the task’s response count.', 'WA-P01'], ['Completed with assistance', 79, 1, 1, 1, 'Y', 4, 'Open the date/time control.', 'Needed a hint to move beyond relative availability choices.', 'WA-P02'], ['Completed unaided', 39, 0, 0, 0, 'N', 6, '', '', ''], ['Completed with assistance', 52, 1, 1, 1, 'Y', 4, 'Try the Home quick actions.', 'Searched the tab bar before finding History.', 'WA-P04'],
  ['Completed unaided', 23, 0, 0, 0, 'N', 7, '', '', ''], ['Completed with assistance', 84, 1, 1, 1, 'Y', 4, 'The optional details are under the expandable section.', 'Expected the relationship field to be visible.', 'WA-P03'], ['Completed unaided', 61, 0, 0, 0, 'N', 5, '', '', ''], ['Abandoned', 180, 3, 1, 1, 'Y', 2, 'Stopped after three minutes.', 'Could not confidently set an exact end time.', 'WA-P02'], ['Completed unaided', 51, 0, 0, 0, 'N', 6, '', '', ''], ['Completed with assistance', 70, 1, 1, 1, 'Y', 4, 'Open History from the Home quick action.', 'History was not expected outside the tabs.', 'WA-P04'],
  ['Completed unaided', 21, 0, 0, 0, 'N', 7, '', '', ''], ['Completed unaided', 66, 0, 0, 0, 'N', 6, '', '', ''], ['Completed unaided', 59, 0, 0, 0, 'N', 5, '', '', ''], ['Completed with assistance', 91, 1, 1, 1, 'Y', 4, 'Choose the date/time picker for 18:00.', 'Wanted an “until 6 pm” quick option.', 'WA-P02'], ['Completed unaided', 45, 0, 0, 0, 'N', 6, '', '', ''], ['Completed unaided', 47, 0, 0, 0, 'N', 6, '', '', ''],
];

const sus = [
  [4, 2, 4, 2, 4, 2, 4, 2, 4, 2], [4, 2, 4, 2, 4, 2, 3, 2, 4, 2], [4, 2, 4, 2, 4, 2, 4, 2, 4, 2], [3, 3, 3, 3, 4, 3, 3, 3, 3, 3], [4, 2, 4, 2, 4, 2, 4, 2, 4, 2],
];
const proxyIssues = [
  ['WA-P01', 'T3', 'Proxy evaluation (synthetic; not participant)', '“Responded” does not map directly to the accepted, contacted, waiting and declined counters, causing inconsistent interpretations.', 'Proxy task traces P01, P02, P03', 3, 3, 'Required assistance or produced an ambiguous answer.', 'Always in this proxy evaluation', 'Label the task and request summary consistently, or add a clearly named response total.', 'Proxy finding — validate with people', 'UI-03'],
  ['WA-P02', 'T4', 'Proxy evaluation (synthetic; not participant)', 'Setting an exact “until 6 pm” availability time is less discoverable than the relative availability options.', 'Proxy task traces P01–P05', 5, 3, 'One abandonment and four assisted completions.', 'Always in this proxy evaluation', 'Add an “Until 6 pm today” shortcut and simplify the exact-time flow.', 'Proxy finding — validate with people', 'UI-01'],
  ['WA-P03', 'T2', 'Proxy evaluation (synthetic; not participant)', 'The relationship detail expected by the scenario is optional and hidden in an expandable section.', 'Proxy task traces P01, P04', 2, 2, 'Caused hesitation and one assisted completion.', 'Sometimes in this proxy evaluation', 'Keep optional details grouped but make their availability clearer in the request flow.', 'Proxy finding — validate with people', 'None'],
  ['WA-P04', 'T6', 'Proxy evaluation (synthetic; not participant)', 'History is not available as a tab, leading first-time users to search the tab bar before finding a secondary path.', 'Proxy task traces P01, P03, P04', 3, 3, 'Three assisted completions.', 'Always in this proxy evaluation', 'Expose History more prominently or add it to a primary navigation surface.', 'Proxy finding — validate with people', 'UI-04'],
];

async function load(name) {
  return SpreadsheetFile.importXlsx(await FileBlob.load(path.join(root, name)));
}

async function populateObservation(name) {
  const wb = await load(name);
  wb.worksheets.getItem('Legend').getRange('A3').values = [[`Populated with ${proxyNote}`]];
  const sheet = wb.worksheets.getItem('Sessions');
  sheet.getRange('A2:T6').values = sessions;
  const obs = wb.worksheets.getItem('Observations');
  outcomes.forEach((item, index) => {
    const row = index + 2;
    obs.getRange(`A${row}`).values = [[`P${String(Math.floor(index / 6) + 1).padStart(2, '0')}`]];
    obs.getRange(`C${row}`).values = [[`T${(index % 6) + 1}`]];
    obs.getRange(`E${row}`).values = [[item[0]]];
    obs.getRange(`I${row}`).values = [[item[1]]];
    obs.getRange(`K${row}:N${row}`).values = [[item[2], item[3], item[4], item[5]]];
    obs.getRange(`O${row}:U${row}`).values = [[item[6] < 7 ? item[6] : '', item[6], item[7], item[8], item[9], '', proxyNote]];
  });
  const susSheet = wb.worksheets.getItem('SUS');
  susSheet.getRange('B2:K6').values = sus;
  susSheet.getRange('N2:N6').values = Array.from({ length: 5 }, () => [proxyNote]);
  wb.recalculate();
  const output = await SpreadsheetFile.exportXlsx(wb);
  await output.save(path.join(root, name));
}

async function populateResults() {
  const name = 'results-analysis.xlsx';
  const wb = await load(name);
  wb.worksheets.getItem('Legend').getRange('A3').values = [[`Proxy-study demonstration data only. ${proxyNote}`]];
  wb.worksheets.getItem('Sessions').getRange('A2:T6').values = sessions;
  const obs = wb.worksheets.getItem('Observations');
  outcomes.forEach((item, index) => {
    const row = index + 2;
    obs.getRange(`A${row}`).values = [[`P${String(Math.floor(index / 6) + 1).padStart(2, '0')}`]];
    obs.getRange(`C${row}`).values = [[`T${(index % 6) + 1}`]];
    obs.getRange(`E${row}`).values = [[item[0]]];
    obs.getRange(`I${row}`).values = [[item[1]]];
    obs.getRange(`K${row}:N${row}`).values = [[item[2], item[3], item[4], item[5]]];
    obs.getRange(`O${row}:U${row}`).values = [[item[6] < 7 ? item[6] : '', item[6], item[7], item[8], item[9], '', proxyNote]];
  });
  wb.worksheets.getItem('SUS').getRange('B2:K6').values = sus;
  wb.worksheets.getItem('SUS').getRange('N2:N6').values = Array.from({ length: 5 }, () => [proxyNote]);
  const issues = wb.worksheets.getItem('Issues');
  proxyIssues.forEach((item, index) => {
    const row = index + 8;
    issues.getRange(`A${row}:F${row}`).values = [[...item.slice(0, 6)]];
    issues.getRange(`H${row}`).values = [[item[6]]];
    issues.getRange(`J${row}:N${row}`).values = [[...item.slice(7)]];
    issues.getRange(`G${row}`).formulas = [[`=IF(OR(F${row}="",N('Severity Scale'!$B$2)=0),"",F${row}/'Severity Scale'!$B$2)`]];
    issues.getRange(`I${row}`).formulas = [[`=IF(H${row}="","",IFERROR(INDEX('Severity Scale'!$B$5:$B$9,H${row}+1)&" ("&INDEX('Severity Scale'!$C$5:$C$9,H${row}+1)&")",""))`]];
  });
  wb.recalculate();
  const output = await SpreadsheetFile.exportXlsx(wb);
  await output.save(path.join(root, name));
}

async function populateIssues() {
  const name = 'issue-log.xlsx';
  const wb = await load(name);
  wb.worksheets.getItem('Legend').getRange('A3').values = [[`Contains proxy-study demonstration findings. ${proxyNote}`]];
  wb.worksheets.getItem('Severity Scale').getRange('B2').values = [[5]];
  const issues = wb.worksheets.getItem('Issues');
  proxyIssues.forEach((item, index) => {
    const row = index + 8;
    issues.getRange(`A${row}:F${row}`).values = [[...item.slice(0, 6)]];
    issues.getRange(`H${row}`).values = [[item[6]]];
    issues.getRange(`J${row}:N${row}`).values = [[...item.slice(7)]];
    issues.getRange(`G${row}`).formulas = [[`=IF(OR(F${row}="",N('Severity Scale'!$B$2)=0),"",F${row}/'Severity Scale'!$B$2)`]];
    issues.getRange(`I${row}`).formulas = [[`=IF(H${row}="","",IFERROR(INDEX('Severity Scale'!$B$5:$B$9,H${row}+1)&" ("&INDEX('Severity Scale'!$C$5:$C$9,H${row}+1)&")",""))`]];
  });
  wb.recalculate();
  const output = await SpreadsheetFile.exportXlsx(wb);
  await output.save(path.join(root, name));
}

await populateObservation('observation-sheet.xlsx');
await populateResults();
await populateIssues();
