import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import type { MonthlyBill } from "@/context/DataContext";

export type PdfAudience = "admin" | "member";

export interface PdfExportOptions {
  audience: PdfAudience;
  bill: MonthlyBill;
  month: string;
  eggPrice: number;
  totalExpenses: number;
  paymentAmount: number;
  appName?: string;
}

const COLORS = {
  butter: "#FFF8E7",
  bistre: "#3D2B1F",
  aureolin: "#FDE047",
  violet: "#7C3AED",
  red: "#E11D48",
  mint: "#DFF8F0",
  white: "#FFFFFF",
  muted: "#6B7280",
  line: "#E7E2D8",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(value: number) {
  return `₹${Number.isFinite(value) ? value.toFixed(2) : "0.00"}`;
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-");
  return new Date(Number(year), Number(monthNumber) - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function statusFor(bill: MonthlyBill, paymentAmount: number) {
  if (bill.dueAmount <= 0 || paymentAmount >= bill.dueAmount) return "Paid";
  if (paymentAmount > 0) return "Partial";
  return "Due";
}

function row(label: string, value: string, emphasis = false) {
  return `
    <div class="row ${emphasis ? "emphasis" : ""}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function buildHtml(options: PdfExportOptions) {
  const { audience, bill, month, eggPrice, totalExpenses, paymentAmount } = options;
  const appName = options.appName ?? "Dishari Mess";
  const status = statusFor(bill, paymentAmount);
  const statusClass = status.toLowerCase();
  const generatedAt = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const memberName = escapeHtml(bill.memberName);
  const title = audience === "admin" ? "Monthly Billing Statement" : "Your Monthly Bill";

  const adminRows = [
    row("Total meals", String(bill.mealCount)),
    row("Meal rate", money(bill.perMealCost)),
    row("Meal cost", money(bill.mealBill)),
    row("Egg count", String(bill.eggCount)),
    row("Egg cost", money(bill.eggBill)),
    row("Advance payments", money(bill.totalAdvance)),
    row("Cook salary", money(bill.cookShare)),
    row("Total expenses", money(totalExpenses)),
  ].join("");

  const memberRows = [
    row("Meals consumed", String(bill.mealCount)),
    row("Meal cost", money(bill.mealBill)),
    row("Eggs consumed", String(bill.eggCount)),
    row("Egg cost", money(bill.eggBill)),
    row("Cook share", money(bill.cookShare)),
    ...(bill.fineTotal > 0 ? [row("Fines", money(bill.fineTotal))] : []),
    row("Advance payments", money(bill.totalAdvance)),
  ].join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(appName)} · ${escapeHtml(monthLabel(month))}</title>
      <style>
        @page { size: A4; margin: 0; }
        * { box-sizing: border-box; }
         html { background: linear-gradient(135deg, #DFF8F0 0%, #F5F3EF 48%, #EDE9FE 100%); }
         body { margin: 0; background: linear-gradient(135deg, #DFF8F0 0%, #F5F3EF 48%, #EDE9FE 100%); color: ${COLORS.bistre}; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
         .page { max-width: 820px; margin: 0 auto; padding: 34px; background: linear-gradient(180deg, #FFFDF9 0%, #FFFFFF 52%, #FFF8E7 100%); min-height: 100vh; }
         .header { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; padding: 24px; border: 1px solid #FFFFFF55; border-radius: 24px; background: linear-gradient(135deg, ${COLORS.violet} 0%, #5B21B6 55%, ${COLORS.bistre} 100%); color: ${COLORS.white}; box-shadow: 0 14px 28px #7c3aed2e; }
        .brand { display: flex; align-items: center; gap: 13px; }
         .logo { width: 50px; height: 50px; border-radius: 17px; display: grid; place-items: center; background: linear-gradient(145deg, ${COLORS.aureolin}, #F59E0B); color: ${COLORS.bistre}; font-size: 25px; font-weight: 900; box-shadow: 0 8px 18px #120b082e; }
         .brand h1 { margin: 0; color: ${COLORS.white}; font-size: 23px; letter-spacing: -0.6px; }
         .brand p { margin: 5px 0 0; color: #FFFFFFC7; font-size: 12px; }
         .invoice-meta { text-align: right; padding-top: 3px; }
        .invoice-meta h2 { margin: 0; font-size: 19px; }
         .invoice-meta p { margin: 6px 0 0; color: #FFFFFFB8; font-size: 12px; }
         .member-banner { margin: 22px 0; padding: 20px 22px; border-radius: 20px; background: linear-gradient(105deg, ${COLORS.butter} 0%, #FFF1B8 100%); border: 1px solid #FDE04788; display: flex; justify-content: space-between; gap: 16px; align-items: center; box-shadow: 0 8px 18px #FACC151F; }
        .member-banner span { color: ${COLORS.muted}; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
        .member-banner strong { display: block; margin-top: 5px; font-size: 20px; }
         .badge { padding: 9px 14px; border-radius: 999px; font-size: 11px; font-weight: 900; letter-spacing: .8px; border: 1px solid #FFFFFFAA; }
         .badge.paid { color: #047857; background: ${COLORS.mint}; }
         .badge.partial { color: #92400E; background: #FEF3C7; }
         .badge.due { color: ${COLORS.red}; background: #FFE4E6; }
         .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 18px 0 30px; }
         .summary-card { padding: 18px; min-height: 72px; border: 1px solid ${COLORS.line}; border-radius: 18px; background: linear-gradient(145deg, #FFFDF9 0%, #FFFFFF 100%); box-shadow: 0 8px 18px #3D2B1F12; }
         .summary-card:nth-child(1) { background: linear-gradient(145deg, #FFF8E7 0%, #FFFDF9 100%); border-color: #FDE04788; }
         .summary-card:nth-child(2) { background: linear-gradient(145deg, #F3E8FF 0%, #FFFFFF 100%); border-color: #C4B5FD99; }
         .summary-card:nth-child(3) { background: linear-gradient(145deg, #FFE4E6 0%, #FFFFFF 100%); border-color: #FDA4AF88; }
        .summary-card span { display: block; color: ${COLORS.muted}; font-size: 11px; }
         .summary-card strong { display: block; margin-top: 8px; font-size: 20px; color: ${COLORS.bistre}; }
         .section-title { margin: 26px 0 11px; font-size: 12px; text-transform: uppercase; letter-spacing: 1.3px; color: ${COLORS.violet}; font-weight: 900; }
         .table { border: 1px solid ${COLORS.line}; border-radius: 18px; overflow: hidden; background: #FFFFFFB8; box-shadow: 0 8px 18px #3D2B1F0D; }
         .row { display: flex; justify-content: space-between; gap: 20px; padding: 13px 17px; border-bottom: 1px solid ${COLORS.line}; font-size: 13px; }
        .row:last-child { border-bottom: 0; }
        .row span { color: ${COLORS.muted}; }
         .table .row:nth-child(even) { background: #F8FAFC99; }
         .table .row:nth-child(3n) { background: #F3E8FF45; }
         .row.emphasis { background: linear-gradient(90deg, ${COLORS.butter}, #FFF1B8); }
        .row.emphasis strong { color: ${COLORS.bistre}; }
         .totals { margin-top: 20px; padding: 20px; border-radius: 20px; background: linear-gradient(135deg, ${COLORS.bistre} 0%, #5B3B2B 55%, ${COLORS.violet} 150%); color: white; box-shadow: 0 12px 22px #3D2B1F2E; }
        .totals .row { border-color: #ffffff22; }
        .totals .row span { color: #ffffffaa; }
        .totals .row strong { color: white; }
        .totals .final { font-size: 18px; padding-top: 16px; margin-top: 4px; border-top: 1px solid #ffffff55; border-bottom: 0; }
        .totals .final strong { color: ${COLORS.aureolin}; }
         .note { margin-top: 20px; padding: 15px 17px; border: 1px solid #C4B5FD88; border-left: 5px solid ${COLORS.violet}; border-radius: 13px; background: linear-gradient(105deg, #F5F3FF 0%, #EDE9FE 100%); color: ${COLORS.muted}; font-size: 12px; line-height: 1.55; }
         footer { margin-top: 36px; padding: 16px 2px 0; border-top: 2px solid #FDE04788; display: flex; justify-content: space-between; gap: 16px; color: ${COLORS.muted}; font-size: 10px; }
         footer span:last-child { color: ${COLORS.violet}; font-weight: 800; }
         @media print { html, body { background: #F5F3EF; } .page { box-shadow: none; } }
        @media (max-width: 600px) { .page { padding: 24px 18px; } .header { flex-direction: column; } .invoice-meta { text-align: left; } .summary { grid-template-columns: 1fr; } .member-banner { align-items: flex-start; flex-direction: column; } footer { flex-direction: column; } }
      </style>
    </head>
    <body>
      <main class="page">
        <header class="header">
          <div class="brand">
            <div class="logo">D</div>
            <div><h1>${escapeHtml(appName)}</h1><p>Secure · Smart · Seamless</p></div>
          </div>
          <div class="invoice-meta"><h2>${title}</h2><p>${escapeHtml(monthLabel(month))}</p></div>
        </header>
        <section class="member-banner">
          <div><span>Bill prepared for</span><strong>${memberName}</strong></div>
          <span class="badge ${statusClass}">${status.toUpperCase()}</span>
        </section>
        <section class="summary">
          <div class="summary-card"><span>Final payable</span><strong>${money(bill.grossBill)}</strong></div>
          <div class="summary-card"><span>Due amount</span><strong>${money(bill.dueAmount)}</strong></div>
          <div class="summary-card"><span>Credit balance</span><strong>${money(bill.creditBalance)}</strong></div>
        </section>
        <div class="section-title">${audience === "admin" ? "Billing breakdown" : "Your breakdown"}</div>
        <section class="table">${audience === "admin" ? adminRows : memberRows}</section>
        <section class="totals">
          ${row("Final payable amount", money(bill.grossBill), true)}
          ${row("Advance payments", `− ${money(bill.totalAdvance)}`)}
          ${row("Payment received", `− ${money(paymentAmount)}`)}
          <div class="row final"><span>Due amount</span><strong>${money(bill.dueAmount)}</strong></div>
        </section>
        ${audience === "admin" ? `<div class="note">Meal rate: ${money(bill.perMealCost)} · Egg price: ${money(eggPrice)} per egg · This statement includes the month's shared expenses for administrative reference.</div>` : `<div class="note">This is your personal statement for ${escapeHtml(monthLabel(month))}. If you have questions about an amount, please contact the mess administrator.</div>`}
        <footer><span>Generated on ${generatedAt}</span><span>${escapeHtml(appName)} · ${audience === "admin" ? "Admin copy" : "Member copy"}</span></footer>
      </main>
    </body>
  </html>`;
}

export async function exportMonthlyBillPdf(options: PdfExportOptions) {
  const html = buildHtml(options);

  if (Platform.OS === "web") {
    // expo-print's web implementation ignores the supplied HTML and calls
    // window.print() on the current app. Printing here would therefore print
    // the dashboard (or a blank route), not the invoice. Navigate a real
    // print document to the generated HTML instead.
    const popup = window.open("", "_blank");
    if (!popup) {
      throw new Error("Please allow pop-ups to download your bill as a PDF.");
    }

    popup.document.open();
    popup.document.write(html);
    popup.document.close();

    await new Promise<void>((resolve) => {
      const print = () => {
        window.setTimeout(() => {
          popup.focus();
          popup.print();
          resolve();
        }, 150);
      };

      if (popup.document.readyState === "complete") {
        print();
      } else {
        popup.addEventListener("load", print, { once: true });
      }
    });
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: `Download ${options.bill.memberName}'s bill`,
      UTI: "com.adobe.pdf",
    });
  } else {
    await Print.printAsync({ html });
  }
}