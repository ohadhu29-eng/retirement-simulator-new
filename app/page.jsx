"use client";

import { useMemo, useState } from "react";
import coeff from "./data/coefficients.json";
import taxConfig from "./data/tax_2026.json";
import { buildSpouseKey, canFixRights, computeSimulation, validateTaxConfig } from "./lib/calc";

const SOURCE_TYPES = coeff.source_types;
const FUNDS = coeff.funds;

function nfmt(x) {
  const v = Number.isFinite(x) ? x : Number(x) || 0;
  return v.toLocaleString("he-IL", { maximumFractionDigits: 2 });
}

function closestYear(years, birthYear) {
  const y = Number(birthYear) || 0;
  if (!Array.isArray(years) || years.length === 0) return null;
  let best = years[0];
  let bestDiff = Math.abs(y - best);
  for (const yr of years) {
    const d = Math.abs(y - yr);
    if (d < bestDiff) { best = yr; bestDiff = d; }
  }
  return best;
}

function getCoefficient({ fundId, sourceType, gender, retirementAge, spouseKey, birthYear }) {
  const age = String(Number(retirementAge) || "");
  const node = coeff?.tables?.[fundId]?.[sourceType]?.[gender]?.[age] || {};
  const bySpouse = node?.[spouseKey];
  if (!bySpouse) return null;

  const years = coeff?.tables?.[fundId]?.[sourceType]?.years;
  const y = closestYear(years, birthYear);
  if (!y) return null;

  const val = bySpouse?.[String(y)] ?? bySpouse?.[y];
  return (typeof val === "number" && val > 0) ? val : null;
}


export default function Page() {
  const [gender, setGender] = useState("male");
  const [birthYear, setBirthYear] = useState(1965);
  const [retirementAge, setRetirementAge] = useState(67);
  const [taxCreditPoints, setTaxCreditPoints] = useState(2.25);
  const [additionalIncomeMonthly, setAdditionalIncomeMonthly] = useState(0);

  const [hasSpouse, setHasSpouse] = useState(true);
  const [guaranteeMonths, setGuaranteeMonths] = useState(0);
  const [spousePercent, setSpousePercent] = useState(60);

  const [rightsFixationEnabled, setRightsFixationEnabled] = useState(true);
  const [exemptionRate, setExemptionRate] = useState(taxConfig?.pension_exemption?.default_exemption_rate ?? 0.52);

  // 4 sources max (as requested)
  const [sources, setSources] = useState([
    { id: "s1", sourceType: "main_pension", fundId: "clal", capital: 1800000 },
  ]);

  const spouseKey = useMemo(() => buildSpouseKey({ hasSpouse, guaranteeMonths, spousePercent }), [hasSpouse, guaranteeMonths, spousePercent]);
  const fixationAllowed = canFixRights({ gender, retirementAge });
  const taxErrors = useMemo(() => validateTaxConfig(), []);

  function addSource() {
    if (sources.length >= 4) return;
    const nextType = ["supp_pension","exec_ins","gemel_invest"].find(t => !sources.some(s => s.sourceType === t)) || "supp_pension";
    setSources(prev => [...prev, { id: `s${Date.now()}`, sourceType: nextType, fundId: "clal", capital: 0 }]);
  }
  function removeSource(id) { setSources(prev => prev.filter(s => s.id !== id)); }
  function updateSource(id, patch) { setSources(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s)); }

  const sourcesWithCoef = useMemo(() => sources.map(s => ({
    ...s,
    coefficient: getCoefficient({ fundId: s.fundId, sourceType: s.sourceType, gender, retirementAge, spouseKey, birthYear })
  })), [sources, gender, retirementAge, spouseKey]);

  const sim = useMemo(() => {
    return computeSimulation({
      gender,
      retirementAge,
      taxCreditPoints,
      additionalIncomeMonthly,
      sources: sourcesWithCoef.map(s => ({ sourceType: s.sourceType, capital: s.capital, coefficient: s.coefficient || 0 })),
      rightsFixationEnabled,
      exemptionRate: Number(exemptionRate)
    });
  }, [gender, retirementAge, taxCreditPoints, additionalIncomeMonthly, sourcesWithCoef, rightsFixationEnabled, exemptionRate]);

  return (
    <div style={{ maxWidth: 1220, margin: "0 auto", padding: 18 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>אפליקציית סימולציות פרישה</h1>
          <div style={{ color: "#555", marginTop: 4 }}>מקדמים אוטומטיים • מס • קיבוע זכויות • 4 מקורות קצבה • PDF</div>
        </div>
        <button
          onClick={() => window.print()}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
        >
          הפק PDF (הדפס/שמירה)
        </button>
      </header>

      {taxErrors.length > 0 && (
        <div style={{ marginTop: 12, background: "#fff3cd", border: "1px solid #ffeeba", padding: 12, borderRadius: 10 }}>
          <strong>שימו לב:</strong> כדי שחישוב המס יהיה \"עדכני לשנת 2026\", יש לעדכן את הקובץ <code>app/data/tax_2026.json</code>.
          <ul style={{ margin: "8px 0 0 0" }}>
            {taxErrors.map((e,i)=><li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16, marginTop: 16 }}>
        <section style={{ background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>נתוני לקוח</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label>
              מין
              <select value={gender} onChange={(e) => setGender(e.target.value)} style={{ width: "100%", padding: 8 }}>
                <option value="male">זכר</option>
                <option value="female">נקבה</option>
              </select>
            </label>
            <label>
              גיל פרישה
              <input type="number" min={50} max={80} value={retirementAge} onChange={(e) => setRetirementAge(Number(e.target.value))}
                style={{ width: "100%", padding: 8 }} />
            </label>
            <label>
              נקודות זיכוי
              <input type="number" step="0.25" value={taxCreditPoints} onChange={(e) => setTaxCreditPoints(Number(e.target.value))}
                style={{ width: "100%", padding: 8 }} />
            </label>
            <label>
              הכנסה חודשית נוספת (ברוטו)
              <input type="number" value={additionalIncomeMonthly} onChange={(e) => setAdditionalIncomeMonthly(Number(e.target.value))}
                style={{ width: "100%", padding: 8 }} />
            </label>
          </div>

          <hr style={{ margin: "16px 0" }} />

          <h3 style={{ marginTop: 0 }}>פרמטרים לבחירת מקדם</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={hasSpouse} onChange={(e)=>setHasSpouse(e.target.checked)} />
              יש/אין בן/בת זוג
            </label>
            <label>
              חודשי הבטחה לבן/בת זוג
              <input type="number" min={0} value={guaranteeMonths} disabled={!hasSpouse}
                onChange={(e)=>setGuaranteeMonths(Number(e.target.value))} style={{ width: "100%", padding: 8 }} />
            </label>
            <label>
              אחוז הבטחה לבן/בת זוג
              <input type="number" min={0} max={100} value={spousePercent} disabled={!hasSpouse}
                onChange={(e)=>setSpousePercent(Number(e.target.value))} style={{ width: "100%", padding: 8 }} />
            </label>
          </div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
            הערה: התאמת המקדם תלויה בטבלאות שנטענו מהתקנונים. אם אין נתון תוצג הודעה \"אין מקדם\".
          </div>

          <hr style={{ margin: "16px 0" }} />

          <h3 style={{ marginTop: 0 }}>מקורות קצבה (עד 4)</h3>
          <button onClick={addSource} disabled={sources.length >= 4} style={{ padding: "8px 10px", marginBottom: 10 }}>
            ➕ הוסף מקור קצבה
          </button>

          {sourcesWithCoef.map((s) => (
            <div key={s.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <strong>{SOURCE_TYPES.find(t=>t.id===s.sourceType)?.label}</strong>
                <button onClick={() => removeSource(s.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#b00" }}>
                  הסר
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                <label>
                  קרן / חברה
                  <select value={s.fundId} onChange={(e) => updateSource(s.id, { fundId: e.target.value })} style={{ width: "100%", padding: 8 }}>
                    {FUNDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </label>

                <label>
                  צבירה בפרישה
                  <input type="number" value={s.capital} onChange={(e) => updateSource(s.id, { capital: Number(e.target.value) })}
                    style={{ width: "100%", padding: 8 }} />
                </label>

                <label>
                  מקדם קצבה (אוטומטי)
                  <input
                    type="number"
                    value={s.coefficient ?? ""}
                    readOnly
                    placeholder={"אין מקדם לטווח/אפשרות זו"}
                    style={{ width: "100%", padding: 8, background: "#fafafa" }}
                  />
                  <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                    המקדמים יוזנו מהתקנונים שתשלח. אין באמור התחייבות של הקרן.
                  </div>
                </label>

                <div>
                  <div style={{ fontSize: 12, color: "#666" }}>קצבה חודשית משוערת</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>
                    {nfmt(sim.monthlyBySource.find(x => x.sourceType === s.sourceType)?.monthly ?? 0)} ₪
                  </div>
                </div>
              </div>
            </div>
          ))}

          <hr style={{ margin: "16px 0" }} />

          <h3 style={{ marginTop: 0 }}>קיבוע זכויות (פטור קצבה)</h3>
          <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              checked={rightsFixationEnabled && fixationAllowed}
              disabled={!fixationAllowed}
              onChange={(e) => setRightsFixationEnabled(e.target.checked)}
            />
            הפעל קיבוע זכויות
          </label>
          {!fixationAllowed && (
            <div style={{ marginTop: 6, color: "#b00" }}>
              קיבוע זכויות זמין רק לנשים מגיל 64 ומעלה ולגברים מגיל 67 ומעלה.
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            שיעור פטור:{" "}
            <input
              type="number"
              step="0.01"
              value={exemptionRate}
              disabled={!fixationAllowed}
              onChange={(e) => setExemptionRate(Number(e.target.value))}
              style={{ padding: 8, width: 120 }}
            />{" "}
            (ברירת מחדל {taxConfig?.pension_exemption?.default_exemption_rate ?? 0.52})
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
            הנחות MVP: קיבוע זכויות = פטור קצבה בלבד (ללא היוון). אין באמור ייעוץ מס סופי.
          </div>
        </section>

        <aside style={{ background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>תוצאות</h2>
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <div style={{ color: "#666" }}>קצבה ברוטו כוללת</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{nfmt(sim.grossPension)} ₪</div>
            </div>

            <div>
              <div style={{ color: "#666" }}>קצבה פטורה ממס (עם קיבוע)</div>
              <div style={{ fontSize: 18 }}>{nfmt(sim.withFixation.exemptPension)} ₪</div>
            </div>

            <div>
              <div style={{ color: "#666" }}>קצבה חייבת (עם קיבוע)</div>
              <div style={{ fontSize: 18 }}>{nfmt(sim.withFixation.taxablePension)} ₪</div>
            </div>

            <div>
              <div style={{ color: "#666" }}>מס חודשי (עם קיבוע)</div>
              <div style={{ fontSize: 18, color: "#b00" }}>{nfmt(sim.withFixation.monthlyTax)} ₪</div>
            </div>

            <div style={{ paddingTop: 10, borderTop: "1px solid #eee" }}>
              <div style={{ color: "#666" }}>קצבה נטו (עם קיבוע)</div>
              <div style={{ fontSize: 26, fontWeight: 900 }}>{nfmt(sim.withFixation.netPension)} ₪</div>
            </div>

            <hr />

            <h3 style={{ margin: 0 }}>השוואה</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "right", padding: "6px 0", color: "#666" }}>תרחיש</th>
                  <th style={{ textAlign: "left", padding: "6px 0", color: "#666" }}>קצבה נטו</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "6px 0" }}>ללא קיבוע</td>
                  <td style={{ padding: "6px 0", textAlign: "left" }}>{nfmt(sim.withoutFixation.netPension)} ₪</td>
                </tr>
                <tr>
                  <td style={{ padding: "6px 0" }}>עם קיבוע</td>
                  <td style={{ padding: "6px 0", textAlign: "left" }}>{nfmt(sim.withFixation.netPension)} ₪</td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
              * כדי לקבל \"מדרגות מס עדכניות לשנת 2026\" יש לעדכן קובץ הגדרות בהתאם לפרסום רשמי.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
