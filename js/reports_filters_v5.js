import { resolveModeDateRange } from "./utils_v5.js";

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
    return resolveModeDateRange(mode, fromMDY, toMDY, { isoToday, parseUsDateToISODate });
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
    const modeAliases = {
      MONTH: "THIS_MONTH",
      MTD: "THIS_MONTH",
      RANGE_7D: "7D"
    };
    const normalized = modeAliases[L] || L;
    const withDates = (token)=> `${base}_${token}_${formatISOForFile(startISO)}_to_${formatISOForFile(endISO)}.csv`;
    if (L === "ALL") return `${base}_ALL.csv`;
    if (normalized === "YTD" || normalized === "12M" || normalized === "90D" || normalized === "30D" || normalized === "7D" || normalized === "THIS_MONTH" || normalized === "LAST_MONTH") {
      if (startISO && endISO) return withDates(normalized);
      return `${base}_${normalized}.csv`;
    }
    if (normalized === "RANGE" && startISO && endISO) {
      return withDates("RANGE");
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
