import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ALDES_AUCTIONS_LOGO, ALDES_BUSINESS_BROKERS_LOGO } from "./logo-base64";

export type CompanyBrand = "auctions" | "brokers";

const COMPANY_INFO: Record<CompanyBrand, { logo: string; name: string; format: "PNG" | "JPEG"; logoW: number; logoH: number }> = {
  auctions: { logo: ALDES_AUCTIONS_LOGO, name: "Aldes Auctions", format: "PNG", logoW: 50, logoH: 50 },
  brokers: { logo: ALDES_BUSINESS_BROKERS_LOGO, name: "Aldes Business Brokers", format: "JPEG", logoW: 61, logoH: 50 },
};

const NAV = "#1e3a5f";
const GOLD = "#C9A84C";
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

function drawCoverPage(
  doc: jsPDF,
  title: string,
  subtitle: string,
  summaryRows: { label: string; value: string }[],
  companyBrand: CompanyBrand = "auctions",
) {
  // Logo — centered, top third
  const { logo, format, logoW, logoH } = COMPANY_INFO[companyBrand];
  const logoX = (PAGE_W - logoW) / 2;
  doc.addImage(logo, format, logoX, 45, logoW, logoH);

  // Gold divider line
  setDrawColor(doc, GOLD);
  doc.setLineWidth(0.8);
  doc.line(PAGE_W / 2 - 25, 108, PAGE_W / 2 + 25, 108);

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  setTextColor(doc, NAV);
  doc.text("BROKER OPINION", PAGE_W / 2, 130, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  setTextColor(doc, GOLD);
  doc.text("OF VALUE", PAGE_W / 2, 142, { align: "center" });

  // Subtitle (property name)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  setTextColor(doc, MUTED);
  const splitSubtitle = doc.splitTextToSize(subtitle, CONTENT_W - 40);
  doc.text(splitSubtitle, PAGE_W / 2, 158, { align: "center" });

  // Summary table at bottom
  const tableTop = 220;
  setDrawColor(doc, DIVIDER);
  doc.setLineWidth(0.3);

  summaryRows.forEach((row, i) => {
    const rowY = tableTop + i * 14;
    doc.line(MARGIN + 20, rowY, PAGE_W - MARGIN - 20, rowY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    setTextColor(doc, NAV);
    doc.text(row.label.toUpperCase(), MARGIN + 24, rowY + 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setTextColor(doc, TEXT);
    doc.text(row.value, PAGE_W / 2 + 10, rowY + 9);
  });

  // Bottom line
  const lastY = tableTop + summaryRows.length * 14;
  doc.line(MARGIN + 20, lastY, PAGE_W - MARGIN - 20, lastY);
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
    doc.text("Income Approach – Broker Opinion of Value", MARGIN, PAGE_H - 7);
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 7, { align: "right" });
  }
}

function drawSignature(doc: jsPDF, y: number, brokerName = "Peet Brits", companyBrand: CompanyBrand = "auctions"): number {
  if (y > PAGE_H - 70) { doc.addPage(); y = 20; }

  y += 8;
  setDrawColor(doc, DIVIDER);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setTextColor(doc, MUTED);
  doc.text("Prepared by:", MARGIN, y);

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setTextColor(doc, NAV);
  doc.text(brokerName, MARGIN, y);

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setTextColor(doc, TEXT);
  doc.text(COMPANY_INFO[companyBrand].name, MARGIN, y);

  y += 12;
  setDrawColor(doc, NAV);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, MARGIN + 60, y);

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setTextColor(doc, MUTED);
  doc.text("Signature", MARGIN, y);

  const today = new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setTextColor(doc, TEXT);
  doc.text(today, PAGE_W - MARGIN - 50, y - 7);
  setDrawColor(doc, NAV);
  doc.line(PAGE_W - MARGIN - 50, y - 5, PAGE_W - MARGIN, y - 5);
  doc.setFontSize(7.5);
  setTextColor(doc, MUTED);
  doc.text("Date", PAGE_W - MARGIN - 50, y);

  return y + 10;
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
    "Indicative value only. Not a formal appraisal.",
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

export function exportRentalClientPDF(
  valuationName: string,
  state: {
    stabilisedOccPct: string;
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
    pgiAnnual: number;
    egiUsed: number;
    noi: number;
    lo: number;
    hi: number;
  },
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  drawHeader(doc, valuationName, "Income Approach – Broker Opinion of Value  ·  Client Summary");

  let y = 30;
  y = disclaimer(doc, y);

  const cL = Number(state.capLowPct || 0);
  const cH = Number(state.capHighPct || 0);
  const yieldLo = Math.min(cL, cH);
  const yieldHi = Math.max(cL, cH);

  y = sectionTitle(doc, "Key Metrics", y);
  const metrics = [
    { label: "PGI (Annual)", value: fmtMoney(calc.pgiAnnual) },
    { label: "Stabilised Occ.", value: `${state.stabilisedOccPct || "0"}%` },
    { label: "EGI (Annual)", value: fmtMoney(calc.egiUsed) },
    { label: "Operating Expenses", value: fmtMoney(Number(state.opexAnnual || 0)) },
    { label: "Utility Recovery", value: fmtMoney(Number(state.utilityAdj || 0)) },
    { label: "NOI (Annual)", value: fmtMoney(calc.noi) },
    { label: "Cap Rate Range", value: cL > 0 && cH > 0 ? `${fmtPct(yieldLo)} – ${fmtPct(yieldHi)}` : "—" },
    { label: "Excess Land Value", value: fmtMoney(Number(state.unusedLandSize || 0) * Number(state.landValuePerM2 || 0)) },
    { label: "Refurb / Installs", value: fmtMoney(Number(state.refurb || 0)) },
  ];
  y = kpiGrid(doc, metrics, y, 3);

  const actualRev = Number(state.actualAnnualRev || 0);
  const performancePct = actualRev > 0 && calc.egiUsed > 0 ? (actualRev / calc.egiUsed) * 100 : null;

  y += 4;
  y = sectionTitle(doc, "Performance Factor (Reality Check)", y);
  const perfItems = [
    { label: "Actual Revenue (12m)", value: actualRev > 0 ? fmtMoney(actualRev) : "—" },
    { label: "Modelled Revenue (Annual)", value: fmtMoney(calc.egiUsed) },
    { label: "Performance Factor", value: performancePct !== null ? fmtPct(performancePct) : "—" },
  ];
  y = kpiGrid(doc, perfItems, y, 3);

  y += 6;
  if (y > PAGE_H - 50) { doc.addPage(); y = 16; }

  const yieldStr = cL > 0 && cH > 0 ? `${fmtPct(yieldLo)} – ${fmtPct(yieldHi)}` : "—";
  const paybackStr = cL > 0 && cH > 0
    ? `${(1 / (yieldHi / 100)).toFixed(1)} – ${(1 / (yieldLo / 100)).toFixed(1)} years`
    : "—";
  valuationBox(doc, calc.lo, calc.hi, yieldStr, paybackStr, y);

  drawFooter(doc, doc.getNumberOfPages());
  doc.save(`${valuationName} – Client Summary.pdf`);
}

export function exportHospitalityClientPDF(
  valuationName: string,
  state: {
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
    annualRoomRevenue: number;
    egiUsed: number;
    noi: number;
    lo: number;
    hi: number;
    weightedADR: number;
    weightedOcc: number;
    actualRev: number;
    performancePct: number | null;
  },
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  drawHeader(doc, valuationName, "Income Approach – Broker Opinion of Value  ·  Client Summary");

  let y = 30;
  y = disclaimer(doc, y);

  const cL = Number(state.capLowPct || 0);
  const cH = Number(state.capHighPct || 0);
  const yieldLo = Math.min(cL, cH);
  const yieldHi = Math.max(cL, cH);

  y = sectionTitle(doc, "Key Metrics", y);
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
    { label: "Excess Land Value", value: fmtMoney(Number(state.unusedLandSize || 0) * Number(state.landValuePerM2 || 0)) },
    { label: "Refurb / Installs", value: fmtMoney(Number(state.refurb || 0)) },
  ];
  y = kpiGrid(doc, metrics, y, 3);

  y += 4;
  y = sectionTitle(doc, "Performance Factor (Reality Check)", y);
  const perfItems = [
    { label: "Actual Revenue (12m)", value: calc.actualRev > 0 ? fmtMoney(calc.actualRev) : "—" },
    { label: "Modelled Revenue (Annual)", value: fmtMoney(calc.egiUsed) },
    { label: "Performance Factor", value: calc.performancePct !== null ? fmtPct(calc.performancePct) : "—" },
  ];
  y = kpiGrid(doc, perfItems, y, 3);

  y += 6;
  if (y > PAGE_H - 50) { doc.addPage(); y = 16; }

  const yieldStr = cL > 0 && cH > 0 ? `${fmtPct(yieldLo)} – ${fmtPct(yieldHi)}` : "—";
  const paybackStr = cL > 0 && cH > 0
    ? `${(1 / (yieldHi / 100)).toFixed(1)} – ${(1 / (yieldLo / 100)).toFixed(1)} years`
    : "—";
  valuationBox(doc, calc.lo, calc.hi, yieldStr, paybackStr, y);

  drawFooter(doc, doc.getNumberOfPages());
  doc.save(`${valuationName} – Client Summary.pdf`);
}

export function exportRentalPDF(
  valuationName: string,
  state: {
    lines: { id: number; desc: string; size: number; rate: number; qty?: number; climateControlled?: boolean }[];
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
    expenseLines?: { id: number; group: string; label: string; monthly: number; recovery: number }[];
  },
  calc: {
    pgiMonthly: number;
    pgiAnnual: number;
    egiUsed: number;
    noi: number;
    lo: number;
    hi: number;
    valueNote: string;
    opex?: number;
  },
  brokerName = "Peet Brits",
  companyBrand: CompanyBrand = "auctions",
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const isStorage = state.propertyType === "storage";
  const isStudent = state.propertyType === "student";
  const useFlatRate = isStorage || isStudent;

  const cL = Number(state.capLowPct || 0);
  const cH = Number(state.capHighPct || 0);
  const yieldLo = Math.min(cL, cH);
  const yieldHi = Math.max(cL, cH);
  const today = new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
  const typeLabel = isStudent ? "Student Accommodation" : isStorage ? "Self-storage" : (state.propertyType?.charAt(0).toUpperCase() + state.propertyType?.slice(1)) || "Property";

  drawCoverPage(doc, valuationName, valuationName, [
    { label: "Indicated Value Range", value: `${fmtMoney(calc.lo)}  –  ${fmtMoney(calc.hi)}` },
    { label: "Property Type", value: typeLabel },
    { label: "Document", value: "Income Approach — Broker Opinion of Value" },
    { label: "Date Issued", value: today },
  ], companyBrand);

  doc.addPage();
  drawHeader(doc, valuationName, "Income Approach – Broker Opinion of Value");

  let y = 30;
  y = disclaimer(doc, y);

  y = sectionTitle(doc, "Income Lines", y);

  const totalUnits = state.lines.reduce((s, l) => s + (l.qty || 1), 0);
  const totalM2 = state.lines.reduce((s, l) => s + (l.qty || 1) * l.size, 0);
  const lineMonthly = (l: { size: number; rate: number; qty?: number }) =>
    useFlatRate ? (l.qty || 1) * l.rate : (l.qty || 1) * l.size * l.rate;

  const qtyCol = isStudent ? "Beds / Units" : useFlatRate ? "Units" : "Qty";
  const rateCol = useFlatRate ? "Rate (R/unit/mo)" : "Rate (R/m²/mo)";

  const lineRows = state.lines.map((l) => [
    l.desc,
    String(l.qty || 1),
    l.size.toLocaleString("en-ZA"),
    fmtMoney(l.rate),
    fmtMoney(lineMonthly(l)),
  ]);

  if (Number(state.otherMonthly || 0) > 0) {
    lineRows.push(["Other Income", "—", "—", "—", fmtMoney(Number(state.otherMonthly))]);
  }

  autoTable(doc, {
    startY: y,
    head: [["Description", qtyCol, "Size (m²)", rateCol, "Monthly (R)"]],
    body: lineRows.length
      ? lineRows
      : [["No income lines added", "", "", "", ""]],
    foot: [[
      "PGI Total (Monthly)",
      String(totalUnits),
      totalM2.toLocaleString("en-ZA"),
      "",
      fmtMoney(calc.pgiMonthly),
    ]],
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 8, cellPadding: 2.5, textColor: hexToRgb(TEXT), font: "helvetica" },
    headStyles: { fillColor: hexToRgb(NAV), textColor: hexToRgb(WHITE), fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: hexToRgb(GREY_ROW) },
    didParseCell: (data: any) => {
      const col = data.column.index;
      const isFoot = data.section === "foot";
      if (isFoot) {
        data.cell.styles.fillColor = hexToRgb(GREY_ROW);
        data.cell.styles.textColor = hexToRgb(TEXT);
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 8;
      }
      if (col === 1 || col === 2) data.cell.styles.halign = "center";
      if (col === 3 || col === 4) data.cell.styles.halign = "right";
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // ── Expense Schedule ────────────────────────────────────────────
  const expenses = state.expenseLines || [];
  if (expenses.length > 0) {
    if (y > PAGE_H - 60) { doc.addPage(); drawHeader(doc, valuationName, "Income Approach – Broker Opinion of Value"); y = 30; }
    y = sectionTitle(doc, "Expense Schedule", y);

    const groups = [...new Set(expenses.map(e => e.group))];
    const expRows: (string | { content: string; colSpan?: number; styles?: any })[][] = [];

    for (const group of groups) {
      const groupItems = expenses.filter(e => e.group === group);
      const groupNet = groupItems.reduce((s, e) => s + Math.max(0, e.monthly - e.recovery), 0);
      // Group header row
      expRows.push([
        { content: group.toUpperCase(), colSpan: 2, styles: { fontStyle: "bold", textColor: hexToRgb(BLUE), fillColor: hexToRgb("#f0f4ff"), fontSize: 7.5 } },
        { content: "", styles: { fillColor: hexToRgb("#f0f4ff") } },
        { content: fmtMoney(groupNet), styles: { fontStyle: "bold", textColor: hexToRgb(BLUE), fillColor: hexToRgb("#f0f4ff"), halign: "right" } },
        { content: fmtMoney(groupNet * 12), styles: { fontStyle: "bold", textColor: hexToRgb(BLUE), fillColor: hexToRgb("#f0f4ff"), halign: "right" } },
      ]);
      // Line items
      for (const e of groupItems) {
        const net = Math.max(0, e.monthly - e.recovery);
        expRows.push([
          "    " + e.label,
          fmtMoney(e.monthly),
          e.recovery > 0 ? fmtMoney(e.recovery) : "—",
          fmtMoney(net),
          fmtMoney(net * 12),
        ]);
      }
    }

    const totalNetMonthly = expenses.reduce((s, e) => s + Math.max(0, e.monthly - e.recovery), 0);

    autoTable(doc, {
      startY: y,
      head: [["Expense", "Cost / mo", "Recovery", "Net / mo", "Annual (Net)"]],
      body: expRows as any,
      foot: [["Total Operating Expenses", "", "", fmtMoney(totalNetMonthly), fmtMoney(totalNetMonthly * 12)]],
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: hexToRgb(TEXT), font: "helvetica" },
      headStyles: { fillColor: hexToRgb(NAV), textColor: hexToRgb(WHITE), fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: hexToRgb(GREY_ROW) },
      didParseCell: (data: any) => {
        const col = data.column.index;
        const isFoot = data.section === "foot";
        if (isFoot) {
          data.cell.styles.fillColor = hexToRgb(NAV);
          data.cell.styles.textColor = hexToRgb(GOLD);
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fontSize = 8;
        }
        if (col >= 1) data.cell.styles.halign = "right";
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    setTextColor(doc, MUTED);
    doc.text("Net = Cost minus tenant recoveries. Annual = Monthly × 12.", MARGIN, y + 3);
    y += 10;
  }

  y = sectionTitle(doc, "Income & Expense Summary", y);

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
  y += 8;

  drawSignature(doc, y, brokerName, companyBrand);
  drawFooter(doc, doc.getNumberOfPages());
  doc.save(`${valuationName} – Broker Opinion of Value.pdf`);
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
  brokerName = "Peet Brits",
  companyBrand: CompanyBrand = "auctions",
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const getNights = (start: string, end: string) => {
    if (!start || !end) return 0;
    const diff = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
    return Math.max(0, diff);
  };

  const formatIso = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
  };

  drawHeader(doc, valuationName, "Income Approach – Broker Opinion of Value  ·  Hospitality");

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
  y = valuationBox(doc, calc.lo, calc.hi, yieldStr, paybackStr, y);

  drawSignature(doc, y, brokerName, companyBrand);
  drawFooter(doc, doc.getNumberOfPages());
  doc.save(`${valuationName} – Broker Opinion of Value.pdf`);
}
