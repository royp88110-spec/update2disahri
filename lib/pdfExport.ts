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

export interface AllBillsPdfExportOptions {
  bills: MonthlyBill[];
  month: string;
  payments: Array<{ memberId: string; amount: number }>;
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
  <html class="${audience === "member" ? "member-document-html" : "admin-document-html"}">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(appName)} · ${escapeHtml(monthLabel(month))}</title>
      <style>
        @page { size: A4; margin: 0; }
        * { box-sizing: border-box; }
         html { background: linear-gradient(135deg, #F3FBF8 0%, #F7F4FB 52%, #FFF9EE 100%); }
         body { margin: 0; background: linear-gradient(135deg, #F3FBF8 0%, #F7F4FB 52%, #FFF9EE 100%); color: ${COLORS.bistre}; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
         .page { max-width: 820px; margin: 0 auto; padding: 34px; background: linear-gradient(180deg, #FFFEFC 0%, #FBFAFF 52%, #FFFDF5 100%); min-height: 100vh; }
         .header { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; padding: 24px; border: 1px solid #FFFFFF66; border-radius: 24px; background: linear-gradient(135deg, #6D5BD0 0%, #5F4BB6 55%, #4A372D 100%); color: ${COLORS.white}; box-shadow: 0 14px 28px #5F4BB626; }
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
          .summary-card { padding: 18px; min-height: 72px; border: 1px solid ${COLORS.line}; border-radius: 18px; background: linear-gradient(145deg, #FFFEFC 0%, #FFFFFF 100%); box-shadow: 0 8px 18px #3D2B1F0C; }
          .summary-card:nth-child(1) { background: linear-gradient(145deg, #FFF9E9 0%, #FFFEFC 100%); border-color: #FDE04766; }
          .summary-card:nth-child(2) { background: linear-gradient(145deg, #F6F1FF 0%, #FFFFFF 100%); border-color: #C4B5FD70; }
          .summary-card:nth-child(3) { background: linear-gradient(145deg, #FFF1F2 0%, #FFFFFF 100%); border-color: #FDA4AF70; }
        .summary-card span { display: block; color: ${COLORS.muted}; font-size: 11px; }
         .summary-card strong { display: block; margin-top: 8px; font-size: 20px; color: ${COLORS.bistre}; }
         .section-title { margin: 26px 0 11px; font-size: 12px; text-transform: uppercase; letter-spacing: 1.3px; color: ${COLORS.violet}; font-weight: 900; }
         .table { border: 1px solid ${COLORS.line}; border-radius: 18px; overflow: hidden; background: #FFFFFFB8; box-shadow: 0 8px 18px #3D2B1F0D; }
         .row { display: flex; justify-content: space-between; gap: 20px; padding: 13px 17px; border-bottom: 1px solid ${COLORS.line}; font-size: 13px; }
        .row:last-child { border-bottom: 0; }
        .row span { color: ${COLORS.muted}; }
          .table .row:nth-child(even) { background: #F8FAFC70; }
          .table .row:nth-child(3n) { background: #F6F1FF45; }
          .row.emphasis { background: linear-gradient(90deg, #FFF9E9, #FFF3C4); }
        .row.emphasis strong { color: ${COLORS.bistre}; }
         .totals { margin-top: 20px; padding: 20px; border-radius: 20px; background: linear-gradient(135deg, ${COLORS.bistre} 0%, #5B3B2B 55%, ${COLORS.violet} 150%); color: white; box-shadow: 0 12px 22px #3D2B1F2E; }
        .totals .row { border-color: #ffffff22; }
        .totals .row span { color: #ffffffaa; }
        .totals .row strong { color: white; }
        .totals .final { font-size: 18px; padding-top: 16px; margin-top: 4px; border-top: 1px solid #ffffff55; border-bottom: 0; }
        .totals .final strong { color: ${COLORS.aureolin}; }
          .note { margin-top: 20px; padding: 15px 17px; border: 1px solid #C4B5FD70; border-left: 5px solid ${COLORS.violet}; border-radius: 13px; background: linear-gradient(105deg, #F8F5FF 0%, #F1EDFB 100%); color: ${COLORS.muted}; font-size: 12px; line-height: 1.55; }
         footer { margin-top: 36px; padding: 16px 2px 0; border-top: 2px solid #FDE04788; display: flex; justify-content: space-between; gap: 16px; color: ${COLORS.muted}; font-size: 10px; }
         footer span:last-child { color: ${COLORS.violet}; font-weight: 800; }
          @media print { .page { box-shadow: none; } }
        @media (max-width: 600px) { .page { padding: 24px 18px; } .header { flex-direction: column; } .invoice-meta { text-align: left; } .summary { grid-template-columns: 1fr; } .member-banner { align-items: flex-start; flex-direction: column; } footer { flex-direction: column; } }

         /* Member statement theme — intentionally scoped so admin copies remain unchanged. */
         html.member-document-html { background: #EAF0F7; }
         body.member-document-body {
           background: linear-gradient(145deg, #EAF0F7 0%, #F5F8FC 54%, #E8EEF6 100%);
           color: #102A43;
         }
         .member-document-body .page {
           position: relative;
           overflow: hidden;
           background:
             radial-gradient(circle at 100% 0%, #DDE7F433 0, #DDE7F400 29%),
             radial-gradient(circle at 0% 100%, #D9D5FF2B 0, #D9D5FF00 25%),
             linear-gradient(180deg, #F9FBFD 0%, #EEF3F8 100%);
           color: #102A43;
         }
         .member-document-body .page::before,
         .member-document-body .page::after {
           position: absolute;
           z-index: 0;
           border: 1px solid #FFFFFF80;
           border-radius: 999px;
           content: "";
           pointer-events: none;
         }
         .member-document-body .page::before {
           top: 128px;
           right: -92px;
           width: 230px;
           height: 230px;
           background: #D8E2F033;
         }
         .member-document-body .page::after {
           bottom: 86px;
           left: -118px;
           width: 260px;
           height: 260px;
           background: #DDD9FF24;
         }
         .member-document-body .page > * {
           position: relative;
           z-index: 1;
         }
         .member-document-body .header {
           position: relative;
           overflow: hidden;
           border: 1px solid #FFFFFF2E;
           border-radius: 22px;
           background: linear-gradient(135deg, #0B1F3A 0%, #16385F 58%, #214E7D 100%);
           box-shadow: 0 14px 28px #102A431C;
         }
         .member-document-body .header::after {
           position: absolute;
           top: -46px;
           right: -32px;
           width: 148px;
           height: 148px;
           border: 1px solid #FFFFFF1C;
           border-radius: 999px;
           background: #FFFFFF0A;
           content: "";
         }
         .member-document-body .brand,
         .member-document-body .invoice-meta {
           position: relative;
           z-index: 1;
         }
         .member-document-body .logo {
           border: 3px solid #FFFFFF24;
           background: linear-gradient(145deg, #FFF6A8 0%, #F7E967 100%);
           color: #0B1F3A;
           box-shadow: 0 8px 18px #06142652;
         }
         .member-document-body .brand h1,
         .member-document-body .invoice-meta h2 {
           color: #FFFFFF;
         }
         .member-document-body .brand p,
         .member-document-body .invoice-meta p {
           color: #D8E5F2;
         }
         .member-document-body .member-banner {
           border: 1px solid #C8D6E5;
           border-left: 4px solid #6D5AE6;
           background: #FFFFFFD9;
           box-shadow: 0 8px 18px #102A430D;
         }
         .member-document-body .member-banner span {
           color: #61758A;
         }
         .member-document-body .member-banner strong {
           color: #102A43;
         }
         .member-document-body .badge {
           border-color: #FFFFFF;
         }
         .member-document-body .badge.partial {
           color: #5B4B00;
           background: #FFF8C9;
           border-color: #F7E96780;
         }
         .member-document-body .summary {
           margin-bottom: 28px;
         }
         .member-document-body .summary-card {
           border: 1px solid #D6E0EB;
           background: #FFFFFFE6;
           box-shadow: 0 8px 18px #102A430B;
         }
         .member-document-body .summary-card:nth-child(1) {
           border-color: #CFCBF4;
           border-top: 3px solid #6D5AE6;
           background: #FBFAFF;
         }
         .member-document-body .summary-card:nth-child(2) {
           border-color: #E6DFA0;
           border-top: 3px solid #F7E967;
           background: #FFFDF0;
         }
         .member-document-body .summary-card:nth-child(3) {
           border-color: #C9D8E6;
           border-top: 3px solid #8AA6C1;
           background: #F8FBFD;
         }
         .member-document-body .summary-card span {
           color: #61758A;
         }
         .member-document-body .summary-card strong {
           color: #102A43;
         }
         .member-document-body .section-title {
           color: #415A77;
         }
         .member-document-body .table {
           border: 1px solid #D1DDE9;
           background: #FFFFFFD9;
           box-shadow: 0 8px 18px #102A430D;
         }
         .member-document-body .row {
           border-bottom-color: #DCE5EE;
         }
         .member-document-body .row span {
           color: #61758A;
         }
         .member-document-body .table .row:nth-child(even) {
           background: #F3F7FB;
         }
         .member-document-body .table .row:nth-child(3n) {
           background: #F7F8FF;
         }
         .member-document-body .row strong {
           color: #102A43;
         }
         .member-document-body .totals {
           border: 1px solid #C8D6E5;
           border-top: 4px solid #102A43;
           background: linear-gradient(145deg, #F8FAFD 0%, #EEF2F7 100%);
           color: #102A43;
           box-shadow: 0 10px 22px #102A4314;
         }
         .member-document-body .totals .row {
           border-color: #D4DFEA;
         }
         .member-document-body .totals .row span {
           color: #61758A;
         }
         .member-document-body .totals .row strong {
           color: #102A43;
         }
         .member-document-body .totals .row.emphasis {
           background: transparent;
         }
         .member-document-body .totals .final {
           border-top-color: #6D5AE6;
           background: #F0EEFF;
         }
         .member-document-body .totals .final span {
           color: #3C4773;
         }
         .member-document-body .totals .final strong {
           color: #4B3BB4;
         }
         .member-document-body .note {
           border: 1px solid #CCC8F2;
           border-left: 5px solid #6D5AE6;
           background: #F3F1FF;
           color: #61758A;
         }
         .member-document-body footer {
           border-top-color: #F7E967;
           color: #61758A;
         }
         .member-document-body footer span:last-child {
           color: #4B3BB4;
         }
         @media (max-width: 600px) {
           .member-document-body .page { padding: 24px 18px; }
           .member-document-body .header { padding: 20px; }
           .member-document-body .summary { gap: 11px; }
         }
      </style>
    </head>
    <body class="${audience === "member" ? "member-document-body" : "admin-document-body"}">
      <main class="page ${audience === "member" ? "member-document" : "admin-document"}">
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

function batchStatus(status: string) {
  return `<span class="batch-status ${status.toLowerCase()}">${escapeHtml(status.toUpperCase())}</span>`;
}

function buildAllBillsHtml(options: AllBillsPdfExportOptions) {
  const appName = options.appName ?? "Dishari Mess";
  const generatedAt = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const paymentByMember = new Map(options.payments.map((payment) => [payment.memberId, payment.amount]));
  const rows = options.bills.map((bill) => {
    const paymentAmount = paymentByMember.get(bill.memberId) ?? 0;
    const status = statusFor(bill, paymentAmount);
    const dueOrCredit = bill.dueAmount > 0 ? money(bill.dueAmount) : `Cr ${money(bill.creditBalance)}`;
    return `
      <tr>
        <td class="member-cell">${escapeHtml(bill.memberName)}</td>
        <td>${escapeHtml(String(bill.mealCount))}</td>
        <td>${escapeHtml(String(bill.eggCount))}</td>
        <td class="money-cell">${escapeHtml(money(bill.grossBill))}</td>
        <td class="money-cell advance">${escapeHtml(money(bill.totalAdvance))}</td>
        <td class="money-cell due">${escapeHtml(dueOrCredit)}</td>
        <td>${batchStatus(status)}</td>
      </tr>
    `;
  }).join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(appName)} · All bills · ${escapeHtml(monthLabel(options.month))}</title>
      <style>
        @page { size: A4 landscape; margin: 0; }
        * { box-sizing: border-box; }
        html { background: linear-gradient(135deg, #F3FBF8 0%, #F7F4FB 52%, #FFF9EE 100%); }
        body { margin: 0; color: ${COLORS.bistre}; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: linear-gradient(135deg, #F3FBF8 0%, #F7F4FB 52%, #FFF9EE 100%); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .sheet { width: 100vw; height: 100vh; max-height: 100vh; overflow: hidden; padding: 22px 28px; background: linear-gradient(180deg, #FFFEFC 0%, #FBFAFF 54%, #FFFDF5 100%); }
        .header { display: flex; align-items: center; justify-content: space-between; padding: 15px 20px; border-radius: 18px; color: ${COLORS.white}; background: linear-gradient(135deg, #6D5BD0 0%, #5F4BB6 58%, #4A372D 100%); box-shadow: 0 10px 20px #5F4BB626; }
        .brand { display: flex; align-items: center; gap: 11px; }
        .logo { width: 35px; height: 35px; display: grid; place-items: center; border-radius: 11px; background: linear-gradient(145deg, ${COLORS.aureolin}, #F4C95D); color: ${COLORS.bistre}; font-size: 18px; font-weight: 900; }
        h1 { margin: 0; font-size: 18px; letter-spacing: -.3px; }
        .sub { margin-top: 3px; color: #FFFFFFC7; font-size: 10px; }
        .meta { text-align: right; }
        .meta strong { display: block; font-size: 15px; }
        .meta span { display: block; margin-top: 3px; color: #FFFFFFC7; font-size: 10px; }
        .summary { display: flex; gap: 10px; margin: 13px 0; }
        .summary-card { flex: 1; padding: 9px 12px; border: 1px solid ${COLORS.line}; border-radius: 12px; background: #FFFEFC; box-shadow: 0 5px 12px #3D2B1F0C; }
        .summary-card:nth-child(1) { background: #FFF9E9; border-color: #FDE04766; }
        .summary-card:nth-child(2) { background: #F6F1FF; border-color: #C4B5FD70; }
        .summary-card:nth-child(3) { background: #FFF1F2; border-color: #FDA4AF70; }
        .summary-card span { color: ${COLORS.muted}; font-size: 9px; text-transform: uppercase; letter-spacing: .7px; }
        .summary-card strong { display: block; margin-top: 3px; color: ${COLORS.bistre}; font-size: 15px; }
        .table-wrap { overflow: hidden; border: 1px solid ${COLORS.line}; border-radius: 14px; background: #FFFFFFB8; box-shadow: 0 7px 14px #3D2B1F0C; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th { padding: 7px 9px; color: #FFFFFF; background: ${COLORS.bistre}; font-size: 8px; font-weight: 800; letter-spacing: .65px; text-align: left; text-transform: uppercase; }
        th:not(:first-child), td:not(:first-child) { text-align: right; }
        th:first-child, td:first-child { width: 30%; text-align: left; }
        th:nth-child(2), th:nth-child(3) { width: 9%; }
        th:nth-child(4), th:nth-child(5), th:nth-child(6) { width: 15%; }
        th:last-child { width: 13%; text-align: center; }
        td { padding: 6px 9px; border-bottom: 1px solid ${COLORS.line}; color: ${COLORS.muted}; font-size: 9px; line-height: 1.1; white-space: nowrap; }
        tr:nth-child(even) td { background: #F6F1FF38; }
        tr:last-child td { border-bottom: 0; }
        .member-cell { overflow: hidden; color: ${COLORS.bistre}; font-weight: 800; text-overflow: ellipsis; }
        .money-cell { color: ${COLORS.bistre}; font-weight: 700; }
        .advance { color: #16805F; }
        .due { color: ${COLORS.red}; }
        .batch-status { display: inline-block; min-width: 48px; padding: 3px 5px; border-radius: 999px; font-size: 7px; font-weight: 900; letter-spacing: .4px; text-align: center; }
        .batch-status.paid { color: #047857; background: ${COLORS.mint}; }
        .batch-status.partial { color: #92400E; background: #FEF3C7; }
        .batch-status.due { color: ${COLORS.red}; background: #FFE4E6; }
        footer { display: flex; justify-content: space-between; margin-top: 12px; padding-top: 8px; border-top: 2px solid #FDE04766; color: ${COLORS.muted}; font-size: 8px; }
        footer strong { color: ${COLORS.violet}; }
      </style>
    </head>
    <body>
      <main class="sheet">
        <header class="header">
          <div class="brand"><div class="logo">D</div><div><h1>${escapeHtml(appName)}</h1><div class="sub">Secure · Smart · Seamless</div></div></div>
          <div class="meta"><strong>All Members Billing Summary</strong><span>${escapeHtml(monthLabel(options.month))} · Admin copy</span></div>
        </header>
        <section class="summary">
          <div class="summary-card"><span>Members</span><strong>${options.bills.length}</strong></div>
          <div class="summary-card"><span>Total billed</span><strong>${money(options.bills.reduce((sum, bill) => sum + bill.grossBill, 0))}</strong></div>
          <div class="summary-card"><span>Total due</span><strong>${money(options.bills.reduce((sum, bill) => sum + bill.dueAmount, 0))}</strong></div>
        </section>
        <section class="table-wrap">
          <table>
            <thead><tr><th>Member</th><th>Meals</th><th>Eggs</th><th>Total bill</th><th>Advance</th><th>Due / Credit</th><th>Status</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="7">No bills available for this month.</td></tr>'}</tbody>
          </table>
        </section>
        <footer><span>Generated on ${generatedAt} · Values match the monthly billing records.</span><strong>${escapeHtml(appName)} · Admin summary</strong></footer>
      </main>
    </body>
  </html>`;
}

async function deliverPdfHtml(html: string, dialogTitle: string) {
  if (Platform.OS === "web") {
    // expo-print's web implementation ignores HTML and prints the current
    // route. Use a dedicated document so the invoice/summary is what prints.
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
      dialogTitle,
      UTI: "com.adobe.pdf",
    });
  } else {
    await Print.printAsync({ html });
  }
}

export async function exportMonthlyBillPdf(options: PdfExportOptions) {
  await deliverPdfHtml(
    buildHtml(options),
    `Download ${options.bill.memberName}'s bill`,
  );
}

export async function exportAllMonthlyBillsPdf(options: AllBillsPdfExportOptions) {
  await deliverPdfHtml(
    buildAllBillsHtml(options),
    `Download all bills · ${monthLabel(options.month)}`,
  );
}