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
  /** "Pago mínimo + compras y cargos diferidos a meses": paying less makes the MSI generate interest. */
  minimumPlusInstallments?: number;
  creditLimit?: number;
  /** Annual ordinary rate printed on the statement, in percent and without VAT. */
  annualInterestRate?: number;
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
  minimumPlusInstallments?: number;
  creditLimit?: number;
  annualInterestRate?: number;
  installments: BBVAInstallmentDraft[];
};

/** A regular purchase listed in the statement. Payments, points and installment rows are excluded. */
export type StatementMovement = { date: string; description: string; amount: number };

export type BBVAParseResult = { draft: BBVAStatementDraft; warnings: string[]; movements?: StatementMovement[] };
