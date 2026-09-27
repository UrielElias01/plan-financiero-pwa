/** Confirmed statement snapshot. The billed installment is already included in the current payment. */
export type BankStatementInstallment = {
  id: string;
  merchant: string;
  originalAmount: number;
  monthlyAmount: number;
  billedInstallment: number;
  totalInstallments: number;
  /** Principal deferred AFTER the billed installment; never add the billed installment again. */
  remainingBalance: number;
};

export type BankStatement = {
  id: string;
  issuer: "BBVA";
  periodStart: string;
  cutoffDate: string;
  dueDate: string;
  paymentToAvoidInterest: number;
  minimumPayment: number;
  totalDebt: number;
  installmentBalance: number;
  installments: BankStatementInstallment[];
  importedAt: string;
};

export type BBVAInstallmentDraft = { merchant: string } & Partial<Omit<BankStatementInstallment, "id" | "merchant">>;
export type BBVAStatementDraft = {
  periodStart: string;
  cutoffDate: string;
  dueDate: string;
  paymentToAvoidInterest?: number;
  minimumPayment?: number;
  totalDebt?: number;
  installmentBalance?: number;
  installments: BBVAInstallmentDraft[];
};

export type BBVAParseResult = { draft: BBVAStatementDraft; warnings: string[] };
