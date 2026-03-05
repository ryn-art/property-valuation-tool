import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Trash2,
  Building2,
  ArrowRight,
  Save,
  FilePlus2,
  FileText,
  Pencil,
  Check,
  X,
  Loader2,
  ArrowLeft,
  Hotel,
  FolderOpen,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-provider";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/components/calculator-shared";
import CalculatorRental from "@/components/calculator-rental";
import type { RentalCalcState, RentalCalcSetters } from "@/components/calculator-rental";
import CalculatorHospitality from "@/components/calculator-hospitality";
import type { HospitalityCalcState, HospitalityCalcSetters } from "@/components/calculator-hospitality";
import type { Valuation, IncomeLine, RoomType, Season, RateMatrix } from "@shared/schema";

type PropertyType = "office" | "retail" | "industrial" | "storage" | "other";
type Scenario = "stabilised" | "actual";
type IncomeModel = "rental" | "hospitality";

const PROPERTY_LABELS: Record<PropertyType, string> = {
  office: "Office",
  retail: "Retail",
  industrial: "Industrial",
  storage: "Self-storage",
  other: "Other",
};

export default function CalculatorPage() {
  const { toast } = useToast();

  const [incomeModel, setIncomeModel] = useState<IncomeModel | null>(null);
  const [activeValuationId, setActiveValuationId] = useState<number | null>(null);
  const [valuationName, setValuationName] = useState("Untitled Valuation");
  const [savedPopoverOpen, setSavedPopoverOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  const [nextId, setNextId] = useState(1);

  const [lines, setLines] = useState<IncomeLine[]>([]);
  const [otherMonthly, setOtherMonthly] = useState("");
  const [rentalActualAnnualRev, setRentalActualAnnualRev] = useState("");
  const [propertyType, setPropertyType] = useState<PropertyType>("office");
  const [stabilisedOccPct, setStabilisedOccPct] = useState("88");
  const [scenario, setScenario] = useState<Scenario>("stabilised");

  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [rateMatrix, setRateMatrix] = useState<RateMatrix>({});
  const [otherAnnualIncome, setOtherAnnualIncome] = useState("");
  const [hospActualAnnualRev, setHospActualAnnualRev] = useState("");

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

    const model = (val.incomeModel === "hospitality" ? "hospitality" : "rental") as IncomeModel;
    setIncomeModel(model);

    if (model === "rental") {
      const savedLines = (val.lines as IncomeLine[]) || [];
      setLines(savedLines);
      setOtherMonthly(val.otherMonthly ? String(val.otherMonthly) : "");
      setRentalActualAnnualRev(val.actualAnnualRev ? String(val.actualAnnualRev) : "");
      setPropertyType(val.propertyType as PropertyType);
      setStabilisedOccPct(String(val.stabilisedOccPct));
      setScenario(val.scenario as Scenario);
      const allIds = savedLines.map((l) => l.id);
      setNextId(allIds.length > 0 ? Math.max(...allIds) + 1 : 1);
    } else {
      const savedRoomTypes = (val.roomTypes as RoomType[]) || [];
      const savedSeasons = (val.seasons as Season[]) || [];
      setRoomTypes(savedRoomTypes);
      setSeasons(savedSeasons);
      setRateMatrix((val.rateMatrix as RateMatrix) || {});
      setOtherAnnualIncome(val.otherAnnualIncome ? String(val.otherAnnualIncome) : "");
      setHospActualAnnualRev(val.actualAnnualRev ? String(val.actualAnnualRev) : "");
      const allIds = [...savedRoomTypes.map((r) => r.id), ...savedSeasons.map((s) => s.id)];
      setNextId(allIds.length > 0 ? Math.max(...allIds) + 1 : 1);
    }

    setOpexAnnual(val.opexAnnual ? String(val.opexAnnual) : "");
    setUtilityAdj(val.utilityAdj ? String(val.utilityAdj) : "");
    setCapLowPct(String(val.capLowPct));
    setCapHighPct(String(val.capHighPct));
    setExcessLand(val.excessLand ? String(val.excessLand) : "");
    setRefurb(val.refurb ? String(val.refurb) : "");
  }, []);

  const getCurrentData = useCallback(() => {
    const base = {
      name: valuationName,
      incomeModel: incomeModel || "rental",
      opexAnnual: Number(opexAnnual || 0),
      utilityAdj: Number(utilityAdj || 0),
      capLowPct: Number(capLowPct || 0),
      capHighPct: Number(capHighPct || 0),
      excessLand: Number(excessLand || 0),
      refurb: Number(refurb || 0),
    };

    if (incomeModel === "hospitality") {
      return {
        ...base,
        propertyType: "other" as const,
        lines: [],
        otherMonthly: 0,
        stabilisedOccPct: 0,
        scenario: "stabilised" as const,
        roomTypes,
        seasons,
        rateMatrix,
        otherAnnualIncome: Number(otherAnnualIncome || 0),
        actualAnnualRev: Number(hospActualAnnualRev || 0),
      };
    }

    return {
      ...base,
      propertyType,
      lines,
      otherMonthly: Number(otherMonthly || 0),
      actualAnnualRev: Number(rentalActualAnnualRev || 0),
      stabilisedOccPct: Number(stabilisedOccPct || 0),
      scenario,
      roomTypes: [],
      seasons: [],
      rateMatrix: {},
      otherAnnualIncome: 0,
    };
  }, [
    valuationName, incomeModel, propertyType, lines, otherMonthly, rentalActualAnnualRev,
    stabilisedOccPct, scenario, opexAnnual, utilityAdj, capLowPct, capHighPct, excessLand, refurb,
    roomTypes, seasons, rateMatrix, otherAnnualIncome, hospActualAnnualRev,
  ]);

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
    setIncomeModel(null);
    setLines([]);
    setNextId(1);
    setOtherMonthly("");
    setRentalActualAnnualRev("");
    setPropertyType("office");
    setStabilisedOccPct("88");
    setScenario("stabilised");
    setRoomTypes([]);
    setSeasons([]);
    setRateMatrix({});
    setOtherAnnualIncome("");
    setHospActualAnnualRev("");
    setOpexAnnual("");
    setUtilityAdj("");
    setCapLowPct("12.0");
    setCapHighPct("13.5");
    setExcessLand("");
    setRefurb("");
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

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const rentalState: RentalCalcState = useMemo(() => ({
    lines, otherMonthly, actualAnnualRev: rentalActualAnnualRev, propertyType,
    stabilisedOccPct, scenario, opexAnnual, utilityAdj, capLowPct, capHighPct, excessLand, refurb,
  }), [lines, otherMonthly, rentalActualAnnualRev, propertyType, stabilisedOccPct, scenario, opexAnnual, utilityAdj, capLowPct, capHighPct, excessLand, refurb]);

  const rentalSetters: RentalCalcSetters = useMemo(() => ({
    setLines, setOtherMonthly, setActualAnnualRev: setRentalActualAnnualRev,
    setPropertyType, setStabilisedOccPct, setScenario,
    setOpexAnnual, setUtilityAdj, setCapLowPct, setCapHighPct, setExcessLand, setRefurb,
  }), []);

  const hospState: HospitalityCalcState = useMemo(() => ({
    roomTypes, seasons, rateMatrix, otherAnnualIncome, actualAnnualRev: hospActualAnnualRev,
    opexAnnual, utilityAdj, capLowPct, capHighPct, excessLand, refurb,
  }), [roomTypes, seasons, rateMatrix, otherAnnualIncome, hospActualAnnualRev, opexAnnual, utilityAdj, capLowPct, capHighPct, excessLand, refurb]);

  const hospSetters: HospitalityCalcSetters = useMemo(() => ({
    setRoomTypes, setSeasons, setRateMatrix, setOtherAnnualIncome,
    setActualAnnualRev: setHospActualAnnualRev,
    setOpexAnnual, setUtilityAdj, setCapLowPct, setCapHighPct, setExcessLand, setRefurb,
  }), []);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/50 dark:bg-card/30 backdrop-blur-sm sticky top-0 z-50 print:hidden">
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
            {incomeModel && (
              <Badge variant="secondary" className="text-[10px] no-default-active-elevate hidden sm:inline-flex">
                {incomeModel === "rental" ? (
                  <>PGI <ArrowRight className="w-2.5 h-2.5 mx-0.5" /> EGI <ArrowRight className="w-2.5 h-2.5 mx-0.5" /> NOI <ArrowRight className="w-2.5 h-2.5 mx-0.5" /> Value</>
                ) : (
                  <>Room Rev <ArrowRight className="w-2.5 h-2.5 mx-0.5" /> EGI <ArrowRight className="w-2.5 h-2.5 mx-0.5" /> NOI <ArrowRight className="w-2.5 h-2.5 mx-0.5" /> Value</>
                )}
              </Badge>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="space-y-5">
            {!incomeModel ? (
              <div className="flex flex-col items-center justify-center py-12 sm:py-20">
                <h2 className="text-xl sm:text-2xl font-bold text-center mb-2" data-testid="text-select-type">
                  What type of property are you valuing?
                </h2>
                <p className="text-sm text-muted-foreground text-center mb-8 max-w-md">
                  Select the income model that matches your property. This determines how revenue is calculated.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
                  <Card
                    className="p-6 cursor-pointer transition-all hover:border-primary/40 hover:shadow-md group"
                    role="button"
                    tabIndex={0}
                    onClick={() => setIncomeModel("rental")}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setIncomeModel("rental"); } }}
                    data-testid="card-select-rental"
                  >
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-base font-semibold mb-1">Rental / Lease Property</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Commercial or residential. Income based on rentable areas (m²), monthly rates, and occupancy.
                    </p>
                  </Card>

                  <Card
                    className="p-6 cursor-pointer transition-all hover:border-primary/40 hover:shadow-md group"
                    role="button"
                    tabIndex={0}
                    onClick={() => setIncomeModel("hospitality")}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setIncomeModel("hospitality"); } }}
                    data-testid="card-select-hospitality"
                  >
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <Hotel className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-base font-semibold mb-1">Hospitality Property</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Lodge, guesthouse, or hotel. Income based on room types, seasonal rates, and occupancy by season.
                    </p>
                  </Card>
                </div>

                {isListLoading ? (
                  <div className="w-full max-w-2xl mt-10 space-y-2">
                    <h3 className="text-sm font-semibold mb-3">Saved Valuations</h3>
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : valuationsList && valuationsList.length > 0 && (
                  <div className="w-full max-w-2xl mt-10">
                    <h3 className="text-sm font-semibold mb-3" data-testid="text-saved-heading">Saved Valuations</h3>
                    <Card className="divide-y">
                      {valuationsList.map((v) => (
                        <div
                          key={v.id}
                          role="button"
                          tabIndex={0}
                          data-testid={`card-home-valuation-${v.id}`}
                          className="group flex items-center justify-between gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50"
                          onClick={() => loadValuation(v)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); loadValuation(v); } }}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" data-testid={`text-home-valuation-name-${v.id}`}>
                              {v.name}
                            </p>
                            <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center flex-wrap gap-x-1">
                              <Badge variant="outline" className="text-[9px] px-1 py-0 no-default-active-elevate">
                                {v.incomeModel === "hospitality" ? "Hospitality" : "Rental"}
                              </Badge>
                              <span>
                                {v.incomeModel !== "hospitality" && (PROPERTY_LABELS[v.propertyType as PropertyType] || v.propertyType)}
                                {" · "}
                                {formatDate(v.updatedAt)}
                              </span>
                            </div>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="opacity-0 group-hover:opacity-100 flex-shrink-0 h-8 w-8"
                                aria-label={`Delete ${v.name}`}
                                data-testid={`button-home-delete-${v.id}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
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
                                <AlertDialogAction onClick={() => deleteMutation.mutate(v.id)} data-testid={`button-home-confirm-delete-${v.id}`}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ))}
                    </Card>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="ghost" size="sm" onClick={() => setIncomeModel(null)} data-testid="button-back-to-select" className="print:hidden">
                    <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                    Back
                  </Button>

                  <Badge variant="outline" className="text-[10px] no-default-active-elevate print:hidden">
                    {incomeModel === "rental" ? "Rental / Lease" : "Hospitality"}
                  </Badge>

                  <div className="flex-1" />

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
                      <Button size="icon" variant="ghost" onClick={confirmEditName} aria-label="Confirm name" data-testid="button-confirm-name">
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setIsEditingName(false)} aria-label="Cancel editing name" data-testid="button-cancel-name">
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 cursor-pointer group" onClick={startEditName} data-testid="button-edit-name">
                      <h2 className="text-lg font-semibold">{valuationName}</h2>
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {activeValuationId && (
                      <Badge variant="secondary" className="text-[10px] no-default-active-elevate">Saved</Badge>
                    )}
                    <Popover open={savedPopoverOpen} onOpenChange={setSavedPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="outline" data-testid="button-open-saved">
                          <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                          Saved
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-80 p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <h3 className="text-sm font-semibold">Saved Valuations</h3>
                          <Button size="sm" variant="secondary" onClick={() => { startNew(); setSavedPopoverOpen(false); }} data-testid="button-new-valuation">
                            <FilePlus2 className="w-3.5 h-3.5 mr-1.5" />
                            New
                          </Button>
                        </div>
                        {isListLoading ? (
                          <div className="space-y-2">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                          </div>
                        ) : isListError ? (
                          <p className="text-xs text-destructive py-2">Failed to load. Refresh the page.</p>
                        ) : !valuationsList || valuationsList.length === 0 ? (
                          <div className="rounded-md border border-dashed p-4 text-center">
                            <FileText className="w-5 h-5 text-muted-foreground/40 mx-auto mb-1" />
                            <p className="text-xs text-muted-foreground">No saved valuations yet.</p>
                          </div>
                        ) : (
                          <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                            {valuationsList.map((v) => (
                              <div
                                key={v.id}
                                role="button"
                                tabIndex={0}
                                data-testid={`card-valuation-${v.id}`}
                                className={`group rounded-md p-2 cursor-pointer transition-colors border ${
                                  activeValuationId === v.id
                                    ? "bg-primary/5 dark:bg-primary/10 border-primary/20"
                                    : "border-transparent hover:bg-muted/50"
                                }`}
                                onClick={() => { loadValuation(v); setSavedPopoverOpen(false); }}
                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); loadValuation(v); setSavedPopoverOpen(false); } }}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate" data-testid={`text-valuation-name-${v.id}`}>
                                      {v.name}
                                    </p>
                                    <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center flex-wrap gap-x-1">
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 no-default-active-elevate">
                                        {v.incomeModel === "hospitality" ? "Hospitality" : "Rental"}
                                      </Badge>
                                      <span>
                                        {v.incomeModel !== "hospitality" && (PROPERTY_LABELS[v.propertyType as PropertyType] || v.propertyType)}
                                        {" · "}
                                        {formatDate(v.updatedAt)}
                                      </span>
                                    </div>
                                  </div>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 h-7 w-7"
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
                                        <AlertDialogAction onClick={() => deleteMutation.mutate(v.id)} data-testid={`button-confirm-delete-${v.id}`}>
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
                      </PopoverContent>
                    </Popover>
                    <Button size="sm" onClick={handleSave} disabled={isSaving} data-testid="button-save">
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                      {activeValuationId ? "Save" : "Save New"}
                    </Button>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground max-w-2xl -mt-3 print:hidden" data-testid="text-subtitle">
                  Indicative only. Use evidence (rent comparables + sales/cap evidence) to support assumptions.
                </p>

                {incomeModel === "rental" ? (
                  <CalculatorRental state={rentalState} setters={rentalSetters} nextId={nextId} setNextId={setNextId} valuationName={valuationName} />
                ) : (
                  <CalculatorHospitality state={hospState} setters={hospSetters} nextId={nextId} setNextId={setNextId} valuationName={valuationName} />
                )}
              </>
            )}
          </div>
      </div>
    </div>
  );
}
