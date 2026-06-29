import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Globe, ExternalLink, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { money, pct } from "@/components/calculator-shared";
import type { Valuation } from "@shared/schema";

function mapValuation(v: Valuation) {
  const type =
    v.incomeModel === "hospitality" ? "lodge" :
    (v.propertyType === "industrial" || v.propertyType === "storage") ? "industrial" :
    "commercial";

  const revenue = Number(v.actualAnnualRev) || 0;
  const noi = revenue - (Number(v.opexAnnual) || 0) + (Number(v.utilityAdj) || 0);
  const capLow = Number(v.capLowPct) / 100 || 0.12;
  const capHigh = Number(v.capHighPct) / 100 || 0.135;
  const capMid = (capLow + capHigh) / 2;
  const priceLow = capMid > 0 ? Math.round(noi / capHigh) : null;
  const priceHigh = capMid > 0 ? Math.round(noi / capLow) : null;
  const priceMid = capMid > 0 ? Math.round(noi / capMid) : null;

  const roomTypes = Array.isArray(v.roomTypes) ? v.roomTypes : [];
  const totalUnits = roomTypes.reduce((s: number, r: any) => s + (Number(r.rooms) || 0), 0);

  const lines = Array.isArray(v.lines) ? v.lines : [];
  const totalGla = lines.reduce((s: number, l: any) => s + (Number(l.size) || 0), 0);

  return { type, revenue, noi, priceLow, priceHigh, priceMid, totalUnits, totalGla, capLow, capHigh };
}

const TYPE_LABELS: Record<string, string> = {
  lodge: "Lodge / Game Farm",
  commercial: "Commercial",
  industrial: "Industrial",
};

export default function PostToWebsite() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"idle" | "posting" | "done" | "error">("idle");
  const [resultSlug, setResultSlug] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: valuation, isLoading, error } = useQuery<Valuation>({
    queryKey: ["/api/valuations", id],
    queryFn: async () => {
      const res = await fetch(`/api/valuations/${id}`);
      if (!res.ok) throw new Error("Valuation not found");
      return res.json();
    },
  });

  async function postToWebsite() {
    if (!valuation) return;
    setStatus("posting");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/valuations/${id}/post-to-website`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create property");
      localStorage.setItem("adminLastSlug", data.slug);
      setResultSlug(data.slug);
      setStatus("done");
    } catch (e: any) {
      setErrorMsg(e.message);
      setStatus("error");
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !valuation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Valuation not found.</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </div>
      </div>
    );
  }

  const mapped = mapValuation(valuation);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-xl mx-auto">
        <Button variant="ghost" size="sm" className="mb-6" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Calculator
        </Button>

        <h1 className="text-xl font-bold mb-1">Post to Website</h1>
        <p className="text-sm text-muted-foreground mb-6">
          The following data from your valuation will pre-fill the property website builder.
        </p>

        {status === "done" ? (
          <Card className="p-6 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <h2 className="font-semibold mb-1">Property created!</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Your property has been pre-filled in the website builder.
            </p>
            <a href="/builder" className="inline-block">
              <Button>
                Open Property Builder <ExternalLink className="w-3.5 h-3.5 ml-2" />
              </Button>
            </a>
          </Card>
        ) : (
          <>
            <Card className="p-5 mb-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-base">{valuation.name}</h2>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px]">
                      {valuation.incomeModel === "hospitality" ? "Hospitality" : "Rental"}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      → {TYPE_LABELS[mapped.type] || mapped.type}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/40 rounded p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Annual Revenue</div>
                  <div className="font-bold">{mapped.revenue > 0 ? money(mapped.revenue) : "—"}</div>
                </div>
                <div className="bg-muted/40 rounded p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Net Operating Income</div>
                  <div className="font-bold">{mapped.noi > 0 ? money(mapped.noi) : "—"}</div>
                </div>
                <div className="bg-muted/40 rounded p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Occupancy</div>
                  <div className="font-bold">{pct(Number(valuation.stabilisedOccPct))}</div>
                </div>
                <div className="bg-muted/40 rounded p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    {valuation.incomeModel === "hospitality" ? "Units / Chalets" : "GLA (m²)"}
                  </div>
                  <div className="font-bold">
                    {valuation.incomeModel === "hospitality"
                      ? (mapped.totalUnits > 0 ? mapped.totalUnits : "—")
                      : (mapped.totalGla > 0 ? `${mapped.totalGla.toLocaleString()} m²` : "—")}
                  </div>
                </div>
                {mapped.priceMid && (
                  <div className="col-span-2 bg-primary/5 border border-primary/20 rounded p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      Estimated Asking Price ({pct(mapped.capLow * 100)}–{pct(mapped.capHigh * 100)} cap rate)
                    </div>
                    <div className="font-bold text-base">
                      {money(mapped.priceLow!)} – {money(mapped.priceHigh!)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Mid-point: {money(mapped.priceMid)}
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground mt-4 border-t pt-3">
                Location, broker details, photos, star rating and other fields will still need to be filled in the builder.
              </p>
            </Card>

            {status === "error" && errorMsg && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded p-3 mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {errorMsg}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button onClick={postToWebsite} disabled={status === "posting"} className="w-full">
                {status === "posting" ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating property…</>
                ) : (
                  <><Globe className="w-4 h-4 mr-2" /> Post to Website (pre-filled)</>
                )}
              </Button>
              <a href="/builder" className="w-full">
                <Button variant="outline" className="w-full">
                  Open Property Builder (blank)
                </Button>
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
