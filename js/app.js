/* Phase 3A: Review → Confirm & Save (local) → Totals → History → CSV
   Stability rules:
   - No innerHTML for buttons/controls (prevents Safari weirdness)
   - All event listeners attached once on DOMContentLoaded
   - Storage wrapped in try/catch so UI always loads
*/
const DB_KEY = "sht_db_v1"; // Shellfish Harvest Tracker DB v1

function uuid() {
  return "r_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

function showBanner(msg, type = "info") {
  const b = document.getElementById("banner");
  if (!msg) {
    b.classList.add("hidden");
    b.textContent = "";
    b.classList.remove("error");
    return;
  }
  b.textContent = msg;
  b.classList.remove("hidden");
  b.classList.toggle("error", type === "error");
}

function safeParseJSON(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function loadDB() {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) return { version: 1, records: [] };
  const db = safeParseJSON(raw);
  if (!db || !Array.isArray(db.records)) return { version: 1, records: [] };
  return db;
}

function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function normalizeMoney(x) {
  const n = Number(String(x).replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(n)) return "";
  return (Math.round(n * 100) / 100).toFixed(2);
}

function normalizePounds(x) {
  const n = Number(String(x).replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(n)) return "";
  return String(Math.round(n * 100) / 100);
}

// MM/DD/YYYY -> YYYY-MM-DD
function toISODate(mmddyyyy) {
  const s = String(mmddyyyy || "").trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return "";
  let mm = Number(m[1]);
  let dd = Number(m[2]);
  let yy = Number(m[3]);
  if (yy < 100) yy = 2000 + yy;
  if (mm < 1 || mm > 12) return "";
  if (dd < 1 || dd > 31) return "";
  return `${yy.toString().padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function fromISODate(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${Number(m[2])}/${Number(m[3])}/${m[1]}`;
}

function todayISO() {
  const d = new Date();
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function parseOCRBestEffort(text) {
  const t = String(text || "");

  let date = "";
  const dm = t.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dm) date = `${Number(dm[1])}/${Number(dm[2])}/${dm[3]}`;

  let pounds = "";
  const lb = t.match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds)\b/i);
  if (lb) pounds = lb[1];
  if (!pounds) {
    const anyDec = t.match(/\b(\d{1,3}(?:\.\d{1,2})?)\b/);
    if (anyDec) pounds = anyDec[1];
  }

  let total = "";
  const money = t.match(/\$\s*([0-9,]+(?:\.\d{2})?)/);
  if (money) total = money[1].replace(/,/g, "");
  if (!total) {
    const dollars = t.match(/\b([0-9,]+(?:\.\d{2})?)\b[\s\n\r]*DOLLARS\b/i);
    if (dollars) total = dollars[1].replace(/,/g, "");
  }

  let dealer = "";
  const dealerLine = t.match(/^\s*([A-Z][A-Z\s&,.]+(?:INC\.|LLC|CO\.|COMPANY|SEAFOOD)[A-Z\s&,.]*)\s*$/m);
  if (dealerLine) dealer = dealerLine[1].trim();

  return {
    harvest_date: date,
    dealer,
    pounds,
    total,
    notes: "",
    raw_source: t
  };
}

function setTab(tabName) {
  document.querySelectorAll(".tab").forEach(btn => {
    const active = btn.dataset.tab === tabName;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll(".panel").forEach(p => {
    p.classList.toggle("active", p.id === `tab-${tabName}`);
  });
}

function fillReview(d) {
  document.getElementById("r_date").value = d.harvest_date || "";
  document.getElementById("r_dealer").value = d.dealer || "";
  document.getElementById("r_pounds").value = d.pounds || "";
  document.getElementById("r_total").value = d.total || "";
  document.getElementById("r_notes").value = d.notes || "";
  document.getElementById("r_raw").value = d.raw_source || "";
}

function readReview() {
  return {
    harvest_date: document.getElementById("r_date").value.trim(),
    dealer: document.getElementById("r_dealer").value.trim(),
    pounds: document.getElementById("r_pounds").value.trim(),
    total: document.getElementById("r_total").value.trim(),
    notes: document.getElementById("r_notes").value.trim(),
    raw_source: document.getElementById("r_raw").value.trim(),
  };
}

function validateRecordDraft(d) {
  const iso = toISODate(d.harvest_date);
  if (!iso) return "Harvest date must be MM/DD/YYYY.";
  if (!d.dealer) return "Dealer is required.";
  const pounds = Number(d.pounds);
  if (!Number.isFinite(pounds) || pounds <= 0) return "Pounds must be a positive number.";
  const total = Number(d.total);
  if (!Number.isFinite(total) || total <= 0) return "Total $ must be a positive number.";
  return "";
}

function buildRecordFromDraft(d) {
  const iso = toISODate(d.harvest_date);
  const pounds = Number(d.pounds);
  const total = Number(d.total);
  const pricePerLb = total / pounds;

  return {
    id: uuid(),
    created_at: new Date().toISOString(),
    harvest_date_iso: iso,
    harvest_date_display: fromISODate(iso),
    dealer: d.dealer.trim(),
    pounds: Math.round(pounds * 100) / 100,
    total: Math.round(total * 100) / 100,
    price_per_lb: Math.round(pricePerLb * 100) / 100,
    notes: d.notes || "",
    raw_source: d.raw_source || ""
  };
}

function refreshHistory() {
  const db = loadDB();
  const q = document.getElementById("searchText").value.trim().toLowerCase();
  const list = document.getElementById("historyList");
  list.textContent = "";

  const records = [...db.records].sort((a,b)=> (b.harvest_date_iso || "").localeCompare(a.harvest_date_iso || ""));

  const filtered = q
    ? records.filter(r =>
        (r.dealer || "").toLowerCase().includes(q) ||
        (r.notes || "").toLowerCase().includes(q) ||
        (r.harvest_date_display || "").toLowerCase().includes(q)
      )
    : records;

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No records yet.";
    list.appendChild(empty);
    return;
  }

  for (const r of filtered) {
    const item = document.createElement("div");
    item.className = "item";

    const top = document.createElement("div");
    top.className = "itemTop";

    const title = document.createElement("div");
    title.className = "itemTitle";
    title.textContent = `${r.harvest_date_display} • ${r.dealer}`;

    const amt = document.createElement("div");
    amt.textContent = `$${normalizeMoney(r.total)} • ${normalizePounds(r.pounds)} lb`;

    top.appendChild(title);
    top.appendChild(amt);

    const meta = document.createElement("div");
    meta.className = "itemMeta";
    meta.textContent = `$/lb: ${normalizeMoney(r.price_per_lb)}${r.notes ? " • " + r.notes : ""}`;

    item.appendChild(top);
    item.appendChild(meta);
    list.appendChild(item);
  }
}

function computeTotals(range) {
  const db = loadDB();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = null;

  if (range === "7d") {
    start = new Date(today);
    start.setDate(start.getDate() - 6);
  } else if (range === "mtd") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
  } else {
    start = new Date(today.getFullYear(), 0, 1);
  }

  const startISO = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,"0")}-${String(start.getDate()).padStart(2,"0")}`;
  const endISO = todayISO();

  const records = db.records.filter(r => r.harvest_date_iso >= startISO && r.harvest_date_iso <= endISO);

  const trips = records.length;
  const pounds = records.reduce((s,r)=> s + (Number(r.pounds)||0), 0);
  const total = records.reduce((s,r)=> s + (Number(r.total)||0), 0);
  const avg = pounds > 0 ? (total / pounds) : 0;

  return { trips, pounds, total, avg };
}

function refreshTotals() {
  const range = document.getElementById("totalsRange").value;
  const t = computeTotals(range);

  document.getElementById("k_trips").textContent = String(t.trips);
  document.getElementById("k_pounds").textContent = normalizePounds(t.pounds);
  document.getElementById("k_total").textContent = normalizeMoney(t.total);
  document.getElementById("k_avg").textContent = normalizeMoney(t.avg);
}

function buildCSV() {
  const db = loadDB();
  const rows = [];
  rows.push([
    "Harvest Date",
    "Harvest Date ISO",
    "Dealer",
    "Pounds",
    "Total $",
    "Price $/lb",
    "Notes",
    "Created At",
    "Record ID"
  ]);

  const records = [...db.records].sort((a,b)=> (a.harvest_date_iso || "").localeCompare(b.harvest_date_iso || ""));
  for (const r of records) {
    rows.push([
      r.harvest_date_display || "",
      r.harvest_date_iso || "",
      r.dealer || "",
      String(r.pounds ?? ""),
      normalizeMoney(r.total),
      normalizeMoney(r.price_per_lb),
      r.notes || "",
      r.created_at || "",
      r.id || ""
    ]);
  }

  const csv = rows.map(cols => cols.map(v => {
    const s = String(v ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }).join(",")).join("\n");

  document.getElementById("csvPreview").value = csv;
  return csv;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded", () => {
  // Tabs
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      setTab(btn.dataset.tab);
      showBanner("");
      if (btn.dataset.tab === "history") refreshHistory();
      if (btn.dataset.tab === "totals") refreshTotals();
      if (btn.dataset.tab === "export") buildCSV();
    });
  });

  // Capture mode toggle
  const captureMode = document.getElementById("captureMode");
  const manualBox = document.getElementById("manualBox");
  const ocrBox = document.getElementById("ocrBox");
  captureMode.addEventListener("change", () => {
    const isOCR = captureMode.value === "ocr";
    manualBox.classList.toggle("hidden", isOCR);
    ocrBox.classList.toggle("hidden", !isOCR);
  });

  // Manual -> Review
  document.getElementById("btnBuildReviewManual").addEventListener("click", () => {
    try {
      const d = {
        harvest_date: document.getElementById("m_date").value.trim(),
        dealer: document.getElementById("m_dealer").value.trim(),
        pounds: normalizePounds(document.getElementById("m_pounds").value),
        total: normalizeMoney(document.getElementById("m_total").value),
        notes: document.getElementById("m_notes").value.trim(),
        raw_source: ""
      };
      fillReview(d);
      setTab("review");
      showBanner("Review ready. Confirm & Save when it looks right.");
    } catch (e) {
      showBanner("Manual review build failed, but app is still running.", "error");
      console.error(e);
    }
  });

  document.getElementById("btnClearManual").addEventListener("click", () => {
    ["m_date","m_dealer","m_pounds","m_total","m_notes"].forEach(id => document.getElementById(id).value = "");
    showBanner("");
  });

  // OCR -> Review
  document.getElementById("btnBuildReviewOCR").addEventListener("click", () => {
    try {
      const raw = document.getElementById("ocrText").value;
      const d = parseOCRBestEffort(raw);
      d.pounds = normalizePounds(d.pounds);
      d.total = normalizeMoney(d.total);
      fillReview(d);
      setTab("review");
      showBanner("Parsed best-effort. Please verify all fields before saving.");
    } catch (e) {
      showBanner("OCR parse failed. You can still use Manual Entry.", "error");
      console.error(e);
    }
  });

  document.getElementById("btnClearOCR").addEventListener("click", () => {
    document.getElementById("ocrText").value = "";
    showBanner("");
  });

  // Review controls
  document.getElementById("btnBackToCapture").addEventListener("click", () => {
    setTab("capture");
    showBanner("");
  });

  document.getElementById("btnConfirmSave").addEventListener("click", () => {
    try {
      const draft = readReview();
      draft.pounds = normalizePounds(draft.pounds);
      draft.total = normalizeMoney(draft.total);

      const err = validateRecordDraft(draft);
      if (err) {
        showBanner(err, "error");
        return;
      }

      const rec = buildRecordFromDraft(draft);
      const db = loadDB();
      db.records.push(rec);
      saveDB(db);

      showBanner("Saved ✅ Record added to History and Totals.");
      setTab("history");
      refreshHistory();
      refreshTotals();
      buildCSV();
    } catch (e) {
      showBanner("Save failed, but the app is still usable.", "error");
      console.error(e);
    }
  });

  // Totals
  document.getElementById("btnRefreshTotals").addEventListener("click", () => {
    try { refreshTotals(); showBanner(""); } catch (e) { showBanner("Totals failed to load.", "error"); console.error(e); }
  });
  document.getElementById("totalsRange").addEventListener("change", () => refreshTotals());

  // History
  document.getElementById("searchText").addEventListener("input", () => refreshHistory());

  document.getElementById("btnDeleteAll").addEventListener("click", () => {
    const ok = confirm("Delete ALL records? This cannot be undone.");
    if (!ok) return;
    try {
      saveDB({ version: 1, records: [] });
      refreshHistory();
      refreshTotals();
      buildCSV();
      showBanner("All records deleted.");
    } catch (e) {
      showBanner("Delete failed.", "error");
      console.error(e);
    }
  });

  // Export
  document.getElementById("btnExportCSV").addEventListener("click", () => {
    try {
      const csv = buildCSV();
      const yy = new Date().getFullYear();
      downloadText(`shellfish_harvest_${yy}_YTD.csv`, csv);
      showBanner("CSV downloaded.");
    } catch (e) {
      showBanner("CSV export failed.", "error");
      console.error(e);
    }
  });

  document.getElementById("btnCopyCSV").addEventListener("click", async () => {
    try {
      const csv = buildCSV();
      await navigator.clipboard.writeText(csv);
      showBanner("CSV copied to clipboard.");
    } catch (e) {
      showBanner("Clipboard copy failed (iOS permissions). Use Download instead.", "error");
      console.error(e);
    }
  });

  // Initial
  try {
    refreshTotals();
    refreshHistory();
    buildCSV();
    showBanner("");
  } catch (e) {
    showBanner("App loaded with a non-fatal error. Most features should still work.", "error");
    console.error(e);
  }
});
