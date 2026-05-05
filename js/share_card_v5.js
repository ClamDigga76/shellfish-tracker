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
  gradient.addColorStop(0, "#020711");
  gradient.addColorStop(0.58, "#05111f");
  gradient.addColorStop(1, "#071a33");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const topGlow = ctx.createRadialGradient(830, 140, 48, 830, 140, 520);
  topGlow.addColorStop(0, "rgba(70,150,255,0.2)");
  topGlow.addColorStop(0.44, "rgba(70,150,255,0.1)");
  topGlow.addColorStop(1, "rgba(70,150,255,0)");
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, canvas.width, 620);

  const blueBloom = ctx.createRadialGradient(228, 264, 34, 228, 264, 516);
  blueBloom.addColorStop(0, "rgba(7,26,51,0.3)");
  blueBloom.addColorStop(0.56, "rgba(7,26,51,0.14)");
  blueBloom.addColorStop(1, "rgba(7,26,51,0)");
  ctx.fillStyle = blueBloom;
  ctx.fillRect(0, 0, canvas.width, 720);

  const accentGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  accentGradient.addColorStop(0, "rgba(29,111,255,0.24)");
  accentGradient.addColorStop(0.58, "rgba(29,111,255,0.12)");
  accentGradient.addColorStop(1, "rgba(29,111,255,0.2)");
  ctx.fillStyle = accentGradient;
  ctx.fillRect(0, 0, canvas.width, 14);

  const innerX = 54;
  const innerY = 54;
  const innerW = canvas.width - (innerX * 2);
  const innerH = canvas.height - (innerY * 2);
  const heroHeight = 280;

  drawRoundedRect(ctx, innerX, innerY, innerW, innerH, 42);
  ctx.fillStyle = "rgba(5,17,31,0.6)";
  ctx.fill();
  ctx.strokeStyle = "rgba(29,111,255,0.44)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.save();
  drawRoundedRect(ctx, innerX, innerY, innerW, innerH, 42);
  ctx.clip();

  const heroGradient = ctx.createLinearGradient(innerX, innerY, innerX + innerW, innerY + heroHeight);
  heroGradient.addColorStop(0, "rgba(2,7,17,0.99)");
  heroGradient.addColorStop(0.6, "rgba(5,17,31,0.97)");
  heroGradient.addColorStop(0.88, "rgba(7,26,51,0.95)");
  heroGradient.addColorStop(1, "rgba(7,26,51,0.92)");
  ctx.fillStyle = heroGradient;
  ctx.fillRect(innerX, innerY, innerW, heroHeight);

  ctx.fillStyle = "rgba(70,150,255,0.12)";
  ctx.beginPath();
  ctx.ellipse(innerX + innerW - 140, innerY + 98, 228, 124, -0.26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(7,26,51,0.2)";
  ctx.beginPath();
  ctx.ellipse(innerX + innerW - 40, innerY + 42, 190, 70, -0.5, 0, Math.PI * 2);
  ctx.fill();

  const headerCenterX = innerX + (innerW / 2);
  const emblemSize = 60;
  const emblemY = innerY + 38;
  const titleY = emblemY + emblemSize + 54;
  const supportY = titleY + 38;
  const dividerY = supportY + 20;

  try {
    const emblem = await loadImage(`./assets/brand/transparent/btc-emblem-transparent.png${appVersion ? `?v=${encodeURIComponent(appVersion)}` : ""}`);
    ctx.save();
    ctx.globalAlpha = 0.96;
    ctx.drawImage(emblem, headerCenterX - (emblemSize / 2), emblemY, emblemSize, emblemSize);
    ctx.restore();
  } catch (_error) {}

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(75,170,255,0.55)";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "#7ec8ff";
  ctx.font = "700 54px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText("Bank the Catch", headerCenterX, titleY);
  ctx.restore();

  ctx.fillStyle = "#d7e6f8";
  ctx.font = "620 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Logged with Bank the Catch", headerCenterX, supportY);

  const heroDivider = ctx.createLinearGradient(innerX, 0, innerX + innerW, 0);
  heroDivider.addColorStop(0, "rgba(240,185,77,0)");
  heroDivider.addColorStop(0.2, "rgba(255,220,138,0.74)");
  heroDivider.addColorStop(0.5, "rgba(240,185,77,0.9)");
  heroDivider.addColorStop(0.8, "rgba(255,220,138,0.74)");
  heroDivider.addColorStop(1, "rgba(240,185,77,0)");
  ctx.fillStyle = heroDivider;
  ctx.fillRect(innerX + 56, dividerY, innerW - 112, 2);
  ctx.restore();

  const fields = buildShareCardFields({ trip, parseReportDateToISO, round2, formatMoney });
  const speciesLabel = trimOrFallback(trip?.species, "Species not set");
  const cardX = innerX + 58;
  const cardY = innerY + heroHeight + 72;
  const cardW = innerW - 116;
  const cardH = 612;

  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 30);
  ctx.fillStyle = "rgba(5,12,24,0.9)";
  ctx.fill();
  ctx.strokeStyle = "rgba(29,111,255,0.42)";
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
    position: "center",
    hideHeader: true,
    html: `
      <div class="homeScreenshotCardPreviewWrap">
        <div class="homeScreenshotCardPreviewSurface">
          <div class="homeScreenshotCardPreviewHero">
            <div class="homeScreenshotCardPreviewTitleRow" aria-label="Bank the Catch">
              <img class="homeScreenshotCardPreviewEmblem" src="${previewEmblemSrc}" alt="" loading="lazy" decoding="async" />
              <h3 class="homeScreenshotCardPreviewTitleText">Bank the Catch</h3>
            </div>
            <p class="homeScreenshotCardPreviewSupport">Logged with Bank the Catch</p>
            <span class="homeScreenshotCardPreviewGoldDivider" aria-hidden="true"></span>
          </div>
          <div class="homeScreenshotCardPreviewCard">${renderTripsBrowseReadOnlyTripCard(trip)}</div>
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
