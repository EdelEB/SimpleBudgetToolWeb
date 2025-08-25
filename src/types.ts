// Types
export type FilingStatus = "single" | "married";
export type Timeframe = "year" | "month" | "biweek" | "week" | "day";

export type Bracket = {
  lower: number;
  upper: number | "INF";
  rate: number;
};

export type FederalTaxData = {
  brackets: Bracket[];
  standard_deduction?: number;
};

export type FicaTaxData = {
  oasdi_rate: number;
  oasdi_wage_base: number;
  medicare_rate: number;
  medicare_addl_threshold?: number;
  medicare_addl_rate?: number;
};

type StateNone = { type: "none" };
type StateFlat = { type: "flat"; rate: number; standard_deduction?: number };
type StateBrackets = {
  type: "brackets";
  brackets: Bracket[];
  standard_deduction?: number;
};
export type StateTaxSchema = StateNone | StateFlat | StateBrackets;

export type TaxRatesFile = {
  federal: FederalTaxData;
  fica: FicaTaxData;
  states: Record<string, StateTaxSchema>;
};

export type ExpenseBase = {
  id: string;
  name: string;
  color: string;
  amountAnnual: number;
};

export type UserExpense = ExpenseBase & {
  kind: "user";
  isPreTax: boolean;
  order?: number;
  inputTimeframe?: Timeframe;
  percentOfSalary?: number;
  percentOfPostTax?: number;
};

export type TaxExpense = ExpenseBase & {
  kind: "tax";
  taxKey: "federal" | "oasdi" | "medicare" | "medicare_addl" | "state";
};

export type DiscretionaryExpense = ExpenseBase & {
  kind: "discretionary";
};

export type AnyExpense = UserExpense | TaxExpense | DiscretionaryExpense;

export type BudgetSave = {
  version: number;
  salaryAnnual: number;
  filingStatus: FilingStatus;
  state: string;
  timeframe: Timeframe;
  userExpenses: UserExpense[];
  name?: string;
};