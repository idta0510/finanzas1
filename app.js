import {
    addMovement, deleteMovement,
    getMovementsByYearMonth, getAllMovementsByYear,
    setBudget, getBudgetsByYearMonth,
    exportYearToJSON, importFromJSON
} from "./db.js";

import { showToast } from "./ui.js";

import {
    drawBarLineSavings, drawTwoBars, drawPieAndBars, palette, drawStackedSavings
} from "./charts.js";

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const monthKeys = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

// Categorías exactas que pediste
const CATEGORIES = [
    "Sueldo", "Arriendo", "Transporte", "Teléfono", "Luz", "Agua", "Gas",
    "Mercadería", "Hormiga", "Streaming", "Pago CMR", "Ocio", "Gimnasio",
    "ChatGPT", "Spotify", "Ropa",
    "Ahorro", "Otros"
];

const $ = (id) => document.getElementById(id);

const statusLine = $("statusLine");
const swLine = $("swLine");

// Nav screens
const navItems = Array.from(document.querySelectorAll(".navItem"));
const screens = Array.from(document.querySelectorAll(".screen"));

// Dashboard controls
const yearInput = $("yearInput");
const monthSelectDash = $("monthSelectDash");
const btnRefreshDash = $("btnRefreshDash");

const kpiIncome = $("kpiIncome");
const kpiExpense = $("kpiExpense");
const kpiSaving = $("kpiSaving");
const kpiAccum = $("kpiAccum");

const chartSavingsByMonth = $("chartSavingsByMonth");
const chartIncomeExpenseMonth = $("chartIncomeExpenseMonth");
const chartPieDash = $("chartPieDash");

// Movimientos controls
const yearInputMov = $("yearInputMov");
const monthSelectMov = $("monthSelectMov");
const btnRefreshMov = $("btnRefreshMov");

const tabs = Array.from(document.querySelectorAll(".tab"));
const tabPanels = Array.from(document.querySelectorAll(".tabPanel"));

const fDate = $("fDate");
const fType = $("fType");
const fCategory = $("fCategory");
const fDesc = $("fDesc");
const fAmount = $("fAmount");
const formMove = $("formMove");

const mIncome = $("mIncome");
const mExpense = $("mExpense");
const mSaving = $("mSaving");
const monthBody = $("monthBody");

// Budget UI
const budgetGrid = $("budgetGrid");
const btnSaveBudgets = $("btnSaveBudgets");
const chartCatsMonth = $("chartCatsMonth");

// Ahorro screen
const yearInputSav = $("yearInputSav");
const btnRefreshSav = $("btnRefreshSav");
const kpiYearSaving = $("kpiYearSaving");
const kpiBestMonth = $("kpiBestMonth");
const kpiWorstMonth = $("kpiWorstMonth");
const kpiLastAccum = $("kpiLastAccum");
const chartAccumLine = $("chartAccumLine");
const annualBodySav = $("annualBodySav");

// Export / Import
const btnExport = $("btnExport");
const importFile = $("importFile");

function formatCLP(n) {
    const v = Number(n) || 0;
    return "$" + v.toLocaleString("es-CL");
}

function todayISO() {
    const d = new Date();
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(Date.now() - tz).toISOString().slice(0, 10);
}

function getSelectedYear(elInput) {
    const y = parseInt(elInput.value, 10);
    return Number.isFinite(y) ? y : new Date().getFullYear();
}

function sumMonth(rows) {
    let income = 0, expense = 0;
    for (const r of rows) {
        const amt = Number(r.amount) || 0;
        if (r.type === "Ingreso") income += amt;
        if (r.type === "Egreso") expense += amt;
    }
    return { income, expense, saving: income - expense };
}

function buildAnnual(yearRows, year) {
    const buckets = monthKeys.map(m => ({ month: m, income: 0, expense: 0, saving: 0, accum: 0 }));
    for (const r of yearRows) {
        if (r.year !== year) continue;
        const idx = parseInt(r.month, 10) - 1;
        if (idx < 0 || idx > 11) continue;
        const amt = Number(r.amount) || 0;
        if (r.type === "Ingreso") buckets[idx].income += amt;
        if (r.type === "Egreso") buckets[idx].expense += amt;
    }
    let acc = 0;
    for (const b of buckets) {
        b.saving = b.income - b.expense;
        acc += b.saving;
        b.accum = acc;
    }
    return buckets;
}

function setKpiColor(el, value) {
    el.style.color = value >= 0 ? "var(--good)" : "var(--bad)";
}

// -------------------- NAV + TABS --------------------
function showScreen(screenId) {
    screens.forEach(s => s.classList.remove("screen--active"));
    navItems.forEach(n => n.classList.remove("navItem--active"));

    document.getElementById(screenId).classList.add("screen--active");
    navItems.find(n => n.dataset.screen === screenId)?.classList.add("navItem--active");
}

function setActiveTab(tabId) {
    tabs.forEach(t => t.classList.toggle("tab--active", t.dataset.tab === tabId));
    tabPanels.forEach(p => p.classList.toggle("tabPanel--active", p.id === tabId));
}

// -------------------- INIT SELECTS --------------------
function fillMonthSelect(selectEl) {
    selectEl.innerHTML = "";
    monthNames.forEach((name, i) => {
        const opt = document.createElement("option");
        opt.value = monthKeys[i];
        opt.textContent = name;
        selectEl.appendChild(opt);
    });
}

function fillCategorySelect(selectEl) {
    selectEl.innerHTML = "";
    const first = document.createElement("option");
    first.value = "";
    first.textContent = "Selecciona…";
    first.disabled = true;
    first.selected = true;
    selectEl.appendChild(first);

    for (const c of CATEGORIES) {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        selectEl.appendChild(opt);
    }
}

// -------------------- BUDGET UI --------------------
function normalizeBudgetMap(rows) {
    const map = new Map();
    rows.forEach(r => map.set(r.category, Number(r.amount) || 0));
    // si falta alguna categoría, queda en 0
    for (const c of CATEGORIES) if (!map.has(c)) map.set(c, 0);
    return map;
}

function expensesByCategory(rows) {
    const map = new Map();
    for (const c of CATEGORIES) map.set(c, 0);
    for (const r of rows) {
        if (r.type !== "Egreso") continue;
        const cat = r.category;
        const amt = Number(r.amount) || 0;
        if (!map.has(cat)) map.set(cat, 0);
        map.set(cat, map.get(cat) + amt);
    }
    return map;
}


function renderBudgetGrid(budgetMap, spentMap) {
    budgetGrid.innerHTML = "";

    CATEGORIES.forEach((cat, idx) => {
        // presupuesto solo tiene sentido para egresos; pero tú quieres también “Ahorro”
        const budget = budgetMap.get(cat) || 0;
        const spent = spentMap.get(cat) || 0;

        const row = document.createElement("div");
        row.className = "budgetRow";

        row.innerHTML = `
      <div class="budgetRowTop">
        <b>${cat}</b>
        <div class="mini">
          <span>Gastado: <b style="color:var(--text)">${formatCLP(spent)}</b></span>
          <span>Presupuesto:</span>
          <input data-budget-cat="${cat}" type="number" min="0" step="1" inputmode="numeric"
                 value="${budget}" style="width:140px" />
        </div>
      </div>
      <div class="progress"><div data-progress-cat="${cat}"></div></div>
      <div class="warn" data-warn-cat="${cat}">⚠️ Pasaste el presupuesto en ${formatCLP(spent - budget)}.</div>
    `;

        budgetGrid.appendChild(row);

        // progress
        const bar = row.querySelector(`[data-progress-cat="${cat}"]`);
        const warn = row.querySelector(`[data-warn-cat="${cat}"]`);

        let pct = 0;
        if (budget > 0) pct = Math.min(150, Math.round((spent / budget) * 100));
        bar.style.width = `${pct}%`;

        // color progress
        if (budget === 0) bar.style.background = "rgba(148,163,184,.35)";
        else if (spent <= budget) bar.style.background = "rgba(34,197,94,.80)";
        else bar.style.background = "rgba(239,68,68,.80)";

        // warning
        if (budget > 0 && spent > budget) warn.classList.add("warn--show");
    });
}

async function saveBudgetsForSelectedMonth() {
    const year = getSelectedYear(yearInputMov);
    const month = monthSelectMov.value;

    const inputs = Array.from(document.querySelectorAll("[data-budget-cat]"));
    for (const inp of inputs) {
        const cat = inp.getAttribute("data-budget-cat");
        const amt = Number(inp.value) || 0;
        await setBudget(year, month, cat, amt);
    }
}

// -------------------- RENDER TABLES --------------------
function renderMovementsTable(rows) {
    monthBody.innerHTML = "";
    const sorted = rows.slice().sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    for (const r of sorted) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${r.date || "-"}</td>
      <td>${r.type}</td>
      <td>${r.category}</td>
      <td>${(r.description || "").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</td>
      <td class="num">${formatCLP(r.amount)}</td>
      <td class="num"><button class="btn btn--ghost" data-del="${r.id}">Eliminar</button></td>
    `;
        monthBody.appendChild(tr);
    }

    monthBody.querySelectorAll("[data-del]").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = Number(btn.getAttribute("data-del"));
            await deleteMovement(id);
            await refreshMovimientos(); // refresca pantalla actual
            await refreshDashboard();   // mantiene dashboard al día
            await refreshAhorro();      // mantiene ahorro al día
        });
    });
}

function renderMovementsCards(rows) {
    const container = document.getElementById("cardsContainer");
    if (!container) return;

    container.innerHTML = "";

    const sorted = rows.slice().sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    for (const r of sorted) {
        const card = document.createElement("div");
        card.className = `moveCard ${r.type === "Ingreso" ? "income" : "expense"}`;

        const safeDesc = (r.description || "")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;");

        const sign = r.type === "Ingreso" ? "" : "- ";

        card.innerHTML = `
            <div class="moveCardTop">
                <span>${r.category}</span>
                <span>${sign}${formatCLP(r.amount)}</span>
            </div>
            <div class="moveCardBottom">
                <span>${safeDesc}</span>
                <span>${r.date || "-"}</span>
            </div>
        `;

        container.appendChild(card);
    }
}

function renderAnnualTableSav(annual) {
    annualBodySav.innerHTML = "";
    for (let i = 0; i < 12; i++) {
        const a = annual[i];
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${monthNames[i]}</td>
      <td class="num">${formatCLP(a.income)}</td>
      <td class="num">${formatCLP(a.expense)}</td>
      <td class="num" style="color:${a.saving >= 0 ? "var(--good)" : "var(--bad)"}">${formatCLP(a.saving)}</td>
      <td class="num" style="color:${a.accum >= 0 ? "var(--good)" : "var(--bad)"}">${formatCLP(a.accum)}</td>
    `;
        annualBodySav.appendChild(tr);
    }
}

// -------------------- CHARTS --------------------
function drawDashboardCharts(annual, monthSummary) {
    const labelsShort = monthNames.map(m => m.slice(0, 3));
    const savings = annual.map(a => a.saving);
    const accum = annual.map(a => a.accum);
    const income = annual.map(a => a.income);
    const expense = annual.map(a => a.expense);

    drawStackedSavings(chartSavingsByMonth, labelsShort, income, expense, accum);

    drawTwoBars(
        chartIncomeExpenseMonth,
        ["Mes"],
        [monthSummary.income],
        [monthSummary.expense],
        "rgba(34,197,94,0.75)",
        "rgba(239,68,68,0.75)",
        "Verde: ingresos | Rojo: egresos"
    );
}

function drawCategoryCharts(rows) {
    // only expenses
    const spent = expensesByCategory(rows);

    const items = CATEGORIES.map((cat, i) => ({
        label: cat,
        value: spent.get(cat) || 0,
        color: palette(i)
    })).filter(it => it.value > 0);

    if (items.length === 0) {
        // draw empty
        const ctx = chartCatsMonth.getContext("2d");
        ctx.clearRect(0, 0, chartCatsMonth.width, chartCatsMonth.height);
        ctx.fillStyle = "rgba(156,163,175,0.9)";
        ctx.font = "14px system-ui";
        ctx.fillText("No hay egresos para graficar en este mes.", 16, 26);
        return;
    }

    drawPieAndBars(chartCatsMonth, items, "Torta + barras por categoría (Egresos del mes)");
}

function drawSavingsOnlyCharts(annual) {
    // acumulado line simple usando drawBarLineSavings con savings=0 (pero preferimos línea)
    // reutilizamos drawBarLineSavings: pondremos savings como annual.saving y accum como annual.accum
    const labelsShort = monthNames.map(m => m.slice(0, 3));
    const savings = annual.map(a => a.saving);
    const accum = annual.map(a => a.accum);
    drawBarLineSavings(chartAccumLine, labelsShort, savings, accum);
}

// -------------------- REFRESH FUNCTIONS --------------------
async function refreshDashboard() {
    const year = getSelectedYear(yearInput);
    const month = monthSelectDash.value;

    const yearRows = await getAllMovementsByYear(year);
    const annual = buildAnnual(yearRows, year);

    const monthRows = await getMovementsByYearMonth(year, month);
    const monthSummary = sumMonth(monthRows);

    const accumYear = annual[parseInt(month, 10) - 1]?.accum ?? (annual[11]?.accum ?? 0);

    kpiIncome.textContent = formatCLP(monthSummary.income);
    kpiExpense.textContent = formatCLP(monthSummary.expense);
    kpiSaving.textContent = formatCLP(monthSummary.saving);
    setKpiColor(kpiSaving, monthSummary.saving);

    // acumulado del año hasta el mes seleccionado (no todo el año necesariamente)
    kpiAccum.textContent = formatCLP(accumYear);
    setKpiColor(kpiAccum, accumYear);

    drawDashboardCharts(annual, monthSummary);
    drawDashboardPie(monthRows);
    statusLine.textContent = "✅ BD local activa (IndexedDB) · Offline listo";
}

function drawDashboardPie(rows) {
    const spent = expensesByCategory(rows);
    const items = CATEGORIES.map((cat, i) => ({
        label: cat,
        value: spent.get(cat) || 0,
        color: palette(i)
    })).filter(it => it.value > 0);

    if (items.length === 0) {
        const ctx = chartPieDash.getContext("2d");
        ctx.clearRect(0, 0, chartPieDash.width, chartPieDash.height);
        return;
    }
    // Reutilizamos drawPieAndBars o creamos uno nuevo. 
    // Usaremos drawPieAndBars que ya existe en charts.js y es lo que pide el usuario (torta).
    drawPieAndBars(chartPieDash, items, "Gastos por categoría");
}

async function refreshMovimientos() {
    const year = getSelectedYear(yearInputMov);
    const month = monthSelectMov.value;

    const rows = await getMovementsByYearMonth(year, month);
    const s = sumMonth(rows);

    mIncome.textContent = formatCLP(s.income);
    mExpense.textContent = formatCLP(s.expense);
    mSaving.textContent = formatCLP(s.saving);
    mSaving.style.color = s.saving >= 0 ? "var(--good)" : "var(--bad)";

    renderMovementsTable(rows);
    renderMovementsCards(rows);

    // budgets
    const budRows = await getBudgetsByYearMonth(year, month);
    const budgetMap = normalizeBudgetMap(budRows);
    const spentMap = expensesByCategory(rows);

    renderBudgetGrid(budgetMap, spentMap);
    drawCategoryCharts(rows);
}

async function refreshAhorro() {
    const year = getSelectedYear(yearInputSav);
    const yearRows = await getAllMovementsByYear(year);
    const annual = buildAnnual(yearRows, year);

    // KPIs
    const totalSaving = annual.reduce((s, a) => s + a.saving, 0);
    kpiYearSaving.textContent = formatCLP(totalSaving);
    setKpiColor(kpiYearSaving, totalSaving);

    const best = annual.reduce((p, a, i) => a.saving > p.val ? { val: a.saving, idx: i } : p, { val: -Infinity, idx: 0 });
    const worst = annual.reduce((p, a, i) => a.saving < p.val ? { val: a.saving, idx: i } : p, { val: Infinity, idx: 0 });

    kpiBestMonth.textContent = `${monthNames[best.idx]} (${formatCLP(best.val)})`;
    kpiBestMonth.style.color = best.val >= 0 ? "var(--good)" : "var(--bad)";

    kpiWorstMonth.textContent = `${monthNames[worst.idx]} (${formatCLP(worst.val)})`;
    kpiWorstMonth.style.color = worst.val >= 0 ? "var(--good)" : "var(--bad)";

    const lastAccum = annual[11]?.accum ?? 0;
    kpiLastAccum.textContent = formatCLP(lastAccum);
    setKpiColor(kpiLastAccum, lastAccum);

    drawSavingsOnlyCharts(annual);
    renderAnnualTableSav(annual);
}

// -------------------- EVENTS --------------------
function wireNav() {
    navItems.forEach(btn => {
        btn.addEventListener("click", () => showScreen(btn.dataset.screen));
    });
}

function wireTabs() {
    tabs.forEach(t => {
        t.addEventListener("click", () => setActiveTab(t.dataset.tab));
    });
}

function wireForms() {
    formMove.addEventListener("submit", async (e) => {
        e.preventDefault();

        const year = getSelectedYear(yearInputMov);
        const month = monthSelectMov.value;

        const date = fDate.value;
        const type = fType.value;
        const category = fCategory.value;
        const description = (fDesc.value || "").trim();
        const amount = Number(fAmount.value);

        if (!date || !type || !category || !Number.isFinite(amount) || amount <= 0) {
            showToast("Completa fecha, tipo, categoría y monto (>0).", "warning");
            return;
        }

        // Forzamos mes/año desde select (no desde fecha), así queda consistente con tu control mensual
        await addMovement({
            date,
            year,
            month,
            type,
            category,
            description,
            amount,
            createdAt: new Date().toISOString()
        });

        // limpiar
        fDesc.value = "";
        fAmount.value = "";

        // refrescar
        await refreshMovimientos();
        await refreshDashboard();
        await refreshAhorro();

        // ir a lista para ver
        setActiveTab("tabList");
    });

    btnSaveBudgets.addEventListener("click", async () => {
        await saveBudgetsForSelectedMonth();
        await refreshMovimientos();
        showToast("Presupuestos guardados ✅", "success");
    });
}

function wireRefreshButtons() {
    btnRefreshDash.addEventListener("click", refreshDashboard);
    btnRefreshMov.addEventListener("click", refreshMovimientos);
    btnRefreshSav.addEventListener("click", refreshAhorro);

    // al cambiar selects, refrescar suave
    monthSelectDash.addEventListener("change", refreshDashboard);
    monthSelectMov.addEventListener("change", refreshMovimientos);

    yearInput.addEventListener("change", refreshDashboard);
    yearInputMov.addEventListener("change", refreshMovimientos);
    yearInputSav.addEventListener("change", refreshAhorro);
}

function wireExportImport() {
    btnExport.addEventListener("click", async () => {
        const year = getSelectedYear(yearInput);
        const payload = await exportYearToJSON(year);

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `finanzas_${year}_backup.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    });

    importFile.addEventListener("change", async () => {
        const file = importFile.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const payload = JSON.parse(text);
            await importFromJSON(payload);

            showToast("Importación lista ✅", "success");
            await refreshDashboard();
            await refreshMovimientos();
            await refreshAhorro();
        } catch (err) {
            showToast("No se pudo importar: " + (err?.message || err), "error");
        } finally {
            importFile.value = "";
        }
    });
}

// -------------------- SERVICE WORKER --------------------
async function registerSW() {
    if (!("serviceWorker" in navigator)) {
        swLine.textContent = "Service Worker: no soportado";
        return;
    }
    try {
        const reg = await navigator.serviceWorker.register("./service-worker.js");
        swLine.textContent = "Service Worker: activo ✅";
    } catch {
        swLine.textContent = "Service Worker: error";
    }
}

// -------------------- BOOT --------------------
(function boot() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");

    // fill selects
    fillMonthSelect(monthSelectDash);
    fillMonthSelect(monthSelectMov);
    fillCategorySelect(fCategory);

    yearInput.value = y;
    yearInputMov.value = y;
    yearInputSav.value = y;

    monthSelectDash.value = m;
    monthSelectMov.value = m;

    fDate.value = todayISO();

    wireNav();
    wireTabs();
    wireForms();
    wireRefreshButtons();
    wireExportImport();
    registerSW();

    // default views
    showScreen("screenDashboard");
    setActiveTab("tabAdd");

    // initial refresh
    refreshDashboard();
    refreshMovimientos();
    refreshAhorro();
})();