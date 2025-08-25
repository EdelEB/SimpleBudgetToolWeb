import React, { useRef, useState } from 'react';
import { AnyExpense, UserExpense, Timeframe } from '../types';
import { currencyRounded, fromAnnual, percentHundredth, sanitizeInput } from '../utils';

interface BudgetTableProps {
  rows: AnyExpense[];
  timeframe: Timeframe;
  calc: {
    salary: number;
    postTaxBase: number;
  };
  onEditName: (row: UserExpense, value: string) => void;
  onEditCost: (row: UserExpense, displayAmount: number) => void;
  onEditPctOfSalary: (row: UserExpense, pctStr: string) => void;
  onEditPctOfPostTax: (row: UserExpense, pctStr: string) => void;
  onEditColor: (row: UserExpense, color: string) => void;
  onReorderExpenses: (srcId: string, targetId: string) => void;
}

export function BudgetTable({
  rows,
  timeframe,
  calc,
  onEditName,
  onEditCost,
  onEditPctOfSalary,
  onEditPctOfPostTax,
  onEditColor,
  onReorderExpenses,
}: BudgetTableProps) {
  const dragId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const onDragStart = (row: AnyExpense, e: React.DragEvent) => {
    if (row.kind === "user" && !row.isPreTax) {
      dragId.current = row.id;
      e.dataTransfer.effectAllowed = "move";
    }
  };

  const onDragOver = (row: AnyExpense, e: React.DragEvent) => {
    if (row.kind === "user" && !row.isPreTax && dragId.current) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverId(row.id);
    }
  };

  const onDragLeave = () => {
    setDragOverId(null);
  };

  const onDrop = (target: AnyExpense, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverId(null);
    const srcId = dragId.current;
    dragId.current = null;
    if (!srcId || !(target.kind === "user" && !target.isPreTax)) return;
    onReorderExpenses(srcId, target.id);
  };

  const DragHandle: React.FC<{ row: AnyExpense; muted?: boolean }> = ({ row, muted }) => {
    const enabled = row.kind === "user" && !row.isPreTax;
    if (!enabled) return null;
    const style: React.CSSProperties = {
      width: 14,
      display: "inline-flex",
      cursor: "grab",
      opacity: muted ? 0.6 : 0.95,
      userSelect: "none",
    };
    return (
      <span
        role="img"
        aria-label="drag"
        draggable={true}
        onDragStart={(e) => onDragStart(row, e)}
        onDragOver={(e) => onDragOver(row, e)}
        onDrop={(e) => onDrop(row, e)}
        style={style}
        title="Drag to reorder post-tax expenses"
      >
        ⋮⋮
      </span>
    );
  };

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

  return (
    <div style={{ background: "#f7f9fc", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
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
            {rows.map((row) => {
              const textColor = "#000000ff";
              const borderRow = "rgba(39, 39, 41, 0.82)";
              const isUser = row.kind === "user";
              const userRow = isUser ? (row as UserExpense) : undefined;

              const costDisplay = Math.round(fromAnnual(row.amountAnnual, timeframe));
              const pctSalary = calc.salary > 0 ? (row.amountAnnual / calc.salary) * 100 : 0;
              const pctPostTax = calc.postTaxBase > 0 ? (row.amountAnnual / calc.postTaxBase) * 100 : 0;

              const isDragTarget = dragOverId === row.id;
              const canDrop = row.kind === "user" && !row.isPreTax && dragId.current;

              return (
                <tr
                  key={row.id}
                  onDragOver={(e) => canDrop && onDragOver(row, e)}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => canDrop && onDrop(row, e)}
                  style={{
                    opacity: dragId.current === row.id ? 0.5 : 1,
                    transform: isDragTarget ? "scale(1.02)" : "scale(1)",
                    transition: "all 0.2s ease",
                  }}
                >
                  <td
                    style={{
                      ...cellBase,
                      background: isDragTarget ? "#e3f2fd" : row.color,
                      color: textColor,
                      borderBottom: `1px solid ${borderRow}`,
                      border: isDragTarget ? "2px dashed #1976d2" : undefined,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <DragHandle row={row} />
                      {isUser ? (
                        <>
                          <input
                            value={userRow!.name}
                            onChange={(e) => onEditName(userRow!, sanitizeInput(e.target.value))}
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
                          <input
                            type="color"
                            value={userRow!.color.slice(0, 7)}
                            onChange={(e) => onEditColor(userRow!, e.target.value)}
                            style={{
                              width: 20,
                              height: 20,
                              border: "none",
                              borderRadius: 4,
                              cursor: "pointer",
                            }}
                            title="Change color"
                          />
                        </>
                      ) : (
                        <span style={{ fontWeight: 600 }}>{row.name}</span>
                      )}
                    </div>
                  </td>

                  <td
                    style={{
                      ...cellBase,
                      background: isDragTarget ? "#e3f2fd" : row.color,
                      color: textColor,
                      borderBottom: `1px solid ${borderRow}`,
                      border: isDragTarget ? "2px dashed #1976d2" : undefined,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {isUser ? (
                        <input
                          type="number"
                          step={1}
                          min={0}
                          value={costDisplay}
                          onChange={(e) => onEditCost(userRow!, Number(e.target.value))}
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

                  <td
                    style={{
                      ...cellBase,
                      background: isDragTarget ? "#e3f2fd" : row.color,
                      color: textColor,
                      borderBottom: `1px solid ${borderRow}`,
                      border: isDragTarget ? "2px dashed #1976d2" : undefined,
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
                            onChange={(e) => onEditPctOfSalary(userRow!, e.target.value)}
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

                  <td
                    style={{
                      ...cellBase,
                      background: isDragTarget ? "#e3f2fd" : row.color,
                      color: textColor,
                      borderBottom: `1px solid ${borderRow}`,
                      border: isDragTarget ? "2px dashed #1976d2" : undefined,
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
                            onChange={(e) => onEditPctOfPostTax(userRow!, e.target.value)}
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
                      ) : row.kind === "discretionary" ? (
                        <span style={{ whiteSpace: "nowrap" }}>{percentHundredth(pctPostTax / 100)}</span>
                      ) : (
                        <span style={{ whiteSpace: "nowrap" }}>n/a</span>
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
  );
}