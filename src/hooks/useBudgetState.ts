import { useState, useMemo, useEffect } from 'react';
import { FilingStatus, Timeframe, UserExpense, TaxRatesFile, BudgetSave } from '../types';
import { toAnnual, generateId, sanitizeInput } from '../utils';
import singleRates from '../data/tax_rates_single.json';
import jointRates from '../data/tax_rates_joint.json';

export function useBudgetState() {
  const [filingStatus, setFilingStatus] = useState<FilingStatus>("single");
  const [timeframe, setTimeframe] = useState<Timeframe>("month");
  const [salaryAnnual, setSalaryAnnual] = useState<number>(65000);
  const [budgetName, setBudgetName] = useState<string>("");

  const [userExpenses, setUserExpenses] = useState<UserExpense[]>([
    {
      id: generateId(),
      kind: "user",
      name: "Rent",
      color: "#feb53780",
      isPreTax: false,
      inputTimeframe: "month",
      order: 0,
      amountAnnual: toAnnual(2000, "month"),
    },
    {
      id: generateId(),
      kind: "user",
      name: "Groceries",
      color: "#e3fb4980",
      isPreTax: false,
      inputTimeframe: "month",
      order: 1,
      amountAnnual: toAnnual(400, "month"),
    },
  ]);

  const rates: TaxRatesFile = filingStatus === "single" ? (singleRates as any) : (jointRates as any);
  const states = useMemo(() => Object.keys(rates.states || {}).sort(), [rates]);
  const [stateName, setStateName] = useState<string>(() =>
    states.includes("New Jersey") ? "New Jersey" : states[0] || "Alaska"
  );

  useEffect(() => {
    if (!states.includes(stateName)) {
      setStateName(states[0] || "Alaska");
    }
  }, [filingStatus, states, stateName]);

  const preTaxUser = useMemo(() => userExpenses.filter((e) => e.isPreTax), [userExpenses]);
  const postTaxUser = useMemo(
    () => userExpenses.filter((e) => !e.isPreTax).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [userExpenses]
  );

  const applyLoaded = (data: BudgetSave) => {
    setSalaryAnnual(Math.max(0, Number(data.salaryAnnual) || 0));
    setFilingStatus((data.filingStatus as FilingStatus) || "single");
    setStateName(data.state || stateName);
    setTimeframe((data.timeframe as Timeframe) || "month");
    setBudgetName(sanitizeInput(data.name || ""));
    setUserExpenses(
      (data.userExpenses || []).map((x) => ({
        ...x,
        name: sanitizeInput(x.name || ""),
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

  return {
    filingStatus,
    setFilingStatus,
    timeframe,
    setTimeframe,
    salaryAnnual,
    setSalaryAnnual,
    budgetName,
    setBudgetName,
    userExpenses,
    setUserExpenses,
    rates,
    states,
    stateName,
    setStateName,
    preTaxUser,
    postTaxUser,
    applyLoaded,
    newBudget,
  };
}