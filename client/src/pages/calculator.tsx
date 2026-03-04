import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Trash2,
  Building2,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Info,
  ListPlus,
  ArrowRight,
  Save,
  FilePlus2,
  FileText,
  Pencil,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-provider";
import { useToast } from "@/hooks/use-toast";
import type { Valuation, IncomeLine } from "@shared/schema";

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

function StepBadge({ step }: { step: number }) {
  return (
    <Badge className="w-6 h-6 rounded-md justify-center no-default-active-elevate flex-shrink-0">
      {step}
    </Badge>
  );
}

function KpiCard({
  label,
  value,
  testId,
  accent,
}: {
  label: string;
  value: string;
  testId: string;
  accent?: boolean;
}) {
  return (
    <Card
      className={`p-3.5 transition-colors ${
        accent
          ? "bg-primary/5 dark:bg-primary/10 border-primary/10 dark:border-primary/20"
          : ""
      }`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-semibold mt-1.5 tabular-nums" data-testid={testId}>
        {value}
      </p>
    </Card>
  );
}

function formatDate(dateStr: string | Date) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CalculatorPage() {
  const { toast } = useToast();

  const [activeValuationId, setActiveValuationId] = useState<number | null>(null);
  const [valuationName, setValuationName] = useState("Untitled Valuation");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

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

  const { data: valuationsList, isLoading: isListLoading, isError: isListError } = useQuery<Valuation[]>({
    queryKey: ["/api/valuations"],
  });

  const loadValuation = useCallback((val: Valuation) => {
    setActiveValuationId(val.id);
    setValuationName(val.name);
    const savedLines = (val.lines as IncomeLine[]) || [];
    setLines(savedLines);
    setNextId(savedLines.length > 0 ? Math.max(...savedLines.map((l) => l.id)) + 1 : 1);
    setOtherMonthly(val.otherMonthly ? String(val.otherMonthly) : "");
    setActualAnnualRev(val.actualAnnualRev ? String(val.actualAnnualRev) : "");
    setPropertyType(val.propertyType as PropertyType);
    setStabilisedOccPct(String(val.stabilisedOccPct));
    setScenario(val.scenario as Scenario);
    setOpexAnnual(val.opexAnnual ? String(val.opexAnnual) : "");
    setUtilityAdj(val.utilityAdj ? String(val.utilityAdj) : "");
    setCapLowPct(String(val.capLowPct));
    setCapHighPct(String(val.capHighPct));
    setExcessLand(val.excessLand ? String(val.excessLand) : "");
    setRefurb(val.refurb ? String(val.refurb) : "");
  }, []);

  const getCurrentData = useCallback(() => ({
    name: valuationName,
    propertyType,
    lines,
    otherMonthly: Number(otherMonthly || 0),
    actualAnnualRev: Number(actualAnnualRev || 0),
    stabilisedOccPct: Number(stabilisedOccPct || 0),
    scenario,
    opexAnnual: Number(opexAnnual || 0),
    utilityAdj: Number(utilityAdj || 0),
    capLowPct: Number(capLowPct || 0),
    capHighPct: Number(capHighPct || 0),
    excessLand: Number(excessLand || 0),
    refurb: Number(refurb || 0),
  }), [valuationName, propertyType, lines, otherMonthly, actualAnnualRev, stabilisedOccPct, scenario, opexAnnual, utilityAdj, capLowPct, capHighPct, excessLand, refurb]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/valuations", getCurrentData());
      return res.json();
    },
    onSuccess: (data: Valuation) => {
      setActiveValuationId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/valuations"] });
      toast({ title: "Valuation saved", description: `"${data.name}" has been created.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save valuation.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!activeValuationId) throw new Error("No active valuation to update");
      const res = await apiRequest("PATCH", `/api/valuations/${activeValuationId}`, getCurrentData());
      return res.json() as Promise<Valuation>;
    },
    onSuccess: (data: Valuation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/valuations"] });
      toast({ title: "Valuation updated", description: `"${data.name}" has been saved.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update valuation.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/valuations/${id}`);
      return id;
    },
    onSuccess: (deletedId: number) => {
      queryClient.invalidateQueries({ queryKey: ["/api/valuations"] });
      if (activeValuationId === deletedId) {
        startNew();
      }
      toast({ title: "Deleted", description: "Valuation has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete valuation.", variant: "destructive" });
    },
  });

  const handleSave = useCallback(() => {
    if (activeValuationId) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  }, [activeValuationId, updateMutation, createMutation]);

  const startNew = useCallback(() => {
    setActiveValuationId(null);
    setValuationName("Untitled Valuation");
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

  const startEditName = useCallback(() => {
    setEditNameValue(valuationName);
    setIsEditingName(true);
  }, [valuationName]);

  const confirmEditName = useCallback(() => {
    const trimmed = editNameValue.trim();
    if (trimmed) {
      setValuationName(trimmed);
    }
    setIsEditingName(false);
  }, [editNameValue]);

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

    const capLow = Number(capLowPct || 0) / 100;
    const capHigh = Number(capHighPct || 0) / 100;
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

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/50 dark:bg-card/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold truncate" data-testid="text-title">
                Property Valuation Calculator
              </h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                Income Approach
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="secondary" className="text-[10px] no-default-active-elevate hidden sm:inline-flex">
              PGI <ArrowRight className="w-2.5 h-2.5 mx-0.5" /> EGI <ArrowRight className="w-2.5 h-2.5 mx-0.5" /> NOI <ArrowRight className="w-2.5 h-2.5 mx-0.5" /> Value
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-5">
          {/* SAVED VALUATIONS PANEL */}
          <div className="xl:order-first order-last">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-semibold">Saved Valuations</h3>
                <Button size="sm" variant="secondary" onClick={startNew} data-testid="button-new-valuation">
                  <FilePlus2 className="w-3.5 h-3.5 mr-1.5" />
                  New
                </Button>
              </div>

              {isListLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : isListError ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-center">
                  <p className="text-xs text-destructive">
                    Failed to load saved valuations. Please refresh the page.
                  </p>
                </div>
              ) : !valuationsList || valuationsList.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-center">
                  <FileText className="w-6 h-6 text-muted-foreground/40 mx-auto mb-1.5" />
                  <p className="text-xs text-muted-foreground">
                    No saved valuations yet. Fill in the calculator and hit Save.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[60vh] xl:max-h-[calc(100vh-200px)] overflow-y-auto">
                  {valuationsList.map((v) => (
                    <div
                      key={v.id}
                      role="button"
                      tabIndex={0}
                      data-testid={`card-valuation-${v.id}`}
                      className={`group rounded-md p-2.5 cursor-pointer transition-colors border ${
                        activeValuationId === v.id
                          ? "bg-primary/5 dark:bg-primary/10 border-primary/20"
                          : "border-transparent hover:bg-muted/50"
                      }`}
                      onClick={() => loadValuation(v)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); loadValuation(v); } }}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" data-testid={`text-valuation-name-${v.id}`}>
                            {v.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {PROPERTY_LABELS[v.propertyType as PropertyType] || v.propertyType}
                            {" \u00b7 "}
                            {formatDate(v.updatedAt)}
                          </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="opacity-0 group-hover:opacity-100 flex-shrink-0"
                              aria-label={`Delete ${v.name}`}
                              data-testid={`button-delete-${v.id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete valuation?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete "{v.name}". This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(v.id)}
                                data-testid={`button-confirm-delete-${v.id}`}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* MAIN CALCULATOR */}
          <div className="space-y-5">
            {/* VALUATION NAME + SAVE BAR */}
            <div className="flex flex-wrap items-center gap-3">
              {isEditingName ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    className="h-8 w-56 text-sm"
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmEditName();
                      if (e.key === "Escape") setIsEditingName(false);
                    }}
                    autoFocus
                    data-testid="input-valuation-name"
                  />
                  <Button size="icon" variant="ghost" onClick={confirmEditName} aria-label="Confirm name">
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setIsEditingName(false)} aria-label="Cancel editing name">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 cursor-pointer group" onClick={startEditName} data-testid="button-edit-name">
                  <h2 className="text-lg font-semibold">{valuationName}</h2>
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
              <div className="flex items-center gap-2 ml-auto">
                {activeValuationId && (
                  <Badge variant="secondary" className="text-[10px] no-default-active-elevate">
                    Saved
                  </Badge>
                )}
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  data-testid="button-save"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  {activeValuationId ? "Save" : "Save New"}
                </Button>
              </div>
            </div>

            <p className="text-sm text-muted-foreground max-w-2xl -mt-3" data-testid="text-subtitle">
              Indicative only. Use evidence (rent comparables + sales/cap evidence) to support assumptions.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* LEFT: INCOME INPUTS */}
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
                      <Label className="text-xs font-medium" htmlFor="input-desc">
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
                      <Label className="text-xs font-medium" htmlFor="input-size">
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
                      <Label className="text-xs font-medium" htmlFor="input-rate">
                        Rate (R/m²/mo)
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

                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={addLine}
                    data-testid="button-add-line"
                  >
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
                            <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                              Description
                            </TableHead>
                            <TableHead className="text-[11px] font-medium uppercase tracking-wider text-right">
                              m²
                            </TableHead>
                            <TableHead className="text-[11px] font-medium uppercase tracking-wider text-right">
                              R/m²
                            </TableHead>
                            <TableHead className="text-[11px] font-medium uppercase tracking-wider text-right">
                              Monthly
                            </TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lines.map((l) => (
                            <TableRow key={l.id} data-testid={`row-line-${l.id}`}>
                              <TableCell className="text-sm font-medium">
                                {l.desc}
                              </TableCell>
                              <TableCell className="text-sm text-right tabular-nums text-muted-foreground">
                                {money(l.size)}
                              </TableCell>
                              <TableCell className="text-sm text-right tabular-nums text-muted-foreground">
                                {money(l.rate)}
                              </TableCell>
                              <TableCell className="text-sm text-right tabular-nums font-semibold">
                                R {money(l.size * l.rate)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label={`Remove ${l.desc}`}
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

                  <Separator className="my-4" />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium" htmlFor="input-other-monthly">
                        Other Monthly Income (R)
                        <span className="text-muted-foreground font-normal ml-1">optional</span>
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
                      <Label className="text-xs font-medium" htmlFor="input-actual-rev">
                        Actual Revenue (12 mo)
                        <span className="text-muted-foreground font-normal ml-1">optional</span>
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
                </Card>

                <div className="grid grid-cols-2 gap-3">
                  <KpiCard
                    label="Gross Monthly (100%)"
                    value={`R ${money(calc.pgiMonthly)}`}
                    testId="text-pgi-monthly"
                    accent
                  />
                  <KpiCard
                    label="Gross Annual (PGI)"
                    value={`R ${money(calc.pgiAnnual)}`}
                    testId="text-pgi-annual"
                    accent
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <KpiCard
                    label="Derived Occupancy"
                    value={calc.derivedOcc !== null ? pct(calc.derivedOcc) : "\u2014"}
                    testId="text-current-occ"
                  />
                  <KpiCard
                    label="Derived Vacancy"
                    value={calc.derivedVac !== null ? pct(calc.derivedVac) : "\u2014"}
                    testId="text-current-vac"
                  />
                </div>

                <div className="flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed px-1">
                  <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <p>
                    <strong>Occupancy derivation:</strong> Current Occupancy = Actual
                    Annual Revenue / PGI. Without actual revenue, stabilised assumptions are used.
                  </p>
                </div>

                {calc.showDoubleVacWarning && (
                  <div
                    className="flex items-start gap-2.5 text-xs p-3.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
                    data-testid="warning-double-vacancy"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <p>
                      Actual annual revenue is below PGI, implying existing vacancy.
                      No additional vacancy is applied in the Actual scenario.
                    </p>
                  </div>
                )}
              </div>

              {/* RIGHT: ASSUMPTIONS + OUTPUT */}
              <div className="space-y-5">
                <Card className="p-5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <StepBadge step={2} />
                    <div>
                      <h2 className="text-sm font-semibold" data-testid="text-section-assumptions">
                        Assumptions + Value
                      </h2>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Set property type, scenario, and cap rates
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-medium" htmlFor="select-property-type">
                      Property Type
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
                        {(Object.keys(PROPERTY_LABELS) as PropertyType[]).map(
                          (key) => (
                            <SelectItem key={key} value={key}>
                              {PROPERTY_LABELS[key]}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <div>
                      <Label className="text-xs font-medium" htmlFor="input-stab-occ">
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
                      <Label className="text-xs font-medium" htmlFor="select-scenario">
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
                            Stabilised (PGI x occ.)
                          </SelectItem>
                          <SelectItem value="actual">
                            Actual (annual revenue)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium" htmlFor="input-opex">
                        Operating Expenses (Annual)
                      </Label>
                      <Input
                        id="input-opex"
                        data-testid="input-opex"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="R 0"
                        value={opexAnnual}
                        onChange={(e) => setOpexAnnual(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium" htmlFor="input-utility">
                        Utility Recovery (Annual)
                        <span className="text-muted-foreground font-normal ml-1">optional</span>
                      </Label>
                      <Input
                        id="input-utility"
                        data-testid="input-utility"
                        type="number"
                        step="0.01"
                        placeholder="R 0"
                        value={utilityAdj}
                        onChange={(e) => setUtilityAdj(e.target.value)}
                      />
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium" htmlFor="input-cap-low">
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
                      <Label className="text-xs font-medium" htmlFor="input-cap-high">
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
                      <Label className="text-xs font-medium" htmlFor="input-excess">
                        + Excess Land (R)
                        <span className="text-muted-foreground font-normal ml-1">optional</span>
                      </Label>
                      <Input
                        id="input-excess"
                        data-testid="input-excess"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="R 0"
                        value={excessLand}
                        onChange={(e) => setExcessLand(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium" htmlFor="input-refurb">
                        - Refurb / Installs (R)
                        <span className="text-muted-foreground font-normal ml-1">optional</span>
                      </Label>
                      <Input
                        id="input-refurb"
                        data-testid="input-refurb"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="R 0"
                        value={refurb}
                        onChange={(e) => setRefurb(e.target.value)}
                      />
                    </div>
                  </div>
                </Card>

                {calc.showActualWarning && (
                  <div
                    className="flex items-start gap-2.5 text-xs p-3.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
                    data-testid="warning-no-actual-rev"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <p>Enter actual annual revenue to use the Actual scenario.</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <KpiCard
                    label="EGI Used (Annual)"
                    value={`R ${money(calc.egiUsed)}`}
                    testId="text-egi"
                  />
                  <KpiCard
                    label="NOI (Annual)"
                    value={`R ${money(calc.noi)}`}
                    testId="text-noi"
                  />
                </div>

                <div className="relative rounded-md bg-primary p-5 text-primary-foreground">
                  <div className="absolute inset-0 rounded-md bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                  <p className="text-[11px] font-medium uppercase tracking-wider opacity-80">
                    Indicated Value Range
                  </p>
                  <p
                    className="text-xl sm:text-2xl font-bold mt-2 tabular-nums"
                    data-testid="text-value-range"
                  >
                    R {money(calc.lo)} – R {money(calc.hi)}
                  </p>
                  <p
                    className="text-xs mt-2 opacity-75"
                    data-testid="text-value-note"
                  >
                    {calc.valueNote}
                  </p>
                </div>

                {calc.showActualNote && !calc.showActualWarning && (
                  <div
                    className="flex items-start gap-2.5 text-xs p-3.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                    data-testid="note-actual-scenario"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <p>
                      <strong>Actual scenario:</strong> Value is based on actual annual
                      revenue (no additional vacancy applied).
                    </p>
                  </div>
                )}

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
                        <li>
                          <strong>PGI</strong> = Potential Monthly x 12
                        </li>
                        <li>
                          <strong>Current Occupancy</strong> = Actual Annual Revenue / PGI
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
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
