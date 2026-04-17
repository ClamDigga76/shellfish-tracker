export function createSettlementLineUpdater({
  elWrittenCheckAmount,
  elAmount,
  parseMoney,
  deriveTripSettlement,
  formatMoney,
  adjustmentId,
  hintSelector
}) {
  return ()=>{
    if(!elWrittenCheckAmount) return;
    const settlement = deriveTripSettlement({
      amount: parseMoney(elAmount?.value),
      writtenCheckAmount: parseMoney(elWrittenCheckAmount.value)
    });
    const adjustmentEl = document.getElementById(adjustmentId);
    if(adjustmentEl){
      adjustmentEl.textContent = `${settlement.dealerAdjustment >= 0 ? "+" : "-"}${formatMoney(Math.abs(settlement.dealerAdjustment))}`;
    }
    const hintEl = document.querySelector(hintSelector);
    if(hintEl){
      hintEl.textContent = settlement.adjustmentClass === "rounded_up"
        ? "Likely rounded up."
        : (settlement.adjustmentClass === "rounded_down" ? "Likely rounded down." : "");
      hintEl.style.display = hintEl.textContent ? "block" : "none";
    }
  };
}

export function bindEntryNumericField({
  fieldEl,
  primeValues,
  metricSync,
  metricField,
  updateMetricStateHelper,
  sanitizeDecimalInput,
  primeNumericField,
  onBlurNormalize,
  onAfterInput,
  onAfterBlur
}) {
  if(!fieldEl || fieldEl.__boundNumeric) return;
  fieldEl.__boundNumeric = true;
  const prime = ()=>primeNumericField(fieldEl, primeValues);
  fieldEl.addEventListener("pointerdown", prime);
  fieldEl.addEventListener("focus", prime);
  fieldEl.addEventListener("input", ()=>{
    if(metricSync && metricField){
      metricSync.onUserEdit(metricField);
      updateMetricStateHelper?.();
    }
    const sanitized = sanitizeDecimalInput(fieldEl.value);
    if(sanitized !== fieldEl.value) fieldEl.value = sanitized;
    onAfterInput?.();
  });
  fieldEl.addEventListener("blur", ()=>{
    if(String(fieldEl.value || "").endsWith(".")) fieldEl.value = String(fieldEl.value).slice(0, -1);
    onBlurNormalize?.();
    onAfterBlur?.();
  });
}
