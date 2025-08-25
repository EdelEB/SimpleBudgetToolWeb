import { useState } from 'react';
import { UserExpense, Timeframe, BudgetSave } from '../types';
import { toAnnual, generateId, DEFAULT_ROW_COLORS, sanitizeInput } from '../utils';

export function useBudgetActions(
  userExpenses: UserExpense[],
  setUserExpenses: React.Dispatch<React.SetStateAction<UserExpense[]>>,
  salaryAnnual: number,
  timeframe: Timeframe,
  postTaxBase: number,
  budgetName: string,
  filingStatus: string,
  stateName: string,
  applyLoaded: (data: BudgetSave) => void
) {
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showNewBudgetModal, setShowNewBudgetModal] = useState(false);

  // Add modal form state
  const [addForm, setAddForm] = useState<{
    name: string;
    color: string;
    isPreTax: boolean;
    defineBy: "amount" | "pctPreTax" | "pctPostTax";
    amount: number;
    amountTimeframe: Timeframe;
    percent: number;
  }>({
    name: "",
    color: DEFAULT_ROW_COLORS[0] + "80",
    isPreTax: false,
    defineBy: "amount",
    amount: 0,
    amountTimeframe: "month",
    percent: 0,
  });

  // Delete modal state
  const [deleteSelection, setDeleteSelection] = useState<Record<string, boolean>>({});

  // Edit handlers
  const handleEditName = (row: UserExpense, value: string) =>
    setUserExpenses((prev) => prev.map((x) => (x.id === row.id ? { ...x, name: value } : x)));

  const handleEditCost = (row: UserExpense, displayAmount: number) => {
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

  const handleEditPctOfSalary = (row: UserExpense, pctStr: string) => {
    const pctVal = Math.max(0, Number(pctStr) || 0) / 100;
    setUserExpenses((prev) =>
      prev.map((x) =>
        x.id === row.id
          ? { ...x, percentOfSalary: pctVal, percentOfPostTax: undefined, amountAnnual: salaryAnnual * pctVal }
          : x
      )
    );
  };

  const handleEditPctOfPostTax = (row: UserExpense, pctStr: string) => {
    if (row.isPreTax) return;
    const pctVal = Math.max(0, Number(pctStr) || 0) / 100;
    const annual = postTaxBase * pctVal;
    setUserExpenses((prev) =>
      prev.map((x) =>
        x.id === row.id
          ? { ...x, percentOfPostTax: pctVal, percentOfSalary: undefined, amountAnnual: annual }
          : x
      )
    );
  };

  const handleEditColor = (row: UserExpense, color: string) =>
    setUserExpenses((prev) => prev.map((x) => (x.id === row.id ? { ...x, color: color + "80" } : x)));

  const handleReorderExpenses = (srcId: string, targetId: string) => {
    setUserExpenses((prev) => {
      const pre = prev.filter((x) => x.isPreTax);
      const post = prev.filter((x) => !x.isPreTax);
      const sIdx = post.findIndex((x) => x.id === srcId);
      const tIdx = post.findIndex((x) => x.id === targetId);
      if (sIdx < 0 || tIdx < 0) return prev;
      const list = [...post];
      const [moved] = list.splice(sIdx, 1);
      list.splice(tIdx, 0, moved);
      list.forEach((x, i) => (x.order = i));
      return [...pre, ...list];
    });
  };

  // Add expense logic
  const openAddModal = () => {
    setAddForm({
      name: "",
      color: DEFAULT_ROW_COLORS[userExpenses.length % DEFAULT_ROW_COLORS.length] + "80",
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
      amountAnnual = postTaxBase * percentOfPostTax;
    }

    const newExp: UserExpense = {
      id: generateId(),
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

  // Delete logic
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

  // File operations
  const saveBudget = async () => {
    const payload: BudgetSave = {
      version: 1,
      salaryAnnual,
      filingStatus: filingStatus as any,
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
          suggestedName: `${sanitizeInput(budgetName) || "budget"}.json`,
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
    a.download = `${sanitizeInput(budgetName) || "budget"}.json`;
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
        try {
          const data = JSON.parse(text) as BudgetSave;
          applyLoaded(data);
        } catch (error) {
          alert('Invalid JSON file format. Please select a valid budget file.');
        }
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
      try {
        const text = await file.text();
        const data = JSON.parse(text) as BudgetSave;
        applyLoaded(data);
      } catch (error) {
        alert('Invalid JSON file format. Please select a valid budget file.');
      }
    };
    input.click();
  };

  return {
    // Modal states
    showAddModal,
    setShowAddModal,
    showDeleteModal,
    setShowDeleteModal,
    showNewBudgetModal,
    setShowNewBudgetModal,
    
    // Form states
    addForm,
    setAddForm,
    deleteSelection,
    
    // Handlers
    handleEditName,
    handleEditCost,
    handleEditPctOfSalary,
    handleEditPctOfPostTax,
    handleEditColor,
    handleReorderExpenses,
    
    // Actions
    openAddModal,
    addExpense,
    openDeleteModal,
    toggleDeleteSelect,
    performDelete,
    saveBudget,
    loadBudget,
  };
}