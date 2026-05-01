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


function fitTextToWidth(ctx, text, maxWidth) {
  const value = String(text || "");
  if (!value) return value;
  if (ctx.measureText(value).width <= maxWidth) return value;
  const ellipsis = "…";
  let next = value;
  while (next.length > 1 && ctx.measureText(`${next}${ellipsis}`).width > maxWidth) {
    next = next.slice(0, -1).trimEnd();
  }
  return `${next}${ellipsis}`;
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

  ctx.fillStyle = "rgba(88,152,236,0.10)";
  ctx.beginPath();
  ctx.ellipse(innerX + innerW - 140, innerY + 98, 228, 124, -0.26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(6,44,99,0.08)";
  ctx.beginPath();
  ctx.ellipse(innerX + innerW - 40, innerY + 42, 190, 70, -0.5, 0, Math.PI * 2);
  ctx.fill();

  const headerCenterX = innerX + (innerW / 2);
  const headerBaselineY = innerY + 114;
  const emblemSize = 60;

  let emblemDrawn = false;
  try {
    const emblem = await loadImage(`./assets/brand/transparent/btc-emblem-transparent.png${appVersion ? `?v=${encodeURIComponent(appVersion)}` : ""}`);
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.drawImage(emblem, headerCenterX - 220, headerBaselineY - 50, emblemSize, emblemSize);
    ctx.restore();
    emblemDrawn = true;
  } catch (_error) {
    emblemDrawn = false;
  }

  const titleLeftX = emblemDrawn ? (headerCenterX - 132) : (headerCenterX - 100);
  const sideLineY = headerBaselineY - 18;
  ctx.strokeStyle = "rgba(187,214,255,0.46)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(innerX + 76, sideLineY);
  ctx.lineTo(titleLeftX - 18, sideLineY);
  ctx.moveTo(headerCenterX + 138, sideLineY);
  ctx.lineTo(innerX + innerW - 76, sideLineY);
  ctx.stroke();

  ctx.fillStyle = "#f4f8ff";
  ctx.font = "700 56px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText("Bank the Catch", titleLeftX, headerBaselineY);

  const heroDivider = ctx.createLinearGradient(innerX, 0, innerX + innerW, 0);
  heroDivider.addColorStop(0, "rgba(205,166,96,0)");
  heroDivider.addColorStop(0.5, "rgba(205,166,96,0.42)");
  heroDivider.addColorStop(1, "rgba(205,166,96,0)");
  ctx.fillStyle = heroDivider;
  ctx.fillRect(innerX + 84, innerY + 164, innerW - 168, 1);
  ctx.restore();

  const fields = buildShareCardFields({ trip, parseReportDateToISO, round2, formatMoney });
  const speciesLabel = trimOrFallback(trip?.species, "Species not set");
  const cardX = innerX + 58;
  const cardY = innerY + heroHeight + 72;
  const cardW = innerW - 116;
  const cardH = 612;

  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 30);
  ctx.fillStyle = "rgba(10,22,44,0.86)";
  ctx.fill();
  ctx.strokeStyle = "rgba(122,164,238,0.38)";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  const leftX = cardX + 40;
  const rightColX = cardX + cardW - 286;

  ctx.fillStyle = "rgba(171,198,237,0.95)";
  ctx.font = "600 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText("DATE", leftX, cardY + 62);
  ctx.fillStyle = "#f2f8ff";
  ctx.font = "700 44px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText(fields.dateLabel, leftX, cardY + 112);

  ctx.fillStyle = "rgba(171,198,237,0.95)";
  ctx.font = "600 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText("AREA", leftX, cardY + 190);
  ctx.fillStyle = "#f2f8ff";
  ctx.font = "700 68px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  const maxAreaWidth = rightColX - leftX - 30;
  const safeAreaLabel = fitTextToWidth(ctx, fields.areaLabel, maxAreaWidth);
  ctx.fillText(safeAreaLabel, leftX, cardY + 270);

  ctx.fillStyle = "rgba(171,198,237,0.95)";
  ctx.font = "600 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText("DEALER", leftX, cardY + 348);
  ctx.fillStyle = "#f2f8ff";
  ctx.font = "700 38px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText(fields.dealerLabel, leftX, cardY + 402);

  ctx.fillStyle = "rgba(171,198,237,0.95)";
  ctx.font = "600 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText("SPECIES", leftX, cardY + 466);
  ctx.fillStyle = "#f2f8ff";
  ctx.font = "700 38px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText(speciesLabel, leftX, cardY + 520);

  const rightMetrics = [
    ["POUNDS", fields.poundsLabel],
    ["AMOUNT", fields.amountLabel],
    ["PRICE / LB", fields.avgLabel]
  ];
  rightMetrics.forEach(([label, value], idx) => {
    const y = cardY + 106 + (idx * 156);
    ctx.fillStyle = "rgba(171,198,237,0.95)";
    ctx.font = "600 20px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText(label, rightColX, y);
    ctx.fillStyle = "#f2f8ff";
    ctx.font = "700 40px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText(value, rightColX, y + 48);
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


export function openScreenshotCardPreview({
  trip,
  renderTripsBrowseReadOnlyTripCard,
  openModal,
  closeModal,
  showToast,
  escapeHtml,
}) {
  if (!trip) {
    if (typeof showToast === "function") showToast("Trip preview unavailable");
    return false;
  }
  if (typeof renderTripsBrowseReadOnlyTripCard !== "function") {
    if (typeof showToast === "function") showToast("Trip preview unavailable");
    return false;
  }
  if (typeof openModal !== "function") return false;
  const appVersion = String(window?.APP_VERSION || "").trim();
  const previewEmblemSrcRaw = `assets/brand/transparent/btc-emblem-transparent.png${appVersion ? `?v=${encodeURIComponent(appVersion)}` : ""}`;
  const previewEmblemSrc = typeof escapeHtml === "function" ? escapeHtml(previewEmblemSrcRaw) : previewEmblemSrcRaw;
  openModal({
    html: `
      <div class="homeScreenshotCardPreviewWrap">
        <div class="homeScreenshotCardPreviewSurface">
          <div class="homeScreenshotCardPreviewHero">
            <div class="homeScreenshotCardPreviewTitleRow" aria-label="Bank the Catch">
              <span class="homeScreenshotCardPreviewTitleLine" aria-hidden="true"></span>
              <img class="homeScreenshotCardPreviewEmblem" src="${previewEmblemSrc}" alt="" loading="lazy" decoding="async" />
              <h3 class="homeScreenshotCardPreviewTitleText">Bank the Catch</h3>
              <span class="homeScreenshotCardPreviewTitleLine" aria-hidden="true"></span>
            </div>
          </div>
          <div class="homeScreenshotCardPreviewCard">${renderTripsBrowseReadOnlyTripCard(trip)}</div>
          <div class="homeScreenshotCardPreviewFooter">Logged with Bank the Catch</div>
        </div>
        <div class="homeScreenshotCardPreviewActions">
          <button class="btn btn-ghost homeScreenshotCardPreviewCloseBtn" id="homeScreenshotCardClose" type="button">Close</button>
        </div>
      </div>
    `,
    backdropClose: true,
    escClose: true,
    showCloseButton: false,
    onOpen: () => {
      const previewCloseBtn = document.getElementById("homeScreenshotCardClose");
      if (previewCloseBtn) {
        previewCloseBtn.onclick = () => {
          if (typeof closeModal === "function") closeModal();
        };
      }
    }
  });
  return true;
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
