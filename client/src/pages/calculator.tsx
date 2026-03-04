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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Trash2,
  Building2,
  Calculator,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Info,
} from "lucide-react";

interface IncomeLine {
  id: number;
  desc: string;
  size: number;
  rate: number;
}

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

function money(n: number): string {
  return n.toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function pct(n: number): string {
  return `${n.toFixed(2)}%`;
}

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max);
}

export default function CalculatorPage() {
  const [lines, setLines] = useState<IncomeLine[]>([]);
  const [nextId, setNextId] = useState(1);

  const [desc, setDesc] = useState("");
  const [size, setSize] = useState("");
  const [rate, setRate] = useState("");

  const [otherMonthly, setOtherMonthly] = useState("");
  const [actualAnnualRev, setActualAnnualRev] = useState("");

  const [propertyType, setPropertyType] = useState<PropertyType>("office");
  const [stabilisedOccPct, setStabilisedOccPct] = useState("88");
  const [scenario, setScenario] = useState<Scenario>("stabilised");

  const [opexAnnual, setOpexAnnual] = useState("");
  const [utilityAdj, setUtilityAdj] = useState("");

  const [capLowPct, setCapLowPct] = useState("12.0");
  const [capHighPct, setCapHighPct] = useState("13.5");

  const [excessLand, setExcessLand] = useState("");
  const [refurb, setRefurb] = useState("");

  const addLine = useCallback(() => {
    const sizeVal = Number(size || 0);
    const rateVal = Number(rate || 0);
    if (sizeVal <= 0 || rateVal < 0) return;

    setLines((prev) => [
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
  }, [desc, size, rate, nextId]);

  const removeLine = useCallback((id: number) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const handlePropertyTypeChange = useCallback((val: string) => {
    const t = val as PropertyType;
    setPropertyType(t);
    setStabilisedOccPct(String(PROPERTY_DEFAULTS[t]));
  }, []);

  const resetAll = useCallback(() => {
    setLines([]);
    setNextId(1);
    setDesc("");
    setSize("");
    setRate("");
    setOtherMonthly("");
    setActualAnnualRev("");
    setPropertyType("office");
    setStabilisedOccPct("88");
    setScenario("stabilised");
    setOpexAnnual("");
    setUtilityAdj("");
    setCapLowPct("12.0");
    setCapHighPct("13.5");
    setExcessLand("");
    setRefurb("");
  }, []);

  const calc = useMemo(() => {
    const otherM = Number(otherMonthly || 0);
    const pgiMonthly =
      lines.reduce((sum, l) => sum + l.size * l.rate, 0) + otherM;
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

    let capLow = Number(capLowPct || 0) / 100;
    let capHigh = Number(capHighPct || 0) / 100;
    const capMin = Math.min(capLow, capHigh);
    const capMax = Math.max(capLow, capHigh);

    const excess = Number(excessLand || 0);
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

    const showActualWarning =
      scenario === "actual" && (!actualRev || actualRev === 0);

    return {
      pgiMonthly,
      pgiAnnual,
      derivedOcc,
      derivedVac,
      egiUsed,
      noi,
      lo,
      hi,
      valueNote,
      showActualNote,
      showDoubleVacWarning,
      showActualWarning,
    };
  }, [
    lines,
    otherMonthly,
    actualAnnualRev,
    stabilisedOccPct,
    scenario,
    opexAnnual,
    utilityAdj,
    capLowPct,
    capHighPct,
    excessLand,
    refurb,
  ]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-primary/10">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <h1
              className="text-xl sm:text-2xl font-bold tracking-tight"
              data-testid="text-title"
            >
              Property Valuation Calculator
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 ml-11">
            <p className="text-sm text-muted-foreground" data-testid="text-subtitle">
              Income Approach — indicative only. Use evidence (rent comparables +
              sales/cap evidence) to support assumptions.
            </p>
            <Badge variant="secondary" className="text-xs no-default-active-elevate">
              PGI &rarr; EGI &rarr; NOI &rarr; Value
            </Badge>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h2 className="text-base font-semibold" data-testid="text-section-income">
                1) Income Potential (PGI)
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Build your <strong>Potential Gross Income</strong> at 100% occupancy
              from areas/rates (plus other monthly income).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_0.7fr_0.7fr] gap-3 items-end">
              <div>
                <Label className="text-xs" htmlFor="input-desc">
                  Description
                </Label>
                <Input
                  id="input-desc"
                  data-testid="input-desc"
                  placeholder="e.g., Office Area"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addLine()}
                />
              </div>
              <div>
                <Label className="text-xs" htmlFor="input-size">
                  Size (m²)
                </Label>
                <Input
                  id="input-size"
                  data-testid="input-size"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addLine()}
                />
              </div>
              <div>
                <Label className="text-xs" htmlFor="input-rate">
                  Rate (R/m²/month)
                </Label>
                <Input
                  id="input-rate"
                  data-testid="input-rate"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addLine()}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={addLine} data-testid="button-add-line">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add line
              </Button>
            </div>

            {lines.length > 0 && (
              <div className="mt-4 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs text-right">m²</TableHead>
                      <TableHead className="text-xs text-right">R/m²</TableHead>
                      <TableHead className="text-xs text-right">Monthly (R)</TableHead>
                      <TableHead className="text-xs w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l) => (
                      <TableRow key={l.id} data-testid={`row-line-${l.id}`}>
                        <TableCell className="text-sm">{l.desc}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums">
                          {money(l.size)}
                        </TableCell>
                        <TableCell className="text-sm text-right tabular-nums">
                          {money(l.rate)}
                        </TableCell>
                        <TableCell className="text-sm text-right tabular-nums font-medium">
                          {money(l.size * l.rate)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeLine(l.id)}
                            data-testid={`button-remove-${l.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div>
                <Label className="text-xs" htmlFor="input-other-monthly">
                  Other Monthly Income (R){" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="input-other-monthly"
                  data-testid="input-other-monthly"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={otherMonthly}
                  onChange={(e) => setOtherMonthly(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs" htmlFor="input-actual-rev">
                  Actual Rental Revenue (last 12 months){" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="input-actual-rev"
                  data-testid="input-actual-rev"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={actualAnnualRev}
                  onChange={(e) => setActualAnnualRev(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="border rounded-md p-3">
                <p className="text-xs text-muted-foreground">
                  Potential Gross Monthly (100%)
                </p>
                <p
                  className="text-base font-bold mt-1 tabular-nums"
                  data-testid="text-pgi-monthly"
                >
                  R {money(calc.pgiMonthly)}
                </p>
              </div>
              <div className="border rounded-md p-3">
                <p className="text-xs text-muted-foreground">
                  Potential Gross Annual (PGI)
                </p>
                <p
                  className="text-base font-bold mt-1 tabular-nums"
                  data-testid="text-pgi-annual"
                >
                  R {money(calc.pgiAnnual)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="border rounded-md p-3">
                <p className="text-xs text-muted-foreground">
                  Derived Current Occupancy
                </p>
                <p
                  className="text-base font-bold mt-1 tabular-nums"
                  data-testid="text-current-occ"
                >
                  {calc.derivedOcc !== null ? pct(calc.derivedOcc) : "—"}
                </p>
              </div>
              <div className="border rounded-md p-3">
                <p className="text-xs text-muted-foreground">
                  Derived Current Vacancy
                </p>
                <p
                  className="text-base font-bold mt-1 tabular-nums"
                  data-testid="text-current-vac"
                >
                  {calc.derivedVac !== null ? pct(calc.derivedVac) : "—"}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <p>
                <strong>How occupancy is derived:</strong> Current Occupancy = Actual
                Annual Revenue / Potential Gross Annual (PGI). If you don't enter actual
                revenue, the calculator will skip this and just use your stabilised
                assumption.
              </p>
            </div>

            {calc.showDoubleVacWarning && (
              <div
                className="mt-3 flex items-start gap-2 text-xs p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
                data-testid="warning-double-vacancy"
              >
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <p>
                  Your <strong>actual annual revenue</strong> is already below PGI,
                  which implies vacancy already exists. This calculator will{" "}
                  <strong>not</strong> apply vacancy on the "Actual" scenario (to avoid
                  double vacancy).
                </p>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="w-4 h-4 text-primary" />
              <h2 className="text-base font-semibold" data-testid="text-section-assumptions">
                2) Assumptions + Value
              </h2>
            </div>

            <div className="mt-3">
              <Label className="text-xs" htmlFor="select-property-type">
                Property Type{" "}
                <span className="text-muted-foreground">
                  (sets a sensible stabilised occupancy default)
                </span>
              </Label>
              <Select
                value={propertyType}
                onValueChange={handlePropertyTypeChange}
              >
                <SelectTrigger
                  id="select-property-type"
                  data-testid="select-property-type"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.keys(PROPERTY_LABELS) as PropertyType[]
                  ).map((key) => (
                    <SelectItem key={key} value={key}>
                      {PROPERTY_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <Label className="text-xs" htmlFor="input-stab-occ">
                  Stabilised Occupancy (%)
                </Label>
                <Input
                  id="input-stab-occ"
                  data-testid="input-stab-occ"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={stabilisedOccPct}
                  onChange={(e) => setStabilisedOccPct(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs" htmlFor="select-scenario">
                  Scenario
                </Label>
                <Select
                  value={scenario}
                  onValueChange={(v) => setScenario(v as Scenario)}
                >
                  <SelectTrigger
                    id="select-scenario"
                    data-testid="select-scenario"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stabilised">
                      Stabilised Income (PGI x occ.)
                    </SelectItem>
                    <SelectItem value="actual">
                      Actual Income (annual revenue)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="my-4" />

            <div>
              <Label className="text-xs" htmlFor="input-opex">
                Operating Expenses (Annual) (R)
              </Label>
              <Input
                id="input-opex"
                data-testid="input-opex"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={opexAnnual}
                onChange={(e) => setOpexAnnual(e.target.value)}
              />
            </div>

            <div className="mt-3">
              <Label className="text-xs" htmlFor="input-utility">
                Net Utility Under/(Over) Recovery (Annual) (R){" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="input-utility"
                data-testid="input-utility"
                type="number"
                step="0.01"
                placeholder="0"
                value={utilityAdj}
                onChange={(e) => setUtilityAdj(e.target.value)}
              />
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs" htmlFor="input-cap-low">
                  Cap Rate Low (%)
                </Label>
                <Input
                  id="input-cap-low"
                  data-testid="input-cap-low"
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={capLowPct}
                  onChange={(e) => setCapLowPct(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs" htmlFor="input-cap-high">
                  Cap Rate High (%)
                </Label>
                <Input
                  id="input-cap-high"
                  data-testid="input-cap-high"
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={capHighPct}
                  onChange={(e) => setCapHighPct(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <Label className="text-xs" htmlFor="input-excess">
                  Plus: Expansion / Excess Land (R){" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="input-excess"
                  data-testid="input-excess"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={excessLand}
                  onChange={(e) => setExcessLand(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs" htmlFor="input-refurb">
                  Less: Refurb / Tenant Installs (R){" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="input-refurb"
                  data-testid="input-refurb"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={refurb}
                  onChange={(e) => setRefurb(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={resetAll}
                data-testid="button-reset"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Reset All
              </Button>
            </div>

            <Separator className="my-4" />

            {calc.showActualWarning && (
              <div
                className="mb-3 flex items-start gap-2 text-xs p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
                data-testid="warning-no-actual-rev"
              >
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <p>
                  Enter actual annual revenue to use the Actual scenario.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="border rounded-md p-3">
                <p className="text-xs text-muted-foreground">
                  Effective Gross Income Used (Annual)
                </p>
                <p
                  className="text-base font-bold mt-1 tabular-nums"
                  data-testid="text-egi"
                >
                  R {money(calc.egiUsed)}
                </p>
              </div>
              <div className="border rounded-md p-3">
                <p className="text-xs text-muted-foreground">NOI (Annual)</p>
                <p
                  className="text-base font-bold mt-1 tabular-nums"
                  data-testid="text-noi"
                >
                  R {money(calc.noi)}
                </p>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-md bg-primary/5 border border-primary/20">
              <p
                className="text-lg sm:text-xl font-bold tabular-nums"
                data-testid="text-value-range"
              >
                Value Range: R {money(calc.lo)} – R {money(calc.hi)}
              </p>
              <p
                className="text-xs text-muted-foreground mt-1"
                data-testid="text-value-note"
              >
                {calc.valueNote}
              </p>
            </div>

            {calc.showActualNote && !calc.showActualWarning && (
              <div
                className="mt-3 flex items-start gap-2 text-xs p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                data-testid="note-actual-scenario"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <p>
                  <strong>Actual scenario:</strong> Value is based on{" "}
                  <strong>actual annual revenue</strong> (no additional vacancy
                  applied).
                </p>
              </div>
            )}

            <div className="mt-4 text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Formulas:</p>
              <ul className="list-disc ml-4 space-y-0.5">
                <li>
                  <strong>PGI</strong> = Potential Monthly x 12
                </li>
                <li>
                  <strong>Current Occupancy</strong> = Actual Annual Revenue / PGI
                  (if provided)
                </li>
                <li>
                  <strong>EGI (Stabilised)</strong> = PGI x Stabilised Occupancy
                </li>
                <li>
                  <strong>NOI</strong> = EGI - Opex + Utility Adj
                </li>
                <li>
                  <strong>Value Range</strong> = (NOI / Cap High) to (NOI / Cap Low),
                  then + Excess Land - Refurb
                </li>
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
