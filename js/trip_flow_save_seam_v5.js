export function buildTripFormInputs({
  date = "",
  dealer = "",
  pounds = "",
  amount = "",
  rate = "",
  area = "",
  species = "",
  notes = "",
  defaultSpecies
} = {}){
  return {
    date,
    dealer,
    pounds,
    amount,
    rate,
    area,
    species: species || defaultSpecies,
    notes
  };
}

export function buildNewTripSaveSnapshot({
  rawDate,
  rawDealer,
  rawPounds,
  rawAmount,
  rawRate,
  rawArea,
  rawSpecies,
  rawNotes,
  defaultSpecies,
  parseUsDateToISODate,
  formatDateDMY,
  normalizeDealerDisplay,
  parseNum,
  parseMoney
} = {}){
  const dateInput = String(rawDate || "").trim();
  const dateISO = dateInput.includes("-") ? dateInput.slice(0,10) : (parseUsDateToISODate(dateInput) || "");
  const commitDate = dateInput.includes("-") ? formatDateDMY(dateISO) : dateInput;

  const inputs = buildTripFormInputs({
    date: commitDate,
    dealer: normalizeDealerDisplay(String(rawDealer || "").trim()),
    pounds: parseNum(rawPounds),
    amount: parseMoney(rawAmount),
    rate: parseMoney(rawRate),
    area: String(rawArea || "").trim(),
    species: String(rawSpecies || defaultSpecies).trim() || defaultSpecies,
    notes: String(rawNotes || "").trim(),
    defaultSpecies
  });

  const draft = {
    dateISO: dateISO || "",
    dealer: inputs.dealer,
    pounds: inputs.pounds,
    amount: inputs.amount,
    rate: inputs.rate,
    payRate: inputs.rate,
    area: inputs.area,
    species: inputs.species,
    notes: inputs.notes
  };

  const anyEntered = Boolean(
    inputs.date ||
    inputs.dealer ||
    (inputs.pounds > 0) ||
    (inputs.amount > 0) ||
    (inputs.rate > 0) ||
    inputs.area ||
    inputs.notes
  );

  return { draft, inputs, anyEntered };
}
