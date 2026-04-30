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
  gradient.addColorStop(0, "#000f2c");
  gradient.addColorStop(0.58, "#031c45");
  gradient.addColorStop(1, "#062c63");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const topGlow = ctx.createRadialGradient(830, 140, 48, 830, 140, 520);
  topGlow.addColorStop(0, "rgba(6,44,99,0.24)");
  topGlow.addColorStop(0.44, "rgba(6,44,99,0.1)");
  topGlow.addColorStop(1, "rgba(6,44,99,0)");
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, canvas.width, 620);

  const blueBloom = ctx.createRadialGradient(228, 264, 34, 228, 264, 516);
  blueBloom.addColorStop(0, "rgba(3,28,69,0.28)");
  blueBloom.addColorStop(0.56, "rgba(3,28,69,0.12)");
  blueBloom.addColorStop(1, "rgba(3,28,69,0)");
  ctx.fillStyle = blueBloom;
  ctx.fillRect(0, 0, canvas.width, 720);

  const accentGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  accentGradient.addColorStop(0, "rgba(98,155,238,0.24)");
  accentGradient.addColorStop(0.58, "rgba(98,155,238,0.12)");
  accentGradient.addColorStop(1, "rgba(98,155,238,0.2)");
  ctx.fillStyle = accentGradient;
  ctx.fillRect(0, 0, canvas.width, 14);

  const innerX = 54;
  const innerY = 54;
  const innerW = canvas.width - (innerX * 2);
  const innerH = canvas.height - (innerY * 2);
  const heroHeight = 280;

  drawRoundedRect(ctx, innerX, innerY, innerW, innerH, 42);
  ctx.fillStyle = "rgba(2,12,38,0.56)";
  ctx.fill();
  ctx.strokeStyle = "rgba(124,172,243,0.36)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.save();
  drawRoundedRect(ctx, innerX, innerY, innerW, innerH, 42);
  ctx.clip();

  const heroGradient = ctx.createLinearGradient(innerX, innerY, innerX + innerW, innerY + heroHeight);
  heroGradient.addColorStop(0, "rgba(0,15,44,0.99)");
  heroGradient.addColorStop(0.6, "rgba(0,15,44,0.97)");
  heroGradient.addColorStop(0.88, "rgba(3,28,69,0.94)");
  heroGradient.addColorStop(1, "rgba(6,44,99,0.9)");
  ctx.fillStyle = heroGradient;
  ctx.fillRect(innerX, innerY, innerW, heroHeight);

  ctx.fillStyle = "rgba(88,152,236,0.14)";
  ctx.beginPath();
  ctx.ellipse(innerX + innerW - 140, innerY + 98, 228, 124, -0.26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(6,44,99,0.12)";
  ctx.beginPath();
  ctx.ellipse(innerX + innerW - 40, innerY + 42, 190, 70, -0.5, 0, Math.PI * 2);
  ctx.fill();

  let logoDrawn = false;
  try {
    const logo = await loadImage(`./assets/brand/backgrounds/btc-share-logo-wide.png${appVersion ? `?v=${encodeURIComponent(appVersion)}` : ""}`);
    const heroPadX = 34;
    const heroPadTop = 34;
    const drawW = innerW - (heroPadX * 2);
    const sourceRatio = logo.naturalWidth > 0 ? (logo.naturalHeight / logo.naturalWidth) : 0.34;
    const drawH = Math.max(170, Math.round(drawW * sourceRatio));
    const drawY = innerY + heroPadTop;
    ctx.save();
    ctx.globalAlpha = 0.98;
    ctx.drawImage(logo, innerX + heroPadX, drawY, drawW, drawH);

    const logoFade = ctx.createLinearGradient(0, drawY + drawH - 78, 0, drawY + drawH + 16);
    logoFade.addColorStop(0, "rgba(0,15,44,0)");
    logoFade.addColorStop(1, "rgba(0,15,44,0.62)");
    ctx.fillStyle = logoFade;
    ctx.fillRect(innerX + heroPadX, drawY + drawH - 78, drawW, 104);
    ctx.restore();
    logoDrawn = true;
  } catch (_error) {
    logoDrawn = false;
  }

  if (!logoDrawn) {
    ctx.fillStyle = "#f4f8ff";
    ctx.font = "700 66px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText("Bank the Catch", innerX + 82, innerY + 146);
  }

  const heroDivider = ctx.createLinearGradient(innerX, 0, innerX + innerW, 0);
  heroDivider.addColorStop(0, "rgba(130,184,255,0)");
  heroDivider.addColorStop(0.5, "rgba(130,184,255,0.38)");
  heroDivider.addColorStop(1, "rgba(130,184,255,0)");
  ctx.fillStyle = heroDivider;
  ctx.fillRect(innerX + 12, innerY + heroHeight - 1, innerW - 24, 2);
  ctx.restore();

  ctx.fillStyle = "rgba(198,219,255,0.94)";
  ctx.font = "600 28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText("Last Saved Trip", innerX + 58, innerY + heroHeight + 56);

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
  const cardY = innerY + heroHeight + 82;
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

  ctx.fillStyle = "#8dc3ff";
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
