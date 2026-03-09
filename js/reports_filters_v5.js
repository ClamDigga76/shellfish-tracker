export function createReportsFilterHelpers({ parseUsDateToISODate, formatDateDMY, round2, downloadText }) {
  function isoToday() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function parseReportDateToISO(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    return parseUsDateToISODate(raw) || "";
  }

  function formatReportDateValue(value) {
    const iso = parseReportDateToISO(value);
    if (!iso) return String(value || "");
    return iso;
  }

  function modeRange(mode, fromMDY = "", toMDY = "") {
    const todayISO = isoToday();
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const m = String(mode || "").toUpperCase();

    // Back-compat: old keys
    if (m === "MONTH") mode = "THIS_MONTH";
    if (m === "7D") mode = "RANGE_7D";

    const M = String(mode || "").toUpperCase();

    if (M === "YTD") {
      const start = `${now.getFullYear()}-01-01`;
      return { startISO: start, endISO: todayISO, label: "YTD" };
    }
    if (M === "THIS_MONTH") {
      const start = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
      return { startISO: start, endISO: todayISO, label: "THIS_MONTH" };
    }
    if (M === "LAST_MONTH") {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      d.setMonth(d.getMonth() - 1);
      const start = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
      const endD = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const end = `${endD.getFullYear()}-${pad(endD.getMonth() + 1)}-${pad(endD.getDate())}`;
      return { startISO: start, endISO: end, label: "LAST_MONTH" };
    }
    if (M === "RANGE_7D") {
      const d = new Date(now);
      d.setDate(now.getDate() - 6);
      const start = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return { startISO: start, endISO: todayISO, label: "7D" };
    }
    if (M === "RANGE") {
      const s = parseReportDateToISO(fromMDY);
      const e = parseReportDateToISO(toMDY);
      if (s && e) {
        const a = s <= e ? { startISO: s, endISO: e } : { startISO: e, endISO: s };
        return { ...a, label: "RANGE" };
      }
      return { startISO: "", endISO: "", label: "RANGE" };
    }
    return { startISO: "", endISO: "", label: "ALL" };
  }

  function filterByISOInclusive(trips, startISO, endISO) {
    if (!startISO || !endISO) return trips.slice();
    const s = String(startISO);
    const e = String(endISO);
    return trips.filter((t) => {
      const d = String(t?.dateISO || "");
      if (!d) return false;
      return d >= s && d <= e;
    });
  }

  function formatISOForFile(iso) {
    return String(iso || "").slice(0, 10);
  }

  function tripsFilename(label, startISO = "", endISO = "") {
    const base = "shellfish_trips";
    const L = String(label || "").toUpperCase();
    if (L === "ALL") return `${base}_ALL.csv`;
    if (L === "YTD" || L === "12M" || L === "90D" || L === "30D") {
      if (startISO && endISO) return `${base}_${L}_${formatISOForFile(startISO)}_to_${formatISOForFile(endISO)}.csv`;
      return `${base}_${L}.csv`;
    }
    if (L === "RANGE" && startISO && endISO) {
      return `${base}_RANGE_${formatISOForFile(startISO)}_to_${formatISOForFile(endISO)}.csv`;
    }
    return `${base}.csv`;
  }

  function exportTripsWithLabel(trips, label, startISO = "", endISO = "") {
    const rows = Array.isArray(trips) ? trips : [];
    const csvEscape = (v) => {
      const s = String(v ?? "");
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const header = ["Date", "Dealer", "Area", "Pounds", "Amount", "$/Lb"].join(",");
    const lines = [header];
    for (const t of rows) {
      const date = formatDateDMY(String(t?.dateISO || ""));
      const dealer = String(t?.dealer || "");
      const area = String(t?.area || "");
      const lbs = Number(t?.pounds) || 0;
      const amt = Number(t?.amount) || 0;
      const ppl = lbs > 0 && amt > 0 ? amt / lbs : 0;
      lines.push([
        csvEscape(date),
        csvEscape(dealer),
        csvEscape(area),
        csvEscape(round2(lbs)),
        csvEscape(round2(amt)),
        csvEscape(round2(ppl))
      ].join(","));
    }
    const csv = lines.join("\n");
    const filename = tripsFilename(label, startISO, endISO);

    try {
      downloadText(filename, csv);
      return;
    } catch (e) {}

    try {
      const blob = new Blob([csv], { type: "text/csv" });
      const file = new File([blob], filename, { type: "text/csv" });
      if (navigator?.canShare && navigator.canShare({ files: [file] }) && navigator?.share) {
        navigator.share({ files: [file], title: "Trips CSV" });
        return;
      }
    } catch (e) {}

    try {
      const url = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
      window.open(url, "_blank");
    } catch (e) {}
  }

  return {
    isoToday,
    parseReportDateToISO,
    formatReportDateValue,
    modeRange,
    filterByISOInclusive,
    tripsFilename,
    exportTripsWithLabel
  };
}
