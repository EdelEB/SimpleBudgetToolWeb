import React, { useMemo, useState, useEffect } from "react";
import { Timeframe, FilingStatus } from './types';
import { btnStyle, modalInput, sanitizeInput, fromAnnual, currencyRounded } from './utils';
import { useBudgetCalculations } from './hooks/useBudgetCalculations';
import { useBudgetState } from './hooks/useBudgetState';
import { useBudgetActions } from './hooks/useBudgetActions';
import { BudgetTable } from './components/BudgetTable';
import { PieChartSection } from './components/PieChartSection';
import { Modal } from './components/Modal';

export default function SimpleBudgetTool() {
  const budgetState = useBudgetState();
  const {
    filingStatus,
    setFilingStatus,
    timeframe,
    setTimeframe,
    salaryAnnual,
    setSalaryAnnual,
    budgetName,
    userExpenses,
    setUserExpenses,
    rates,
    states,
    stateName,
    setStateName,
    preTaxUser,
    postTaxUser,
    newBudget,
  } = budgetState;

  const [showTaxesInPie, setShowTaxesInPie] = useState(true);

  const calc = useBudgetCalculations(salaryAnnual, preTaxUser, postTaxUser, rates, stateName);

  const actions = useBudgetActions(
    userExpenses,
    setUserExpenses,
    salaryAnnual,
    timeframe,
    calc.postTaxBase,
    budgetName,
    filingStatus,
    stateName,
    budgetState.applyLoaded
  );

  const pieData = useMemo(
    () =>
      calc.rows
        .filter((r) => {
          if (r.amountAnnual <= 0) return false;
          if (!showTaxesInPie) {
            return r.kind !== "tax" && !(r.kind === "user" && r.isPreTax);
          }
          return true;
        })
        .map((r) => ({
          id: r.id,
          name: r.name,
          value: Math.round(fromAnnual(r.amountAnnual, timeframe)),
          color: r.color,
        })),
    [calc.rows, timeframe, showTaxesInPie]
  );

  const bgApp = "#ffffff";
  const cardBg = "#f7f9fc";
  const border = "1px solid #e5e7eb";

  useEffect(() => {
    // Initialize AdSense ads
    try {
      (window as any).adsbygoogle = (window as any).adsbygoogle || [];
      (window as any).adsbygoogle.push({});
      (window as any).adsbygoogle.push({});
      (window as any).adsbygoogle.push({});
      (window as any).adsbygoogle.push({});
    } catch (err) {
      console.log('AdSense error:', err);
    }
  }, []);

  return (
    <div style={{ background: bgApp, minHeight: "10vh", padding: "2px 0" }}>
      <div style={{ display: "flex", width: "100%", gap: "16px" }}>
        {/* Left Sidebar Ad */}
        <div className="mobile-hide" style={{ width: "160px", flexShrink: 0 }}>
          <div style={{ position: "sticky", top: "24px" }}>
            <ins className="adsbygoogle"
                 style={{ display: "block", width: "160px", height: "600px" }}
                 data-ad-client="ca-pub-2961662780194890"
                 data-ad-slot="4065739991"
                 data-ad-format="auto"></ins>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1 }}>
        <h1 style={{ textAlign: "center", margin: "0 0 16px 0", fontSize: "1.75rem", fontWeight: "bold" }}>Simple Budget Tool</h1>

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
          }}
        >
          <button className="btn" onClick={actions.saveBudget} style={btnStyle("#111827", true)}>
            Save Budget
          </button>
          <button className="btn" onClick={actions.loadBudget} style={btnStyle("#374151", true)}>
            Load Budget
          </button>
          <button className="btn" onClick={() => actions.setShowNewBudgetModal(true)} style={btnStyle("#b00020", true)}>
            New Budget
          </button>
        </div>

        {/* Middle Banner Ad */}
        <div style={{ position: "relative", height: "90px", width: "100%" }}>
          <ins className="adsbygoogle"
               style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", display: "block", width: "728px", height: "90px" }}
               data-ad-client="ca-pub-2961662780194890"
               data-ad-slot="6579474269"
               data-ad-format="auto"></ins>
        </div>

        <div
          className="mobile-grid"
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
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ color: "#4b5563", fontSize: 12 }}>Salary (annual)</label>
            <input
              type="number"
              min={0}
              step={1000}
              value={Math.round(salaryAnnual)}
              onChange={(e) => {
                const val = Math.max(0, Math.round(Number(e.target.value) || 0));
                setSalaryAnnual(val);
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

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ color: "#4b5563", fontSize: 12 }}>Filing status</label>
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

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ color: "#4b5563", fontSize: 12 }}>State</label>
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

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ color: "#4b5563", fontSize: 12 }}>Timeline</label>
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

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <button className="btn" onClick={actions.openAddModal} style={btnStyle("#1a73e8", true)}>
              Add Expense
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <button className="btn" onClick={actions.openDeleteModal} style={btnStyle("#b00020", true)}>
              Delete
            </button>
          </div>
        </div>

        <div className="mobile-stack" style={{ width:"100%", display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, alignItems: "start" }}>
          <BudgetTable
            rows={calc.rows}
            timeframe={timeframe}
            calc={calc}
            onEditName={actions.handleEditName}
            onEditCost={actions.handleEditCost}
            onEditPctOfSalary={actions.handleEditPctOfSalary}
            onEditPctOfPostTax={actions.handleEditPctOfPostTax}
            onEditColor={actions.handleEditColor}
            onReorderExpenses={actions.handleReorderExpenses}
          />

          <div className="mobile-full-width">
            <PieChartSection
              pieData={pieData}
              showTaxesInPie={showTaxesInPie}
              onToggleTaxes={() => setShowTaxesInPie(!showTaxesInPie)}
              rates={rates}
              stateName={stateName}
              calc={calc}
            />
          </div>
        </div>
        </div>

        {/* Right Sidebar Ad */}
        <div className="mobile-hide" style={{ width: "160px", flexShrink: 0 }}>
          <div style={{ position: "sticky", top: "24px" }}>
            <ins className="adsbygoogle"
                 style={{ display: "block", width: "160px", height: "600px" }}
                 data-ad-client="ca-pub-2961662780194890"
                 data-ad-slot="1366622133"
                 data-ad-format="auto"></ins>
          </div>
        </div>
      </div>

      {/* Bottom Ad */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: "24px" }}>
        <ins className="adsbygoogle"
             style={{ display: "block", width: "728px", height: "90px" }}
             data-ad-client="ca-pub-2961662780194890"
             data-ad-slot="9053540467"
             data-ad-format="auto"></ins>
      </div>

      {actions.showAddModal && (
        <Modal onClose={() => actions.setShowAddModal(false)} title="Add expense">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label>Name</label>
              <input
                value={actions.addForm.name}
                onChange={(e) => actions.setAddForm((f) => ({ ...f, name: sanitizeInput(e.target.value) }))}
                placeholder="e.g., Utilities"
                style={modalInput}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label>Color</label>
              <input
                type="color"
                value={actions.addForm.color.slice(0, 7)}
                onChange={(e) => actions.setAddForm((f) => ({ ...f, color: e.target.value + "80" }))}
                style={{ ...modalInput, padding: 0, height: 40 }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label>Category</label>
              <select
                value={actions.addForm.isPreTax ? "pretax" : "posttax"}
                onChange={(e) => {
                  const isPreTax = e.target.value === "pretax";
                  actions.setAddForm((f) => ({
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
                value={actions.addForm.defineBy}
                onChange={(e) =>
                  actions.setAddForm((f) => {
                    const v = e.target.value as typeof f.defineBy;
                    return { ...f, defineBy: f.isPreTax && v === "pctPostTax" ? "pctPreTax" : v };
                  })
                }
                style={modalInput}
              >
                <option value="amount">Amount</option>
                <option value="pctPreTax">% of pre-tax salary</option>
                <option value="pctPostTax" disabled={actions.addForm.isPreTax}>
                  % of post-tax salary
                </option>
              </select>
            </div>

            {actions.addForm.defineBy === "amount" ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label>Amount</label>
                  <input
                    type="number"
                    min={0}
                    value={actions.addForm.amount || ""}
                    onChange={(e) => actions.setAddForm((f) => ({ ...f, amount: Number(e.target.value) || 0 }))}
                    placeholder="e.g., 150"
                    style={modalInput}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label>Timeframe</label>
                  <select
                    value={actions.addForm.amountTimeframe}
                    onChange={(e) =>
                      actions.setAddForm((f) => ({ ...f, amountTimeframe: e.target.value as Timeframe }))
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
                    value={actions.addForm.percent}
                    onChange={(e) =>
                      actions.setAddForm((f) => ({ ...f, percent: Math.max(0, Number(e.target.value) || 0) }))
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
            <button onClick={() => actions.setShowAddModal(false)} style={btnStyle("#555759ff", false)}>
              Cancel
            </button>
            <button onClick={actions.addExpense} style={btnStyle("#1a73e8", true)}>
              Add
            </button>
          </div>
        </Modal>
      )}

      {actions.showDeleteModal && (
        <Modal onClose={() => actions.setShowDeleteModal(false)} title="Delete expenses">
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflow: "auto" }}>
            {userExpenses.length === 0 && <div style={{ color: "#6b7280" }}>No user expenses to delete.</div>}
            {userExpenses.map((e) => (
              <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={!!actions.deleteSelection[e.id]}
                  onChange={() => actions.toggleDeleteSelect(e.id)}
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
            <button onClick={() => actions.setShowDeleteModal(false)} style={btnStyle("#555759ff", false)}>
              Cancel
            </button>
            <button onClick={actions.performDelete} style={btnStyle("#b00020", true)}>
              Delete selected
            </button>
          </div>
        </Modal>
      )}

      {actions.showNewBudgetModal && (
        <Modal onClose={() => actions.setShowNewBudgetModal(false)} title="New Budget">
          <p style={{ margin: "0 0 16px 0", lineHeight: 1.5 }}>
            This will reset the table and you will lose all your expenses. Make sure to save first if you don't want to lose your progress.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => actions.setShowNewBudgetModal(false)} style={btnStyle("#555759ff", false)}>
              Cancel
            </button>
            <button onClick={() => { newBudget(); actions.setShowNewBudgetModal(false); }} style={btnStyle("#b00020", true)}>
              Reset Budget
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}