export function escapeSettingsHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatDeletedStamp(value) {
  const iso = String(value || "").trim();
  if (!iso) return "recently";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "recently";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function normalizeLedgerStatus(value) {
  const raw = String(value || "").toLowerCase();
  if (raw === "pass" || raw === "fail" || raw === "not-run") return raw;
  return "not-run";
}

export function releaseStatusLabel(value) {
  if (value === "pass") return "Pass";
  if (value === "fail") return "Fail";
  return "Not run";
}

export function formatReleaseDraftStamp(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Not saved yet";
  return date.toLocaleString();
}
