export function createChartStorySeam({ escapeHtml }) {
  const safeEscape = typeof escapeHtml === "function"
    ? escapeHtml
    : (value) => String(value == null ? "" : value);

  const DEFAULT_EMPTY_MESSAGE = "Not enough data in this range yet.";

  function renderLeanStoryCard({
    canvasId,
    title,
    explanation = "",
    context = "",
    titleClass = "chartTitle",
    explanationClass = "homeInsightsChartExplanation",
    contextClass = "chartContext",
    height = 256,
    cardTag = "article",
    cardClass = "card chartCard",
    emptyClass = "reportsChartEmpty",
    emptyMessage = DEFAULT_EMPTY_MESSAGE
  }) {
    return `
      <${cardTag} class="${safeEscape(cardClass)}">
        <h3 class="${safeEscape(titleClass)}">${safeEscape(title)}</h3>
        ${explanation ? `<p class="${safeEscape(explanationClass)}">${safeEscape(explanation)}</p>` : ""}
        ${context ? `<div class="${safeEscape(contextClass)}">${safeEscape(context)}</div>` : ""}
        <canvas class="chart" id="${safeEscape(canvasId)}" height="${safeEscape(height)}"></canvas>
        <div class="${safeEscape(emptyClass)}" data-chart-empty-for="${safeEscape(canvasId)}" hidden>${safeEscape(emptyMessage)}</div>
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
    height = 210,
    cardTag = "div",
    cardClass = "chartCard",
    emptyClass = "reportsChartEmpty",
    emptyMessage = DEFAULT_EMPTY_MESSAGE
  }) {
    const tone = String(takeaway?.tone || "steady");
    const takeawayText = String(takeaway?.text || "Holding steady");
    return `
      <${cardTag} class="${safeEscape(cardClass)}">
        <div class="chartTakeaway tone-${safeEscape(tone)}">${safeEscape(takeawayText)}</div>
        <div class="chartTitle">${safeEscape(title)}</div>
        <div class="chartSubhead">${safeEscape(subhead)}</div>
        <div class="chartHero">${hero || ""}</div>
        <div class="chartContext">${context || ""}</div>
        <canvas class="chart" id="${safeEscape(canvasId)}" height="${safeEscape(height)}"></canvas>
        <div class="${safeEscape(emptyClass)}" data-chart-empty-for="${safeEscape(canvasId)}" hidden>${safeEscape(emptyMessage)}</div>
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
    renderChartStoryCard
  };
}
