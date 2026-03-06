import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const NAV = "#1e3a5f";
const BLUE = "#2563eb";
const BLUE_LIGHT = "#eff6ff";
const GREY_ROW = "#f8fafc";
const TEXT = "#1e293b";
const MUTED = "#64748b";
const WHITE = "#ffffff";
const DIVIDER = "#e2e8f0";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

function fmtMoney(n: number): string {
  return "R\u00a0" + n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n: number): string {
  return n.toFixed(1) + "%";
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function setFill(doc: jsPDF, hex: string) {
  doc.setFillColor(...hexToRgb(hex));
}

function setTextColor(doc: jsPDF, hex: string) {
  doc.setTextColor(...hexToRgb(hex));
}

function setDrawColor(doc: jsPDF, hex: string) {
  doc.setDrawColor(...hexToRgb(hex));
}

function drawHeader(doc: jsPDF, name: string, subtitle: string) {
  setFill(doc, NAV);
  doc.rect(0, 0, PAGE_W, 26, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setTextColor(doc, WHITE);
  doc.text(name, MARGIN, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setTextColor(doc, "#93c5fd");
  doc.text(subtitle, MARGIN, 17.5);

  const today = new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setTextColor(doc, "#93c5fd");
  doc.text(`Generated: ${today}`, PAGE_W - MARGIN, 17.5, { align: "right" });
}

function drawFooter(doc: jsPDF, totalPages: number) {
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    setDrawColor(doc, DIVIDER);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setTextColor(doc, MUTED);
    doc.text("Income Approach – Property Valuation", MARGIN, PAGE_H - 7);
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 7, { align: "right" });
  }
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setTextColor(doc, BLUE);
  doc.text(title.toUpperCase(), MARGIN, y);
  setDrawColor(doc, BLUE);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y + 1.5, PAGE_W - MARGIN, y + 1.5);
  return y + 6;
}

function disclaimer(doc: jsPDF, y: number): number {
  setFill(doc, GREY_ROW);
  doc.rect(MARGIN, y, CONTENT_W, 7.5, "F");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  setTextColor(doc, MUTED);
  doc.text(
    "Indicative only. Use evidence (rent comparables + sales/cap evidence) to support assumptions. Not a formal appraisal.",
    MARGIN + 3,
    y + 4.5,
  );
  return y + 11;
}

function kpiGrid(
  doc: jsPDF,
  items: { label: string; value: string }[],
  y: number,
  cols = 3,
): number {
  const colW = CONTENT_W / cols;
  const rowH = 10;
  const rows = Math.ceil(items.length / cols);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= items.length) break;
      const x = MARGIN + c * colW;
      const itemY = y + r * rowH;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      setTextColor(doc, MUTED);
      doc.text(items[idx].label, x + 2, itemY + 3.5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      setTextColor(doc, TEXT);
      doc.text(items[idx].value, x + 2, itemY + 8.5);
    }
  }
  return y + rows * rowH + 4;
}

function valuationBox(doc: jsPDF, lo: number, hi: number, yieldStr: string, paybackStr: string, y: number): number {
  setFill(doc, BLUE_LIGHT);
  setDrawColor(doc, BLUE);
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGIN, y, CONTENT_W, 34, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  setTextColor(doc, BLUE);
  doc.text("INDICATED VALUE RANGE", MARGIN + 4, y + 5.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  setTextColor(doc, NAV);
  doc.text(`${fmtMoney(lo)}  –  ${fmtMoney(hi)}`, MARGIN + 4, y + 15);

  setDrawColor(doc, DIVIDER);
  doc.setLineWidth(0.3);
  doc.line(MARGIN + 4, y + 20, PAGE_W - MARGIN - 4, y + 20);

  const col = CONTENT_W / 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setTextColor(doc, MUTED);
  doc.text("Implied Yield", MARGIN + 4, y + 25);
  doc.text("Payback Period", MARGIN + 4 + col, y + 25);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setTextColor(doc, TEXT);
  doc.text(yieldStr, MARGIN + 4, y + 31);
  doc.text(paybackStr, MARGIN + 4 + col, y + 31);

  return y + 39;
}

export function exportRentalPDF(
  valuationName: string,
  state: {
    lines: { id: number; desc: string; size: number; rate: number }[];
    otherMonthly: string;
    actualAnnualRev: string;
    propertyType: string;
    stabilisedOccPct: string;
    scenario: string;
    opexAnnual: string;
    utilityAdj: string;
    capLowPct: string;
    capHighPct: string;
    unusedLandSize: string;
    landValuePerM2: string;
    refurb: string;
  },
  calc: {
    pgiMonthly: number;
    pgiAnnual: number;
    egiUsed: number;
    noi: number;
    lo: number;
    hi: number;
    valueNote: string;
  },
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  drawHeader(doc, valuationName, "Income Approach – Property Valuation  ·  Rental / Lease");

  let y = 30;
  y = disclaimer(doc, y);

  y = sectionTitle(doc, "Income Lines", y);

  const lineRows = state.lines.map((l) => [
    l.desc,
    l.size.toLocaleString("en-ZA"),
    `R ${l.rate.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`,
    fmtMoney(l.size * l.rate),
  ]);

  if (Number(state.otherMonthly || 0) > 0) {
    lineRows.push(["Other Income", "—", "—", fmtMoney(Number(state.otherMonthly))]);
  }

  autoTable(doc, {
    startY: y,
    head: [["Description", "Size (m²)", "Rate (R/m²/mo)", "Monthly (R)"]],
    body: lineRows.length
      ? lineRows
      : [["No income lines added", "", "", ""]],
    foot: [["PGI Total (Monthly)", "", "", fmtMoney(calc.pgiMonthly)]],
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 8, cellPadding: 2.5, textColor: hexToRgb(TEXT), font: "helvetica" },
    headStyles: { fillColor: hexToRgb(NAV), textColor: hexToRgb(WHITE), fontStyle: "bold", fontSize: 8 },
    footStyles: { fillColor: hexToRgb(GREY_ROW), textColor: hexToRgb(TEXT), fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: hexToRgb(GREY_ROW) },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  y = sectionTitle(doc, "Income & Expense Summary", y);

  const cL = Number(state.capLowPct || 0);
  const cH = Number(state.capHighPct || 0);
  const yieldLo = Math.min(cL, cH);
  const yieldHi = Math.max(cL, cH);

  const metrics = [
    { label: "PGI (Annual)", value: fmtMoney(calc.pgiAnnual) },
    { label: "Stabilised Occ.", value: `${state.stabilisedOccPct || "0"}%` },
    { label: "EGI (Annual)", value: fmtMoney(calc.egiUsed) },
    { label: "Operating Expenses", value: fmtMoney(Number(state.opexAnnual || 0)) },
    { label: "Utility Recovery", value: fmtMoney(Number(state.utilityAdj || 0)) },
    { label: "NOI (Annual)", value: fmtMoney(calc.noi) },
    { label: "Cap Rate Range", value: cL > 0 && cH > 0 ? `${fmtPct(yieldLo)} – ${fmtPct(yieldHi)}` : "—" },
    { label: "Unused Land (m²)", value: Number(state.unusedLandSize || 0) > 0 ? Number(state.unusedLandSize).toLocaleString("en-ZA") : "—" },
    { label: "Land Value / m²", value: Number(state.landValuePerM2 || 0) > 0 ? fmtMoney(Number(state.landValuePerM2)) : "—" },
    { label: "Excess Land Value", value: fmtMoney(Number(state.unusedLandSize || 0) * Number(state.landValuePerM2 || 0)) },
    { label: "Refurb / Installs", value: fmtMoney(Number(state.refurb || 0)) },
  ];

  y = kpiGrid(doc, metrics, y, 3);
  y += 4;

  const yieldStr =
    cL > 0 && cH > 0 ? `${fmtPct(yieldLo)} – ${fmtPct(yieldHi)}` : "—";
  const paybackStr =
    cL > 0 && cH > 0
      ? `${(1 / (yieldHi / 100)).toFixed(1)} – ${(1 / (yieldLo / 100)).toFixed(1)} years`
      : "—";

  if (y > PAGE_H - 50) { doc.addPage(); y = 16; }
  y = valuationBox(doc, calc.lo, calc.hi, yieldStr, paybackStr, y);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  setTextColor(doc, MUTED);
  doc.text(calc.valueNote, MARGIN, y + 3);

  drawFooter(doc, doc.getNumberOfPages());
  doc.save(`${valuationName} – Property Valuation.pdf`);
}

export function exportHospitalityPDF(
  valuationName: string,
  state: {
    roomTypes: { id: number; name: string; rooms: number; sizeSqm: number }[];
    seasons: { id: number; name: string; startDate: string; endDate: string; occupancyPct: number }[];
    rateMatrix: Record<string, number>;
    otherAnnualIncome: string;
    actualAnnualRev: string;
    opexAnnual: string;
    utilityAdj: string;
    capLowPct: string;
    capHighPct: string;
    unusedLandSize: string;
    landValuePerM2: string;
    refurb: string;
  },
  calc: {
    totalRooms: number;
    totalGLA: number;
    annualRoomRevenue: number;
    egiUsed: number;
    noi: number;
    lo: number;
    hi: number;
    weightedADR: number;
    weightedOcc: number;
    actualRev: number;
    performancePct: number | null;
    seasonBreakdown: {
      seasonId: number;
      name: string;
      nights: number;
      availableRoomNights: number;
      occupiedRoomNights: number;
      revenue: number;
    }[];
  },
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const getNights = (start: string, end: string) => {
    if (!start || !end) return 0;
    const diff = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
    return Math.max(0, diff);
  };

  const formatIso = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
  };

  drawHeader(doc, valuationName, "Income Approach – Property Valuation  ·  Hospitality");

  let y = 30;
  y = disclaimer(doc, y);

  y = sectionTitle(doc, "Room Types", y);
  autoTable(doc, {
    startY: y,
    head: [["Room Type", "Rooms", "Size (m²/room)", "Total m²"]],
    body: state.roomTypes.length
      ? state.roomTypes.map((r) => [
          r.name,
          r.rooms.toString(),
          r.sizeSqm.toLocaleString("en-ZA"),
          (r.rooms * r.sizeSqm).toLocaleString("en-ZA"),
        ])
      : [["No room types added", "", "", ""]],
    foot: [["Totals", calc.totalRooms.toString(), "", calc.totalGLA.toLocaleString("en-ZA")]],
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 8, cellPadding: 2.5, textColor: hexToRgb(TEXT) },
    headStyles: { fillColor: hexToRgb(NAV), textColor: hexToRgb(WHITE), fontStyle: "bold", fontSize: 8 },
    footStyles: { fillColor: hexToRgb(GREY_ROW), textColor: hexToRgb(TEXT), fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: hexToRgb(GREY_ROW) },
    didParseCell: (data) => {
      if ([1, 2, 3].includes(data.column.index)) data.cell.styles.halign = "center";
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  y = sectionTitle(doc, "Seasons", y);
  autoTable(doc, {
    startY: y,
    head: [["Season", "Start", "End", "Nights", "Occupancy %"]],
    body: state.seasons.length
      ? state.seasons.map((s) => [
          s.name,
          formatIso(s.startDate),
          formatIso(s.endDate),
          getNights(s.startDate, s.endDate).toString(),
          fmtPct(s.occupancyPct),
        ])
      : [["No seasons added", "", "", "", ""]],
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 8, cellPadding: 2.5, textColor: hexToRgb(TEXT) },
    headStyles: { fillColor: hexToRgb(NAV), textColor: hexToRgb(WHITE), fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: hexToRgb(GREY_ROW) },
    didParseCell: (data) => {
      if ([3, 4].includes(data.column.index)) data.cell.styles.halign = "center";
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  if (state.roomTypes.length > 0 && state.seasons.length > 0) {
    y = sectionTitle(doc, "Rate Matrix (R per night)", y);
    const rateHead = ["Room Type", ...state.seasons.map((s) => s.name)];
    const rateBody = state.roomTypes.map((rt) => [
      rt.name,
      ...state.seasons.map((s) => {
        const rate = state.rateMatrix[`${rt.id}-${s.id}`];
        return rate != null ? fmtMoney(rate) : "—";
      }),
    ]);
    autoTable(doc, {
      startY: y,
      head: [rateHead],
      body: rateBody,
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: hexToRgb(TEXT) },
      headStyles: { fillColor: hexToRgb(NAV), textColor: hexToRgb(WHITE), fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: hexToRgb(GREY_ROW) },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  if (calc.seasonBreakdown.length > 0) {
    y = sectionTitle(doc, "Season Revenue Breakdown", y);
    autoTable(doc, {
      startY: y,
      head: [["Season", "Nights", "Avail. Room Nights", "Occ. Room Nights", "Revenue (R)"]],
      body: calc.seasonBreakdown.map((s) => [
        s.name,
        s.nights.toLocaleString("en-ZA"),
        s.availableRoomNights.toLocaleString("en-ZA"),
        s.occupiedRoomNights.toLocaleString("en-ZA"),
        fmtMoney(s.revenue),
      ]),
      foot: [[
        "Total",
        calc.seasonBreakdown.reduce((a, s) => a + s.nights, 0).toLocaleString("en-ZA"),
        calc.seasonBreakdown.reduce((a, s) => a + s.availableRoomNights, 0).toLocaleString("en-ZA"),
        calc.seasonBreakdown.reduce((a, s) => a + s.occupiedRoomNights, 0).toLocaleString("en-ZA"),
        fmtMoney(calc.annualRoomRevenue),
      ]],
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: hexToRgb(TEXT) },
      headStyles: { fillColor: hexToRgb(NAV), textColor: hexToRgb(WHITE), fontStyle: "bold", fontSize: 8 },
      footStyles: { fillColor: hexToRgb(GREY_ROW), textColor: hexToRgb(TEXT), fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: hexToRgb(GREY_ROW) },
      didParseCell: (data) => {
        if ([1, 2, 3].includes(data.column.index)) data.cell.styles.halign = "center";
        if (data.column.index === 4) data.cell.styles.halign = "right";
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  if (y > PAGE_H - 80) {
    doc.addPage();
    y = 16;
  }

  y = sectionTitle(doc, "Key Metrics", y);

  const cL = Number(state.capLowPct || 0);
  const cH = Number(state.capHighPct || 0);
  const yieldLo = Math.min(cL, cH);
  const yieldHi = Math.max(cL, cH);

  const metrics = [
    { label: "Annual Room Revenue", value: fmtMoney(calc.annualRoomRevenue) },
    { label: "Other Annual Income", value: fmtMoney(Number(state.otherAnnualIncome || 0)) },
    { label: "EGI (Annual)", value: fmtMoney(calc.egiUsed) },
    { label: "Operating Expenses", value: fmtMoney(Number(state.opexAnnual || 0)) },
    { label: "Utility Recovery", value: fmtMoney(Number(state.utilityAdj || 0)) },
    { label: "NOI (Annual)", value: fmtMoney(calc.noi) },
    { label: "Weighted ADR", value: fmtMoney(calc.weightedADR) },
    { label: "Weighted Occupancy", value: fmtPct(calc.weightedOcc) },
    { label: "Cap Rate Range", value: cL > 0 && cH > 0 ? `${fmtPct(yieldLo)} – ${fmtPct(yieldHi)}` : "—" },
    { label: "Unused Land (m²)", value: Number(state.unusedLandSize || 0) > 0 ? Number(state.unusedLandSize).toLocaleString("en-ZA") : "—" },
    { label: "Land Value / m²", value: Number(state.landValuePerM2 || 0) > 0 ? fmtMoney(Number(state.landValuePerM2)) : "—" },
    { label: "Excess Land Value", value: fmtMoney(Number(state.unusedLandSize || 0) * Number(state.landValuePerM2 || 0)) },
    { label: "Refurb / Installs", value: fmtMoney(Number(state.refurb || 0)) },
  ];
  y = kpiGrid(doc, metrics, y, 3);

  if (calc.actualRev > 0 && calc.performancePct !== null) {
    y += 4;
    y = sectionTitle(doc, "Performance Factor (Reality Check)", y);
    const perfItems = [
      { label: "Actual Revenue (12m)", value: fmtMoney(calc.actualRev) },
      { label: "Modelled Revenue (Annual)", value: fmtMoney(calc.egiUsed) },
      { label: "Performance Factor", value: fmtPct(calc.performancePct) },
    ];
    y = kpiGrid(doc, perfItems, y, 3);
  }

  y += 6;

  if (y > PAGE_H - 50) {
    doc.addPage();
    y = 16;
  }

  const yieldStr =
    cL > 0 && cH > 0 ? `${fmtPct(yieldLo)} – ${fmtPct(yieldHi)}` : "—";
  const paybackStr =
    cL > 0 && cH > 0
      ? `${(1 / (yieldHi / 100)).toFixed(1)} – ${(1 / (yieldLo / 100)).toFixed(1)} years`
      : "—";

  if (y > PAGE_H - 50) { doc.addPage(); y = 16; }
  valuationBox(doc, calc.lo, calc.hi, yieldStr, paybackStr, y);

  drawFooter(doc, doc.getNumberOfPages());
  doc.save(`${valuationName} – Property Valuation.pdf`);
}
