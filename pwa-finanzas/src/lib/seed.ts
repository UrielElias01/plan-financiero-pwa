import type { AppState, Period } from "./types";

export function dateInputValue(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export const today = dateInputValue();
export const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export function createPeriod(year: number, month: number, half: 1 | 2): Period {
  return {
    id: `${year}-${String(month).padStart(2, "0")}-h${half}`,
    month: monthNames[month - 1], label: `${half}a ${monthNames[month - 1].toLowerCase()} ${year}`,
    note: half === 1 ? "Del día 1 al 15." : "Del día 16 al último día del mes.",
    salary: 0, extraIncome: 0, partnerIncome: 0, rent: 0, debitServices: 0,
    foodCredit: 0, otherCredit: 0, chatGptCredit: 0, cardPayment: 0,
  };
}

export function cloneSeed(asOf = dateInputValue()): AppState {
  const [year, month, day] = asOf.split("-").map(Number);
  const periods: Period[] = [];
  for (let offset = 0; offset < 12; offset += 1) {
    const date = new Date(Date.UTC(year, month - 1 + offset, 1));
    if (offset !== 0 || day <= 15) periods.push(createPeriod(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
    periods.push(createPeriod(date.getUTCFullYear(), date.getUTCMonth() + 1, 2));
  }
  return {
    version: 4, updatedAt: new Date().toISOString(),
    settings: {
      openingSavings: 0, openingRentReserve: 0, openingCardDebt: 0,
      openingFoodReserve: 0, foodReserve: 0, monthlyFood: 0,
      balanceAsOf: asOf,
      nextPayday: `${year}-${String(month).padStart(2, "0")}-${String(day <= 15 ? 15 : new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`,
      openingCardPaymentMonth: asOf.slice(0, 7),
      currentSavings: 0, rentReserve: 0, salary: 0, monthlyRent: 0, defaultFood: 0,
      chatGpt: 0, cutoffDay: 3, dueDay: 25, previousCardDebt: 0, previousCardPayment: 0,
      pointsPayment: 0, newJulyPurchases: 0, nonRecurringBalance: 0, usedCreditBalance: 0,
    },
    periods, recurring: [], transactions: [], statements: [], cardCalendar: [],
    sync: { endpoint: "https://plan-financiero-sync.uriel-plan-financiero.workers.dev", syncId: "" },
  };
}

export const seedState: AppState = cloneSeed();
