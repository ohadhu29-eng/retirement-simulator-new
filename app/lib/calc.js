import taxConfig from "../data/tax_2026.json";

export function canFixRights({ gender, retirementAge }) {
  const age = Number(retirementAge) || 0;
  if (gender === "female") return age >= 64;
  return age >= 67;
}

export function calcMonthlyPension(source) {
  // Priority 1: direct user-entered monthly pension estimate.
  const override = Number(source?.monthlyOverride);
  if (Number.isFinite(override) && override > 0) return override;

  // Priority 2: derive from capital / coefficient.
  const cap = Number(source?.capital) || 0;
  const coef = Number(source?.coefficient) || 0;
  if (!coef) return 0;
  return cap / coef;
}

export function buildSpouseKey({ hasSpouse, guaranteeMonths, spousePercent }) {
  if (!hasSpouse) return "S0";
  const m = Number(guaranteeMonths) || 0;
  const p = Number(spousePercent) || 0;
  return `S1_m${m}_p${p}`;
}

export function validateTaxConfig() {
  const errs = [];
  if (!(Number(taxConfig.credit_point_value) > 0)) errs.push("חסר ערך נקודת זיכוי לשנת 2026");
  const b = taxConfig.brackets_monthly || [];
  if (!Array.isArray(b) || b.length === 0 || b.some(x => typeof x.rate !== "number")) errs.push("חסרות מדרגות מס חודשיות לשנת 2026");
  if (!(Number(taxConfig.pension_exemption?.monthly_exempt_ceiling) > 0)) errs.push("חסרה תקרת קצבה מזכה לפטור (חודשי)");
  return errs;
}

export function calcIncomeTax(taxableIncome, taxCreditPoints) {
  const brackets = taxConfig.brackets_monthly || [];
  let remaining = Math.max(0, Number(taxableIncome) || 0);
  let tax = 0;

  for (const br of brackets) {
    const rate = Number(br.rate);
    if (!Number.isFinite(rate)) continue;
    if (br.up_to === null || br.up_to === undefined) {
      tax += remaining * rate;
      remaining = 0;
      break;
    }
    const upTo = Number(br.up_to);
    const part = Math.min(remaining, upTo);
    tax += part * rate;
    remaining -= part;
    if (remaining <= 0) break;
  }

  const cpv = Number(taxConfig.credit_point_value) || 0;
  const credit = (Number(taxCreditPoints) || 0) * cpv;
  return Math.max(0, tax - credit);
}

export function computeSimulation({
  gender,
  retirementAge,
  taxCreditPoints,
  additionalIncomeMonthly,
  sources, // [{sourceType, capital, coefficient}]
  rightsFixationEnabled,
  exemptionRate,
  taxOnly = false,
  grossMonthlyOverride = 0,
}) {
  const monthlyBySource = sources.map(s => ({
    ...s,
    monthly: calcMonthlyPension(s),
  }));
  const computedGrossPension = monthlyBySource.reduce((a,b)=>a + b.monthly, 0);
  const grossPension = (Number(grossMonthlyOverride) > 0) ? Number(grossMonthlyOverride) : computedGrossPension;

  const fixationAllowed = canFixRights({ gender, retirementAge });
  const effectiveFixation = Boolean(rightsFixationEnabled && fixationAllowed);

  const ceiling = Number(taxConfig.pension_exemption?.monthly_exempt_ceiling) || 0;
  const defaultRate = Number(taxConfig.pension_exemption?.default_exemption_rate) || 0.52;
  const exRate = (typeof exemptionRate === "number") ? exemptionRate : defaultRate;

  const exemptBase = ceiling ? Math.min(grossPension, ceiling) : 0;
  const exemptPension = effectiveFixation ? exemptBase * exRate : 0;
  const taxablePension = Math.max(0, grossPension - exemptPension);

  const taxableIncome = taxablePension + (Number(additionalIncomeMonthly) || 0);
  const monthlyTax = calcIncomeTax(taxableIncome, taxCreditPoints);
  const netPension = grossPension - monthlyTax;

  // Comparison: without fixation
  const taxableIncomeNoFix = grossPension + (Number(additionalIncomeMonthly) || 0);
  const taxNoFix = calcIncomeTax(taxableIncomeNoFix, taxCreditPoints);
  const netNoFix = grossPension - taxNoFix;

  return {
    monthlyBySource,
    grossPension,
    fixationAllowed,
    withFixation: { enabled: effectiveFixation, exemptPension, taxablePension, taxableIncome, monthlyTax, netPension },
    withoutFixation: { monthlyTax: taxNoFix, netPension: netNoFix }
  };
}
