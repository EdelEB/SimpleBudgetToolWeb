import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { TaxRatesFile, Timeframe } from '../types';
import { currencyRounded, percentHundredth, btnStyle } from '../utils';

interface PieChartSectionProps {
  pieData: Array<{
    id: string;
    name: string;
    value: number;
    color: string;
  }>;
  showTaxesInPie: boolean;
  onToggleTaxes: () => void;
  rates: TaxRatesFile;
  stateName: string;
  calc: {
    taxableIncome: number;
    postTaxBase: number;
  };
}

export function PieChartSection({
  pieData,
  showTaxesInPie,
  onToggleTaxes,
  rates,
  stateName,
  calc,
}: PieChartSectionProps) {
  const muted = "#4b5563";

  return (
    <div style={{ width: "70%", background: "#f7f9fc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 8 }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
        <button
          onClick={onToggleTaxes}
          style={{
            ...btnStyle(showTaxesInPie ? "#1a73e8" : "#6b7280", true),
            fontSize: 12,
            padding: "4px 8px",
          }}
        >
          {showTaxesInPie ? "Hide" : "Show"} taxes & pre-tax
        </button>
      </div>
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
        <h3 style={{ fontSize: 11, margin: "0 0 8px 0" }}>Tax rates in use:</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Federal brackets</div>
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
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>FICA</div>
            <ul style={{ fontSize: 10, margin: 0, paddingLeft: 18 }}>
              <li>
                OASDI: {(rates.fica.oasdi_rate * 100).toFixed(2)}% up to{" "}
                {currencyRounded(rates.fica.oasdi_wage_base)}
              </li>
              <li>Medicare: {(rates.fica.medicare_rate * 100).toFixed(2)}%</li>
              {rates.fica.medicare_addl_threshold && rates.fica.medicare_addl_rate && (
                <li>
                  Additional Medicare:{" "}
                  {(rates.fica.medicare_addl_rate * 100).toFixed(2)}% over{" "}
                  {currencyRounded(rates.fica.medicare_addl_threshold)}
                </li>
              )}
            </ul>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>State: {stateName}</div>
            {(() => {
              const st = rates.states[stateName];
              if (!st || st.type === "none") return <div style={{ fontSize: 10 }}>No state income tax</div>;
              if (st.type === "flat") return <div style={{ fontSize: 10 }}>Flat rate: {(st.rate * 100).toFixed(2)}%</div>;
              if (st.type === "brackets")
                return (
                  <ul style={{ fontSize: 10, margin: 0, paddingLeft: 18 }}>
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

      {/* Summary */}
      <div style={{ marginTop: 8, color: muted, fontSize: 12 }}>
        Taxable income: <strong>{currencyRounded(calc.taxableIncome)}</strong>
      </div>
      <div style={{ marginTop: 8, color: muted, fontSize: 12 }}>
        Post-tax income: <strong>{currencyRounded(calc.postTaxBase)}</strong>
      </div>
    </div>
  );
}