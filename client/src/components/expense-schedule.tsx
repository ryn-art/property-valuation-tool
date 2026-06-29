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
import { Plus, Trash2, Upload, Loader2 } from "lucide-react";
import { money } from "./calculator-shared";
import type { ExpenseLine } from "@shared/schema";

const GROUPS = ["Operating Expenses", "Utilities"] as const;

interface Props {
  lines: ExpenseLine[];
  setLines: (fn: ExpenseLine[] | ((prev: ExpenseLine[]) => ExpenseLine[])) => void;
  nextId: number;
  setNextId: (fn: number | ((n: number) => number)) => void;
}

export default function ExpenseSchedule({ lines, setLines, nextId, setNextId }: Props) {
  const [newGroup, setNewGroup] = useState<string>("Operating Expenses");
  const [newLabel, setNewLabel] = useState("");
  const [newMonthly, setNewMonthly] = useState("");
  const [newRecovery, setNewRecovery] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const addLine = useCallback(() => {
    const m = Number(newMonthly || 0);
    if (!newLabel.trim() || m <= 0) return;
    setLines((prev) => [
      ...prev,
      {
        id: nextId,
        group: newGroup,
        label: newLabel.trim(),
        monthly: m,
        recovery: Number(newRecovery || 0),
      },
    ]);
    setNextId((n) => n + 1);
    setNewLabel("");
    setNewMonthly("");
    setNewRecovery("");
  }, [newGroup, newLabel, newMonthly, newRecovery, nextId, setLines, setNextId]);

  const removeLine = useCallback((id: number) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }, [setLines]);

  const updateField = useCallback((id: number, field: keyof ExpenseLine, value: string) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        if (field === "label" || field === "group") return { ...l, [field]: value };
        return { ...l, [field]: Number(value || 0) };
      })
    );
  }, [setLines]);

  const handleScan = useCallback(async (file: File) => {
    setScanning(true);
    setScanError("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/expense-scan", { method: "POST", body: formData });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Scan failed");

      const scanned: ExpenseLine[] = data.expenses.map((e: { group: string; label: string; monthly: number; recovery: number }) => ({
        id: nextId + data.expenses.indexOf(e),
        group: e.group || "Operating Expenses",
        label: e.label,
        monthly: Number(e.monthly) || 0,
        recovery: Number(e.recovery) || 0,
      }));

      setLines((prev) => [...prev, ...scanned]);
      setNextId((n) => n + scanned.length);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }, [nextId, setLines, setNextId]);

  const groups = useMemo(() => {
    const seen = new Set<string>();
    lines.forEach((l) => seen.add(l.group));
    GROUPS.forEach((g) => seen.add(g));
    return [...seen];
  }, [lines]);

  const calc = useMemo(() => {
    const byGroup: Record<string, { netMonthly: number; netAnnual: number }> = {};
    let totalNetMonthly = 0;

    for (const l of lines) {
      const net = Math.max(0, l.monthly - l.recovery);
      if (!byGroup[l.group]) byGroup[l.group] = { netMonthly: 0, netAnnual: 0 };
      byGroup[l.group].netMonthly += net;
      byGroup[l.group].netAnnual += net * 12;
      totalNetMonthly += net;
    }

    return { byGroup, totalNetMonthly, totalNetAnnual: totalNetMonthly * 12 };
  }, [lines]);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold">Expense Schedule</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Cost, recovery, and net per line — auto-calculates total opex
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={scanning}
            onClick={() => fileRef.current?.click()}
          >
            {scanning ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5 mr-1.5" />
            )}
            {scanning ? "Scanning…" : "Scan Bill"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleScan(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {scanError && (
        <div className="mb-3 text-xs p-2.5 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
          {scanError}
        </div>
      )}

      {/* Add new expense */}
      <div className="grid grid-cols-1 sm:grid-cols-[0.7fr_1fr_0.6fr_0.6fr] gap-3 items-end">
        <div>
          <Label className="text-xs font-medium">Group</Label>
          <Select value={newGroup} onValueChange={setNewGroup}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {GROUPS.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-medium">Expense Label</Label>
          <Input placeholder="e.g., Rates & Taxes" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLine()} />
        </div>
        <div>
          <Label className="text-xs font-medium">Monthly (R)</Label>
          <Input type="number" min="0" step="0.01" placeholder="0" value={newMonthly} onChange={(e) => setNewMonthly(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLine()} />
        </div>
        <div>
          <Label className="text-xs font-medium">Recovery (R)</Label>
          <Input type="number" min="0" step="0.01" placeholder="0" value={newRecovery} onChange={(e) => setNewRecovery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLine()} />
        </div>
      </div>
      <Button size="sm" className="mt-3" onClick={addLine}>
        <Plus className="w-3.5 h-3.5 mr-1.5" />
        Add expense
      </Button>

      {/* Table */}
      {lines.length > 0 && (
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
              {groups.map((group) => {
                const groupLines = lines.filter((l) => l.group === group);
                if (groupLines.length === 0) return null;
                const groupData = calc.byGroup[group];
                return (
                  <>
                    {/* Group header */}
                    <TableRow key={`hdr-${group}`} className="bg-primary/5">
                      <TableCell colSpan={3} className="text-[11px] font-bold uppercase tracking-wider text-primary">{group}</TableCell>
                      <TableCell className="text-[11px] font-bold text-primary text-right tabular-nums">R {money(groupData?.netMonthly || 0)}</TableCell>
                      <TableCell className="text-[11px] font-bold text-primary text-right tabular-nums">R {money(groupData?.netAnnual || 0)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    {/* Group lines */}
                    {groupLines.map((l) => {
                      const net = Math.max(0, l.monthly - l.recovery);
                      return (
                        <TableRow key={l.id}>
                          <TableCell>
                            <Input className="h-7 text-sm w-40" value={l.label} onChange={(e) => updateField(l.id, "label", e.target.value)} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-7 text-sm w-24 text-right" type="number" min="0" step="0.01" value={l.monthly || ""} onChange={(e) => updateField(l.id, "monthly", e.target.value)} />
                          </TableCell>
                          <TableCell>
                            <Input className="h-7 text-sm w-24 text-right" type="number" min="0" step="0.01" value={l.recovery || ""} onChange={(e) => updateField(l.id, "recovery", e.target.value)} />
                          </TableCell>
                          <TableCell className={`text-sm text-right tabular-nums font-semibold ${net === 0 ? "text-emerald-600" : ""}`}>
                            R {money(net)}
                          </TableCell>
                          <TableCell className={`text-sm text-right tabular-nums font-semibold ${net === 0 ? "text-emerald-600" : ""}`}>
                            R {money(net * 12)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" onClick={() => removeLine(l.id)}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </>
                );
              })}
              {/* Total row */}
              <TableRow className="bg-primary text-primary-foreground font-bold">
                <TableCell colSpan={3} className="text-sm font-bold">Total Operating Expenses</TableCell>
                <TableCell className="text-sm text-right tabular-nums font-bold">R {money(calc.totalNetMonthly)}</TableCell>
                <TableCell className="text-sm text-right tabular-nums font-bold">R {money(calc.totalNetAnnual)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {lines.length > 0 && (
        <p className="text-[11px] text-muted-foreground mt-2 italic">
          Net = Cost minus tenant recoveries. Annual = Monthly × 12.
        </p>
      )}
    </Card>
  );
}
