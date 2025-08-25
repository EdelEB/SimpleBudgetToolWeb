import { useMemo } from 'react';
import { UserExpense, TaxExpense, DiscretionaryExpense, TaxRatesFile } from '../types';
import { computeFederalTax, computeStateTax, computeFica, TAX_GREYS, DISCRETIONARY_COLOR } from '../utils';

export function useBudgetCalculations(
  salaryAnnual: number,
  preTaxUser: UserExpense[],
  postTaxUser: UserExpense[],
  rates: TaxRatesFile,
  stateName: string
) {
  return useMemo(() => {
    const salary = Math.max(0, salaryAnnual);

    // Resolve pre-tax user expenses
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

    // Resolve post-tax user expenses
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

    const tableRows = [...preTaxResolved, ...taxExpenses, ...postTaxResolved, discretionary];

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
}