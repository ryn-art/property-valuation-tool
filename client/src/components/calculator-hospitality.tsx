import { useState, useCallback, useMemo } from "react";
import { format, parse } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Calculator,
  BedDouble,
  CalendarDays,
  FileDown,
  CalendarIcon,
} from "lucide-react";
import { StepBadge, KpiCard, money, pct } from "./calculator-shared";
import { exportHospitalityPDF } from "@/lib/pdf-export";
import { cn } from "@/lib/utils";
import type { RoomType, Season, RateMatrix } from "@shared/schema";

function isoToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const d = parse(iso, "yyyy-MM-dd", new Date());
  return isNaN(d.getTime()) ? undefined : d;
}

function dateToIso(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function formatDisplay(iso: string): string {
  const d = isoToDate(iso);
  return d ? format(d, "d MMM yyyy") : "Pick date";
}

function DatePickerButton({
  value,
  onChange,
  testId,
  compact,
}: {
  value: string;
  onChange: (iso: string) => void;
  testId: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = isoToDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal",
            compact ? "h-7 text-xs px-2 w-[120px]" : "h-9 text-sm w-full",
            !value && "text-muted-foreground"
          )}
          data-testid={testId}
        >
          <CalendarIcon className={cn("mr-1.5 flex-shrink-0", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
          <span className="truncate">{value ? formatDisplay(value) : "Pick date"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(day) => {
            if (day) {
              onChange(dateToIso(day));
              setOpen(false);
            }
          }}
          defaultMonth={selected}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export interface HospitalityCalcState {
  roomTypes: RoomType[];
  seasons: Season[];
  rateMatrix: RateMatrix;
  otherAnnualIncome: string;
  actualAnnualRev: string;
  opexAnnual: string;
  utilityAdj: string;
  capLowPct: string;
  capHighPct: string;
  unusedLandSize: string;
  landValuePerM2: string;
  refurb: string;
}

export interface HospitalityCalcSetters {
  setRoomTypes: (fn: RoomType[] | ((prev: RoomType[]) => RoomType[])) => void;
  setSeasons: (fn: Season[] | ((prev: Season[]) => Season[])) => void;
  setRateMatrix: (fn: RateMatrix | ((prev: RateMatrix) => RateMatrix)) => void;
  setOtherAnnualIncome: (v: string) => void;
  setActualAnnualRev: (v: string) => void;
  setOpexAnnual: (v: string) => void;
  setUtilityAdj: (v: string) => void;
  setCapLowPct: (v: string) => void;
  setCapHighPct: (v: string) => void;
  setUnusedLandSize: (v: string) => void;
  setLandValuePerM2: (v: string) => void;
  setRefurb: (v: string) => void;
}

interface Props {
  state: HospitalityCalcState;
  setters: HospitalityCalcSetters;
  nextId: number;
  setNextId: (fn: number | ((n: number) => number)) => void;
  valuationName: string;
}

function getNights(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(0, diff);
}

function rateKey(roomTypeId: number, seasonId: number): string {
  return `${roomTypeId}-${seasonId}`;
}

export default function CalculatorHospitality({ state, setters, nextId, setNextId, valuationName }: Props) {
  const {
    roomTypes, seasons, rateMatrix, otherAnnualIncome, actualAnnualRev,
    opexAnnual, utilityAdj, capLowPct, capHighPct, unusedLandSize, landValuePerM2, refurb,
  } = state;

  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomCount, setNewRoomCount] = useState("");
  const [newRoomSize, setNewRoomSize] = useState("");

  const [newSeasonName, setNewSeasonName] = useState("");
  const [newSeasonStart, setNewSeasonStart] = useState("");
  const [newSeasonEnd, setNewSeasonEnd] = useState("");
  const [newSeasonOcc, setNewSeasonOcc] = useState("");

  const addRoomType = useCallback(() => {
    const rooms = parseInt(newRoomCount || "0");
    const sizeSqm = Number(newRoomSize || "0");
    if (rooms <= 0) return;
    setters.setRoomTypes((prev) => [
      ...prev,
      { id: nextId, name: newRoomName.trim() || "Room Type", rooms, sizeSqm },
    ]);
    setNextId((n) => n + 1);
    setNewRoomName("");
    setNewRoomCount("");
    setNewRoomSize("");
  }, [newRoomName, newRoomCount, newRoomSize, nextId, setters, setNextId]);

  const removeRoomType = useCallback((id: number) => {
    setters.setRoomTypes((prev) => prev.filter((r) => r.id !== id));
    setters.setRateMatrix((prev) => {
      const next: RateMatrix = {};
      for (const [k, v] of Object.entries(prev)) {
        if (!k.startsWith(`${id}-`)) next[k] = v;
      }
      return next;
    });
  }, [setters]);

  const addSeason = useCallback(() => {
    if (!newSeasonStart || !newSeasonEnd) return;
    const nights = getNights(newSeasonStart, newSeasonEnd);
    if (nights <= 0) return;
    setters.setSeasons((prev) => [
      ...prev,
      {
        id: nextId,
        name: newSeasonName.trim() || "Season",
        startDate: newSeasonStart,
        endDate: newSeasonEnd,
        occupancyPct: Number(newSeasonOcc || "0"),
      },
    ]);
    setNextId((n) => n + 1);
    setNewSeasonName("");
    setNewSeasonStart("");
    setNewSeasonEnd("");
    setNewSeasonOcc("");
  }, [newSeasonName, newSeasonStart, newSeasonEnd, newSeasonOcc, nextId, setters, setNextId]);

  const removeSeason = useCallback((id: number) => {
    setters.setSeasons((prev) => prev.filter((s) => s.id !== id));
    setters.setRateMatrix((prev) => {
      const next: RateMatrix = {};
      for (const [k, v] of Object.entries(prev)) {
        if (!k.endsWith(`-${id}`)) next[k] = v;
      }
      return next;
    });
  }, [setters]);

  const updateRate = useCallback((roomId: number, seasonId: number, val: string) => {
    setters.setRateMatrix((prev) => ({
      ...prev,
      [rateKey(roomId, seasonId)]: Number(val || 0),
    }));
  }, [setters]);

  const updateSeasonField = useCallback((id: number, field: keyof Season, value: string) => {
    setters.setSeasons((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              [field]: field === "occupancyPct" ? Number(value || 0) : value,
            }
          : s
      )
    );
  }, [setters]);

  const updateRoomField = useCallback((id: number, field: keyof RoomType, value: string) => {
    setters.setRoomTypes((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              [field]: field === "name" ? value : Number(value || 0),
            }
          : r
      )
    );
  }, [setters]);

  const calc = useMemo(() => {
    const totalRooms = roomTypes.reduce((sum, r) => sum + r.rooms, 0);
    const totalGLA = roomTypes.reduce((sum, r) => sum + r.rooms * r.sizeSqm, 0);

    let totalAvailableRoomNights = 0;
    let totalOccupiedRoomNights = 0;
    let annualRoomRevenue = 0;

    const seasonBreakdown = seasons.map((s) => {
      const nights = getNights(s.startDate, s.endDate);
      let seasonAvailable = 0;
      let seasonOccupied = 0;
      let seasonRevenue = 0;

      roomTypes.forEach((r) => {
        const available = r.rooms * nights;
        const occupied = available * (s.occupancyPct / 100);
        const rate = rateMatrix[rateKey(r.id, s.id)] || 0;
        const rev = occupied * rate;

        seasonAvailable += available;
        seasonOccupied += occupied;
        seasonRevenue += rev;
      });

      totalAvailableRoomNights += seasonAvailable;
      totalOccupiedRoomNights += seasonOccupied;
      annualRoomRevenue += seasonRevenue;

      return {
        seasonId: s.id,
        name: s.name,
        nights,
        availableRoomNights: seasonAvailable,
        occupiedRoomNights: seasonOccupied,
        revenue: seasonRevenue,
      };
    });

    const otherIncome = Number(otherAnnualIncome || 0);
    const egiUsed = annualRoomRevenue + otherIncome;

    const opex = Number(opexAnnual || 0);
    const util = Number(utilityAdj || 0);
    const noi = egiUsed - opex + util;

    const capLow = Number(capLowPct || 0) / 100;
    const capHigh = Number(capHighPct || 0) / 100;
    const capMin = Math.min(capLow, capHigh);
    const capMax = Math.max(capLow, capHigh);

    const excess = Number(unusedLandSize || 0) * Number(landValuePerM2 || 0);
    const ref = Number(refurb || 0);

    let vLow = 0;
    let vHigh = 0;
    if (capMin > 0 && capMax > 0) {
      vHigh = noi / capMin + excess - ref;
      vLow = noi / capMax + excess - ref;
    }
    const lo = Math.min(vLow, vHigh);
    const hi = Math.max(vLow, vHigh);

    const weightedADR = totalOccupiedRoomNights > 0 ? annualRoomRevenue / totalOccupiedRoomNights : 0;
    const weightedOcc = totalAvailableRoomNights > 0 ? (totalOccupiedRoomNights / totalAvailableRoomNights) * 100 : 0;

    const actualRev = Number(actualAnnualRev || 0);
    const performancePct = egiUsed > 0 && actualRev > 0 ? (actualRev / egiUsed) * 100 : null;

    return {
      totalRooms, totalGLA, totalAvailableRoomNights, totalOccupiedRoomNights,
      annualRoomRevenue, egiUsed, noi, lo, hi,
      weightedADR, weightedOcc, actualRev, performancePct, seasonBreakdown,
    };
  }, [roomTypes, seasons, rateMatrix, otherAnnualIncome, actualAnnualRev, opexAnnual, utilityAdj, capLowPct, capHighPct, unusedLandSize, landValuePerM2, refurb]);

  const hasNoSeasons = seasons.length === 0;
  const hasInvalidDates = seasons.some((s) => getNights(s.startDate, s.endDate) <= 0);
  const capLow = Number(capLowPct || 0);
  const capHigh = Number(capHighPct || 0);
  const hasInvalidCaps = capLow <= 0 || capHigh <= 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" id="print-area">
      <div className="space-y-5">
        <Card className="p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <StepBadge step={1} />
            <div>
              <h2 className="text-sm font-semibold" data-testid="text-section-rooms">Room Types</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Define room inventory and sizes</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_0.5fr_0.5fr] gap-3 items-end">
            <div>
              <Label className="text-xs font-medium" htmlFor="input-room-name">Room Type Name</Label>
              <Input id="input-room-name" data-testid="input-room-name" placeholder="e.g., Standard" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRoomType()} />
            </div>
            <div>
              <Label className="text-xs font-medium" htmlFor="input-room-count">Rooms</Label>
              <Input id="input-room-count" data-testid="input-room-count" type="number" min="1" step="1" placeholder="0" value={newRoomCount} onChange={(e) => setNewRoomCount(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRoomType()} />
            </div>
            <div>
              <Label className="text-xs font-medium" htmlFor="input-room-size">Size (m²)</Label>
              <Input id="input-room-size" data-testid="input-room-size" type="number" min="0" step="0.01" placeholder="0" value={newRoomSize} onChange={(e) => setNewRoomSize(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRoomType()} />
            </div>
          </div>

          <Button size="sm" className="mt-3" onClick={addRoomType} data-testid="button-add-room">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Room Type
          </Button>

          {roomTypes.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed p-6 flex flex-col items-center justify-center text-center">
              <BedDouble className="w-8 h-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">No room types yet. Add your first room type above.</p>
            </div>
          ) : (
            <div className="mt-4 rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider">Type</TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider text-right">Rooms</TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider text-right">m²/room</TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider text-right">Total m²</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roomTypes.map((r) => (
                    <TableRow key={r.id} data-testid={`row-room-${r.id}`}>
                      <TableCell className="text-sm font-medium">{r.name}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums">{r.rooms}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums text-muted-foreground">{money(r.sizeSqm)}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums font-semibold">{money(r.rooms * r.sizeSqm)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" aria-label={`Remove ${r.name}`} onClick={() => removeRoomType(r.id)} data-testid={`button-remove-room-${r.id}`}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {roomTypes.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mt-4">
              <KpiCard label="Total Rooms" value={String(calc.totalRooms)} testId="text-total-rooms" accent />
              <KpiCard label="Total GLA (m²)" value={money(calc.totalGLA)} testId="text-total-gla" accent />
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <StepBadge step={2} />
            <div>
              <h2 className="text-sm font-semibold" data-testid="text-section-seasons">Seasons</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Define seasonal periods and occupancy. End date is included as the last night.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div>
              <Label className="text-xs font-medium" htmlFor="input-season-name">Season Name</Label>
              <Input id="input-season-name" data-testid="input-season-name" placeholder="e.g., Peak" value={newSeasonName} onChange={(e) => setNewSeasonName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-medium">Start Date</Label>
              <DatePickerButton value={newSeasonStart} onChange={setNewSeasonStart} testId="input-season-start" />
            </div>
            <div>
              <Label className="text-xs font-medium">End Date</Label>
              <DatePickerButton value={newSeasonEnd} onChange={setNewSeasonEnd} testId="input-season-end" />
            </div>
            <div>
              <Label className="text-xs font-medium" htmlFor="input-season-occ">Occupancy %</Label>
              <Input id="input-season-occ" data-testid="input-season-occ" type="number" min="0" max="100" step="1" placeholder="0" value={newSeasonOcc} onChange={(e) => setNewSeasonOcc(e.target.value)} />
            </div>
          </div>

          <Button size="sm" className="mt-3" onClick={addSeason} data-testid="button-add-season">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Season
          </Button>

          {seasons.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed p-6 flex flex-col items-center justify-center text-center">
              <CalendarDays className="w-8 h-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">No seasons yet. Add your first season above (e.g., Off-Peak, Peak, Holiday).</p>
            </div>
          ) : (
            <div className="mt-4 rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider">Season</TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider">Start</TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider">End</TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider text-right">Nights</TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider text-right">Occ %</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {seasons.map((s) => {
                    const nights = getNights(s.startDate, s.endDate);
                    const bothFilled = !!s.startDate && !!s.endDate;
                    const invalid = bothFilled && nights === 0;
                    return (
                      <TableRow key={s.id} data-testid={`row-season-${s.id}`}>
                        <TableCell className="text-sm font-medium">
                          <Input className="h-7 text-sm w-24" value={s.name} onChange={(e) => updateSeasonField(s.id, "name", e.target.value)} data-testid={`input-season-name-${s.id}`} />
                        </TableCell>
                        <TableCell>
                          <DatePickerButton compact value={s.startDate} onChange={(v) => updateSeasonField(s.id, "startDate", v)} testId={`input-season-start-${s.id}`} />
                        </TableCell>
                        <TableCell>
                          <DatePickerButton compact value={s.endDate} onChange={(v) => updateSeasonField(s.id, "endDate", v)} testId={`input-season-end-${s.id}`} />
                        </TableCell>
                        <TableCell className="text-sm text-right tabular-nums font-semibold">
                          {nights > 0 ? (
                            nights
                          ) : (
                            <span className="inline-flex items-center justify-end gap-1 text-destructive">
                              {invalid && (
                                <AlertTriangle className="w-3 h-3 flex-shrink-0" title="End date must be after start date" />
                              )}
                              0
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input className="h-7 text-sm w-16 text-right" type="number" min="0" max="100" value={s.occupancyPct || ""} onChange={(e) => updateSeasonField(s.id, "occupancyPct", e.target.value)} data-testid={`input-season-occ-${s.id}`} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" aria-label={`Remove ${s.name}`} onClick={() => removeSeason(s.id)} data-testid={`button-remove-season-${s.id}`}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="text-xs font-medium text-muted-foreground">Total Nights</TableCell>
                    <TableCell className="text-sm text-right tabular-nums font-semibold" data-testid="text-total-nights">
                      {(() => {
                        const total = seasons.reduce((sum, s) => sum + getNights(s.startDate, s.endDate), 0);
                        return (
                          <span className={total > 0 && total !== 365 ? "text-amber-600 dark:text-amber-400" : ""}>
                            {total}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}

          {hasNoSeasons && (
            <div className="mt-3 flex items-start gap-2.5 text-xs p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <p>Add at least one season to calculate revenue.</p>
            </div>
          )}
        </Card>

        {roomTypes.length > 0 && seasons.length > 0 && (
          <Card className="p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <StepBadge step={3} />
              <div>
                <h2 className="text-sm font-semibold" data-testid="text-section-rates">Rate Matrix (R per night)</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">Set the nightly rate for each room type in each season</p>
              </div>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider">Room Type</TableHead>
                    {seasons.map((s) => (
                      <TableHead key={s.id} className="text-[11px] font-medium uppercase tracking-wider text-center min-w-[100px]">
                        {s.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roomTypes.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm font-medium whitespace-nowrap">{r.name}</TableCell>
                      {seasons.map((s) => (
                        <TableCell key={s.id} className="p-1">
                          <Input
                            className="h-7 text-sm text-right w-full min-w-[80px]"
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            value={rateMatrix[rateKey(r.id, s.id)] || ""}
                            onChange={(e) => updateRate(r.id, s.id, e.target.value)}
                            data-testid={`input-rate-${r.id}-${s.id}`}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        <Card className="p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <StepBadge step={4} />
            <div>
              <h2 className="text-sm font-semibold" data-testid="text-section-other-income">Other Income & Actual Revenue</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Additional revenue sources and performance check</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium" htmlFor="input-hosp-other-income">
                Other Annual Income (R)<span className="text-muted-foreground font-normal ml-1">optional</span>
              </Label>
              <Input id="input-hosp-other-income" data-testid="input-hosp-other-income" type="number" min="0" step="0.01" placeholder="0" value={otherAnnualIncome} onChange={(e) => setters.setOtherAnnualIncome(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-medium" htmlFor="input-hosp-actual-rev">
                Actual Revenue (12 mo)<span className="text-muted-foreground font-normal ml-1">optional</span>
              </Label>
              <Input id="input-hosp-actual-rev" data-testid="input-hosp-actual-rev" type="number" min="0" step="0.01" placeholder="0" value={actualAnnualRev} onChange={(e) => setters.setActualAnnualRev(e.target.value)} />
            </div>
          </div>

        </Card>
      </div>

      <div className="space-y-5">
        <Card className="p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <StepBadge step={5} />
            <div>
              <h2 className="text-sm font-semibold" data-testid="text-section-hosp-expenses">Expenses + Cap Rate</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Operating costs and capitalisation rate band</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium" htmlFor="input-hosp-opex">Operating Expenses (Annual)</Label>
              <Input id="input-hosp-opex" data-testid="input-hosp-opex" type="number" min="0" step="0.01" placeholder="R 0" value={opexAnnual} onChange={(e) => setters.setOpexAnnual(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-medium" htmlFor="input-hosp-utility">
                Utility Recovery (Annual)<span className="text-muted-foreground font-normal ml-1">optional</span>
              </Label>
              <Input id="input-hosp-utility" data-testid="input-hosp-utility" type="number" step="0.01" placeholder="R 0" value={utilityAdj} onChange={(e) => setters.setUtilityAdj(e.target.value)} />
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium" htmlFor="input-hosp-cap-low">Cap Rate Low (%)</Label>
              <Input id="input-hosp-cap-low" data-testid="input-hosp-cap-low" type="number" min="0.01" max="100" step="0.01" value={capLowPct} onChange={(e) => setters.setCapLowPct(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-medium" htmlFor="input-hosp-cap-high">Cap Rate High (%)</Label>
              <Input id="input-hosp-cap-high" data-testid="input-hosp-cap-high" type="number" min="0.01" max="100" step="0.01" value={capHighPct} onChange={(e) => setters.setCapHighPct(e.target.value)} />
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Development Potential <span className="font-normal normal-case">(optional)</span></p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium" htmlFor="input-hosp-unused-land-size">Unused Land Size (m²)</Label>
                <Input id="input-hosp-unused-land-size" data-testid="input-hosp-unused-land-size" type="number" min="0" step="1" placeholder="0" value={unusedLandSize} onChange={(e) => setters.setUnusedLandSize(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-medium" htmlFor="input-hosp-land-value-per-m2">Market Land Value per m² (R)</Label>
                <Input id="input-hosp-land-value-per-m2" data-testid="input-hosp-land-value-per-m2" type="number" min="0" step="0.01" placeholder="R 0" value={landValuePerM2} onChange={(e) => setters.setLandValuePerM2(e.target.value)} />
              </div>
            </div>
            {(Number(unusedLandSize || 0) > 0 || Number(landValuePerM2 || 0) > 0) && (
              <div className="text-xs text-muted-foreground pt-0.5">
                Excess Land Value: <span className="font-semibold text-foreground">R {(Number(unusedLandSize || 0) * Number(landValuePerM2 || 0)).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>

          <div className="mt-3">
            <Label className="text-xs font-medium" htmlFor="input-hosp-refurb">
              - Refurb / Installs (R)<span className="text-muted-foreground font-normal ml-1">optional</span>
            </Label>
            <Input id="input-hosp-refurb" data-testid="input-hosp-refurb" type="number" min="0" step="0.01" placeholder="R 0" value={refurb} onChange={(e) => setters.setRefurb(e.target.value)} />
          </div>
        </Card>

        {hasInvalidCaps && (
          <div className="flex items-start gap-2.5 text-xs p-3.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200" data-testid="warning-invalid-caps">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <p>Enter valid cap rates (greater than 0) to calculate the value range.</p>
          </div>
        )}

        {calc.seasonBreakdown.length > 0 && (
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3" data-testid="text-section-revenue-breakdown">Revenue by Season</h3>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider">Season</TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider text-right">Nights</TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider text-right">Avail. RN</TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider text-right">Occ. RN</TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calc.seasonBreakdown.map((sb) => (
                    <TableRow key={sb.seasonId} data-testid={`row-revenue-${sb.seasonId}`}>
                      <TableCell className="text-sm font-medium">{sb.name}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums">{sb.nights}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums text-muted-foreground">{money(sb.availableRoomNights)}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums text-muted-foreground">{money(sb.occupiedRoomNights)}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums font-semibold">R {money(sb.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                    <TableCell className="text-sm font-bold">Total</TableCell>
                    <TableCell className="text-sm text-right tabular-nums font-bold">
                      {calc.seasonBreakdown.reduce((s, b) => s + b.nights, 0)}
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums font-bold">
                      {money(calc.totalAvailableRoomNights)}
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums font-bold">
                      {money(calc.totalOccupiedRoomNights)}
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums font-bold">
                      R {money(calc.annualRoomRevenue)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Weighted Occ." value={pct(calc.weightedOcc)} testId="text-weighted-occ" />
          <KpiCard label="Weighted ADR" value={`R ${money(calc.weightedADR)}`} testId="text-weighted-adr" />
          <KpiCard label="EGI (Annual)" value={`R ${money(calc.egiUsed)}`} testId="text-hosp-egi" />
          <KpiCard label="NOI (Annual)" value={`R ${money(calc.noi)}`} testId="text-hosp-noi" />
        </div>

        {calc.actualRev > 0 && (
          <Card className="p-4 border-primary/15 bg-primary/[0.02] dark:bg-primary/[0.04]" data-testid="card-performance-factor">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Performance Factor (Reality Check)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-[11px] text-muted-foreground">Actual Revenue (12m)</p>
                <p className="text-sm font-semibold tabular-nums mt-0.5" data-testid="text-actual-revenue">
                  R {money(calc.actualRev)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Modelled Revenue (Annual)</p>
                <p className="text-sm font-semibold tabular-nums mt-0.5" data-testid="text-modelled-revenue">
                  R {money(calc.egiUsed)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Performance Factor</p>
                <p className={`text-sm font-bold tabular-nums mt-0.5 ${
                  calc.performancePct !== null && calc.performancePct >= 100
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }`} data-testid="text-performance-pct">
                  {calc.performancePct !== null ? pct(calc.performancePct) : "—"}
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="relative rounded-md bg-primary p-5 text-primary-foreground">
          <div className="absolute inset-0 rounded-md bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
          <p className="text-[11px] font-medium uppercase tracking-wider opacity-80">Indicated Value Range</p>
          <p className="text-xl sm:text-2xl font-bold mt-2 tabular-nums" data-testid="text-hosp-value-range">
            R {money(calc.lo)} – R {money(calc.hi)}
          </p>
          <p className="text-xs mt-2 opacity-75" data-testid="text-hosp-value-note">
            Based on modelled seasonal room revenue + other income.
          </p>
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
            <div className="grid grid-cols-2 gap-3" data-testid="card-hosp-yield-payback">
              <Card className="p-3">
                <p className="text-[11px] text-muted-foreground">Implied Yield</p>
                <p className="text-sm font-semibold tabular-nums mt-0.5" data-testid="text-hosp-implied-yield">
                  {yieldLo.toFixed(1)}% – {yieldHi.toFixed(1)}%
                </p>
              </Card>
              <Card className="p-3">
                <p className="text-[11px] text-muted-foreground">Payback Period</p>
                <p className="text-sm font-semibold tabular-nums mt-0.5" data-testid="text-hosp-payback-period">
                  {paybackLo.toFixed(1)} – {paybackHi.toFixed(1)} years
                </p>
              </Card>
            </div>
          );
        })()}

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => exportHospitalityPDF(valuationName, state, calc)} data-testid="button-export-pdf-hosp">
            <FileDown className="w-3.5 h-3.5 mr-1.5" />
            Export PDF
          </Button>
        </div>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="formulas" className="border rounded-md px-4">
            <AccordionTrigger className="text-xs font-medium py-3" data-testid="button-formulas-toggle-hosp">
              <span className="flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5" />
                Formulas Reference
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="text-xs text-muted-foreground space-y-1.5 pb-1">
                <li><strong>Available Room Nights</strong> = Rooms × Nights in Season</li>
                <li><strong>Occupied Room Nights</strong> = Available × Occupancy %</li>
                <li><strong>Season Revenue</strong> = Σ (Occupied RN × Rate per Night) per room type</li>
                <li><strong>Annual Room Revenue</strong> = Σ Season Revenues</li>
                <li><strong>EGI</strong> = Annual Room Revenue + Other Annual Income</li>
                <li><strong>NOI</strong> = EGI - Opex + Utility Adj</li>
                <li><strong>Excess Land Value</strong> = Unused Land Size (m²) × Market Land Value per m²</li>
                <li><strong>Value Range</strong> = (NOI / Cap High) to (NOI / Cap Low), then + Excess Land Value - Refurb</li>
                <li><strong>Weighted ADR</strong> = Annual Room Revenue / Total Occupied Room Nights</li>
                <li><strong>Weighted Occ</strong> = Total Occupied RN / Total Available RN</li>
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
