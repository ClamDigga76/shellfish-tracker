export function createChartStorySeam({ escapeHtml }) {
  const safeEscape = typeof escapeHtml === "function"
    ? escapeHtml
    : (value) => String(value == null ? "" : value);

  const DEFAULT_EMPTY_MESSAGE = "Not enough data in this range yet.";
  const CHART_SURFACE_HEIGHT_PRESETS = Object.freeze({
    standard: Object.freeze({ min: 300, preferred: 320, max: 340 }),
    compact: Object.freeze({ min: 280, preferred: 300, max: 320 }),
    kpi: Object.freeze({ min: 300, preferred: 320, max: 340 })
  });

  function resolveChartCardHeight({
    chartSurface = "default",
    chartSizePreset = "standard",
    viewportWidth = (typeof window !== "undefined" ? window.innerWidth : 390),
    fallbackHeight = 300
  } = {}){
    const surface = String(chartSurface || "").toLowerCase();
    const requestedPreset = String(chartSizePreset || "standard");
    const presetKey = requestedPreset;
    const preset = CHART_SURFACE_HEIGHT_PRESETS[presetKey] || CHART_SURFACE_HEIGHT_PRESETS.standard;
    const width = Math.max(280, Number(viewportWidth) || 390);
    const preferred = width <= 360 ? preset.min : (width >= 460 ? preset.max : preset.preferred);
    if(surface === "kpi-detail" || surface === "insights-high-value") return preferred;
    return Number(fallbackHeight) || preset.min;
  }

  function renderLeanStoryCard({
    canvasId,
    title,
    explanation = "",
    context = "",
    titleClass = "chartTitle",
    explanationClass = "homeInsightsChartExplanation",
    contextClass = "chartContext",
    height = 300,
    chartSurface = "default",
    chartSizePreset = "standard",
    cardTag = "article",
    cardClass = "chartCard chartCard--standard",
    emptyClass = "reportsChartEmpty reportsChartEmpty--standard",
    emptyMessage = DEFAULT_EMPTY_MESSAGE
  }) {
    const resolvedHeight = resolveChartCardHeight({ chartSurface, chartSizePreset, fallbackHeight: height });
    return `
      <${cardTag} class="${safeEscape(cardClass)}" data-chart-story-card="true">
        <div class="chartHeader" data-chart-header="true">
          <h3 class="${safeEscape(titleClass)}">${safeEscape(title)}</h3>
          ${explanation ? `<p class="${safeEscape(explanationClass)}">${safeEscape(explanation)}</p>` : ""}
          ${context ? `<div class="${safeEscape(contextClass)}">${safeEscape(context)}</div>` : ""}
        </div>
        <div class="chartViewport" data-chart-viewport="true">
          <canvas class="chart" data-chart-canvas="true" id="${safeEscape(canvasId)}" height="${safeEscape(resolvedHeight)}" data-chart-display-height="${safeEscape(resolvedHeight)}"></canvas>
          <div class="${safeEscape(emptyClass)}" data-chart-empty="true" data-chart-empty-for="${safeEscape(canvasId)}" hidden>${safeEscape(emptyMessage)}</div>
        </div>
      </${cardTag}>
    `;
  }

  function renderRichStoryCard({
    canvasId,
    takeaway,
    title,
    subhead,
    hero,
    context,
    height = 270,
    chartSurface = "default",
    chartSizePreset = "standard",
    cardTag = "div",
    cardClass = "chartCard chartCard--standard",
    emptyClass = "reportsChartEmpty reportsChartEmpty--standard",
    emptyMessage = DEFAULT_EMPTY_MESSAGE
  }) {
    const tone = String(takeaway?.tone || "steady");
    const resolvedHeight = resolveChartCardHeight({ chartSurface, chartSizePreset, fallbackHeight: height });
    const takeawayText = String(takeaway?.text || "Holding steady");
    return `
      <${cardTag} class="${safeEscape(cardClass)}" data-chart-story-card="true">
        <div class="chartHeader" data-chart-header="true">
          <div class="chartTakeaway tone-${safeEscape(tone)}">${safeEscape(takeawayText)}</div>
        <div class="chartTitle">${safeEscape(title)}</div>
        <div class="chartSubhead">${safeEscape(subhead)}</div>
        <div class="chartHero">${hero || ""}</div>
        <div class="chartContext">${context || ""}</div>
        </div>
        <div class="chartViewport" data-chart-viewport="true">
          <canvas class="chart" data-chart-canvas="true" id="${safeEscape(canvasId)}" height="${safeEscape(resolvedHeight)}" data-chart-display-height="${safeEscape(resolvedHeight)}"></canvas>
          <div class="${safeEscape(emptyClass)}" data-chart-empty="true" data-chart-empty-for="${safeEscape(canvasId)}" hidden>${safeEscape(emptyMessage)}</div>
        </div>
      </${cardTag}>
    `;
  }

  function renderChartStoryCard({ mode = "lean", ...story }) {
    if (String(mode).toLowerCase() === "rich") {
      return renderRichStoryCard(story);
    }
    return renderLeanStoryCard(story);
  }

  return {
    renderChartStoryCard,
    resolveChartCardHeight
  };
}
