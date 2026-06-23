import type { AppState } from "./types";

export const today = new Date().toISOString().slice(0, 10);

export const seedState: AppState = {
  version: 1,
  updatedAt: new Date().toISOString(),
  settings: {
    currentSavings: 0,
    rentReserve: 0,
    salary: 0,
    monthlyRent: 0,
    defaultFood: 0,
    chatGpt: 0,
    cutoffDay: 3,
    dueDay: 25,
    previousCardDebt: 0,
    previousCardPayment: 0,
    pointsPayment: 0,
    newJulyPurchases: 0,
    nonRecurringBalance: 0,
    usedCreditBalance: 0,
  },
  periods: [
    {
      id: "2026-06-h2",
      month: "Junio",
      label: "2a junio",
      note: "Base actual. Importa tu respaldo privado o captura tus montos reales.",
      salary: 0,
      extraIncome: 0,
      partnerIncome: 0,
      rent: 0,
      debitServices: 0,
      foodCredit: 0,
      chatGptCredit: 0,
      cardPayment: 0,
      lockedBase: true,
    },
    {
      id: "2026-07-h1",
      month: "Julio",
      label: "1a julio",
      note: "Quincena financiada con el sueldo del 30 del mes anterior.",
      salary: 0,
      extraIncome: 0,
      partnerIncome: 0,
      rent: 0,
      debitServices: 0,
      foodCredit: 0,
      chatGptCredit: 0,
      cardPayment: 0,
    },
    {
      id: "2026-07-h2",
      month: "Julio",
      label: "2a julio",
      note: "Quincena financiada con el sueldo del 15. Aqui suele caer el pago de tarjeta.",
      salary: 0,
      extraIncome: 0,
      partnerIncome: 0,
      rent: 0,
      debitServices: 0,
      foodCredit: 0,
      chatGptCredit: 0,
      cardPayment: 0,
    },
  ],
  recurring: [],
  transactions: [],
  cardCalendar: [
    { month: "Junio", total: 0, userPart: 0, debt: 0 },
    { month: "Julio", total: 0, userPart: 0, debt: 0 },
    { month: "Agosto", total: 0, userPart: 0, debt: 0 },
    { month: "Septiembre", total: 0, userPart: 0, debt: 0 },
    { month: "Octubre", total: 0, userPart: 0, debt: 0 },
    { month: "Noviembre", total: 0, userPart: 0, debt: 0 },
  ],
  sync: {
    endpoint: "https://plan-financiero-sync.uriel-plan-financiero.workers.dev",
    syncId: "",
  },
};

export function cloneSeed(): AppState {
  return structuredClone(seedState);
}
