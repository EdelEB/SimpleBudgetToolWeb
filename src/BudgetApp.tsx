
import React, { useEffect, useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import singleRates from "./data/tax_rates_single.json";
import jointRates from "./data/tax_rates_joint.json";

// ---------------------------------------
// Types
// ---------------------------------------
type FilingStatus = "single" | "married";
type Timeframe = "year" | "month" | "biweek" | "week" | "day";

type Bracket = {
  lower: number;
  upper: number | "INF";
  rate: number;
};

type FederalTaxData = {
  brackets: Bracket[];
  standard_deduction?: number;
};

type FicaTaxData = {
  oasdi_rate: number;
  oasdi_wage_base: number;
  medicare_rate: number;
  medicare_addl_threshold?: number;
  medicare_addl_rate?: number;
  additional_medicare_threshold?: number;
  additional_medicare_rate?: number;
};

type StateNone = { type: "none" };
type StateFlat = { type: "flat"; rate: number; standard_deduction?: number };
type StateBrackets = {
  type: "brackets";
  brackets: Bracket[];
  standard_deduction?: number;
};
type StateTaxSchema = StateNone | StateFlat | StateBrackets;

type TaxRatesFile = {
  federal: FederalTaxData;
  fica: FicaTaxData;
  states: Record<string, StateTaxSchema>;
};

type ExpenseBase = {
  id: string;
  name: string;
  color: string;
  amountAnnual: number; // canonical annual dollars
};

type UserExpense = ExpenseBase & {
  kind: "user";
  isPreTax: boolean;
  order?: number; // only used for post-tax user expenses
  inputTimeframe?: Timeframe; // for display/edit
  percentOfSalary?: number; // 0-1 (pre-tax base = salary)
  percentOfPostTax?: number; // 0-1 (post-tax base)
};

type TaxExpense = ExpenseBase & {
  kind: "tax";
  taxKey: "federal" | "oasdi" | "medicare" | "medicare_addl" | "state";
};

type DiscretionaryExpense = ExpenseBase & {
  kind: "discretionary";
};

type AnyExpense = UserExpense | TaxExpense | DiscretionaryExpense;

type BudgetSave = {
  version: number;
  salaryAnnual: number;
  filingStatus: FilingStatus;
  state: string;
  timeframe: Timeframe;
  userExpenses: UserExpense[];
  name?: string;
};

// ---------------------------------------
// Constants and helpers
// ---------------------------------------
const TF_FACTORS: Record<Timeframe, number> = {
  year: 1,
  month: 12,
  biweek: 26,
  week: 52,
  day: 365,
};

const TAX_GREYS = {
  federal: "#4B5563",
  oasdi: "#6B7280",
  medicare: "#9CA3AF",
  medicare_addl: "#D1D5DB",
  state: "#575757ff",
};
const DISCRETIONARY_COLOR = "#2E7D32";

const DEFAULT_ROW_COLORS = [
  "#4F46E5",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#22C55E",
  "#06B6D4",
  "#E11D48",
  "#84CC16",
];

function currencyRounded(n: number): string {
  const rounded = Math.round(n);
  return rounded.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function percentHundredth(p01: number): string {
  const val = isFinite(p01) ? p01 : 0;
  return `${(Math.round(val * 10000) / 100).toFixed(2)}%`;
}

function toAnnual(amount: number, tf: Timeframe): number {
  return amount * TF_FACTORS[tf];
}

function fromAnnual(amountAnnual: number, tf: Timeframe): number {
  return amountAnnual / TF_FACTORS[tf];
}

function id(): string {
  return `id_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function computeTaxFromBrackets(taxable: number, brackets: Bracket[]): number {
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

function computeFederalTax(income: number, federal: FederalTaxData): number {
  const sd = federal.standard_deduction ?? 0;
  const taxable = Math.max(0, income - sd);
  return computeTaxFromBrackets(taxable, federal.brackets);
}

function computeStateTax(income: number, stateSchema: StateTaxSchema | undefined): number {
  if (!stateSchema) return 0;
  if (stateSchema.type === "none") return 0;
  const sd = (stateSchema as any).standard_deduction ?? 0;
  const taxable = Math.max(0, income - sd);
  if (stateSchema.type === "flat") return taxable * stateSchema.rate;
  if (stateSchema.type === "brackets") return computeTaxFromBrackets(taxable, stateSchema.brackets);
  return 0;
}

function computeFica(income: number, fica: FicaTaxData) {
  const base = Math.max(0, income);
  const oasdi = Math.min(base, fica.oasdi_wage_base) * fica.oasdi_rate;
  const medicare = base * fica.medicare_rate;
  const addlThreshold = fica.medicare_addl_threshold ?? fica.additional_medicare_threshold;
  const addlRate = fica.medicare_addl_rate ?? fica.additional_medicare_rate;
  let medicare_addl = 0;
  if (addlThreshold && addlRate) {
    const excess = Math.max(0, base - addlThreshold);
    medicare_addl = excess * addlRate;
  }
  return { oasdi, medicare, medicare_addl };
}

function isDark(hex: string): boolean {
  const h = hex.replace("#", "");
  const v = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = (v >> 16) & 255,
    g = (v >> 8) & 255,
    b = v & 255;
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return l < 160;
}

function btnStyle(color: string, solid: boolean): React.CSSProperties {
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

const modalInput: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  background: "#fff",
};

// ---------------------------------------
// Main Component
// ---------------------------------------
export default function SimpleBudgetTool(): JSX.Element {
  const [filingStatus, setFilingStatus] = useState<FilingStatus>("single");
  const [timeframe, setTimeframe] = useState<Timeframe>("month");
  const [salaryAnnual, setSalaryAnnual] = useState<number>(65000);
  const [budgetName, setBudgetName] = useState<string>("");

  const [userExpenses, setUserExpenses] = useState<UserExpense[]>([
    {
      id: id(),
      kind: "user",
      name: "Rent",
      color: "#feb537ab",
      isPreTax: false,
      inputTimeframe: "month",
      order: 0,
      amountAnnual: toAnnual(2000, "month"),
    },
    {
      id: id(),
      kind: "user",
      name: "Groceries",
      color: "#e3fb49c3",
      isPreTax: false,
      inputTimeframe: "month",
      order: 1,
      amountAnnual: toAnnual(400, "month"),
    },
  ]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Add modal form state
  const [addForm, setAddForm] = useState<{
    name: string;
    color: string;
    isPreTax: boolean;
    defineBy: "amount" | "pctPreTax" | "pctPostTax";
    amount: number;
    amountTimeframe: Timeframe;
    percent: number; // 0-100
  }>({
    name: "",
    color: DEFAULT_ROW_COLORS[0],
    isPreTax: false,
    defineBy: "amount",
    amount: 0,
    amountTimeframe: "month",
    percent: 0,
  });

  // Tax rates
  const rates: TaxRatesFile = filingStatus === "single" ? (singleRates as any) : (jointRates as any);
  const states = useMemo(() => Object.keys(rates.states || {}).sort(), [rates]);
  const [stateName, setStateName] = useState<string>(() =>
    states.includes("New Jersey") ? "New Jersey" : states[0] || "Alaska"
  );

  useEffect(() => {
    if (!states.includes(stateName)) {
      setStateName(states[0] || "Alaska");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filingStatus]);

  // Split user expenses for ordering
  const preTaxUser = useMemo(() => userExpenses.filter((e) => e.isPreTax), [userExpenses]);
  const postTaxUser = useMemo(
    () => userExpenses.filter((e) => !e.isPreTax).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [userExpenses]
  );

  // Core calculations
  const calc = useMemo(() => {
    const salary = Math.max(0, salaryAnnual);

    // Resolve pre-tax user if percentOfSalary set
    const preTaxResolved = preTaxUser.map((e) => {
      const amt = typeof e.percentOfSalary === "number" ? salary * e.percentOfSalary : e.amountAnnual;
      return { ...e, amountAnnual: amt };
    });

    const preTaxTotal = preTaxResolved.reduce((s, e) => s + Math.max(0, e.amountAnnual), 0);

    // Taxable income
    const taxableIncome = Math.max(0, salary - preTaxTotal);

    // Taxes
    const federal = computeFederalTax(taxableIncome, rates.federal);
    const fica = computeFica(taxableIncome, rates.fica);
    const stateTax = computeStateTax(taxableIncome, rates.states[stateName]);

    const taxExpenses: TaxExpense[] = [
      { id: "tax_federal", kind: "tax", taxKey: "federal", name: "Federal Income Tax", color: TAX_GREYS.federal, amountAnnual: federal },
      { id: "tax_oasdi", kind: "tax", taxKey: "oasdi", name: "FICA (OASDI)", color: TAX_GREYS.oasdi, amountAnnual: fica.oasdi },
      { id: "tax_medicare", kind: "tax", taxKey: "medicare", name: "Medicare", color: TAX_GREYS.medicare, amountAnnual: fica.medicare },
    ];
    if (fica.medicare_addl > 0) {
      taxExpenses.push({
        id: "tax_medicare_addl",
        kind: "tax",
        taxKey: "medicare_addl",
        name: "Additional Medicare",
        color: TAX_GREYS.medicare_addl,
        amountAnnual: fica.medicare_addl,
      });
    }
    taxExpenses.push({
      id: "tax_state",
      kind: "tax",
      taxKey: "state",
      name: `${stateName} Income Tax`,
      color: TAX_GREYS.state,
      amountAnnual: stateTax,
    });

    const totalTaxes = taxExpenses.reduce((s, t) => s + t.amountAnnual, 0);

    // Post-tax base
    const postTaxBase = Math.max(0, salary - preTaxTotal - totalTaxes);

    // Resolve post-tax user (percent links)
    const postTaxResolved = postTaxUser.map((e) => {
      let amt = e.amountAnnual;
      if (typeof e.percentOfPostTax === "number") {
        amt = postTaxBase * e.percentOfPostTax;
      } else if (typeof e.percentOfSalary === "number") {
        amt = salary * e.percentOfSalary;
      }
      return { ...e, amountAnnual: amt };
    });

    // Discretionary
    const postTaxUserTotal = postTaxResolved.reduce((s, e) => s + Math.max(0, e.amountAnnual), 0);
    const discretionaryAmount = Math.max(0, postTaxBase - postTaxUserTotal);
    const discretionary: DiscretionaryExpense = {
      id: "discretionary",
      kind: "discretionary",
      name: "Discretionary Income",
      color: DISCRETIONARY_COLOR,
      amountAnnual: discretionaryAmount,
    };

    const tableRows: AnyExpense[] = [...preTaxResolved, ...taxExpenses, ...postTaxResolved, discretionary];

    return {
      salary,
      preTaxTotal,
      taxableIncome,
      taxes: taxExpenses,
      postTaxBase,
      postTaxUserTotal,
      discretionary,
      rows: tableRows,
    };
  }, [salaryAnnual, preTaxUser, postTaxUser, rates, stateName]);

  // Pie series
  const pieData = useMemo(
    () =>
      calc.rows
        .filter((r) => r.amountAnnual > 0)
        .map((r) => ({
          id: r.id,
          name: r.name,
          value: Math.round(fromAnnual(r.amountAnnual, timeframe)),
          color: r.color,
        })),
    [calc.rows, timeframe]
  );

  // Drag-and-drop for post-tax user rows (reorder)
  const dragId = useRef<string | null>(null);
  const onDragStart = (row: AnyExpense, e: React.DragEvent) => {
    if (row.kind === "user" && !row.isPreTax) {
      dragId.current = row.id;
      e.dataTransfer.effectAllowed = "move";
    }
  };
  const onDragOver = (row: AnyExpense, e: React.DragEvent) => {
    if (row.kind === "user" && !row.isPreTax) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  };
  const onDrop = (target: AnyExpense, e: React.DragEvent) => {
    e.preventDefault();
    const srcId = dragId.current;
    dragId.current = null;
    if (!srcId) return;
    if (!(target.kind === "user" && !target.isPreTax)) return;

    setUserExpenses((prev) => {
      const pre = prev.filter((x) => x.isPreTax);
      const post = prev.filter((x) => !x.isPreTax);
      const sIdx = post.findIndex((x) => x.id === srcId);
      const tIdx = post.findIndex((x) => x.id === target.id);
      if (sIdx < 0 || tIdx < 0) return prev;
      const list = [...post];
      const [moved] = list.splice(sIdx, 1);
      list.splice(tIdx, 0, moved);
      list.forEach((x, i) => (x.order = i));
      return [...pre, ...list];
    });
  };

  const DragHandle: React.FC<{ row: AnyExpense; muted?: boolean }> = ({ row, muted }) => {
    const enabled = row.kind === "user" && !row.isPreTax;
    const style: React.CSSProperties = {
      width: 14,
      display: "inline-flex",
      cursor: enabled ? "grab" : "default",
      opacity: enabled ? (muted ? 0.6 : 0.95) : 0.25,
      userSelect: "none",
    };
    return (
      <span
        role="img"
        aria-label="drag"
        draggable={enabled}
        onDragStart={(e) => enabled && onDragStart(row, e)}
        onDragOver={(e) => enabled && onDragOver(row, e)}
        onDrop={(e) => enabled && onDrop(row, e)}
        style={style}
        title={enabled ? "Drag to reorder post-tax expenses" : undefined}
      >
        ⋮⋮
      </span>
    );
  };

  // Edit handlers (user rows only)
  const editName = (row: UserExpense, value: string) =>
    setUserExpenses((prev) => prev.map((x) => (x.id === row.id ? { ...x, name: value } : x)));

  const editCost = (row: UserExpense, displayAmount: number) => {
    const amt = Math.max(0, Math.round(displayAmount) || 0);
    const annual = toAnnual(amt, timeframe);
    setUserExpenses((prev) =>
      prev.map((x) =>
        x.id === row.id
          ? { ...x, amountAnnual: annual, percentOfSalary: undefined, percentOfPostTax: undefined }
          : x
      )
    );
  };

  const editPctOfSalary = (row: UserExpense, pctStr: string) => {
    const pctVal = Math.max(0, Number(pctStr) || 0) / 100;
    setUserExpenses((prev) =>
      prev.map((x) =>
        x.id === row.id
          ? { ...x, percentOfSalary: pctVal, percentOfPostTax: undefined, amountAnnual: salaryAnnual * pctVal }
          : x
      )
    );
  };

  const editPctOfPostTax = (row: UserExpense, pctStr: string) => {
    if (row.isPreTax) return;
    const pctVal = Math.max(0, Number(pctStr) || 0) / 100;
    const annual = calc.postTaxBase * pctVal;
    setUserExpenses((prev) =>
      prev.map((x) =>
        x.id === row.id
          ? { ...x, percentOfPostTax: pctVal, percentOfSalary: undefined, amountAnnual: annual }
          : x
      )
    );
  };

  // Add modal logic
  const openAddModal = () => {
    setAddForm({
      name: "",
      color: DEFAULT_ROW_COLORS[userExpenses.length % DEFAULT_ROW_COLORS.length],
      isPreTax: false,
      defineBy: "amount",
      amount: 0,
      amountTimeframe: timeframe,
      percent: 0,
    });
    setShowAddModal(true);
  };

  const addExpense = () => {
    const name = addForm.name.trim() || "New expense";
    let amountAnnual = 0;
    let percentOfSalary: number | undefined;
    let percentOfPostTax: number | undefined;

    if (addForm.defineBy === "amount") {
      amountAnnual = toAnnual(Math.max(0, Math.round(addForm.amount) || 0), addForm.amountTimeframe);
    } else if (addForm.defineBy === "pctPreTax") {
      percentOfSalary = Math.max(0, addForm.percent) / 100;
      amountAnnual = salaryAnnual * percentOfSalary;
    } else {
      percentOfPostTax = Math.max(0, addForm.percent) / 100;
      amountAnnual = calc.postTaxBase * percentOfPostTax;
    }

    const newExp: UserExpense = {
      id: id(),
      kind: "user",
      name,
      color: addForm.color,
      isPreTax: addForm.isPreTax,
      inputTimeframe: addForm.amountTimeframe,
      amountAnnual,
      percentOfSalary,
      percentOfPostTax: addForm.isPreTax ? undefined : percentOfPostTax,
      order: addForm.isPreTax ? undefined : userExpenses.filter((e) => !e.isPreTax).length,
    };

    setUserExpenses((prev) => [...prev, newExp]);
    setShowAddModal(false);
  };

  // Delete modal logic
  const [deleteSelection, setDeleteSelection] = useState<Record<string, boolean>>({});
  const openDeleteModal = () => {
    const init: Record<string, boolean> = {};
    userExpenses.forEach((e) => (init[e.id] = false));
    setDeleteSelection(init);
    setShowDeleteModal(true);
  };
  const toggleDeleteSelect = (id: string) => {
    setDeleteSelection((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const performDelete = () => {
    const ids = new Set(Object.keys(deleteSelection).filter((k) => deleteSelection[k]));
    setUserExpenses((prev) => prev.filter((e) => !ids.has(e.id)));
    setShowDeleteModal(false);
  };

  // Save / Load / New
  const saveBudget = async () => {
    const payload: BudgetSave = {
      version: 1,
      salaryAnnual,
      filingStatus,
      state: stateName,
      timeframe,
      userExpenses,
      name: budgetName || undefined,
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });

    // @ts-ignore
    if (window.showSaveFilePicker) {
      try {
        // @ts-ignore
        const handle = await window.showSaveFilePicker({
          suggestedName: `${budgetName || "budget"}.json`,
          types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch {
        // ignore and fallback
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${budgetName || "budget"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const loadBudget = async () => {
    // @ts-ignore
    if (window.showOpenFilePicker) {
      try {
        // @ts-ignore
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
        });
        const file = await handle.getFile();
        const text = await file.text();
        const data = JSON.parse(text) as BudgetSave;
        applyLoaded(data);
        return;
      } catch {
        // ignore and fallback
      }
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const data = JSON.parse(text) as BudgetSave;
      applyLoaded(data);
    };
    input.click();
  };

  const applyLoaded = (data: BudgetSave) => {
    setSalaryAnnual(Math.max(0, Number(data.salaryAnnual) || 0));
    setFilingStatus((data.filingStatus as FilingStatus) || "single");
    setStateName(data.state || stateName);
    setTimeframe((data.timeframe as Timeframe) || "month");
    setBudgetName(data.name || "");
    setUserExpenses(
      (data.userExpenses || []).map((x) => ({
        ...x,
        amountAnnual: Math.max(0, Number(x.amountAnnual) || 0),
        percentOfSalary: typeof x.percentOfSalary === "number" ? x.percentOfSalary : undefined,
        percentOfPostTax: typeof x.percentOfPostTax === "number" ? x.percentOfPostTax : undefined,
        order: x.isPreTax ? undefined : x.order ?? 0,
      }))
    );
  };

  const newBudget = () => {
    setBudgetName("");
    setSalaryAnnual(100000);
    setFilingStatus("single");
    setStateName(states.includes("New Jersey") ? "New Jersey" : states[0] || "Alaska");
    setTimeframe("month");
    setUserExpenses([]);
  };

  // UI helpers
  const headerCell: React.CSSProperties = {
    textAlign: "left",
    padding: "10px 12px",
    borderBottom: "1px solid #e5e7eb",
    fontWeight: 700,
    whiteSpace: "nowrap",
  };
  const cellBase: React.CSSProperties = {
    padding: "8px 12px",
    verticalAlign: "middle",
  };

  // Layout palette
  const bgApp = "#ffffff"; // page background (distinct from components)
  const cardBg = "#f7f9fc";
  const border = "1px solid #e5e7eb";
  const muted = "#4b5563";

  return (
    <div style={{ background: bgApp, minHeight: "100vh", padding: "24px 0" }}>
      <div style={{ width: "66.666%", margin: "0 auto" }}>
        {/* Title */}
        <h1 style={{ textAlign: "center", margin: "0 0 16px 0" }}>Simple Budget Tool</h1>

        {/* Action Bar 1 */}
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            justifyContent: "center",
            background: cardBg,
            border,
            borderRadius: 10,
            padding: 12,
            marginBottom: 10,
          }}
        >
          <input
            value={budgetName}
            onChange={(e) => setBudgetName(e.target.value)}
            placeholder="Budget name (optional)"
            style={{
              padding: "8px 10px",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              minWidth: 260,
              background: "#fff",
            }}
          />
          <button className="btn" onClick={saveBudget} style={btnStyle("#111827", true)}>
            Save Budget
          </button>
          <button className="btn" onClick={loadBudget} style={btnStyle("#374151", true)}>
            Load Budget
          </button>
          <button className="btn" onClick={newBudget} style={btnStyle("#1a73e8", true)}>
            New Budget
          </button>
        </div>

        {/* Action Bar 2 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
            gap: 12,
            background: cardBg,
            border,
            borderRadius: 10,
            padding: 12,
            marginBottom: 16,
          }}
        >
          {/* Salary (annual) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ color: muted, fontSize: 12 }}>Salary (annual)</label>
            <input
              type="number"
              min={0}
              step={1000}
              value={Math.round(salaryAnnual)}
              onChange={(e) => {
                const val = Math.max(0, Math.round(Number(e.target.value) || 0));
                setSalaryAnnual(val);
                // keep % of salary user expenses in sync
                setUserExpenses((prev) =>
                  prev.map((x) =>
                    typeof x.percentOfSalary === "number"
                      ? { ...x, amountAnnual: val * x.percentOfSalary }
                      : x
                  )
                );
              }}
              style={{
                padding: "8px 10px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                background: "#fff",
              }}
            />
          </div>

          {/* Filing Status */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ color: muted, fontSize: 12 }}>Filing status</label>
            <select
              value={filingStatus}
              onChange={(e) => setFilingStatus(e.target.value as FilingStatus)}
              style={{
                padding: "8px 10px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                background: "#fff",
              }}
            >
              <option value="single">Single</option>
              <option value="married">Married filing jointly</option>
            </select>
          </div>

          {/* State */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ color: muted, fontSize: 12 }}>State</label>
            <select
              value={stateName}
              onChange={(e) => setStateName(e.target.value)}
              style={{
                padding: "8px 10px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                background: "#fff",
              }}
            >
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Timeline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ color: muted, fontSize: 12 }}>Timeline</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as Timeframe)}
              style={{
                padding: "8px 10px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                background: "#fff",
              }}
            >
              <option value="year">Year</option>
              <option value="month">Month</option>
              <option value="biweek">Bi-week</option>
              <option value="week">Week</option>
              <option value="day">Day</option>
            </select>
          </div>

          {/* Add + Delete buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <button className="btn" onClick={openAddModal} style={btnStyle("#1a73e8", true)}>
              Add Expense
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <button className="btn" onClick={openDeleteModal} style={btnStyle("#b00020", true)}>
              Delete
            </button>
          </div>
        </div>

        {/* Main content: table left, pie right */}
        <div style={{ width:"115%", display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, alignItems: "start" }}>
          {/* Table */}
          <div style={{ background: cardBg, border, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "70%", borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: 240 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 140 }} />
                  <col style={{ width: 200 }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "#e5e7eb" }}>
                    <th style={headerCell}>Expense</th>
                    <th style={headerCell}>Cost ({timeframe})</th>
                    <th style={headerCell}>% of Salary</th>
                    <th style={headerCell}>% of Post-Tax Salary</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.rows.map((row) => {
                    const textColor = "#000000ff";
                    const borderRow = "rgba(39, 39, 41, 0.82)";
                    const isUser = row.kind === "user";
                    const userRow = isUser ? (row as UserExpense) : undefined;

                    const costDisplay = Math.round(fromAnnual(row.amountAnnual, timeframe));
                    const pctSalary = calc.salary > 0 ? (row.amountAnnual / calc.salary) * 100 : 0;
                    const pctPostTax = calc.postTaxBase > 0 ? (row.amountAnnual / calc.postTaxBase) * 100 : 0;

                    return (
                      <tr key={row.id}>
                        {/* Expense */}
                        <td
                          style={{
                            ...cellBase,
                            background: row.color,
                            color: textColor,
                            borderBottom: `1px solid ${borderRow}`,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <DragHandle row={row} />
                            {isUser ? (
                              <input
                                value={userRow!.name}
                                onChange={(e) => editName(userRow!, e.target.value)}
                                style={{
                                  background: "transparent",
                                  border: `1px solid ${borderRow}`,
                                  borderRadius: 6,
                                  padding: "6px 8px",
                                  color: textColor,
                                  width: "100%",
                                  minWidth: 120,
                                }}
                              />
                            ) : (
                              <span style={{ fontWeight: 600 }}>{row.name}</span>
                            )}
                          </div>
                        </td>

                        {/* Cost */}
                        <td
                          style={{
                            ...cellBase,
                            background: row.color,
                            color: textColor,
                            borderBottom: `1px solid ${borderRow}`,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {isUser ? (
                              <input
                                type="number"
                                step={1}
                                min={0}
                                value={costDisplay}
                                onChange={(e) => editCost(userRow!, Number(e.target.value))}
                                style={{
                                  background: "transparent",
                                  border: `1px solid ${borderRow}`,
                                  borderRadius: 6,
                                  padding: "6px 8px",
                                  color: textColor,
                                  width: 100,
                                }}
                              />
                            ) : (
                              <span style={{ whiteSpace: "nowrap" }}>{currencyRounded(costDisplay)}</span>
                            )}
                          </div>
                        </td>

                        {/* % of Salary */}
                        <td
                          style={{
                            ...cellBase,
                            background: row.color,
                            color: textColor,
                            borderBottom: `1px solid ${borderRow}`,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {isUser ? (
                              <>
                                <input
                                  type="number"
                                  step={0.01}
                                  min={0}
                                  value={Number.isFinite(pctSalary) ? Number(pctSalary.toFixed(2)) : 0}
                                  onChange={(e) => editPctOfSalary(userRow!, e.target.value)}
                                  style={{
                                    background: "transparent",
                                    border: `1px solid ${borderRow}`,
                                    borderRadius: 6,
                                    padding: "6px 8px",
                                    color: textColor,
                                    width: 75,
                                  }}
                                />
                                <span>%</span>
                              </>
                            ) : (
                              <span style={{ whiteSpace: "nowrap" }}>{percentHundredth(pctSalary / 100)}</span>
                            )}
                          </div>
                        </td>

                        {/* % of Post-Tax Salary */}
                        <td
                          style={{
                            ...cellBase,
                            background: row.color,
                            color: textColor,
                            borderBottom: `1px solid ${borderRow}`,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {isUser && !userRow!.isPreTax ? (
                              <>
                                <input
                                  type="number"
                                  step={0.01}
                                  min={0}
                                  value={Number.isFinite(pctPostTax) ? Number(pctPostTax.toFixed(2)) : 0}
                                  onChange={(e) => editPctOfPostTax(userRow!, e.target.value)}
                                  style={{
                                    background: "transparent",
                                    border: `1px solid ${borderRow}`,
                                    borderRadius: 6,
                                    padding: "6px 8px",
                                    color: textColor,
                                    width: 75,
                                  }}
                                />
                                <span>%</span>
                              </>
                            ) : (
                              <span style={{ whiteSpace: "nowrap" }}>{percentHundredth(pctPostTax / 100)}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pie chart and tax rates */}
          <div style={{ width: "70%", background: cardBg, border, borderRadius: 12, padding: 8 }}>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius="95%" isAnimationActive={false}>
                    {pieData.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any) => {
                      const total = pieData.reduce((s, d) => s + d.value, 0) || 1;
                      const pct = ((value as number) / total) * 100;
                      return [`${currencyRounded(value as number)} • ${percentHundredth(pct / 100)}`, name];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Tax rates used */}
            <div
              style={{
                marginTop: 12,
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 8,
              }}
            >
              <h3 style={{fontSize: 11, margin: "0 0 8px 0" }}>Tax rates in use:</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                <div>
                  <div style={{fontSize: 11, fontWeight: 700, marginBottom: 6}}>Federal brackets</div>
                  <ul style={{ fontSize: 10, margin: 0, paddingLeft: 18 }}>
                    {rates.federal.brackets.map((b, i) => (
                      <li key={`fed-${i}`}>
                        {(b.rate * 100).toFixed(2)}%: {currencyRounded(b.lower)} –{" "}
                        {b.upper === "INF" ? "∞" : currencyRounded(b.upper as number)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div style={{fontSize: 11, fontWeight: 700, marginBottom: 6 }}>FICA</div>
                  <ul style={{fontSize: 10, margin: 0, paddingLeft: 18 }}>
                    <li>
                      OASDI: {(rates.fica.oasdi_rate * 100).toFixed(2)}% up to{" "}
                      {currencyRounded(rates.fica.oasdi_wage_base)}
                    </li>
                    <li>Medicare: {(rates.fica.medicare_rate * 100).toFixed(2)}%</li>
                    {(rates.fica.medicare_addl_threshold ?? rates.fica.additional_medicare_threshold) &&
                      (rates.fica.medicare_addl_rate ?? rates.fica.additional_medicare_rate) && (
                        <li>
                          Additional Medicare:{" "}
                          {(
                            ((rates.fica.medicare_addl_rate ?? rates.fica.additional_medicare_rate) as number) * 100
                          ).toFixed(2)}
                          % over{" "}
                          {currencyRounded(
                            (rates.fica.medicare_addl_threshold ?? rates.fica.additional_medicare_threshold) as number
                          )}
                        </li>
                      )}
                  </ul>
                </div>
                <div>
                  <div style={{fontSize: 11, fontWeight: 700, marginBottom: 6 }}>State: {stateName}</div>
                  {(() => {
                    const st = rates.states[stateName];
                    if (!st || st.type === "none") return <div style={{fontSize: 10}}>No state income tax</div>;
                    if (st.type === "flat") return <div style={{fontSize: 10}}>Flat rate: {(st.rate * 100).toFixed(2)}%</div>;
                    if (st.type === "brackets")
                      return (
                        <ul style={{fontSize: 10, margin: 0, paddingLeft: 18 }}>
                          {st.brackets.map((b, i) => (
                            <li key={`state-${i}`}>
                              {(b.rate * 100).toFixed(2)}%: {currencyRounded(b.lower)} –{" "}
                              {b.upper === "INF" ? "∞" : currencyRounded(b.upper as number)}
                            </li>
                          ))}
                        </ul>
                      );
                    return null;
                  })()}
                </div>
              </div>
            </div>

            {/* subtle summary */}
            <div style={{ marginTop: 8, color: muted, fontSize: 12 }}>
              Taxable income: <strong>{currencyRounded(calc.taxableIncome)}</strong>
            </div>
            <div style={{ marginTop: 8, color: muted, fontSize: 12 }}>
              Post-tax income: <strong>{currencyRounded(calc.postTaxBase)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)} title="Add expense">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label>Name</label>
              <input
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Utilities"
                style={modalInput}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label>Color</label>
              <input
                type="color"
                value={addForm.color}
                onChange={(e) => setAddForm((f) => ({ ...f, color: e.target.value }))}
                style={{ ...modalInput, padding: 0, height: 40 }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label>Category</label>
              <select
                value={addForm.isPreTax ? "pretax" : "posttax"}
                onChange={(e) => {
                  const isPreTax = e.target.value === "pretax";
                  setAddForm((f) => ({
                    ...f,
                    isPreTax,
                    defineBy: isPreTax && f.defineBy === "pctPostTax" ? "pctPreTax" : f.defineBy,
                  }));
                }}
                style={modalInput}
              >
                <option value="pretax">Pre-tax</option>
                <option value="posttax">Post-tax</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label>Define by</label>
              <select
                value={addForm.defineBy}
                onChange={(e) =>
                  setAddForm((f) => {
                    const v = e.target.value as typeof f.defineBy;
                    return { ...f, defineBy: f.isPreTax && v === "pctPostTax" ? "pctPreTax" : v };
                  })
                }
                style={modalInput}
              >
                <option value="amount">Amount</option>
                <option value="pctPreTax">% of pre-tax salary</option>
                <option value="pctPostTax" disabled={addForm.isPreTax}>
                  % of post-tax salary
                </option>
              </select>
            </div>

            {addForm.defineBy === "amount" ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label>Amount</label>
                  <input
                    type="number"
                    min={0}
                    value={addForm.amount}
                    onChange={(e) => setAddForm((f) => ({ ...f, amount: Number(e.target.value) || 0 }))}
                    placeholder="e.g., 150"
                    style={modalInput}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label>Timeframe</label>
                  <select
                    value={addForm.amountTimeframe}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, amountTimeframe: e.target.value as Timeframe }))
                    }
                    style={modalInput}
                  >
                    <option value="year">Year</option>
                    <option value="month">Month</option>
                    <option value="biweek">Bi-week</option>
                    <option value="week">Week</option>
                    <option value="day">Day</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label>Percent</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={addForm.percent}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, percent: Math.max(0, Number(e.target.value) || 0) }))
                    }
                    placeholder="e.g., 5"
                    style={modalInput}
                  />
                </div>
                <div />
              </>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <button onClick={() => setShowAddModal(false)} style={btnStyle("#555759ff", false)}>
              Cancel
            </button>
            <button onClick={addExpense} style={btnStyle("#1a73e8", true)}>
              Add
            </button>
          </div>
        </Modal>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <Modal onClose={() => setShowDeleteModal(false)} title="Delete expenses">
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflow: "auto" }}>
            {userExpenses.length === 0 && <div style={{ color: "#6b7280" }}>No user expenses to delete.</div>}
            {userExpenses.map((e) => (
              <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={!!deleteSelection[e.id]}
                  onChange={() => toggleDeleteSelect(e.id)}
                />
                <span
                  style={{
                    width: 14,
                    height: 14,
                    background: e.color,
                    borderRadius: 3,
                    border: "1px solid #e5e7eb",
                    display: "inline-block",
                  }}
                />
                <span>{e.name}</span>
                <span style={{ marginLeft: "auto", color: "#6b7280" }}>
                  {currencyRounded(fromAnnual(e.amountAnnual, timeframe))}
                  /{timeframe}
                </span>
              </label>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <button onClick={() => setShowDeleteModal(false)} style={btnStyle("#555759ff", false)}>
              Cancel
            </button>
            <button onClick={performDelete} style={btnStyle("#b00020", true)}>
              Delete selected
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------
// Modal component
// ---------------------------------------
function Modal({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17,24,39,0.45)",
        display: "flex",
        alignItems
                : "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#f7f9fc",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          minWidth: 520,
          maxWidth: 720,
          width: "90%",
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: 12,
            borderBottom: "1px solid #e5e7eb",
            background: "#fff",
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
          <button
            aria-label="Close"
            onClick={onClose}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              padding: 6,
              lineHeight: 1,
              color: "#374151",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 14 }}>{children}</div>
      </div>
    </div>
  );
}
