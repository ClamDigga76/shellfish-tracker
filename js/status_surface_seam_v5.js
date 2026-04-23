export function createStatusSurfaceSeam({
  escapeHtml = (value) => String(value ?? "")
} = {}) {
  const normalizeText = (value) => String(value ?? "").trim();

  function renderActionRow(actions = [], { rowClass = "" } = {}) {
    const safeActions = Array.isArray(actions)
      ? actions.filter((action) => action && typeof action === "object" && normalizeText(action.label))
      : [];
    if (!safeActions.length) return "";
    return `
      <div class="statusSurfaceActions cardActionRow ${escapeHtml(rowClass)}">
        ${safeActions.map((action) => {
          const idAttr = normalizeText(action.id) ? ` id="${escapeHtml(action.id)}"` : "";
          const toneClass = normalizeText(action.tone) ? ` ${escapeHtml(action.tone)}` : "";
          const extraClass = normalizeText(action.className) ? ` ${escapeHtml(action.className)}` : "";
          const typeAttr = normalizeText(action.type) || "button";
          const disabledAttr = action.disabled ? " disabled" : "";
          return `<button class="btn${toneClass}${extraClass}"${idAttr} type="${escapeHtml(typeAttr)}"${disabledAttr}>${escapeHtml(action.label)}</button>`;
        }).join("")}
      </div>
    `;
  }

  function renderStatusSurface(options = {}) {
    const {
      title = "",
      body = "",
      support = "",
      statusPill = "",
      minorNote = "",
      eyebrow = "",
      actions = [],
      role = "status",
      live = "polite",
      variant = "neutral",
      emphasis = "default",
      compact = false,
      className = "",
      bodyHtml = "",
      supportHtml = "",
      minorNoteHtml = "",
      headerClass = "",
      actionsClass = ""
    } = options;

    const titleText = normalizeText(title);
    if (!titleText) return "";

    const bodyBlock = bodyHtml
      ? `<div class="statusSurfaceBody">${bodyHtml}</div>`
      : (normalizeText(body) ? `<div class="statusSurfaceBody">${escapeHtml(body)}</div>` : "");
    const supportBlock = supportHtml
      ? `<div class="statusSurfaceSupport">${supportHtml}</div>`
      : (normalizeText(support) ? `<div class="statusSurfaceSupport">${escapeHtml(support)}</div>` : "");
    const noteBlock = minorNoteHtml
      ? `<div class="statusSurfaceMinorNote">${minorNoteHtml}</div>`
      : (normalizeText(minorNote) ? `<div class="statusSurfaceMinorNote">${escapeHtml(minorNote)}</div>` : "");

    return `
      <section class="statusSurface statusSurface--${escapeHtml(variant)} statusSurface--${escapeHtml(emphasis)}${compact ? " statusSurface--compact" : ""} ${escapeHtml(className)}" role="${escapeHtml(role)}" aria-live="${escapeHtml(live)}">
        <div class="statusSurfaceHead ${escapeHtml(headerClass)}">
          <div class="statusSurfaceTitleWrap">
            ${normalizeText(eyebrow) ? `<div class="statusSurfaceEyebrow">${escapeHtml(eyebrow)}</div>` : ""}
            <div class="statusSurfaceTitle">${escapeHtml(titleText)}</div>
          </div>
          ${normalizeText(statusPill) ? `<span class="statusSurfacePill settingsValuePill">${escapeHtml(statusPill)}</span>` : ""}
        </div>
        ${bodyBlock}
        ${supportBlock}
        ${noteBlock}
        ${renderActionRow(actions, { rowClass: actionsClass })}
      </section>
    `;
  }

  return {
    renderStatusSurface,
    renderActionRow
  };
}
