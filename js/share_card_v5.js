function formatTripDate(parseReportDateToISO, rawDate) {
  const iso = parseReportDateToISO(rawDate || "") || "";
  if (!iso) return "Date not set";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${month}/${day}/${year}`;
}

function formatNumber(value, { digits = 2, suffix = "" } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return `0${suffix}`;
  const normalizedDigits = Number.isInteger(digits) ? Math.max(0, digits) : 2;
  return `${numeric.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: normalizedDigits
  })}${suffix}`;
}

function trimOrFallback(value, fallback = "Not set") {
  const trimmed = String(value || "").trim();
  return trimmed || fallback;
}

function buildShareCardFields({ trip, parseReportDateToISO, round2, formatMoney }) {
  const pounds = Number(trip?.pounds) || 0;
  const amount = Number(trip?.amount) || 0;
  const avgPerLb = pounds > 0 ? (amount / pounds) : 0;
  return {
    dateLabel: formatTripDate(parseReportDateToISO, trip?.dateISO),
    poundsLabel: formatNumber(round2(pounds), { digits: 2, suffix: " lbs" }),
    amountLabel: formatMoney(round2(amount)),
    avgLabel: formatMoney(round2(avgPerLb)),
    dealerLabel: trimOrFallback(trip?.dealer, "Dealer not set"),
    areaLabel: trimOrFallback(trip?.area, "Area not set")
  };
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = (error) => reject(error);
    img.src = src;
  });
}

async function buildShareCardBlob({ trip, parseReportDateToISO, round2, formatMoney, appVersion }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#071326");
  gradient.addColorStop(0.55, "#0d1f3b");
  gradient.addColorStop(1, "#050a14");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const accentGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  accentGradient.addColorStop(0, "rgba(46,143,255,0.45)");
  accentGradient.addColorStop(1, "rgba(255,202,88,0.5)");
  ctx.fillStyle = accentGradient;
  ctx.fillRect(0, 0, canvas.width, 14);

  ctx.fillStyle = "rgba(124,170,255,0.18)";
  ctx.beginPath();
  ctx.arc(920, 230, 200, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,190,88,0.12)";
  ctx.beginPath();
  ctx.arc(210, 1120, 240, 0, Math.PI * 2);
  ctx.fill();

  const innerX = 54;
  const innerY = 54;
  const innerW = canvas.width - (innerX * 2);
  const innerH = canvas.height - (innerY * 2);

  drawRoundedRect(ctx, innerX, innerY, innerW, innerH, 42);
  ctx.fillStyle = "rgba(8,15,27,0.62)";
  ctx.fill();
  ctx.strokeStyle = "rgba(144,191,255,0.42)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const iconSize = 84;
  const iconX = innerX + 54;
  const iconY = innerY + 52;
  try {
    const iconVersion = appVersion ? `?v=${encodeURIComponent(String(appVersion))}` : "";
    const icon = await loadImage(`./icons/icon-192.png${iconVersion}`);
    drawRoundedRect(ctx, iconX - 2, iconY - 2, iconSize + 4, iconSize + 4, 22);
    ctx.fillStyle = "rgba(13,28,52,0.9)";
    ctx.fill();
    ctx.save();
    drawRoundedRect(ctx, iconX, iconY, iconSize, iconSize, 20);
    ctx.clip();
    ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
    ctx.restore();
  } catch (_error) {
    ctx.fillStyle = "#79adff";
    ctx.font = "700 44px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText("BC", iconX + 12, iconY + 56);
  }

  ctx.fillStyle = "#f4f8ff";
  let logoDrawn = false;
  try {
    const logo = await loadImage("./docs/brand/reference/source-inputs/bank-the-catch-logo-horizontal.png?v=692");
    const logoWidth = 360;
    const ratio = logo.naturalWidth > 0 ? (logo.naturalHeight / logo.naturalWidth) : 0.23;
    const logoHeight = Math.max(62, Math.round(logoWidth * ratio));
    ctx.drawImage(logo, innerX + 164, innerY + 62, logoWidth, logoHeight);
    logoDrawn = true;
  } catch (_error) {
    logoDrawn = false;
  }
  if (!logoDrawn) {
    ctx.font = "700 52px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText("Bank the Catch", innerX + 164, innerY + 110);
  }

  ctx.fillStyle = "rgba(198,219,255,0.92)";
  ctx.font = "600 28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText("Last Saved Trip", innerX + 164, innerY + 152);

  const fields = buildShareCardFields({ trip, parseReportDateToISO, round2, formatMoney });
  const topMetrics = [
    { label: "Trip Date", value: fields.dateLabel },
    { label: "Pounds", value: fields.poundsLabel },
    { label: "Amount", value: fields.amountLabel },
    { label: "Avg $/lb", value: fields.avgLabel }
  ];
  const lowerMetrics = [
    { label: "Dealer", value: fields.dealerLabel },
    { label: "Area", value: fields.areaLabel }
  ];

  const cardX = innerX + 52;
  const cardY = innerY + 212;
  const cardW = innerW - 104;
  const rowH = 126;

  topMetrics.forEach((metric, idx) => {
    const y = cardY + (idx * rowH);
    drawRoundedRect(ctx, cardX, y, cardW, 104, 24);
    ctx.fillStyle = "rgba(16,33,60,0.82)";
    ctx.fill();
    ctx.strokeStyle = "rgba(122,164,238,0.33)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "rgba(171,198,237,0.95)";
    ctx.font = "600 24px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText(metric.label, cardX + 28, y + 38);

    ctx.fillStyle = "#f2f8ff";
    ctx.font = "700 42px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText(metric.value, cardX + 28, y + 84);
  });

  const lowerY = cardY + (topMetrics.length * rowH) + 10;
  lowerMetrics.forEach((metric, idx) => {
    const y = lowerY + (idx * 116);
    drawRoundedRect(ctx, cardX, y, cardW, 96, 22);
    ctx.fillStyle = "rgba(17,30,55,0.72)";
    ctx.fill();

    ctx.fillStyle = "rgba(171,198,237,0.92)";
    ctx.font = "600 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText(metric.label, cardX + 26, y + 35);

    ctx.fillStyle = "#f2f8ff";
    ctx.font = "700 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText(metric.value, cardX + 26, y + 76);
  });

  ctx.fillStyle = "#86beff";
  ctx.shadowColor = "rgba(95,171,255,0.25)";
  ctx.shadowBlur = 8;
  ctx.font = "600 24px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText("Logged with Bank the Catch", innerX + 58, innerY + innerH - 60);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (!nextBlob) {
        reject(new Error("share-card-blob-failed"));
        return;
      }
      resolve(nextBlob);
    }, "image/png", 1);
  });

  return blob;
}

function downloadBlob(blob, filename) {
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1200);
}

export function createTripShareCardSeam({ parseReportDateToISO, round2, formatMoney }) {
  async function buildTripCardImage(trip) {
    if (!trip || !trip.id) return { ok: false, reason: "missing-trip" };
    const appVersion = String(window?.APP_VERSION || "").trim();
    const blob = await buildShareCardBlob({
      trip,
      parseReportDateToISO,
      round2,
      formatMoney,
      appVersion
    });
    const safeDate = (parseReportDateToISO(trip?.dateISO || "") || "trip").replace(/[^0-9-]/g, "");
    const fileName = `bank-the-catch-trip-${safeDate || "card"}.png`;
    return { ok: true, blob, fileName };
  }

  async function saveTripCardImage(trip) {
    const imageResult = await buildTripCardImage(trip);
    if (!imageResult?.ok) return imageResult;
    const { blob, fileName } = imageResult;
    downloadBlob(blob, fileName);
    return { ok: true, method: "download" };
  }

  async function shareTripCardImage(trip) {
    const imageResult = await buildTripCardImage(trip);
    if (!imageResult?.ok) return imageResult;
    const { blob, fileName } = imageResult;

    let canShareFiles = false;
    if (typeof navigator !== "undefined" && navigator?.canShare) {
      try {
        const shareProbeFile = new File([blob], fileName, { type: "image/png" });
        canShareFiles = navigator.canShare({ files: [shareProbeFile] });
      } catch (_error) {
        canShareFiles = false;
      }
    }

    if (canShareFiles && navigator?.share) {
      try {
        const file = new File([blob], fileName, { type: "image/png" });
        await navigator.share({
          files: [file],
          title: "Bank the Catch - Last Saved Trip"
        });
        return { ok: true, method: "share" };
      } catch (error) {
        if (String(error?.name || "").toLowerCase() === "aborterror") {
          return { ok: false, reason: "share-canceled", error };
        }
      }
    }

    downloadBlob(blob, fileName);
    return {
      ok: true,
      method: "download",
      reason: canShareFiles ? "share-failed-fallback" : "share-unsupported"
    };
  }

  async function shareTripCard(trip) {
    return shareTripCardImage(trip);
  }

  return { buildTripCardImage, saveTripCardImage, shareTripCardImage, shareTripCard };
}
