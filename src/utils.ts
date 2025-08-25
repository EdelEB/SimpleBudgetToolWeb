import { Timeframe, Bracket, FederalTaxData, StateTaxSchema, FicaTaxData } from './types';

// Constants
export const TF_FACTORS: Record<Timeframe, number> = {
  year: 1,
  month: 12,
  biweek: 26,
  week: 52,
  day: 365,
};

export const TAX_GREYS = {
  federal: "#64656680",
  oasdi: "#7b7e8380",
  medicare: "#9e9f9c80",
  medicare_addl: "#d4d4d480",
  state: "#57575780",
};

export const DISCRETIONARY_COLOR = "#2e7d3280";

export const DEFAULT_ROW_COLORS = [
  "#4F4680",
  "#0EA580",
  "#10B980",
  "#F59E80",
  "#EF4480",
  "#8B5C80",
  "#22C580",
  "#06B680",
  "#E11D80",
  "#84CC80",
];

// Utility functions
export function currencyRounded(n: number): string {
  const rounded = Math.round(n);
  return rounded.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function percentHundredth(p01: number): string {
  const val = isFinite(p01) ? p01 : 0;
  return `${(Math.round(val * 100)).toFixed(2)}%`;
}

export function toAnnual(amount: number, tf: Timeframe): number {
  return amount * TF_FACTORS[tf];
}

export function fromAnnual(amountAnnual: number, tf: Timeframe): number {
  return amountAnnual / TF_FACTORS[tf];
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

const colorCache = new Map<string, boolean>();

export function isDark(hex: string): boolean {
  if (colorCache.has(hex)) {
    return colorCache.get(hex)!;
  }
  
  const h = hex.replace("#", "");
  const v = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = (v >> 16) & 255,
    g = (v >> 8) & 255,
    b = v & 255;
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const result = l < 160;
  
  colorCache.set(hex, result);
  return result;
}

export function btnStyle(color: string, solid: boolean): React.CSSProperties {
  const dark = isDark(color);
  return {
    padding: "8px 12px",
    borderRadius: 8,
    border: solid ? "none" : `1px solid ${color}`,
    background: solid ? color : "#fff",
    color: solid ? (dark ? "#fff" : "#111827") : color,
    cursor: "pointer",
    fontWeight: 600,
  };
}

export const modalInput: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  background: "#fff",
};

// Tax calculation functions
export function computeTaxFromBrackets(taxable: number, brackets: Bracket[]): number {
  let tax = 0;
  const base = Math.max(0, taxable);
  for (const b of brackets) {
    const lower = b.lower;
    const upper = b.upper === "INF" ? Infinity : b.upper;
    if (base <= lower) break;
    const taxed = Math.min(base, upper) - lower;
    if (taxed > 0) tax += taxed * b.rate;
    if (base <= upper) break;
  }
  return Math.max(0, tax);
}

export function computeFederalTax(income: number, federal: FederalTaxData): number {
  const sd = federal.standard_deduction ?? 0;
  const taxable = Math.max(0, income - sd);
  return computeTaxFromBrackets(taxable, federal.brackets);
}

export function computeStateTax(income: number, stateSchema: StateTaxSchema | undefined): number {
  if (!stateSchema || stateSchema.type === "none") return 0;
  
  const sd = 'standard_deduction' in stateSchema ? stateSchema.standard_deduction ?? 0 : 0;
  const taxable = Math.max(0, income - sd);
  
  if (stateSchema.type === "flat") return taxable * stateSchema.rate;
  if (stateSchema.type === "brackets") return computeTaxFromBrackets(taxable, stateSchema.brackets);
  return 0;
}

export function computeFica(income: number, fica: FicaTaxData) {
  const base = Math.max(0, income);
  const oasdi = Math.min(base, fica.oasdi_wage_base) * fica.oasdi_rate;
  const medicare = base * fica.medicare_rate;
  
  let medicare_addl = 0;
  const addlThreshold = fica.medicare_addl_threshold;
  const addlRate = fica.medicare_addl_rate;
  
  if (addlThreshold && addlRate) {
    const excess = Math.max(0, base - addlThreshold);
    medicare_addl = excess * addlRate;
  }
  
  return { oasdi, medicare, medicare_addl };
}

// Input sanitization
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}