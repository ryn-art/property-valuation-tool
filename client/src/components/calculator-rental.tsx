import { useState, useCallback, useMemo } from "react";
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
} from "lucide-react";
import { StepBadge, KpiCard, money, pct, clamp } from "./calculator-shared";
import { exportRentalPDF, exportRentalClientPDF } from "@/lib/pdf-export";
import type { IncomeLine } from "@shared/schema";

type PropertyType = "office" | "retail" | "industrial" | "storage" | "other";
type Scenario = "stabilised" | "actual";

const PROPERTY_DEFAULTS: Record<PropertyType, number> = {
  office: 88,
  retail: 92,
  industrial: 95,
  storage: 91,
  other: 90,
};

const PROPERTY_LABELS: Record<PropertyType, string> = {
  office: "Office",
  retail: "Retail",
  industrial: "Industrial",
  storage: "Self-storage",
  other: "Other",
};

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

  const {
    lines, otherMonthly, actualAnnualRev, propertyType, stabilisedOccPct,
    scenario, opexAnnual, utilityAdj, capLowPct, capHighPct, unusedLandSize, landValuePerM2, refurb,
  } = state;

  const addLine = useCallback(() => {
    const sizeVal = Number(size || 0);
    const rateVal = Number(rate || 0);
    if (sizeVal <= 0 || rateVal < 0) return;

    setters.setLines((prev) => [
      ...prev,
      {
        id: nextId,
        desc: desc.trim() || "Rentable Area",
        size: sizeVal,
        rate: rateVal,
      },
    ]);
    setNextId((n) => n + 1);
    setDesc("");
    setSize("");
    setRate("");
  }, [desc, size, rate, nextId, setters, setNextId]);

  const removeLine = useCallback((id: number) => {
    setters.setLines((prev) => prev.filter((l) => l.id !== id));
  }, [setters]);

  const handlePropertyTypeChange = useCallback((val: string) => {
    const t = val as PropertyType;
    setters.setPropertyType(t);
    setters.setStabilisedOccPct(String(PROPERTY_DEFAULTS[t]));
  }, [setters]);

  const calc = useMemo(() => {
    const otherM = Number(otherMonthly || 0);
    const pgiMonthly = lines.reduce((sum, l) => sum + l.size * l.rate, 0) + otherM;
    const pgiAnnual = pgiMonthly * 12;

    const actualRev = Number(actualAnnualRev || 0);
    let derivedOcc: number | null = null;
    let derivedVac: number | null = null;

    if (pgiAnnual > 0 && actualRev > 0) {
      derivedOcc = clamp((actualRev / pgiAnnual) * 100, 0, 200);
      derivedVac = clamp(100 - derivedOcc, 0, 100);
    }

    const stabOcc = clamp(Number(stabilisedOccPct || 0), 0, 100);
    const opex = Number(opexAnnual || 0);
    const util = Number(utilityAdj || 0);

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

    return {
      pgiMonthly, pgiAnnual, derivedOcc, derivedVac, egiUsed, noi,
      lo, hi, valueNote, showActualNote, showDoubleVacWarning, showActualWarning,
    };
  }, [lines, otherMonthly, actualAnnualRev, stabilisedOccPct, scenario, opexAnnual, utilityAdj, capLowPct, capHighPct, unusedLandSize, landValuePerM2, refurb]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" id="print-area">
      <div className="space-y-5">
        <Card className="p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <StepBadge step={1} />
            <div>
              <h2 className="text-sm font-semibold" data-testid="text-section-income">
                Income Potential (PGI)
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Build Potential Gross Income at 100% occupancy
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_0.65fr_0.65fr] gap-3 items-end">
            <div>
              <Label className="text-xs font-medium" htmlFor="input-desc">Description</Label>
              <Input id="input-desc" data-testid="input-desc" placeholder="e.g., Office Area" value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLine()} />
            </div>
            <div>
              <Label className="text-xs font-medium" htmlFor="input-size">Size (m²)</Label>
              <Input id="input-size" data-testid="input-size" type="number" min="0" step="0.01" placeholder="0" value={size} onChange={(e) => setSize(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLine()} />
            </div>
            <div>
              <Label className="text-xs font-medium" htmlFor="input-rate">Rate (R/m²/mo)</Label>
              <Input id="input-rate" data-testid="input-rate" type="number" min="0" step="0.01" placeholder="0" value={rate} onChange={(e) => setRate(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLine()} />
            </div>
          </div>

          <Button size="sm" className="mt-3" onClick={addLine} data-testid="button-add-line">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add line
          </Button>

          {lines.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed p-6 flex flex-col items-center justify-center text-center">
              <ListPlus className="w-8 h-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">
                No income lines yet. Add areas and rates above to build your PGI.
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider">Description</TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider text-right">m²</TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider text-right">R/m²</TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider text-right">Monthly</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => (
                    <TableRow key={l.id} data-testid={`row-line-${l.id}`}>
                      <TableCell className="text-sm font-medium">{l.desc}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums text-muted-foreground">{money(l.size)}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums text-muted-foreground">{money(l.rate)}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums font-semibold">R {money(l.size * l.rate)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" aria-label={`Remove ${l.desc}`} onClick={() => removeLine(l.id)} data-testid={`button-remove-${l.id}`}>
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

        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Gross Monthly (100%)" value={`R ${money(calc.pgiMonthly)}`} testId="text-pgi-monthly" accent />
          <KpiCard label="Gross Annual (PGI)" value={`R ${money(calc.pgiAnnual)}`} testId="text-pgi-annual" accent />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Derived Occupancy" value={calc.derivedOcc !== null ? pct(calc.derivedOcc) : "\u2014"} testId="text-current-occ" />
          <KpiCard label="Derived Vacancy" value={calc.derivedVac !== null ? pct(calc.derivedVac) : "\u2014"} testId="text-current-vac" />
        </div>

        <div className="flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed px-1">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <p>
            <strong>Occupancy derivation:</strong> Current Occupancy = Actual Annual Revenue / PGI. Without actual revenue, stabilised assumptions are used.
          </p>
        </div>

        {calc.showDoubleVacWarning && (
          <div className="flex items-start gap-2.5 text-xs p-3.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200" data-testid="warning-double-vacancy">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <p>Actual annual revenue is below PGI, implying existing vacancy. No additional vacancy is applied in the Actual scenario.</p>
          </div>
        )}
      </div>

      <div className="space-y-5">
        <Card className="p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <StepBadge step={2} />
            <div>
              <h2 className="text-sm font-semibold" data-testid="text-section-assumptions">Assumptions + Value</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Set property type, scenario, and cap rates</p>
            </div>
          </div>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
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

          <Separator className="my-4" />

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

          <Separator className="my-4" />

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
                <Input id="input-unused-land-size" data-testid="input-unused-land-size" type="number" min="0" step="1" placeholder="0" value={unusedLandSize} onChange={(e) => setters.setUnusedLandSize(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-medium" htmlFor="input-land-value-per-m2">Market Land Value per m² (R)</Label>
                <Input id="input-land-value-per-m2" data-testid="input-land-value-per-m2" type="number" min="0" step="0.01" placeholder="R 0" value={landValuePerM2} onChange={(e) => setters.setLandValuePerM2(e.target.value)} />
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
            <Input id="input-refurb" data-testid="input-refurb" type="number" min="0" step="0.01" placeholder="R 0" value={refurb} onChange={(e) => setters.setRefurb(e.target.value)} />
          </div>
        </Card>

        {calc.showActualWarning && (
          <div className="flex items-start gap-2.5 text-xs p-3.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200" data-testid="warning-no-actual-rev">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <p>Enter actual annual revenue to use the Actual scenario.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="EGI Used (Annual)" value={`R ${money(calc.egiUsed)}`} testId="text-egi" />
          <KpiCard label="NOI (Annual)" value={`R ${money(calc.noi)}`} testId="text-noi" />
        </div>

        <div className="relative rounded-md bg-primary p-5 text-primary-foreground">
          <div className="absolute inset-0 rounded-md bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
          <p className="text-[11px] font-medium uppercase tracking-wider opacity-80">Indicated Value Range</p>
          <p className="text-xl sm:text-2xl font-bold mt-2 tabular-nums" data-testid="text-value-range">
            R {money(calc.lo)} – R {money(calc.hi)}
          </p>
          <p className="text-xs mt-2 opacity-75" data-testid="text-value-note">{calc.valueNote}</p>
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
            <div className="grid grid-cols-2 gap-3" data-testid="card-yield-payback">
              <Card className="p-3">
                <p className="text-[11px] text-muted-foreground">Implied Yield</p>
                <p className="text-sm font-semibold tabular-nums mt-0.5" data-testid="text-implied-yield">
                  {yieldLo.toFixed(1)}% – {yieldHi.toFixed(1)}%
                </p>
              </Card>
              <Card className="p-3">
                <p className="text-[11px] text-muted-foreground">Payback Period</p>
                <p className="text-sm font-semibold tabular-nums mt-0.5" data-testid="text-payback-period">
                  {paybackLo.toFixed(1)} – {paybackHi.toFixed(1)} years
                </p>
              </Card>
            </div>
          );
        })()}

        {calc.showActualNote && !calc.showActualWarning && (
          <div className="flex items-start gap-2.5 text-xs p-3.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200" data-testid="note-actual-scenario">
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <p><strong>Actual scenario:</strong> Value is based on actual annual revenue (no additional vacancy applied).</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => exportRentalClientPDF(valuationName, state, calc)} data-testid="button-export-client-pdf">
            <FileDown className="w-3.5 h-3.5 mr-1.5" />
            Client Summary
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportRentalPDF(valuationName, state, calc)} data-testid="button-export-pdf">
            <FileDown className="w-3.5 h-3.5 mr-1.5" />
            Full Report
          </Button>
        </div>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="formulas" className="border rounded-md px-4">
            <AccordionTrigger className="text-xs font-medium py-3" data-testid="button-formulas-toggle">
              <span className="flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5" />
                Formulas Reference
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="text-xs text-muted-foreground space-y-1.5 pb-1">
                <li><strong>PGI</strong> = Potential Monthly x 12</li>
                <li><strong>Current Occupancy</strong> = Actual Annual Revenue / PGI</li>
                <li><strong>EGI (Stabilised)</strong> = PGI x Stabilised Occupancy</li>
                <li><strong>NOI</strong> = EGI - Opex + Utility Adj</li>
                <li><strong>Excess Land Value</strong> = Unused Land Size (m²) × Market Land Value per m²</li>
                <li><strong>Value Range</strong> = (NOI / Cap High) to (NOI / Cap Low), then + Excess Land Value - Refurb</li>
                <li><strong>Implied Yield</strong> = Cap Rate Low% – Cap Rate High%</li>
                <li><strong>Payback Period</strong> = (1 ÷ Cap Rate High) – (1 ÷ Cap Rate Low) in years</li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
