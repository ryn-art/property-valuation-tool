import { useState, useCallback, useMemo, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  ListPlus,
  Calculator,
  FileDown,
  Snowflake,
  Upload,
  Loader2,
} from "lucide-react";
import { StepBadge, KpiCard, money, pct, clamp } from "./calculator-shared";
import { exportRentalPDF, exportRentalClientPDF } from "@/lib/pdf-export";
import type { CompanyBrand } from "@/lib/pdf-export";
import type { IncomeLine, ExpenseLine } from "@shared/schema";

type PropertyType = "office" | "retail" | "industrial" | "storage" | "student" | "other";
type Scenario = "stabilised" | "actual";
type PricingMode = "per-m2" | "per-unit" | "per-bed";

const PROPERTY_DEFAULTS: Record<PropertyType, number> = {
  office: 88,
  retail: 92,
  industrial: 95,
  storage: 91,
  student: 90,
  other: 90,
};

const PROPERTY_LABELS: Record<PropertyType, string> = {
  office: "Office",
  retail: "Retail",
  industrial: "Industrial",
  storage: "Self-storage",
  student: "Student Accommodation",
  other: "Other",
};

const EXPENSE_GROUPS = ["Operating Expenses", "Utilities"] as const;

export interface RentalCalcState {
  lines: IncomeLine[];
  otherMonthly: string;
  actualAnnualRev: string;
  propertyType: PropertyType;
  stabilisedOccPct: string;
  scenario: Scenario;
  opexAnnual: string;
  utilityAdj: string;
  capLowPct: string;
  capHighPct: string;
  unusedLandSize: string;
  landValuePerM2: string;
  refurb: string;
  expenseLines: ExpenseLine[];
  brokerName: string;
  companyBrand: CompanyBrand;
}

export interface RentalCalcSetters {
  setLines: (fn: IncomeLine[] | ((prev: IncomeLine[]) => IncomeLine[])) => void;
  setOtherMonthly: (v: string) => void;
  setActualAnnualRev: (v: string) => void;
  setPropertyType: (v: PropertyType) => void;
  setStabilisedOccPct: (v: string) => void;
  setScenario: (v: Scenario) => void;
  setOpexAnnual: (v: string) => void;
  setUtilityAdj: (v: string) => void;
  setCapLowPct: (v: string) => void;
  setCapHighPct: (v: string) => void;
  setUnusedLandSize: (v: string) => void;
  setLandValuePerM2: (v: string) => void;
  setRefurb: (v: string) => void;
  setExpenseLines: (fn: ExpenseLine[] | ((prev: ExpenseLine[]) => ExpenseLine[])) => void;
  setBrokerName: (v: string) => void;
  setCompanyBrand: (v: CompanyBrand) => void;
}

interface Props {
  state: RentalCalcState;
  setters: RentalCalcSetters;
  nextId: number;
  setNextId: (fn: number | ((n: number) => number)) => void;
  valuationName: string;
}

export default function CalculatorRental({ state, setters, nextId, setNextId, valuationName }: Props) {
  const [desc, setDesc] = useState("");
  const [size, setSize] = useState("");
  const [rate, setRate] = useState("");
  const [qty, setQty] = useState("1");
  const [climate, setClimate] = useState(false);

  // Expense add-row state
  const [newExpGroup, setNewExpGroup] = useState<string>("Operating Expenses");
  const [newExpLabel, setNewExpLabel] = useState("");
  const [newExpMonthly, setNewExpMonthly] = useState("");
  const [newExpRecovery, setNewExpRecovery] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    lines, otherMonthly, actualAnnualRev, propertyType, stabilisedOccPct,
    scenario, opexAnnual, utilityAdj, capLowPct, capHighPct, unusedLandSize,
    landValuePerM2, refurb, expenseLines, brokerName, companyBrand,
  } = state;

  const isStorage = propertyType === "storage";
  const isStudent = propertyType === "student";
  const [pricingMode, setPricingMode] = useState<PricingMode>("per-unit");
  const useFlatRate = isStorage || isStudent;
  const qtyLabel = isStudent && pricingMode === "per-bed" ? "Beds" : (useFlatRate ? "Units" : "Qty");
  const rateLabel = isStudent && pricingMode === "per-bed" ? "R/bed/mo" : (useFlatRate ? "R/unit/mo" : "R/m²/mo");
  const hasExpenseSchedule = expenseLines.length > 0;

  // ── Income line helpers ────────────────────────────────────────

  const addLine = useCallback(() => {
    const sizeVal = Number(size || 0);
    const rateVal = Number(rate || 0);
    const qtyVal = Math.max(1, parseInt(qty || "1"));
    if (useFlatRate ? rateVal <= 0 : (sizeVal <= 0 || rateVal < 0)) return;

    const defaultDesc = isStorage ? "Storage Unit" : isStudent ? (pricingMode === "per-bed" ? "Bed" : "Unit") : "Rentable Area";
    setters.setLines((prev) => [
      ...prev,
      {
        id: nextId,
        desc: desc.trim() || defaultDesc,
        size: sizeVal,
        rate: rateVal,
        qty: qtyVal,
        climateControlled: climate,
      },
    ]);
    setNextId((n) => n + 1);
    setDesc("");
    setSize("");
    setRate("");
    setQty("1");
    setClimate(false);
  }, [desc, size, rate, qty, climate, nextId, setters, setNextId, useFlatRate, pricingMode]);

  const removeLine = useCallback((id: number) => {
    setters.setLines((prev) => prev.filter((l) => l.id !== id));
  }, [setters]);

  const updateLineField = useCallback((id: number, field: keyof IncomeLine, value: string | boolean) => {
    setters.setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        if (field === "desc") return { ...l, desc: value as string };
        if (field === "climateControlled") return { ...l, climateControlled: value as boolean };
        const num = Number(value || 0);
        if (field === "qty") return { ...l, qty: Math.max(1, Math.round(num)) };
        return { ...l, [field]: num };
      })
    );
  }, [setters]);

  const handlePropertyTypeChange = useCallback((val: string) => {
    const t = val as PropertyType;
    setters.setPropertyType(t);
    setters.setStabilisedOccPct(String(PROPERTY_DEFAULTS[t]));
  }, [setters]);

  // ── Expense helpers ────────────────────────────────────────────

  const addExpense = useCallback(() => {
    const m = Number(newExpMonthly || 0);
    if (!newExpLabel.trim() || m <= 0) return;
    setters.setExpenseLines((prev) => [
      ...prev,
      { id: nextId, group: newExpGroup, label: newExpLabel.trim(), monthly: m, recovery: Number(newExpRecovery || 0) },
    ]);
    setNextId((n) => n + 1);
    setNewExpLabel("");
    setNewExpMonthly("");
    setNewExpRecovery("");
  }, [newExpGroup, newExpLabel, newExpMonthly, newExpRecovery, nextId, setters, setNextId]);

  const removeExpense = useCallback((id: number) => {
    setters.setExpenseLines((prev) => prev.filter((l) => l.id !== id));
  }, [setters]);

  const updateExpenseField = useCallback((id: number, field: keyof ExpenseLine, value: string) => {
    setters.setExpenseLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        if (field === "label" || field === "group") return { ...l, [field]: value };
        return { ...l, [field]: Number(value || 0) };
      })
    );
  }, [setters]);

  const handleScan = useCallback(async (file: File) => {
    setScanning(true);
    setScanError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/expense-scan", { method: "POST", body: formData });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Scan failed");
      const scanned: ExpenseLine[] = data.expenses.map((e: { group: string; label: string; monthly: number; recovery: number }, i: number) => ({
        id: nextId + i,
        group: e.group || "Operating Expenses",
        label: e.label,
        monthly: Number(e.monthly) || 0,
        recovery: Number(e.recovery) || 0,
      }));
      setters.setExpenseLines((prev) => [...prev, ...scanned]);
      setNextId((n) => n + scanned.length);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }, [nextId, setters, setNextId]);

  // ── Calculations ───────────────────────────────────────────────

  const lineMonthly = (l: IncomeLine) =>
    useFlatRate ? (l.qty || 1) * l.rate : (l.qty || 1) * l.size * l.rate;

  const expenseCalc = useMemo(() => {
    const byGroup: Record<string, { netMonthly: number; netAnnual: number }> = {};
    let totalNetMonthly = 0;
    for (const l of expenseLines) {
      const net = Math.max(0, l.monthly - l.recovery);
      if (!byGroup[l.group]) byGroup[l.group] = { netMonthly: 0, netAnnual: 0 };
      byGroup[l.group].netMonthly += net;
      byGroup[l.group].netAnnual += net * 12;
      totalNetMonthly += net;
    }
    return { byGroup, totalNetMonthly, totalNetAnnual: totalNetMonthly * 12 };
  }, [expenseLines]);

  const expenseGroups = useMemo(() => {
    const seen = new Set<string>();
    expenseLines.forEach((l) => seen.add(l.group));
    EXPENSE_GROUPS.forEach((g) => seen.add(g));
    return [...seen];
  }, [expenseLines]);

  const calc = useMemo(() => {
    const otherM = Number(otherMonthly || 0);
    const pgiMonthly = lines.reduce((sum, l) => sum + lineMonthly(l), 0) + otherM;
    const pgiAnnual = pgiMonthly * 12;

    const totalUnits = lines.reduce((sum, l) => sum + (l.qty || 1), 0);
    const totalM2 = lines.reduce((sum, l) => sum + (l.qty || 1) * l.size, 0);
    const climateUnits = lines.filter(l => l.climateControlled).reduce((sum, l) => sum + (l.qty || 1), 0);
    const climatePct = totalUnits > 0 ? (climateUnits / totalUnits) * 100 : 0;

    const actualRev = Number(actualAnnualRev || 0);
    let derivedOcc: number | null = null;
    let derivedVac: number | null = null;
    if (pgiAnnual > 0 && actualRev > 0) {
      derivedOcc = clamp((actualRev / pgiAnnual) * 100, 0, 200);
      derivedVac = clamp(100 - derivedOcc, 0, 100);
    }

    const stabOcc = clamp(Number(stabilisedOccPct || 0), 0, 100);

    // Opex: use expense schedule total if available, else manual field
    const opex = hasExpenseSchedule ? expenseCalc.totalNetAnnual : Number(opexAnnual || 0);
    const util = hasExpenseSchedule ? 0 : Number(utilityAdj || 0);

    const capLow = Number(capLowPct || 0) / 100;
    const capHigh = Number(capHighPct || 0) / 100;
    const capMin = Math.min(capLow, capHigh);
    const capMax = Math.max(capLow, capHigh);

    const excess = Number(unusedLandSize || 0) * Number(landValuePerM2 || 0);
    const ref = Number(refurb || 0);

    let egiUsed = 0;
    let valueNote = "";
    let showActualNote = false;
    let showDoubleVacWarning = false;

    if (scenario === "actual") {
      egiUsed = actualRev;
      valueNote = "Using actual annual revenue (no additional vacancy applied).";
      showActualNote = true;
      if (actualRev > 0 && pgiAnnual > 0 && actualRev < pgiAnnual) {
        showDoubleVacWarning = true;
      }
    } else {
      egiUsed = pgiAnnual * (stabOcc / 100);
      valueNote = `Using stabilised income (PGI x ${pct(stabOcc)}).`;
    }

    const noi = egiUsed - opex + util;

    let vLow = 0;
    let vHigh = 0;
    if (capMin > 0 && capMax > 0) {
      vHigh = noi / capMin + excess - ref;
      vLow = noi / capMax + excess - ref;
    }

    const lo = Math.min(vLow, vHigh);
    const hi = Math.max(vLow, vHigh);
    const showActualWarning = scenario === "actual" && (!actualRev || actualRev === 0);
    const performancePct = egiUsed > 0 && actualRev > 0 ? (actualRev / egiUsed) * 100 : null;

    return {
      pgiMonthly, pgiAnnual, derivedOcc, derivedVac, egiUsed, noi, opex,
      lo, hi, valueNote, showActualNote, showDoubleVacWarning, showActualWarning,
      totalUnits, totalM2, climateUnits, climatePct, actualRev, performancePct,
    };
  }, [lines, otherMonthly, actualAnnualRev, stabilisedOccPct, scenario, opexAnnual, utilityAdj, capLowPct, capHighPct, unusedLandSize, landValuePerM2, refurb, hasExpenseSchedule, expenseCalc, isStorage]);

  // ═══════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="space-y-5" id="print-area">

      {/* ── STEP 1: Property Type & Scenario ──────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <StepBadge step={1} />
          <div>
            <h2 className="text-sm font-semibold">Property Type & Scenario</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Select property type first — this determines labels and defaults</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs font-medium" htmlFor="select-property-type">Property Type</Label>
            <Select value={propertyType} onValueChange={handlePropertyTypeChange}>
              <SelectTrigger id="select-property-type" data-testid="select-property-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PROPERTY_LABELS) as PropertyType[]).map((key) => (
                  <SelectItem key={key} value={key}>{PROPERTY_LABELS[key]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-medium" htmlFor="input-stab-occ">Stabilised Occupancy (%)</Label>
            <Input id="input-stab-occ" data-testid="input-stab-occ" type="number" min="0" max="100" step="0.01" value={stabilisedOccPct} onChange={(e) => setters.setStabilisedOccPct(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs font-medium" htmlFor="select-scenario">Scenario</Label>
            <Select value={scenario} onValueChange={(v) => setters.setScenario(v as Scenario)}>
              <SelectTrigger id="select-scenario" data-testid="select-scenario"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="stabilised">Stabilised (PGI x occ.)</SelectItem>
                <SelectItem value="actual">Actual (annual revenue)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isStudent && (
          <>
            <Separator className="my-4" />
            <div>
              <Label className="text-xs font-medium">Pricing Model</Label>
              <div className="flex gap-2 mt-1.5">
                <Button size="sm" variant={pricingMode === "per-unit" ? "default" : "outline"} onClick={() => setPricingMode("per-unit")}>
                  Per Unit
                </Button>
                <Button size="sm" variant={pricingMode === "per-bed" ? "default" : "outline"} onClick={() => setPricingMode("per-bed")}>
                  Per Bed
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {pricingMode === "per-bed"
                  ? "Price per bed — enter number of beds and rate per bed per month"
                  : "Price per unit — enter number of units and rate per unit per month"}
              </p>
            </div>
          </>
        )}
      </Card>

      {/* ── STEP 2: Income Potential (PGI) ────────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <StepBadge step={2} />
          <div>
            <h2 className="text-sm font-semibold">Income Potential (PGI)</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {useFlatRate
                ? `Build Potential Gross Income from ${isStudent ? (pricingMode === "per-bed" ? "bed" : "unit") : "unit"} mix at 100% occupancy`
                : "Build Potential Gross Income at 100% occupancy"}
            </p>
          </div>
        </div>

        <div className={`grid grid-cols-1 gap-3 items-end ${isStorage ? 'sm:grid-cols-[1fr_0.5fr_0.5fr_0.5fr]' : 'sm:grid-cols-[1fr_0.5fr_0.5fr_0.5fr]'}`}>
          <div>
            <Label className="text-xs font-medium" htmlFor="input-desc">Description</Label>
            <Input id="input-desc" data-testid="input-desc" placeholder={isStorage ? "e.g., 3x3 Unit" : isStudent ? (pricingMode === "per-bed" ? "e.g., Single Bed" : "e.g., 2-Bed Unit") : "e.g., Office Area"} value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLine()} />
          </div>
          <div>
            <Label className="text-xs font-medium" htmlFor="input-qty">{qtyLabel}</Label>
            <Input id="input-qty" data-testid="input-qty" type="number" min="1" step="1" placeholder="1" value={qty} onChange={(e) => setQty(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLine()} />
          </div>
          <div>
            <Label className="text-xs font-medium" htmlFor="input-size">Size (m²){useFlatRate && <span className="text-muted-foreground font-normal"> info only</span>}</Label>
            <Input id="input-size" data-testid="input-size" type="number" min="0" step="0.01" placeholder="0" value={size} onChange={(e) => setSize(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLine()} />
          </div>
          <div>
            <Label className="text-xs font-medium" htmlFor="input-rate">{rateLabel}</Label>
            <Input id="input-rate" data-testid="input-rate" type="number" min="0" step="0.01" placeholder="0" value={rate} onChange={(e) => setRate(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLine()} />
          </div>
        </div>

        {isStorage && (
          <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs text-muted-foreground select-none">
            <input type="checkbox" className="rounded border-input accent-primary" checked={climate} onChange={(e) => setClimate(e.target.checked)} />
            <Snowflake className="w-3.5 h-3.5 text-sky-500" />
            Climate-controlled
          </label>
        )}

        <Button size="sm" className="mt-3" onClick={addLine} data-testid="button-add-line">
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add {useFlatRate ? (isStudent && pricingMode === "per-bed" ? "bed type" : "unit type") : "line"}
        </Button>

        {lines.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed p-6 flex flex-col items-center justify-center text-center">
            <ListPlus className="w-8 h-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">
              {useFlatRate
                ? `No ${isStudent && pricingMode === "per-bed" ? "bed" : "unit"} types yet. Add sizes and rates above to build your PGI.`
                : "No income lines yet. Add areas and rates above to build your PGI."}
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider">Description</TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider text-right">{qtyLabel}</TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider text-right">{useFlatRate ? "m² (info)" : "m²"}</TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider text-right">{useFlatRate ? rateLabel.replace("/mo", "") : "R/m²"}</TableHead>
                  {isStorage && <TableHead className="text-[11px] font-medium uppercase tracking-wider text-center">CC</TableHead>}
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider text-right">Monthly</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Input className="h-7 text-sm w-28" value={l.desc} onChange={(e) => updateLineField(l.id, "desc", e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Input className="h-7 text-sm w-16 text-right" type="number" min="1" step="1" value={l.qty || 1} onChange={(e) => updateLineField(l.id, "qty", e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Input className="h-7 text-sm w-20 text-right" type="number" min="0" step="0.01" value={l.size || ""} onChange={(e) => updateLineField(l.id, "size", e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Input className="h-7 text-sm w-20 text-right" type="number" min="0" step="0.01" value={l.rate || ""} onChange={(e) => updateLineField(l.id, "rate", e.target.value)} />
                    </TableCell>
                    {isStorage && (
                      <TableCell className="text-center">
                        <input type="checkbox" className="rounded border-input accent-primary" checked={l.climateControlled || false} onChange={(e) => updateLineField(l.id, "climateControlled", e.target.checked)} />
                      </TableCell>
                    )}
                    <TableCell className="text-sm text-right tabular-nums font-semibold whitespace-nowrap">R {money(lineMonthly(l))}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => removeLine(l.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Separator className="my-4" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium" htmlFor="input-other-monthly">
              Other Monthly Income (R)<span className="text-muted-foreground font-normal ml-1">optional</span>
            </Label>
            <Input id="input-other-monthly" data-testid="input-other-monthly" type="number" min="0" step="0.01" placeholder="0" value={otherMonthly} onChange={(e) => setters.setOtherMonthly(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs font-medium" htmlFor="input-actual-rev">
              Actual Revenue (12 mo)<span className="text-muted-foreground font-normal ml-1">optional</span>
            </Label>
            <Input id="input-actual-rev" data-testid="input-actual-rev" type="number" min="0" step="0.01" placeholder="0" value={actualAnnualRev} onChange={(e) => setters.setActualAnnualRev(e.target.value)} />
          </div>
        </div>
      </Card>

      {/* PGI + Occupancy KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Gross Monthly (100%)" value={`R ${money(calc.pgiMonthly)}`} testId="text-pgi-monthly" accent />
        <KpiCard label="Gross Annual (PGI)" value={`R ${money(calc.pgiAnnual)}`} testId="text-pgi-annual" accent />
        <KpiCard label="Derived Occupancy" value={calc.derivedOcc !== null ? pct(calc.derivedOcc) : "—"} testId="text-current-occ" />
        <KpiCard label="Derived Vacancy" value={calc.derivedVac !== null ? pct(calc.derivedVac) : "—"} testId="text-current-vac" />
      </div>

      {useFlatRate && lines.length > 0 && (
        <div className={`grid gap-3 ${isStorage ? "grid-cols-3" : "grid-cols-2"}`}>
          <KpiCard label={`Total ${qtyLabel}`} value={String(calc.totalUnits)} testId="text-total-units" />
          <KpiCard label="Total m²" value={money(calc.totalM2)} testId="text-total-m2" />
          {isStorage && <KpiCard label="Climate-Ctrl %" value={pct(calc.climatePct)} testId="text-climate-pct" />}
        </div>
      )}

      {calc.showDoubleVacWarning && (
        <div className="flex items-start gap-2.5 text-xs p-3.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <p>Actual annual revenue is below PGI, implying existing vacancy. No additional vacancy is applied in the Actual scenario.</p>
        </div>
      )}

      {/* ── STEP 3: Expense Schedule ──────────────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <StepBadge step={3} />
            <div>
              <h2 className="text-sm font-semibold">Expenses</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {hasExpenseSchedule
                  ? "Detailed expense schedule — auto-calculates total opex for NOI"
                  : "Add expenses line-by-line, or scan a utility bill to auto-populate"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={scanning} onClick={() => fileRef.current?.click()}>
              {scanning ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
              {scanning ? "Scanning…" : "Scan Bill"}
            </Button>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleScan(f); e.target.value = ""; }} />
          </div>
        </div>

        {scanError && (
          <div className="mb-3 text-xs p-2.5 rounded-md bg-destructive/10 text-destructive border border-destructive/20">{scanError}</div>
        )}

        {/* Add expense row */}
        <div className="grid grid-cols-1 sm:grid-cols-[0.7fr_1fr_0.6fr_0.6fr] gap-3 items-end">
          <div>
            <Label className="text-xs font-medium">Group</Label>
            <Select value={newExpGroup} onValueChange={setNewExpGroup}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXPENSE_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-medium">Expense Label</Label>
            <Input placeholder="e.g., Rates & Taxes" value={newExpLabel} onChange={(e) => setNewExpLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addExpense()} />
          </div>
          <div>
            <Label className="text-xs font-medium">Monthly (R)</Label>
            <Input type="number" min="0" step="0.01" placeholder="0" value={newExpMonthly} onChange={(e) => setNewExpMonthly(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addExpense()} />
          </div>
          <div>
            <Label className="text-xs font-medium">Recovery (R)</Label>
            <Input type="number" min="0" step="0.01" placeholder="0" value={newExpRecovery} onChange={(e) => setNewExpRecovery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addExpense()} />
          </div>
        </div>
        <Button size="sm" className="mt-3" onClick={addExpense}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Add expense
        </Button>

        {/* Expense table */}
        {hasExpenseSchedule && (
          <div className="mt-4 rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider">Expense</TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider text-right">Cost/mo</TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider text-right">Recovery</TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider text-right">Net/mo</TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider text-right">Annual (Net)</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseGroups.map((group) => {
                  const groupLines = expenseLines.filter((l) => l.group === group);
                  if (groupLines.length === 0) return null;
                  const groupData = expenseCalc.byGroup[group];
                  return (
                    <>{/* Group header */}
                      <TableRow key={`hdr-${group}`} className="bg-primary/5">
                        <TableCell colSpan={3} className="text-[11px] font-bold uppercase tracking-wider text-primary">{group}</TableCell>
                        <TableCell className="text-[11px] font-bold text-primary text-right tabular-nums">R {money(groupData?.netMonthly || 0)}</TableCell>
                        <TableCell className="text-[11px] font-bold text-primary text-right tabular-nums">R {money(groupData?.netAnnual || 0)}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                      {groupLines.map((l) => {
                        const net = Math.max(0, l.monthly - l.recovery);
                        return (
                          <TableRow key={l.id}>
                            <TableCell><Input className="h-7 text-sm w-40" value={l.label} onChange={(e) => updateExpenseField(l.id, "label", e.target.value)} /></TableCell>
                            <TableCell><Input className="h-7 text-sm w-24 text-right" type="number" min="0" step="0.01" value={l.monthly || ""} onChange={(e) => updateExpenseField(l.id, "monthly", e.target.value)} /></TableCell>
                            <TableCell><Input className="h-7 text-sm w-24 text-right" type="number" min="0" step="0.01" value={l.recovery || ""} onChange={(e) => updateExpenseField(l.id, "recovery", e.target.value)} /></TableCell>
                            <TableCell className={`text-sm text-right tabular-nums font-semibold ${net === 0 ? "text-emerald-600" : ""}`}>R {money(net)}</TableCell>
                            <TableCell className={`text-sm text-right tabular-nums font-semibold ${net === 0 ? "text-emerald-600" : ""}`}>R {money(net * 12)}</TableCell>
                            <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => removeExpense(l.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button></TableCell>
                          </TableRow>
                        );
                      })}
                    </>
                  );
                })}
                <TableRow className="bg-primary text-primary-foreground font-bold">
                  <TableCell colSpan={3} className="text-sm font-bold">Total Operating Expenses</TableCell>
                  <TableCell className="text-sm text-right tabular-nums font-bold">R {money(expenseCalc.totalNetMonthly)}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums font-bold">R {money(expenseCalc.totalNetAnnual)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}

        {/* Manual fallback — only if no expense schedule */}
        {!hasExpenseSchedule && (
          <>
            <Separator className="my-4" />
            <p className="text-[11px] text-muted-foreground mb-3">Or enter a manual total (the expense schedule above overrides these when populated):</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium" htmlFor="input-opex">Operating Expenses (Annual)</Label>
                <Input id="input-opex" data-testid="input-opex" type="number" min="0" step="0.01" placeholder="R 0" value={opexAnnual} onChange={(e) => setters.setOpexAnnual(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-medium" htmlFor="input-utility">
                  Utility Recovery (Annual)<span className="text-muted-foreground font-normal ml-1">optional</span>
                </Label>
                <Input id="input-utility" data-testid="input-utility" type="number" step="0.01" placeholder="R 0" value={utilityAdj} onChange={(e) => setters.setUtilityAdj(e.target.value)} />
              </div>
            </div>
          </>
        )}

        {hasExpenseSchedule && (
          <p className="text-[11px] text-muted-foreground mt-2 italic">
            Net = Cost minus tenant recoveries. Annual = Monthly × 12.
          </p>
        )}
      </Card>

      {/* ── STEP 4: Cap Rate & Adjustments ────────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <StepBadge step={4} />
          <div>
            <h2 className="text-sm font-semibold">Cap Rate & Adjustments</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Capitalisation rate band and value adjustments</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium" htmlFor="input-cap-low">Cap Rate Low (%)</Label>
            <Input id="input-cap-low" data-testid="input-cap-low" type="number" min="0.01" max="100" step="0.01" value={capLowPct} onChange={(e) => setters.setCapLowPct(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs font-medium" htmlFor="input-cap-high">Cap Rate High (%)</Label>
            <Input id="input-cap-high" data-testid="input-cap-high" type="number" min="0.01" max="100" step="0.01" value={capHighPct} onChange={(e) => setters.setCapHighPct(e.target.value)} />
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Development Potential <span className="font-normal normal-case">(optional)</span></p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium" htmlFor="input-unused-land-size">Unused Land Size (m²)</Label>
              <Input id="input-unused-land-size" type="number" min="0" step="1" placeholder="0" value={unusedLandSize} onChange={(e) => setters.setUnusedLandSize(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-medium" htmlFor="input-land-value-per-m2">Market Land Value per m² (R)</Label>
              <Input id="input-land-value-per-m2" type="number" min="0" step="0.01" placeholder="R 0" value={landValuePerM2} onChange={(e) => setters.setLandValuePerM2(e.target.value)} />
            </div>
          </div>
          {(Number(unusedLandSize || 0) > 0 || Number(landValuePerM2 || 0) > 0) && (
            <div className="text-xs text-muted-foreground pt-0.5">
              Excess Land Value: <span className="font-semibold text-foreground">R {(Number(unusedLandSize || 0) * Number(landValuePerM2 || 0)).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>

        <div className="mt-3">
          <Label className="text-xs font-medium" htmlFor="input-refurb">
            - Refurb / Installs (R)<span className="text-muted-foreground font-normal ml-1">optional</span>
          </Label>
          <Input id="input-refurb" type="number" min="0" step="0.01" placeholder="R 0" value={refurb} onChange={(e) => setters.setRefurb(e.target.value)} />
        </div>

        <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium" htmlFor="input-broker-name">Prepared by (broker name on report)</Label>
            <Input id="input-broker-name" type="text" placeholder="e.g. Peet Brits" value={brokerName} onChange={(e) => setters.setBrokerName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs font-medium" htmlFor="select-company-brand">Company (logo on report)</Label>
            <Select value={companyBrand} onValueChange={(v) => setters.setCompanyBrand(v as CompanyBrand)}>
              <SelectTrigger id="select-company-brand" data-testid="select-company-brand">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auctions">Aldes Auctions</SelectItem>
                <SelectItem value="brokers">Aldes Business Brokers</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* ── STEP 5: Results ───────────────────────────────────────── */}

      {calc.showActualWarning && (
        <div className="flex items-start gap-2.5 text-xs p-3.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <p>Enter actual annual revenue to use the Actual scenario.</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="EGI Used (Annual)" value={`R ${money(calc.egiUsed)}`} testId="text-egi" />
        <KpiCard label="Total Opex (Annual)" value={`R ${money(calc.opex)}`} testId="text-opex" />
        <KpiCard label="NOI (Annual)" value={`R ${money(calc.noi)}`} testId="text-noi" />
      </div>

      {calc.actualRev > 0 && (
        <Card className="p-4 border-primary/15 bg-primary/[0.02] dark:bg-primary/[0.04]">
          <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">Performance Factor (Reality Check)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <p className="text-[11px] text-muted-foreground">Actual Revenue (12m)</p>
              <p className="text-sm font-semibold tabular-nums mt-0.5">R {money(calc.actualRev)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{scenario === "actual" ? "Modelled PGI (Annual)" : "Stabilised EGI (Annual)"}</p>
              <p className="text-sm font-semibold tabular-nums mt-0.5">R {money(scenario === "actual" ? calc.pgiAnnual : calc.egiUsed)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Performance Factor</p>
              <p className={`text-sm font-bold tabular-nums mt-0.5 ${calc.performancePct !== null && calc.performancePct >= 100 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                {calc.performancePct !== null ? pct(calc.performancePct) : "—"}
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="relative rounded-md bg-primary p-5 text-primary-foreground">
        <div className="absolute inset-0 rounded-md bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
        <p className="text-[11px] font-medium uppercase tracking-wider opacity-80">Indicated Value Range</p>
        <p className="text-xl sm:text-2xl font-bold mt-2 tabular-nums">
          R {money(calc.lo)} – R {money(calc.hi)}
        </p>
        <p className="text-xs mt-2 opacity-75">{calc.valueNote}</p>
      </div>

      {(() => {
        const cL = Number(capLowPct || 0);
        const cH = Number(capHighPct || 0);
        if (cL <= 0 || cH <= 0) return null;
        const yieldLo = Math.min(cL, cH);
        const yieldHi = Math.max(cL, cH);
        const paybackLo = 1 / (yieldHi / 100);
        const paybackHi = 1 / (yieldLo / 100);
        return (
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-3">
              <p className="text-[11px] text-muted-foreground">Implied Yield</p>
              <p className="text-sm font-semibold tabular-nums mt-0.5">{yieldLo.toFixed(1)}% – {yieldHi.toFixed(1)}%</p>
            </Card>
            <Card className="p-3">
              <p className="text-[11px] text-muted-foreground">Payback Period</p>
              <p className="text-sm font-semibold tabular-nums mt-0.5">{paybackLo.toFixed(1)} – {paybackHi.toFixed(1)} years</p>
            </Card>
          </div>
        );
      })()}

      {calc.showActualNote && !calc.showActualWarning && (
        <div className="flex items-start gap-2.5 text-xs p-3.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <p><strong>Actual scenario:</strong> Value is based on actual annual revenue (no additional vacancy applied).</p>
        </div>
      )}

      <div className="flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed px-1">
        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <p><strong>Occupancy derivation:</strong> Current Occupancy = Actual Annual Revenue / PGI. Without actual revenue, stabilised assumptions are used.</p>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => exportRentalClientPDF(valuationName, { ...state, opexAnnual: String(calc.opex) }, calc)}>
          <FileDown className="w-3.5 h-3.5 mr-1.5" /> Client Summary
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportRentalPDF(valuationName, { ...state, opexAnnual: String(calc.opex) }, calc, brokerName, companyBrand)}>
          <FileDown className="w-3.5 h-3.5 mr-1.5" /> Full Report
        </Button>
      </div>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="formulas" className="border rounded-md px-4">
          <AccordionTrigger className="text-xs font-medium py-3">
            <span className="flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5" /> Formulas Reference
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ul className="text-xs text-muted-foreground space-y-1.5 pb-1">
              <li><strong>Line Monthly</strong> = {useFlatRate ? `${qtyLabel} × Rate (${rateLabel})` : "Qty × Size (m²) × Rate (R/m²/mo)"}</li>
              <li><strong>PGI</strong> = Σ Line Monthlies + Other Monthly × 12</li>
              <li><strong>Current Occupancy</strong> = Actual Annual Revenue / PGI</li>
              <li><strong>EGI (Stabilised)</strong> = PGI × Stabilised Occupancy</li>
              <li><strong>Opex</strong> = {hasExpenseSchedule ? "Σ (Cost − Recovery) × 12 from expense schedule" : "Manual operating expenses"}</li>
              <li><strong>NOI</strong> = EGI − Opex{!hasExpenseSchedule ? " + Utility Recovery" : ""}</li>
              <li><strong>Performance Factor</strong> = Actual Revenue / Modelled EGI × 100</li>
              <li><strong>Excess Land Value</strong> = Unused Land Size (m²) × Market Land Value per m²</li>
              <li><strong>Value Range</strong> = (NOI / Cap High) to (NOI / Cap Low), then + Excess Land − Refurb</li>
              <li><strong>Implied Yield</strong> = Cap Rate Low% – Cap Rate High%</li>
              <li><strong>Payback Period</strong> = (1 ÷ Cap Rate High) – (1 ÷ Cap Rate Low) in years</li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
