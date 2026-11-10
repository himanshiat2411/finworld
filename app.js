/* Finworld prototype — vanilla JS, no build step */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const inr = (n, d = 0) => (n < 0 ? '-' : '') + '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: d });
const num = (n, d = 2) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: d });
const slug = s => String(s).trim().replace(/\(.*?\)/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, '_$1') || 'field';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2400); }

/* ---------------- Templates ---------------- */
const TEMPLATES = [
  { id: 'financial', em: '📊', name: 'Financial Model', cat: 'Corporate', desc: '3-statement style unit economics: revenue, costs, EBITDA and net profit.',
    inputs: [['Price per Unit (₹)', 1200], ['Units Sold', 5000], ['Variable Cost per Unit (₹)', 600], ['Fixed Cost (₹)', 800000], ['Tax Rate (%)', 25], ['Growth Rate (%)', 12]],
    calcs: [['Total Revenue', 'Price_per_Unit * Units_Sold', 1], ['Variable Costs', 'Variable_Cost_per_Unit * Units_Sold', 0], ['Gross Profit', 'Total_Revenue - Variable_Costs', 0], ['Gross Margin (%)', 'Gross_Profit / Total_Revenue * 100', 1], ['EBITDA', 'Gross_Profit - Fixed_Cost', 1], ['Net Profit', 'EBITDA - EBITDA * Tax_Rate / 100', 1]] },
  { id: 'startup', em: '🚀', name: 'Startup Financial Plan', cat: 'Startup', desc: 'Burn rate, runway and break-even for early-stage companies.',
    inputs: [['Cash in Bank (₹)', 5000000], ['Monthly Revenue (₹)', 300000], ['Monthly Burn (₹)', 700000], ['Monthly Growth (%)', 8]],
    calcs: [['Net Burn', 'Monthly_Burn - Monthly_Revenue', 1], ['Runway (months)', 'Cash_in_Bank / Net_Burn', 1], ['Revenue in 12 months', 'Monthly_Revenue * (1 + Monthly_Growth/100) ^ 12', 1]] },
  { id: 'revenue', em: '📈', name: 'Revenue Forecast Model', cat: 'Forecasting', desc: 'Project revenue over time from customers, ARPU and churn.',
    inputs: [['Customers', 2000], ['ARPU (₹)', 900], ['Churn Rate (%)', 3], ['New Customers per Month', 250]],
    calcs: [['Monthly Revenue', 'Customers * ARPU', 1], ['Annual Revenue', 'Monthly_Revenue * 12', 1], ['Net Customer Growth', 'New_Customers_per_Month - Customers * Churn_Rate / 100', 1], ['Customer Lifetime Value', 'ARPU / (Churn_Rate / 100)', 1]] },
  { id: 'budget', em: '🧾', name: 'Budget & Planning Model', cat: 'Corporate', desc: 'Plan departmental budgets and track variance against actuals.',
    inputs: [['Budgeted Spend (₹)', 1200000], ['Actual Spend (₹)', 1325000], ['Salaries (₹)', 650000], ['Marketing (₹)', 300000]],
    calcs: [['Variance', 'Actual_Spend - Budgeted_Spend', 1], ['Variance (%)', 'Variance / Budgeted_Spend * 100', 1], ['Other Spend', 'Actual_Spend - Salaries - Marketing', 1]] },
  { id: 'saas', em: '☁️', name: 'SaaS Metrics', cat: 'Startup', desc: 'MRR, CAC payback and LTV:CAC for subscription businesses.',
    inputs: [['MRR (₹)', 800000], ['Customers', 400], ['CAC (₹)', 15000], ['Gross Margin (%)', 78], ['Monthly Churn (%)', 2.5]],
    calcs: [['ARPA', 'MRR / Customers', 0], ['LTV', 'ARPA * Gross_Margin/100 / (Monthly_Churn/100)', 1], ['LTV to CAC', 'LTV / CAC', 1], ['CAC Payback (months)', 'CAC / (ARPA * Gross_Margin / 100)', 1]] },
  { id: 'dcf', em: '🏦', name: 'DCF Valuation', cat: 'Valuation', desc: 'Discount future free cash flows to estimate enterprise value.',
    inputs: [['Free Cash Flow (₹)', 2500000], ['Growth Rate (%)', 10], ['Discount Rate (%)', 12], ['Terminal Growth (%)', 4]],
    calcs: [['FCF Year 5', 'Free_Cash_Flow * (1 + Growth_Rate/100) ^ 5', 0], ['Terminal Value', 'FCF_Year_5 * (1 + Terminal_Growth/100) / ((Discount_Rate - Terminal_Growth)/100)', 1], ['PV of Terminal Value', 'Terminal_Value / (1 + Discount_Rate/100) ^ 5', 1]] },
  { id: 'loan', em: '💳', name: 'Loan & EMI Calculator', cat: 'Personal', desc: 'Monthly EMI, total interest and total payment for a loan.',
    inputs: [['Loan Amount (₹)', 2000000], ['Interest Rate (%)', 9], ['Tenure (months)', 120]],
    calcs: [['Monthly Rate', 'Interest_Rate / 12 / 100', 0], ['EMI', 'Loan_Amount * Monthly_Rate * (1+Monthly_Rate)^Tenure / ((1+Monthly_Rate)^Tenure - 1)', 1], ['Total Payment', 'EMI * Tenure', 1], ['Total Interest', 'Total_Payment - Loan_Amount', 1]] },
  { id: 'breakeven', em: '⚖️', name: 'Break-even Analysis', cat: 'Forecasting', desc: 'Units and revenue needed to cover fixed costs.',
    inputs: [['Fixed Cost (₹)', 600000], ['Price per Unit (₹)', 1500], ['Variable Cost per Unit (₹)', 900]],
    calcs: [['Contribution Margin', 'Price_per_Unit - Variable_Cost_per_Unit', 0], ['Break-even Units', 'Fixed_Cost / Contribution_Margin', 1], ['Break-even Revenue', 'Break_even_Units * Price_per_Unit', 1]] },
];

/* ---------------- Model state ---------------- */
const BLANK = () => ({
  name: 'Untitled model',
  inputs: [['Price per Unit (₹)', 1200], ['Units Sold (Q1)', 5000], ['Growth Rate (%)', 12], ['Variable Cost per Unit (₹)', 600], ['Tax Rate (%)', 25], ['Fixed Cost (₹)', 500000]].map(mkInput),
  calcs: ['Gross Margin', 'Total Revenue', 'EBITDA', 'Net Profit'].map(n => mkCalc(n, '', true)),
  sources: [], audit: [],
});
function mkInput([label, value, src]) { return { id: slug(label), label, value: +value, src: src || 'manual' }; }
function mkCalc(name, formula, output) { return { id: slug(name), name, formula, output: !!output, fmt: 'Number', dp: 0 }; }
let model = BLANK();
let selected = null; // {kind:'input'|'calc', id}
let editing = null; // calc id under edit
function audit(t) { model.audit.unshift({ t, at: now() }); if (route === 'model') renderAudit(); }

/* ---------------- Formula engine ---------------- */
const FN = {
  SUM: (...a) => a.flat().reduce((s, x) => s + x, 0), AVERAGE: (...a) => FN.SUM(...a) / a.flat().length,
  MIN: Math.min, MAX: Math.max, ABS: Math.abs, ROUND: (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d,
  IF: (c, a, b) => (c ? a : b), SQRT: Math.sqrt,
};
function findEntity(name) {
  const k = name.toLowerCase();
  return model.inputs.find(i => i.id.toLowerCase() === k) || model.calcs.find(c => c.id.toLowerCase() === k);
}
function evaluate(formula, stack = []) {
  let expr = String(formula || '').trim().replace(/^=/, '');
  if (!expr) throw new Error('empty');
  if (!/^[\w\s+\-*/().,<>=!&|%^]*$/.test(expr)) throw new Error('Unsupported character in formula');
  const deps = new Set();
  expr = expr.replace(/\^/g, '**').replace(/(?<![<>=!])=(?!=)/g, '==').replace(/[A-Za-z_][A-Za-z0-9_]*/g, w => {
    const up = w.toUpperCase();
    if (FN[up]) return 'F.' + up;
    const e = findEntity(w);
    if (!e) throw new Error('Unknown name: ' + w);
    deps.add(e.id);
    if ('value' in e) return '(' + e.value + ')';
    if (stack.includes(e.id)) throw new Error('Circular reference: ' + e.id);
    return '(' + evaluate(e.formula, [...stack, e.id]).value + ')';
  });
  const value = Function('F', '"use strict";return (' + expr + ')')(FN);
  if (typeof value !== 'number' || !isFinite(value)) throw new Error('Result is not a finite number');
  return { value, deps: [...deps] };
}
function calcValue(c) { try { return c.formula ? evaluate(c.formula, [c.id]).value : null; } catch { return null; } }
function fmtCalc(c, v) {
  if (v == null) return 'Not calculated';
  if (c.fmt === 'Currency' || (c.fmt === 'Number' && /revenue|profit|cost|ebitda|value|payment|interest|emi|burn|ltv|fcf|spend|variance$/i.test(c.name) && !/%|months|units|ratio|to cac/i.test(c.name))) return inr(v, c.dp);
  if (c.fmt === 'Percent' || /%/.test(c.name)) return num(v, Math.max(c.dp, 1)) + '%';
  return num(v, Math.max(c.dp, 2));
}

/* ---------------- Router ---------------- */
let route = 'home';
function go(r, opts = {}) {
  route = r;
  $$('.page').forEach(p => p.classList.toggle('on', p.id === 'page-' + r));
  $$('.nav-item[data-route]').forEach(a => a.classList.toggle('on', a.dataset.route === r && !a.dataset.tab));
  window.scrollTo(0, 0);
  if (r === 'home') renderHome();
  if (r === 'dashboard') renderDash();
  if (r === 'model') { renderModel(); if (opts.tab) setTab(opts.tab); }
  if (r === 'import') renderImport();
  renderNovaEmbeds();
}

/* ---------------- Home ---------------- */
const RECENT = [['📈', 'Investment Analysis', 'Today, 10:30 AM', 'By You', 'Complete', 4], ['🧾', 'Revenue Forecast', 'Today, 9:30 PM', 'By Anjali', 'In Progress', 2], ['📊', 'Market Trend Analysis', 'Yesterday, 4:20 PM', 'By Varun', 'Incomplete', 1], ['📘', 'Cost Optimization Model', '10 May 2025', 'By You', 'Complete', 4]];
const FEED = [['JC', 'Jane Cooper shared <b>“Market Trend Model”</b> with you', 'Just now'], ['A', 'Anjali edited <b>“Revenue Forecast”.</b>', '45 min ago'], ['D', 'David commented on <b>“Market Trend Model”</b> : “This looks great”', '1 hour ago'], ['V', 'Varun added data on <b>“Cost Optimization Model”</b>', '2 days ago'], ['VA', 'Vani commented on <b>“Revenue Forecast”</b> : “Need some changes here”', '3 hours ago']];
function renderHome() {
  const col = { Complete: '#16a34a', 'In Progress': '#eab308', Incomplete: '#dc2626' };
  $('#recentModels').innerHTML = RECENT.map(([e, n, d, by, h, k], i) => `<tr><td>${e} ${n}</td><td>${d}<small>${by}</small></td>
    <td><span style="color:${col[h]}">●</span> ${h}<div class="health">${[0, 1, 2, 3].map(j => `<i style="background:${j < k ? col[h] : ''}"></i>`).join('')}</div></td>
    <td><button class="btn sm" data-open-recent="${i}">Continue</button></td></tr>`).join('');
  $('#feed').innerHTML = FEED.map(([a, t, w]) => `<li><span class="avatar">${a}</span><div>${t}<small>${w}</small></div></li>`).join('');
}

/* ---------------- Templates modal ---------------- */
let tplCat = 'All';
function openTemplates() {
  $('#tplModal').hidden = false;
  const cats = ['All', ...new Set(TEMPLATES.map(t => t.cat))];
  $('#tplChips').innerHTML = cats.map(c => `<button class="${c === tplCat ? 'on' : ''}" data-cat="${c}">${c}</button>`).join('');
  renderTplGrid(); $('#tplSearch').focus();
}
function renderTplGrid() {
  const q = $('#tplSearch').value.toLowerCase();
  const list = TEMPLATES.filter(t => (tplCat === 'All' || t.cat === tplCat) && (t.name + t.desc).toLowerCase().includes(q));
  $('#tplGrid').innerHTML = (list.map(t => `<div class="tpl" data-template="${t.id}"><span class="em">${t.em}</span><b>${t.name}</b><p>${t.desc}</p><span class="tag">${t.cat} · ${t.inputs.length} inputs · ${t.calcs.length} calcs</span></div>`).join('')) ||
    '<p class="hint">No templates match. Try asking Nova to build one.</p>';
}
function loadTemplate(id) {
  const t = TEMPLATES.find(x => x.id === id); if (!t) return;
  model = { name: t.name, inputs: t.inputs.map(mkInput), calcs: t.calcs.map(([n, f, o]) => mkCalc(n, f, o)), sources: [], audit: [] };
  audit(`Created model from template “${t.name}”`);
  $('#tplModal').hidden = true; selected = null; editing = null;
  go('model'); toast(`Template “${t.name}” loaded`);
  nova(`Loaded the **${t.name}** template with ${t.inputs.length} inputs and ${t.calcs.length} calculations. Change any input value and every output recalculates. Ask me things like “set ${t.inputs[0][0].replace(/\s*\(.*\)/, '')} to ${Math.round(t.inputs[0][1] * 1.2)}”.`, false);
}

/* ---------------- Model Analysis Tool ---------------- */
function renderModel() {
  $('#modelName').textContent = '· ' + model.name;
  const mids = model.calcs.filter(c => !c.output), outs = model.calcs.filter(c => c.output);
  $('#colIn').innerHTML = model.inputs.map(i => `<div class="node ${sel('input', i.id)}" data-node="input:${i.id}" id="n-${i.id}">⛁ ${esc(i.label)}<small>${/%/.test(i.label) ? num(i.value) + '%' : /₹/.test(i.label) ? inr(i.value, 2) : num(i.value)}</small></div>`).join('') || '<p class="hint">No inputs. Upload an Excel file or add components.</p>';
  $('#colCalc').innerHTML = mids.length ? mids.map(c => nodeCalc(c, 'calc')).join('') + `<div style="text-align:center"><button class="btn sm" data-add-calc>＋ Add Calculation</button></div>` :
    `<div class="empty-calc"><b>No Calculation added yet</b><br><span class="hint">Click an output, or add an intermediate calculation using formulas to build your model logic.</span><br><br><button class="btn sm" data-add-calc>＋ Add Calculation</button></div>`;
  $('#colOut').innerHTML = outs.map(c => nodeCalc(c, 'out')).join('') || '<p class="hint">No outputs yet.</p>';
  $('#availInputs').innerHTML = [...model.inputs.map(i => [i.id, i.label]), ...model.calcs.filter(c => c.formula && c.id !== editing).map(c => [c.id, 'ƒ ' + c.name])]
    .map(([id, l]) => `<span class="chip" data-insert="${id}" title="Insert ${id}">⛁ ${esc(l)}</span>`).join('');
  $('#srcCount').textContent = model.sources.length;
  $('#connected').innerHTML = model.sources.map(s => `<div class="src-item">🟩 <span>${esc(s.name)}<small>${s.info}</small></span></div>`).join('') || '<p class="hint">Nothing connected yet</p>';
  renderProps(); renderSheet(); renderAudit(); renderCompChart();
  requestAnimationFrame(drawWires);
}
const sel = (k, id) => (selected && selected.kind === k && selected.id === id ? 'sel' : '');
function nodeCalc(c, cls) {
  const v = calcValue(c);
  return `<div class="node ${cls} ${v == null ? 'empty' : ''} ${sel('calc', c.id)}" data-node="calc:${c.id}" id="n-${c.id}">${cls === 'out' ? '◎' : 'ƒ'} ${esc(c.name)}<small>${fmtCalc(c, v)}</small></div>`;
}
function drawWires() {
  const svg = $('#wires'), box = $('#flow').getBoundingClientRect(); let paths = '';
  model.calcs.forEach(c => {
    if (!c.formula) return; let deps; try { deps = evaluate(c.formula, [c.id]).deps; } catch { return; }
    const to = $('#n-' + c.id); if (!to) return; const b = to.getBoundingClientRect();
    deps.forEach(d => {
      const from = $('#n-' + d); if (!from) return; const a = from.getBoundingClientRect();
      const ltr = a.left < b.left;
      const x1 = (ltr ? a.right : a.left) - box.left, y1 = a.top + a.height / 2 - box.top, x2 = (ltr ? b.left : b.right) - box.left, y2 = b.top + b.height / 2 - box.top;
      const mx = (x1 + x2) / 2, hot = selected && (selected.id === c.id || selected.id === d);
      paths += `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" fill="none" stroke="${hot ? '#2563eb' : '#93c5fd'}" stroke-width="${hot ? 2 : 1.2}"/><circle cx="${x1}" cy="${y1}" r="2.5" fill="#2563eb"/>`;
    });
  });
  svg.innerHTML = paths;
}
window.addEventListener('resize', () => route === 'model' && drawWires());

function startEdit(id) {
  const c = model.calcs.find(x => x.id === id);
  editing = c ? c.id : null;
  $('#calcName').value = c ? c.name : ''; $('#formula').value = c ? c.formula : ''; $('#calcIsOutput').checked = c ? c.output : false;
  $('#deleteCalc').hidden = !c; setTab('formula'); livePreview(); $('#formula').focus();
  $('#tab-formula').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function livePreview() {
  const f = $('#formula').value.trim();
  if (!f) { $('#preview').textContent = '---'; $('#deps').textContent = 'No dependencies yet'; return; }
  try { const r = evaluate(f, editing ? [editing] : []); $('#preview').innerHTML = '= ' + num(r.value, 4); $('#deps').innerHTML = r.deps.map(esc).join('<br>') || 'Constants only'; }
  catch (e) { $('#preview').innerHTML = `<span class="err">${esc(e.message)}</span>`; $('#deps').textContent = '—'; }
}
function saveCalc() {
  const name = $('#calcName').value.trim(), f = $('#formula').value.trim().replace(/^=\s*/, '');
  if (!name) return toast('Give the calculation a name');
  try { evaluate(f, [slug(name)]); } catch (e) { return toast('Formula error: ' + e.message); }
  upsertCalc(name, f, $('#calcIsOutput').checked, editing);
  editing = null; $('#calcName').value = ''; $('#formula').value = ''; livePreview(); $('#deleteCalc').hidden = true;
  renderModel(); toast('Calculation saved');
}
function upsertCalc(name, formula, output, oldId) {
  let c = model.calcs.find(x => x.id === (oldId || slug(name))) || model.calcs.find(x => x.id === slug(name));
  if (c) { audit(`Updated “${name}” = ${formula}`); Object.assign(c, { name, formula, output, id: slug(name) }); }
  else { c = mkCalc(name, formula, output); model.calcs.push(c); audit(`Added calculation “${name}” = ${formula}`); }
  selected = { kind: 'calc', id: c.id }; return c;
}
function setInput(id, v, why = 'manually') {
  const i = model.inputs.find(x => x.id === id); if (!i) return;
  audit(`${i.label}: ${num(i.value)} → ${num(v)} (${why})`); i.value = +v;
  if (route === 'model') { renderModel(); $('#n-' + id)?.classList.add('flash'); }
}
function renderProps() {
  const p = $('#props');
  if (!selected) { p.innerHTML = '<p class="hint" style="margin-top:10px">Select a node in Model Structure to see and edit its properties.</p>'; return; }
  if (selected.kind === 'input') {
    const i = model.inputs.find(x => x.id === selected.id); if (!i) return (p.innerHTML = '');
    p.innerHTML = `<div class="props"><div class="field"><label>Name</label><input value="${esc(i.label)}" data-prop="label"></div>
      <div class="field"><label>Type</label><input value="Input · ${i.src}" disabled></div>
      <div class="field"><label>Value</label><input type="number" value="${i.value}" data-prop="value"></div>
      <div class="field"><label>Reference in formulas</label><input class="mono" value="${i.id}" disabled></div>
      <button class="btn danger" data-del-input="${i.id}">Remove input</button></div>`;
  } else {
    const c = model.calcs.find(x => x.id === selected.id); if (!c) return (p.innerHTML = '');
    p.innerHTML = `<div class="props"><div class="field"><label>Name</label><input value="${esc(c.name)}" disabled></div>
      <div class="field"><label>Type</label><input value="Formula${c.output ? ' · Output' : ''}" disabled></div>
      <div class="field"><label>Formula</label><input class="mono" value="${esc(c.formula)}" data-prop="formula"></div>
      <div class="grid2" style="gap:10px"><div class="field"><label>Format</label><select data-prop="fmt">${['Number', 'Currency', 'Percent'].map(f => `<option ${f === c.fmt ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
      <div class="field"><label>Decimal Places</label><input type="number" min="0" max="6" value="${c.dp}" data-prop="dp"></div></div>
      <button class="btn sm" data-edit-calc="${c.id}">Open in Formula Editor</button></div>`;
  }
}
function renderSheet() {
  $('#sheetView').innerHTML = `<div class="sheet"><table><tr><th>Name</th><th>Reference</th><th>Type</th><th>Formula / Value</th><th>Result</th></tr>
    ${model.inputs.map(i => `<tr><td>${esc(i.label)}</td><td class="mono">${i.id}</td><td>Input</td><td><input type="number" value="${i.value}" data-sheet-input="${i.id}"></td><td>${num(i.value)}</td></tr>`).join('')}
    ${model.calcs.map(c => `<tr><td>${esc(c.name)}</td><td class="mono">${c.id}</td><td>${c.output ? 'Output' : 'Calculation'}</td><td class="mono">${esc(c.formula || '—')}</td><td>${fmtCalc(c, calcValue(c))}</td></tr>`).join('')}</table></div>`;
}
function renderAudit() { $('#audit').innerHTML = model.audit.map(a => `<li><span>✎</span><div>${esc(a.t)}<small>${a.at} · Devon</small></div></li>`).join('') || '<li class="hint">No changes yet</li>'; }
function setTab(t) { $$('.tab').forEach(x => x.classList.toggle('on', x.dataset.tab === t)); ['formula', 'sheet', 'audit'].forEach(k => ($('#tab-' + k).hidden = k !== t)); }

let charts = {};
function chart(id, cfg) { charts[id]?.destroy(); charts[id] = new Chart($('#' + id), cfg); }
const baseOpts = { plugins: { legend: { display: false } }, maintainAspectRatio: true, scales: { x: { grid: { display: false }, ticks: { font: { size: 9 } } }, y: { ticks: { font: { size: 9 } }, grid: { color: '#f1f5f9' } } } };
function renderCompChart() {
  const outs = model.calcs.filter(c => c.output).map(c => [c.name, calcValue(c)]).filter(x => x[1] != null);
  chart('cComp', { type: 'bar', data: { labels: outs.map(o => o[0]), datasets: [{ data: outs.map(o => o[1]), backgroundColor: '#2563eb', borderRadius: 4 }] }, options: baseOpts });
}

/* ---------------- Excel / CSV import ---------------- */
function readFile(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => { try { const wb = XLSX.read(e.target.result, { type: 'array' }); const ws = wb.Sheets[wb.SheetNames[0]]; res({ name: file.name, rows: XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' }) }); } catch (err) { rej(err); } };
    r.onerror = rej; r.readAsArrayBuffer(file);
  });
}
const isNum = v => v !== '' && v != null && !isNaN(+String(v).replace(/[,₹$%\s]/g, ''));
const toNum = v => +String(v).replace(/[,₹$%\s]/g, '');
/* Detects key/value sheets (label | number) or tabular sheets (header row + numeric columns). */
function analyzeRows(rows) {
  const kv = rows.filter(r => r.length >= 2 && typeof r[0] === 'string' && r[0].trim() && isNum(r[1]));
  const width = Math.max(...rows.map(r => r.filter(c => c !== '').length));
  const headerIsText = rows[0] && rows[0].filter(c => c !== '').every(c => !isNum(c));
  if (kv.length >= 2 && kv.length >= rows.length * 0.6 && (width <= 3 || !headerIsText)) return { kind: 'kv', fields: kv.map(r => ({ label: r[0].trim(), value: toNum(r[1]), agg: 'Value', include: true })) };
  const [head, ...body] = rows;
  const fields = (head || []).map((h, ci) => {
    const vals = body.map(r => r[ci]).filter(isNum).map(toNum);
    if (vals.length < Math.max(1, body.length * 0.6)) return null;
    return { label: String(h || 'Column ' + (ci + 1)).trim(), col: ci, vals, agg: 'Sum', include: true, value: vals.reduce((a, b) => a + b, 0) };
  }).filter(Boolean);
  return { kind: 'table', fields };
}
const AGG = { Sum: v => v.reduce((a, b) => a + b, 0), Average: v => AGG.Sum(v) / v.length, First: v => v[0], Last: v => v[v.length - 1], Max: v => Math.max(...v), Min: v => Math.min(...v), Value: (v, f) => f.value };
function mergeIntoModel(fileName, fields, rowsCount) {
  let added = 0, updated = 0;
  fields.filter(f => f.include).forEach(f => {
    const val = f.vals ? AGG[f.agg](f.vals) : f.value, id = slug(f.label);
    const ex = model.inputs.find(i => i.id.toLowerCase() === id.toLowerCase());
    if (ex) { ex.value = val; ex.src = fileName; updated++; } else { model.inputs.push(mkInput([f.label, val, fileName])); added++; }
  });
  model.sources = model.sources.filter(s => s.name !== fileName);
  model.sources.push({ name: fileName, info: `${rowsCount} rows · imported ${now()}` });
  audit(`Imported ${fileName}: ${added} new inputs, ${updated} updated`);
  return { added, updated };
}
function afterImport(name, r) {
  toast(`${name}: ${r.added} inputs added, ${r.updated} updated`);
  const names = model.inputs.slice(-Math.max(r.added, 1)).map(i => i.id).slice(0, 6).join(', ');
  nova(`I read **${name}** and turned its numeric fields into model inputs (${r.added} new, ${r.updated} updated): ${names}.\n\nNow you can build calculations on them — click an output, use the Formula Editor, or just tell me, e.g. “add calculation Profit = ${model.inputs[0]?.id || 'A'} - ${model.inputs[1]?.id || 'B'}” or “create a profit & loss statement”.`, false);
}
async function quickImport(file) {
  try { const { name, rows } = await readFile(file); const a = analyzeRows(rows); if (!a.fields.length) return toast('No numeric columns found in ' + name);
    const r = mergeIntoModel(name, a.fields, rows.length); go('model'); afterImport(name, r);
  } catch (e) { toast('Could not read file: ' + e.message); }
}
const SAMPLE = [['Month', 'Revenue', 'COGS', 'Operating Expenses', 'Marketing', 'Units Sold'], ...['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((m, i) => [m, 820000 + i * 61000, 410000 + i * 26000, 150000 + i * 4000, 60000 + i * 5000, 680 + i * 45])];

/* Import wizard */
let wiz = { step: 1, name: '', rows: [], fields: [] };
function renderImport() {
  $$('#importSteps .step').forEach((s, i) => s.classList.toggle('on', i + 1 === wiz.step));
  const b = $('#importBody');
  if (wiz.step === 1) {
    b.innerHTML = `<h3 style="text-align:center">Let’s get your data in</h3><p class="hint" style="text-align:center;margin-bottom:16px">Upload your financial data to start building your model</p>
      <label class="drop" id="drop"><input type="file" id="wizFile" accept=".xlsx,.xls,.csv" hidden><div style="font-size:40px">⤒</div><b>Drag &amp; drop your file here</b><p class="hint">or click to browse · .xlsx, .xls, .csv</p></label>
      <p style="text-align:center"><a class="more" id="wizSample">Use sample data instead</a></p>`;
  } else if (wiz.step === 2) {
    const rows = wiz.rows.slice(0, 16);
    b.innerHTML = `<h3>Review your dataset</h3><p class="hint">🟩 ${esc(wiz.name)} · ${wiz.rows.length} rows · ${(wiz.rows[0] || []).length} columns</p><br>
      <div class="preview-tbl"><table>${rows.map((r, i) => `<tr>${r.map(c => i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`).join('')}</tr>`).join('')}</table></div>
      <p class="hint" style="margin-top:10px">Detected ${wiz.fields.length} numeric field(s): ${wiz.fields.map(f => esc(f.label)).join(', ')}</p>
      <div class="fe-actions"><button class="btn" data-wiz="1">Back</button><button class="btn primary" data-wiz="3">Next: Map Columns →</button></div>`;
  } else if (wiz.step === 3) {
    b.innerHTML = `<h3>Map your Columns</h3><p class="hint">Choose which fields become model inputs, rename them and pick how rows are aggregated.</p><br>
      <div class="map-row hint"><b>Your file columns</b><span></span><b>Finworld input &amp; aggregation</b></div>
      ${wiz.fields.map((f, i) => `<div class="map-row"><label><input type="checkbox" data-map-inc="${i}" ${f.include ? 'checked' : ''}> ${esc(f.label)}</label><span>→</span>
        <div style="display:flex;gap:6px"><input data-map-name="${i}" value="${esc(f.label)}" style="border:1px solid #d1d5db;border-radius:4px;padding:6px;flex:1;min-width:0">
        ${f.vals ? `<select data-map-agg="${i}" style="width:100px">${['Sum', 'Average', 'First', 'Last', 'Max', 'Min'].map(a => `<option ${a === f.agg ? 'selected' : ''}>${a}</option>`).join('')}</select>` : ''}</div></div>`).join('')}
      <div class="fe-actions"><button class="btn" data-wiz="2">Back</button><button class="btn primary" data-wiz="4">Next: Confirm →</button></div>`;
  } else {
    const inc = wiz.fields.filter(f => f.include);
    b.innerHTML = `<h3>Confirmation</h3><p class="hint">These inputs will be added to <b>${esc(model.name)}</b>:</p><br>
      <div class="sheet"><table><tr><th>Input</th><th>Aggregation</th><th>Value</th></tr>${inc.map(f => `<tr><td>${esc(f.label)}</td><td>${f.agg}</td><td>${num(f.vals ? AGG[f.agg](f.vals) : f.value)}</td></tr>`).join('')}</table></div>
      <div class="fe-actions"><button class="btn" data-wiz="3">Back</button><button class="btn primary" id="wizFinish">Send to Model Analysis Tool →</button></div>`;
  }
}
async function wizLoad(file) {
  try { const r = await readFile(file); startWizard(r.name, r.rows); } catch (e) { toast('Could not read file: ' + e.message); }
}
function startWizard(name, rows) {
  const a = analyzeRows(rows); if (!a.fields.length) return toast('No numeric data found in ' + name);
  wiz = { step: 2, name, rows, fields: a.fields }; renderImport();
}

/* ---------------- Dashboard ---------------- */
const DASH_DEFAULT = { price: 1200, units: 50000, growth: 12, varCost: 600, fixedCost: 50000, inflation: 30, tax: 25 };
let dash = { ...DASH_DEFAULT };
const DASH_FIELDS = [['REVENUE DRIVERS', [['price', 'Price per Unit (₹)', 50], ['units', 'Units Sold (1 year)', 1000], ['growth', 'Revenue Growth Rate (%)', 1]]],
  ['COST DRIVERS', [['varCost', 'Variable Cost per Unit (₹)', 25], ['fixedCost', 'Fixed Cost per Month (₹)', 5000], ['inflation', 'Cost Inflation Rate (%)', 1]]],
  ['TAX & FINANCING', [['tax', 'Tax Rate (%)', 1]]]];
function dashCalc(d = dash) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const season = [0.92, 0.88, 1.02, 0.95, 1.05, 1.0, 0.97, 1.03, 1.08, 1.12, 1.06, 0.92];
  const rev = months.map((_, m) => (d.price * d.units / 12) * Math.pow(1 + d.growth / 100, m / 12) * season[m]);
  const cost = months.map((_, m) => d.varCost * d.units / 12 * season[m] + d.fixedCost * Math.pow(1 + d.inflation / 100, m / 12));
  const pbt = rev.map((r, m) => r - cost[m]); const net = pbt.map(p => (p > 0 ? p * (1 - d.tax / 100) : p));
  let cash = 0; const cashArr = net.map(n => (cash += n * 0.8));
  const totalRev = rev.reduce((a, b) => a + b, 0), totalNet = net.reduce((a, b) => a + b, 0), totalVar = d.varCost * d.units, totalFixed = cost.reduce((a, b) => a + b, 0) - totalVar;
  return { months, rev, cost, net, cashArr, totalRev, totalNet, totalVar, totalFixed, gross: (totalRev - totalVar) / totalRev * 100, op: (totalRev - totalVar - totalFixed) / totalRev * 100, netM: totalNet / totalRev * 100 };
}
function renderDashInputs() {
  $('#dashInputs').innerHTML = DASH_FIELDS.map(([g, fs]) => `<div class="group"><h4>${g}</h4>${fs.map(([k, l, st]) => `<div class="field"><label>${l}</label><div class="stepper"><input type="number" value="${dash[k]}" data-dash="${k}"><button data-step="${k}" data-by="${-st}">−</button><button data-step="${k}" data-by="${st}">+</button></div></div>`).join('')}</div>`).join('');
}
function renderDash() {
  if (!$('#dashInputs').children.length) renderDashInputs();
  const r = dashCalc(), yrs = [2022, 2023, 2024, 2025, 2026];
  $('#kRev').textContent = inr(r.totalRev); $('#kRevF').textContent = '↑ ' + dash.growth + '%';
  $('#kNet').textContent = inr(r.totalNet); $('#kNetF').textContent = num(r.netM, 1) + '%';
  $('#kCash').textContent = inr(r.cashArr[11]); const lo = r.cashArr.indexOf(Math.min(...r.cashArr)); $('#kCashF').textContent = r.months[lo] + ' · ' + inr(r.cashArr[lo]);
  const k = v => v / 1e5; // lakhs
  chart('cRev', { type: 'line', data: { labels: r.months, datasets: [{ data: r.rev.map(k), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.12)', fill: true, tension: .35, pointRadius: 0 }] }, options: baseOpts });
  chart('cNet', { type: 'bar', data: { labels: yrs, datasets: [{ data: yrs.map((_, i) => k(r.totalRev / Math.pow(1 + dash.growth / 100, 4 - i))), backgroundColor: '#14532d' }, { data: yrs.map((_, i) => k(r.totalNet / Math.pow(1 + dash.growth / 100, 4 - i))), backgroundColor: '#eab308' }] }, options: baseOpts });
  chart('cCash', { type: 'line', data: { labels: r.months, datasets: [{ data: r.cashArr.map(k), borderColor: '#3b5bfd', pointBackgroundColor: '#fff', tension: 0 }] }, options: baseOpts });
  chart('cTrend', { type: 'line', data: { labels: r.months, datasets: [{ label: 'Revenue', data: r.rev.map(k), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.08)', fill: true, pointRadius: 0 }, { label: 'Net Profit', data: r.net.map(k), borderColor: '#14532d', backgroundColor: 'rgba(20,83,45,.12)', fill: true, pointRadius: 0 }] }, options: { ...baseOpts, plugins: { legend: { display: true, position: 'right', labels: { boxWidth: 8, font: { size: 11 } } } } } });
  const exp = [['Salaries', r.totalFixed * .5, '#2563eb'], ['Marketing', r.totalFixed * .2, '#22c55e'], ['Operations', r.totalVar, '#f59e0b'], ['Rent & Utilities', r.totalFixed * .18, '#f87171'], ['Technology', r.totalFixed * .12, '#06b6d4']];
  const tot = exp.reduce((a, e) => a + e[1], 0);
  chart('cExp', { type: 'doughnut', data: { labels: exp.map(e => e[0]), datasets: [{ data: exp.map(e => e[1]), backgroundColor: exp.map(e => e[2]) }] }, options: { plugins: { legend: { display: false } }, cutout: '55%', responsive: false } });
  $('#expLegend').innerHTML = exp.map(e => `<li><span><i style="background:${e[2]}"></i>${e[0]}</span><span>${inr(e[1])}</span><span>${num(e[1] / tot * 100, 0)}%</span></li>`).join('') + `<li style="border-top:1px solid #e5e7eb;margin-top:6px;padding-top:8px"><b>Total Expenses</b><b>${inr(tot)}</b></li>`;
  $('#margins').innerHTML = [['Gross Profit Margin', r.gross], ['Operating Profit Margin', r.op], ['Net Profit Margin', r.netM]].map(([l, v]) => `<div class="margin-card"><span>${l}<b>${num(v, 1)}%</b></span><span style="color:${v >= 0 ? '#16a34a' : '#dc2626'}">${v >= 0 ? '▲ healthy' : '▼ loss'}</span></div>`).join('');
  $('#topExp').innerHTML = exp.sort((a, b) => b[1] - a[1]).slice(0, 4).map(e => `<div style="margin-top:12px;font-size:13px;display:flex;justify-content:space-between"><span>${e[0]}</span><span>${num(e[1] / tot * 100, 1)}%</span></div><div class="bar"><i style="width:${e[1] / tot * 100}%"></i></div>`).join('');
  const lowCash = r.cashArr.some(c => c < 0);
  $('#insights').innerHTML = [[`Revenue grows ${dash.growth}% YoY`, `${inr(r.rev[0])} → ${inr(r.rev[11])} / month`], [`Operations are ${num(r.totalVar / tot * 100, 0)}% of expenses`, 'variable cost × units'], [lowCash ? 'Cash dips below zero' : `Net margin ${num(r.netM, 1)}%`, lowCash ? 'review fixed costs or pricing' : 'after ' + dash.tax + '% tax']]
    .map(([a, b]) => `<div>📈 ${a}<small>${b}</small></div>`).join('');
}

/* ---------------- Nova AI ---------------- */
const GLOSSARY = {
  'ebitda': 'EBITDA = Earnings Before Interest, Taxes, Depreciation & Amortization. It shows operating profitability before financing and accounting decisions: Revenue − Operating costs (excluding D&A).',
  'gross margin': 'Gross Margin = (Revenue − Cost of Goods Sold) ÷ Revenue × 100. It tells you what % of each rupee of sales is left after the direct cost of making the product.',
  'net profit': 'Net Profit is what remains after ALL expenses, interest and taxes: Revenue − COGS − Operating expenses − Interest − Tax. It is the “bottom line”.',
  'operating margin': 'Operating Margin = Operating Profit ÷ Revenue × 100 — profitability from core operations before interest and tax.',
  'cogs': 'COGS (Cost of Goods Sold) are the direct costs of producing what you sell — materials, direct labour, manufacturing overhead.',
  'revenue': 'Revenue (top line) is the total income from sales before any costs are deducted: Price × Units sold.',
  'cash flow': 'Cash Flow is the net movement of cash in and out of the business. Positive operating cash flow means operations generate cash.',
  'free cash flow': 'Free Cash Flow = Operating Cash Flow − Capital Expenditure. It is the cash available to repay debt or return to investors.',
  'burn rate': 'Burn Rate is how much cash a company loses per month. Net burn = Expenses − Revenue.',
  'runway': 'Runway = Cash in Bank ÷ Net Monthly Burn — the number of months before cash runs out.',
  'break even': 'Break-even point = Fixed Costs ÷ (Price − Variable Cost per unit). It is the number of units where profit is exactly zero.',
  'contribution margin': 'Contribution Margin = Price − Variable Cost per unit. It is what each unit contributes towards fixed costs and profit.',
  'fixed cost': 'Fixed Costs stay the same regardless of output (rent, salaries, software subscriptions).',
  'variable cost': 'Variable Costs change in proportion to output (raw materials, shipping, payment fees).',
  'dcf': 'DCF (Discounted Cash Flow) values a business by discounting its projected free cash flows back to today using a discount rate (usually WACC).',
  'npv': 'NPV (Net Present Value) = Σ Cash flowₜ ÷ (1 + r)ᵗ − Initial investment. Positive NPV means the investment creates value.',
  'irr': 'IRR (Internal Rate of Return) is the discount rate that makes NPV = 0. Compare it to your cost of capital.',
  'wacc': 'WACC (Weighted Average Cost of Capital) is the blended cost of equity and debt — the usual discount rate in a DCF.',
  'roi': 'ROI = (Gain − Cost) ÷ Cost × 100. A simple measure of investment return.',
  'cagr': 'CAGR = (End value ÷ Start value)^(1/years) − 1. The smoothed annual growth rate.',
  'ltv': 'LTV (Customer Lifetime Value) ≈ ARPU × Gross margin ÷ Churn rate — the profit you expect from a customer over their lifetime.',
  'cac': 'CAC (Customer Acquisition Cost) = Sales & Marketing spend ÷ New customers acquired.',
  'churn': 'Churn Rate = Customers lost in a period ÷ Customers at start × 100.',
  'arpu': 'ARPU (Average Revenue Per User) = Revenue ÷ Number of users.',
  'mrr': 'MRR (Monthly Recurring Revenue) is predictable subscription revenue per month. ARR = MRR × 12.',
  'working capital': 'Working Capital = Current Assets − Current Liabilities. It measures short-term liquidity.',
  'depreciation': 'Depreciation spreads the cost of a tangible asset over its useful life, e.g. straight-line = (Cost − Salvage) ÷ Years.',
  'amortization': 'Amortization spreads the cost of an intangible asset (or a loan principal) over time.',
  'emi': 'EMI = P × r × (1+r)ⁿ ÷ ((1+r)ⁿ − 1), where P is principal, r the monthly rate and n the number of months.',
  'p&l': 'A P&L (Profit & Loss statement) runs Revenue → COGS → Gross Profit → Operating expenses → EBITDA → D&A, Interest, Tax → Net Profit.',
  'balance sheet': 'The Balance Sheet shows Assets = Liabilities + Equity at a point in time.',
  'sensitivity analysis': 'Sensitivity analysis changes one input at a time to see how much an output moves — it shows which drivers matter most.',
  'inflation': 'Inflation is the rate at which prices rise over time; in a model it compounds costs: Cost × (1 + inflation)ᵗ.',
};
const ALIAS = { 'gross profit margin': 'gross margin', 'profit and loss': 'p&l', 'p and l': 'p&l', 'income statement': 'p&l', 'breakeven': 'break even', 'break-even': 'break even', 'lifetime value': 'ltv', 'customer acquisition cost': 'cac', 'net present value': 'npv', 'internal rate of return': 'irr', 'discounted cash flow': 'dcf', 'cost of goods sold': 'cogs', 'return on investment': 'roi', 'fcf': 'free cash flow' };
const DASH_ALIAS = { price: ['price', 'price per unit', 'selling price', 'unit price'], units: ['units', 'units sold', 'volume', 'quantity', 'sales volume'], growth: ['growth', 'growth rate', 'revenue growth'], varCost: ['variable cost', 'variable', 'unit cost', 'cost per unit'], fixedCost: ['fixed cost', 'fixed', 'overhead', 'fixed costs'], inflation: ['inflation', 'cost inflation'], tax: ['tax', 'tax rate'] };

function parseAmount(s) {
  const m = String(s).replace(/,/g, '').match(/(-?\d+(?:\.\d+)?)\s*(k|thousand|m|mn|million|l|lakh|lac|cr|crore)?\b/i); if (!m) return null;
  const mult = { k: 1e3, thousand: 1e3, m: 1e6, mn: 1e6, million: 1e6, l: 1e5, lakh: 1e5, lac: 1e5, cr: 1e7, crore: 1e7 }[(m[2] || '').toLowerCase()] || 1;
  return +m[1] * mult;
}
const words = s => s.toLowerCase().replace(/\(.*?\)|₹|%/g, ' ').split(/[^a-z0-9]+/).filter(w => w && !['the', 'of', 'a', 'my', 'per', 'to', 'by', 'in', 'q1'].includes(w));
/* Returns {target, key, label, value, set(v)} for whichever input set is active */
function matchTarget(phrase) {
  const pw = words(phrase); if (!pw.length) return null;
  if (route === 'dashboard') {
    let best = null, bs = 0;
    for (const [k, al] of Object.entries(DASH_ALIAS)) for (const a of al) { const aw = words(a); const s = aw.filter(w => pw.includes(w)).length / aw.length + (phrase.toLowerCase().includes(a) ? 1 : 0); if (s > bs) { bs = s; best = k; } }
    if (!best || bs < .5) return null;
    const lab = DASH_FIELDS.flatMap(g => g[1]).find(f => f[0] === best)[1];
    return { label: lab, value: dash[best], set: v => { dash[best] = v; renderDashInputs(); renderDash(); } };
  }
  let best = null, bs = 0;
  model.inputs.forEach(i => { const iw = words(i.label + ' ' + i.id.replace(/_/g, ' ')); const s = pw.filter(w => iw.includes(w) || iw.some(x => x.startsWith(w) && w.length > 2)).length / Math.max(pw.length, 1); if (s > bs) { bs = s; best = i; } });
  if (!best || bs < .34) return null;
  return { label: best.label, value: best.value, id: best.id, set: v => setInput(best.id, v, 'via Nova') };
}
function roleInput(re) { const unitRole = re.source.includes('volume'); return model.inputs.find(i => re.test(i.label) && !(unitRole && /price|cost|per unit/i.test(i.label))); }
function buildPL() {
  const R = { price: roleInput(/price|selling/i), units: roleInput(/unit(s)? sold|units|volume|qty|quantity/i), rev: roleInput(/revenue|sales/i), vc: roleInput(/variable/i), cogs: roleInput(/cogs|cost of (goods|sales)/i), fixed: roleInput(/fixed|overhead/i), opex: roleInput(/operating exp|opex/i), mkt: roleInput(/marketing/i), tax: roleInput(/tax/i) };
  const out = []; const add = (n, f, o) => { out.push(n); upsertCalc(n, f, o); };
  if (R.rev) add('Total Revenue', R.rev.id, 1); else if (R.price && R.units) add('Total Revenue', `${R.price.id} * ${R.units.id}`, 1); else return null;
  if (R.cogs) add('Cost of Sales', R.cogs.id, 0); else if (R.vc && R.units) add('Cost of Sales', `${R.vc.id} * ${R.units.id}`, 0);
  const cs = out.includes('Cost of Sales');
  add('Gross Profit', cs ? 'Total_Revenue - Cost_of_Sales' : 'Total_Revenue', 0);
  add('Gross Margin (%)', 'Gross_Profit / Total_Revenue * 100', 1);
  const opx = [R.fixed, R.opex, R.mkt].filter(Boolean).map(i => i.id);
  add('EBITDA', opx.length ? `Gross_Profit - ${opx.join(' - ')}` : 'Gross_Profit', 1);
  add('Net Profit', R.tax ? `EBITDA - IF(EBITDA > 0, EBITDA * ${R.tax.id} / 100, 0)` : 'EBITDA', 1);
  model.calcs = model.calcs.filter(c => c.formula || !out.some(o => slug(o) === c.id) && !/^(gross_margin|ebitda|net_profit|total_revenue)$/i.test(c.id));
  return out;
}
function firstOutput() { return model.calcs.find(c => c.output && calcValue(c) != null) || model.calcs.find(c => calcValue(c) != null); }
function sensitivity() {
  const tgt = firstOutput(); if (!tgt) return null; const base = calcValue(tgt);
  const rows = model.inputs.map(i => { const old = i.value; i.value = old * 1.1; const v = calcValue(tgt); i.value = old; return [i.label, v == null || !base ? 0 : (v - base) / Math.abs(base) * 100]; }).filter(r => Math.abs(r[1]) > 1e-9).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  return { tgt, rows };
}
function novaReply(raw) {
  const t = raw.trim(), q = t.toLowerCase();
  // navigation
  let m = q.match(/\b(go to|open|show|take me to)\s+(the\s+)?(dashboard|home|templates?|model|model analysis|import|data source)/);
  if (m) { const k = m[3]; if (k.startsWith('template')) { openTemplates(); return 'Opened the template library — pick one to start.'; } const r = k === 'home' ? 'home' : k === 'dashboard' ? 'dashboard' : k.startsWith('import') || k.startsWith('data') ? 'import' : 'model'; go(r); return `Done — you’re on ${r === 'model' ? 'the Model Analysis Tool' : r}.`; }
  // load a template
  const tpl = TEMPLATES.find(x => q.includes(x.name.toLowerCase().replace(/ model| calculator| analysis/, '')) && /(template|load|use|start|build|create)/.test(q) && !/statement/.test(q));
  if (tpl) { loadTemplate(tpl.id); return `Started a new model from the **${tpl.name}** template.`; }
  // what-if (non-destructive)
  m = q.match(/what if\s+(.+?)\s+(increases?|decreases?|goes up|goes down|drops?|rises?|is|was|becomes?)\s+(?:by\s+|to\s+)?(-?[\d.,]+\s*(?:k|m|l|lakh|cr|crore)?)\s*(%)?/);
  if (m) {
    const tg = matchTarget(m[1]); if (!tg) return `I couldn’t find an input matching “${m[1]}”.`;
    const amt = parseAmount(m[3]), down = /decrease|down|drop/.test(m[2]), abs = /is|was|become/.test(m[2]);
    const nv = abs ? amt : m[4] ? tg.value * (1 + (down ? -amt : amt) / 100) : tg.value + (down ? -amt : amt);
    if (route === 'dashboard') { const before = dashCalc().totalNet, key = Object.keys(dash).find(k => dash[k] === tg.value); const after = dashCalc({ ...dash, [key]: nv }).totalNet; return `What-if: ${tg.label} ${num(tg.value)} → ${num(nv)}\nNet profit would go from ${inr(before)} to ${inr(after)} (${after >= before ? '+' : ''}${num((after - before) / Math.abs(before || 1) * 100, 1)}%).\nSay “apply it” or “set ${words(tg.label).join(' ')} to ${Math.round(nv)}” to make it real.`; }
    const inp = model.inputs.find(i => i.id === tg.id), old = inp.value, outs = model.calcs.filter(c => c.output);
    const before = outs.map(c => calcValue(c)); inp.value = nv; const after = outs.map(c => calcValue(c)); inp.value = old;
    lastWhatIf = { id: tg.id, v: nv };
    return `What-if: ${tg.label} ${num(old)} → ${num(nv)}\n` + outs.map((c, i) => `• ${c.name}: ${fmtCalc(c, before[i])} → ${fmtCalc(c, after[i])}`).join('\n') + '\n\nSay “apply it” to keep this change.';
  }
  if (/^(apply it|apply|yes,? apply|keep it)/.test(q) && lastWhatIf) { setInput(lastWhatIf.id, lastWhatIf.v, 'what-if applied by Nova'); lastWhatIf = null; return '✅ Applied. All calculations updated.'; }
  // set / change
  m = t.match(/\b(?:set|change|make|update|put)\s+(?:the\s+)?(.+?)\s+(?:to|=|as)\s+(-?[\d.,]+\s*(?:k|m|l|lakh|lac|cr|crore|million|thousand)?)/i);
  if (m) { const tg = matchTarget(m[1]); if (!tg) return `I couldn’t find an input called “${m[1]}”. Available: ${route === 'dashboard' ? Object.keys(DASH_ALIAS).join(', ') : model.inputs.map(i => i.label).join(', ')}.`; const v = parseAmount(m[2]); const old = tg.value; tg.set(v); return `✅ ${tg.label}: ${num(old)} → ${num(v)}. Everything downstream has been recalculated.`; }
  m = t.match(/\b(increase|raise|grow|bump|decrease|reduce|lower|cut|drop)\s+(?:the\s+)?(.+?)\s+by\s+(-?[\d.,]+\s*(?:k|m|l|lakh|cr|crore)?)\s*(%|percent)?/i);
  if (m) { const tg = matchTarget(m[2]); if (!tg) return `I couldn’t find an input called “${m[2]}”.`; const a = parseAmount(m[3]), down = /decrease|reduce|lower|cut|drop/i.test(m[1]); const v = m[4] ? tg.value * (1 + (down ? -a : a) / 100) : tg.value + (down ? -a : a); const old = tg.value; tg.set(+v.toFixed(4)); return `✅ ${tg.label}: ${num(old)} → ${num(v)} (${down ? '−' : '+'}${num(a)}${m[4] ? '%' : ''}).`; }
  // add input
  m = t.match(/\badd\s+(?:an?\s+)?input\s+(?:called\s+)?(.+?)\s*(?:=|with value|of|as)\s*(-?[\d.,]+\s*(?:k|m|l|lakh|cr|crore)?)/i);
  if (m) { if (route !== 'model') go('model'); model.inputs.push(mkInput([m[1], parseAmount(m[2]), 'Nova'])); audit(`Nova added input ${m[1]}`); renderModel(); return `✅ Added input **${m[1]}** = ${num(parseAmount(m[2]))}. Reference it as \`${slug(m[1])}\`.`; }
  // add calculation
  m = t.match(/\b(?:add|create|make|new)\s+(?:a\s+)?(?:calculation|calc|formula|metric|output)\s+(?:called\s+|named\s+)?(.+?)\s*(?:=|as|:)\s*(.+)$/i);
  if (m) {
    if (route !== 'model') go('model');
    let f = m[2].trim().replace(/[A-Za-z][A-Za-z ]+[A-Za-z]/g, phrase => { if (FN[phrase.toUpperCase()] || findEntity(phrase)) return phrase; const tg = model.inputs.find(i => words(i.label).join(' ') === words(phrase).join(' ')) || model.calcs.find(c => words(c.name).join(' ') === words(phrase).join(' ')); return tg ? tg.id : phrase; })
      .replace(/\btimes\b|×/gi, '*').replace(/\bminus\b/gi, '-').replace(/\bplus\b/gi, '+').replace(/\bdivided by\b|÷/gi, '/');
    try { const r = evaluate(f, [slug(m[1])]); upsertCalc(m[1].trim(), f, true); renderModel(); return `✅ Added **${m[1].trim()}** = \`${f}\` → ${num(r.value)}.\nIt’s now an output in Model Structure.`; }
    catch (e) { return `I couldn’t build that formula (${e.message}). Inputs you can use: ${model.inputs.map(i => i.id).join(', ')}.`; }
  }
  m = t.match(/\b(?:remove|delete)\s+(?:the\s+)?(?:calculation|calc|output|input)?\s*(.+)/i);
  if (m && route === 'model') { const k = words(m[1]).join(' '); const c = model.calcs.find(x => words(x.name).join(' ') === k), i = model.inputs.find(x => words(x.label).join(' ') === k); if (c || i) { if (c) model.calcs = model.calcs.filter(x => x !== c); else model.inputs = model.inputs.filter(x => x !== i); audit(`Nova removed ${(c || i).name || i.label}`); selected = null; renderModel(); return `🗑 Removed ${c ? c.name : i.label}.`; } }
  // P&L
  if (/(profit\s*(&|and)\s*loss|p\s*&\s*l|income statement)/.test(q) && /(create|build|make|generate)/.test(q)) {
    if (route !== 'model') go('model'); const out = buildPL(); renderModel();
    if (!out) return 'To build a P&L I need either a Revenue input or both a Price and Units input. Upload a sheet or ask me to “add input Revenue = 1000000”.';
    return '✅ Built a Profit & Loss structure:\n' + out.map(n => { const c = model.calcs.find(x => x.id === slug(n)); return `• ${n} = ${c.formula}  →  ${fmtCalc(c, calcValue(c))}`; }).join('\n');
  }
  // suggestions
  if (/suggest|recommend|which calculation|what (should|can) i (calculate|add|build)|generate formula/.test(q)) {
    const ids = model.inputs.map(i => i.id), s = [];
    const p = roleInput(/price/i), u = roleInput(/unit|volume|qty/i), v = roleInput(/variable/i), f = roleInput(/fixed/i), rv = roleInput(/revenue|sales/i), cg = roleInput(/cogs|cost of/i);
    if (p && u) s.push(`Total Revenue = ${p.id} * ${u.id}`);
    if (p && v) s.push(`Contribution Margin = ${p.id} - ${v.id}`);
    if (p && v && f) s.push(`Break even Units = ${f.id} / (${p.id} - ${v.id})`);
    if (rv && cg) s.push(`Gross Margin (%) = (${rv.id} - ${cg.id}) / ${rv.id} * 100`);
    if (!s.length && ids.length >= 2) s.push(`Ratio = ${ids[0]} / ${ids[1]}`, `Difference = ${ids[0]} - ${ids[1]}`, `Total = SUM(${ids.slice(0, 4).join(', ')})`);
    if (route !== 'model') go('model');
    return 'Here are calculations that fit your inputs — say “add calculation …” with any of them:\n' + s.map(x => '• ' + x).join('\n') + '\n\nOr say “create a profit & loss statement” to build the full structure.';
  }
  if (/driver|sensitiv|what matters|impact/.test(q)) {
    if (route === 'dashboard') { const b = dashCalc().totalNet; const rows = Object.keys(dash).map(k => [DASH_FIELDS.flatMap(g => g[1]).find(f => f[0] === k)[1], (dashCalc({ ...dash, [k]: dash[k] * 1.1 }).totalNet - b) / Math.abs(b) * 100]).sort((a, c) => Math.abs(c[1]) - Math.abs(a[1])); return 'Impact of a +10% change on Net Profit:\n' + rows.map(r => `• ${r[0]}: ${r[1] >= 0 ? '+' : ''}${num(r[1], 1)}%`).join('\n') + `\n\nTop driver: **${rows[0][0]}**.`; }
    const s = sensitivity(); if (!s) return 'Add at least one calculation first — then I can rank which inputs drive it.';
    return `Key drivers of **${s.tgt.name}** (impact of +10% on each input):\n` + s.rows.map(r => `• ${r[0]}: ${r[1] >= 0 ? '+' : ''}${num(r[1], 1)}%`).join('\n') + (s.rows[0] ? `\n\n${s.rows[0][0]} is your biggest lever.` : '');
  }
  if (/insight|analy[sz]e|summar|how (is|am) (my|i)|health/.test(q)) {
    if (route === 'dashboard') { const r = dashCalc(); return `Snapshot:\n• Revenue ${inr(r.totalRev)} (growing ${dash.growth}%/yr)\n• Gross margin ${num(r.gross, 1)}%, net margin ${num(r.netM, 1)}%\n• Year-end cash ${inr(r.cashArr[11])}${r.cashArr.some(c => c < 0) ? '\n⚠️ Cash goes negative in some months — consider lowering fixed costs.' : ''}`; }
    const outs = model.calcs.filter(c => calcValue(c) != null);
    if (!outs.length) return `Your model has ${model.inputs.length} inputs but no calculations yet. Say “suggest calculation for my model”.`;
    const s = sensitivity();
    return `**${model.name}** — ${model.inputs.length} inputs, ${outs.length} working calculations:\n` + outs.map(c => `• ${c.name}: ${fmtCalc(c, calcValue(c))}`).join('\n') + (s?.rows[0] ? `\n\nBiggest driver of ${s.tgt.name}: ${s.rows[0][0]}.` : '');
  }
  if (/ad spe+d|ad spend|marketing/.test(q) && route === 'dashboard') return `Marketing is ~20% of fixed costs (${inr(dashCalc().totalFixed * .2)}). Each extra 1,000 units adds ${inr((dash.price - dash.varCost) * 1000)} contribution, so ad spend that brings > ${num(dashCalc().totalFixed * .2 / Math.max(dash.price - dash.varCost, 1), 0)} units/year pays for itself.`;
  if (/cash reserve|cash low|runway/.test(q) && route === 'dashboard') { const r = dashCalc(); const lo = Math.min(...r.cashArr); return lo < 0 ? `Cash turns negative (${inr(lo)}) during the year. Try “reduce fixed cost by 10%” or “increase price by 5%”.` : `Cash stays positive all year, ending at ${inr(r.cashArr[11])}. Lowest point: ${inr(lo)}.`; }
  if (/q4|forecast/.test(q) && route === 'dashboard') return `Q4 revenue is projected at ${inr(dashCalc().rev.slice(9).reduce((a, b) => a + b, 0))}. To adjust it, change the growth rate — e.g. “set growth rate to 15”.`;
  // glossary
  const key = Object.keys(ALIAS).find(a => q.includes(a)); const term = key ? ALIAS[key] : Object.keys(GLOSSARY).sort((a, b) => b.length - a.length).find(g => new RegExp('\\b' + g.replace(/[&]/g, '\\&') + '\\b').test(q));
  if (term) { let extra = ''; const c = model.calcs.find(x => words(x.name).join(' ').includes(term)); if (c && calcValue(c) != null) extra = `\n\nIn your model, ${c.name} is currently ${fmtCalc(c, calcValue(c))}.`; return GLOSSARY[term] + extra; }
  if (/^(hi|hello|hey)/.test(q)) return 'Hi Devon! I can explain finance terms, change inputs, add calculations and analyse your model. Try “what is EBITDA?”';
  return 'I can help with:\n• Explaining terms — “what is gross margin?”\n• Changing inputs — “set price per unit to 1500”, “increase units sold by 10%”\n• What-ifs — “what if tax rate increases by 5”\n• Building logic — “add calculation Profit = Total_Revenue - Fixed_Cost”, “create a profit & loss statement”\n• Analysis — “what are key profitability drivers?”';
}
let lastWhatIf = null;
const chatLog = [{ who: 'bot', t: 'Hello Devon! I’m Nova. I can help you build your financial model 👋 Ask me a finance question or tell me what to change.' }];
function md(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>'); }
function renderChat() { const c = $('#chat'); c.innerHTML = chatLog.map(m => `<div class="msg ${m.who} ${m.t.startsWith('✅') ? 'act' : ''}">${md(m.t)}</div>`).join(''); c.scrollTop = c.scrollHeight; renderNovaEmbeds(); }
function nova(text, open = true) { chatLog.push({ who: 'bot', t: text }); renderChat(); if (open) $('#novaDrawer').hidden = false; }
function ask(text) {
  if (!text.trim()) return; chatLog.push({ who: 'me', t: text }); $('#novaDrawer').hidden = false; renderChat();
  setTimeout(() => { let r; try { r = novaReply(text); } catch (e) { r = 'Sorry, something went wrong: ' + e.message; } nova(r); }, 350);
}
const SUGG = { home: ['What is EBITDA?', 'Open templates', 'Explain burn rate'], import: ['How should I map my columns?', 'What is COGS?', 'Explain gross margin'],
  dashboard: ['⚙ Optimize ad spend allocation', '⚠ Cash reserves low in 6 months?', '⟳ Forecast: adjust Q4 projection', 'What are key profitability drivers?'],
  model: ['Suggest calculation for my model', 'What are key profitability drivers?', 'Create a profit & loss statement'] };
function renderNovaEmbeds() {
  const last = chatLog.slice(-2);
  $$('[data-nova-embed]').forEach(el => {
    el.innerHTML = `<h4><span class="accent">✦ Nova</span> <small>AI Assistant</small></h4><div class="mini-chat">${last.map(m => `<div class="msg ${m.who}" style="margin:4px 0">${md(m.t.length > 220 ? m.t.slice(0, 220) + '…' : m.t)}</div>`).join('')}</div>
      ${(SUGG[route] || []).map(s => `<button class="sugg" data-ask="${esc(s.replace(/^[^A-Za-z]+/, ''))}">✦ ${esc(s)}</button>`).join('')}
      <form class="ask" data-embed-form><input placeholder="Ask Nova anything"><button>➤</button></form>`;
  });
}

/* ---------------- Events ---------------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-route],[data-action],[data-template],[data-ask],[data-close],[data-node],[data-insert],[data-add-calc],[data-edit-calc],[data-del-input],[data-open-recent],[data-cat],[data-wiz],[data-step],.tab');
  if (!t) return;
  if (t.matches('.tab')) return setTab(t.dataset.tab);
  if (t.dataset.route) return go(t.dataset.route, { tab: t.dataset.tab });
  if (t.dataset.template) return loadTemplate(t.dataset.template);
  if (t.dataset.ask) return ask(t.dataset.ask);
  if (t.dataset.close !== undefined) return (t.closest('.modal,.drawer').hidden = true);
  if (t.dataset.cat) { tplCat = t.dataset.cat; return openTemplates(); }
  if (t.dataset.wiz) { wiz.step = +t.dataset.wiz; return renderImport(); }
  if (t.dataset.step) { const k = t.dataset.step; dash[k] = Math.max(0, +(dash[k] + +t.dataset.by).toFixed(2)); renderDashInputs(); return renderDash(); }
  if (t.dataset.openRecent) { loadTemplate(['financial', 'revenue', 'breakeven', 'budget'][+t.dataset.openRecent]); return; }
  if (t.dataset.node) { const [kind, id] = t.dataset.node.split(':'); selected = { kind, id }; if (kind === 'calc') { startEdit(id); } renderModel(); if (kind === 'input') $('[data-prop="value"]')?.select(); return; }
  if (t.dataset.insert) { const f = $('#formula'); f.value = (f.value.trim() ? f.value.trimEnd() + ' ' : '') + t.dataset.insert + ' '; f.focus(); return livePreview(); }
  if (t.dataset.addCalc !== undefined) { selected = null; startEdit(null); $('#calcIsOutput').checked = false; $('#calcName').focus(); return; }
  if (t.dataset.editCalc) return startEdit(t.dataset.editCalc);
  if (t.dataset.delInput) { const i = model.inputs.find(x => x.id === t.dataset.delInput); model.inputs = model.inputs.filter(x => x !== i); audit('Removed input ' + i.label); selected = null; return renderModel(); }
  const a = t.dataset.action;
  if (a === 'templates') openTemplates();
  else if (a === 'newmodel') { model = BLANK(); model.name = 'New Model'; audit('Created new model'); selected = null; go('model'); toast('New model created'); }
  else if (a === 'nova') { $('#novaDrawer').hidden = !$('#novaDrawer').hidden; $('#chatInput').focus(); }
  else if (a === 'share') { navigator.clipboard?.writeText(location.href); toast('Share link copied to clipboard'); }
  else if (a === 'scenario') { go('dashboard'); nova('Scenarios: ask me “what if price per unit increases by 10%” to compare outcomes without changing your plan.'); }
  else if (a === 'soon') toast('Not part of this prototype yet');
});
['#chatForm'].forEach(s => $(s).addEventListener('submit', e => { e.preventDefault(); const i = $('#chatInput'); ask(i.value); i.value = ''; }));
document.addEventListener('submit', e => { if (e.target.matches('[data-embed-form]')) { e.preventDefault(); const i = e.target.querySelector('input'); ask(i.value); } });
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'formula') livePreview();
  if (t.id === 'tplSearch') renderTplGrid();
  if (t.dataset.dash) { dash[t.dataset.dash] = +t.value || 0; clearTimeout(t._d); t._d = setTimeout(renderDash, 250); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.sheetInput) return setInput(t.dataset.sheetInput, +t.value, 'sheet view');
  if (t.dataset.prop && selected) {
    if (selected.kind === 'input') { if (t.dataset.prop === 'value') setInput(selected.id, +t.value); else { const i = model.inputs.find(x => x.id === selected.id); i.label = t.value; renderModel(); } }
    else { const c = model.calcs.find(x => x.id === selected.id); if (t.dataset.prop === 'formula') { try { evaluate(t.value, [c.id]); c.formula = t.value; audit(`Updated ${c.name} = ${t.value}`); } catch (er) { toast(er.message); } } else c[t.dataset.prop] = t.dataset.prop === 'dp' ? +t.value : t.value; renderModel(); }
  }
  if (t.dataset.mapInc) wiz.fields[t.dataset.mapInc].include = t.checked;
  if (t.dataset.mapName) wiz.fields[t.dataset.mapName].label = t.value;
  if (t.dataset.mapAgg) wiz.fields[t.dataset.mapAgg].agg = t.value;
  if (t.id === 'excelInput' && t.files[0]) { quickImport(t.files[0]); t.value = ''; }
  if (t.id === 'wizFile' && t.files[0]) wizLoad(t.files[0]);
});
document.addEventListener('dragover', e => { const d = e.target.closest?.('#drop,.sources'); if (d) { e.preventDefault(); d.classList.add('over'); } });
document.addEventListener('dragleave', e => e.target.closest?.('#drop')?.classList.remove('over'));
document.addEventListener('drop', e => { const d = e.target.closest?.('#drop,.sources'); if (!d) return; e.preventDefault(); const f = e.dataTransfer.files[0]; if (!f) return; d.id === 'drop' ? wizLoad(f) : quickImport(f); });
document.addEventListener('click', e => {
  if (e.target.id === 'wizSample') startWizard('Financials_Q1_2026.xlsx', SAMPLE);
  if (e.target.id === 'wizFinish') { const nm = wiz.name, r = mergeIntoModel(nm, wiz.fields, wiz.rows.length); wiz = { step: 1 }; go('model'); afterImport(nm, r); }
  if (e.target.closest('#sampleExcel')) { const a = analyzeRows(SAMPLE); const r = mergeIntoModel('Financials_Q1_2026.xlsx', a.fields, SAMPLE.length); renderModel(); afterImport('Financials_Q1_2026.xlsx', r); }
  if (e.target.id === 'saveCalc') saveCalc();
  if (e.target.id === 'cancelCalc') { editing = null; $('#calcName').value = ''; $('#formula').value = ''; livePreview(); }
  if (e.target.id === 'deleteCalc' && editing) { model.calcs = model.calcs.filter(c => c.id !== editing); audit('Deleted calculation ' + editing); editing = null; selected = null; $('#calcName').value = ''; $('#formula').value = ''; renderModel(); }
  if (e.target.id === 'addComponent') { const n = prompt('Input name (e.g. Marketing Spend (₹))'); if (!n) return; const v = prompt('Value', '0'); model.inputs.push(mkInput([n, parseAmount(v) || 0])); audit('Added input ' + n); renderModel(); }
  if (e.target.id === 'resetInputs') { dash = { ...DASH_DEFAULT }; renderDashInputs(); renderDash(); toast('Inputs reset'); }
  if (e.target.id === 'applyChanges') { renderDash(); toast('Dashboard updated'); }
  if (e.target.id === 'dlPdf') window.print();
});
$('#ops').innerHTML = ['+', '−', '*', '/', '(', ')', '^', 'IF', 'SUM', 'AVERAGE', 'MIN', 'MAX', 'ROUND', 'ABS'].map(o => `<button data-op="${o}">${o}</button>`).join('');
$('#ops').addEventListener('click', e => { const o = e.target.dataset.op; if (!o) return; const f = $('#formula'); f.value += /^[A-Z]+$/.test(o) ? ` ${o}(` : ` ${o === '−' ? '-' : o} `; f.focus(); livePreview(); });
$('#formula').addEventListener('keydown', e => e.key === 'Enter' && saveCalc());
$('#globalSearch').addEventListener('keydown', e => { if (e.key !== 'Enter') return; const v = e.target.value.trim(); if (!v) return; const tp = TEMPLATES.find(t => t.name.toLowerCase().includes(v.toLowerCase())); if (tp) { openTemplates(); $('#tplSearch').value = v; renderTplGrid(); } else ask(v); e.target.value = ''; });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('#tplModal').hidden = true; } });
$('#tplModal').addEventListener('click', e => { if (e.target.id === 'tplModal') e.target.hidden = true; });

renderChat(); go('home');
