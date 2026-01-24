/**
 * Comprehensive Chapter 4 Export Helpers
 * Generates academic-standard tables and formatted content for statistical analysis export
 */

// ============= FORMATTING HELPERS =============

export const formatPValue = (p: number | undefined | null): string => {
  if (p === undefined || p === null || isNaN(p)) return "N/A";
  if (p < 0.001) return "<.001***";
  if (p < 0.01) return `${p.toFixed(3)}**`;
  if (p < 0.05) return `${p.toFixed(3)}*`;
  return p.toFixed(3);
};

export const formatNumber = (num: number | undefined | null, decimals = 2): string => {
  if (num === undefined || num === null || isNaN(num)) return "N/A";
  return num.toFixed(decimals);
};

export const getSignificanceMarker = (p: number | undefined | null): string => {
  if (p === undefined || p === null) return "";
  if (p < 0.001) return "***";
  if (p < 0.01) return "**";
  if (p < 0.05) return "*";
  return "";
};

export const formatEffectSize = (value: number | undefined | null, type: string): string => {
  if (value === undefined || value === null || isNaN(value)) return "N/A";
  const interpretations: Record<string, (v: number) => string> = {
    cohensD: (v) => {
      const abs = Math.abs(v);
      if (abs < 0.2) return `${v.toFixed(3)} (negligible)`;
      if (abs < 0.5) return `${v.toFixed(3)} (small)`;
      if (abs < 0.8) return `${v.toFixed(3)} (medium)`;
      return `${v.toFixed(3)} (large)`;
    },
    etaSquared: (v) => {
      if (v < 0.01) return `${v.toFixed(3)} (negligible)`;
      if (v < 0.06) return `${v.toFixed(3)} (small)`;
      if (v < 0.14) return `${v.toFixed(3)} (medium)`;
      return `${v.toFixed(3)} (large)`;
    },
    rSquared: (v) => `${(v * 100).toFixed(1)}%`,
    cramersV: (v) => {
      if (v < 0.1) return `${v.toFixed(3)} (negligible)`;
      if (v < 0.3) return `${v.toFixed(3)} (small)`;
      if (v < 0.5) return `${v.toFixed(3)} (medium)`;
      return `${v.toFixed(3)} (large)`;
    }
  };
  return interpretations[type]?.(value) ?? value.toFixed(3);
};

// ============= TABLE DATA INTERFACES =============

export interface TableData {
  title: string;
  headers: string[];
  rows: string[][];
  footnote?: string;
}

// ============= DESCRIPTIVE STATISTICS =============

export const generateDescriptiveTableData = (results: any): TableData | null => {
  if (!results) return null;
  
  const entries = Object.entries(results).filter(([key]) => key !== 'interpretation');
  if (entries.length === 0) return null;

  const headers = ['Variable', 'N', 'Mean', 'Median', 'Std. Dev.', 'Variance', 'Skewness', 'Kurtosis', 'Min', 'Max'];
  const rows = entries.map(([variable, stats]: [string, any]) => [
    variable,
    String(stats.count ?? 'N/A'),
    formatNumber(stats.mean),
    formatNumber(stats.median),
    formatNumber(stats.stdDev),
    formatNumber(stats.variance),
    formatNumber(stats.skewness, 3),
    formatNumber(stats.kurtosis, 3),
    formatNumber(stats.min),
    formatNumber(stats.max)
  ]);

  return {
    title: 'Descriptive Statistics of Study Variables',
    headers,
    rows,
    footnote: 'N = Number of observations; Std. Dev. = Standard Deviation'
  };
};

// ============= FREQUENCY TABLES =============

export const generateFrequencyTableData = (results: any): TableData[] => {
  if (!results) return [];
  
  const tables: TableData[] = [];
  
  Object.entries(results).forEach(([variable, data]: [string, any]) => {
    if (variable === 'interpretation' || !data?.categories) return;
    
    const headers = ['Category', 'Frequency', 'Percentage (%)'];
    const rows = Object.entries(data.categories).map(([category, stats]: [string, any]) => [
      category,
      String(stats.count ?? 0),
      formatNumber(stats.percentage, 1)
    ]);
    
    // Add total row
    const total = Object.values(data.categories).reduce((sum: number, s: any) => sum + (s.count || 0), 0);
    rows.push(['Total', String(total), '100.0']);

    tables.push({
      title: `Distribution of Respondents by ${variable}`,
      headers,
      rows
    });
  });

  return tables;
};

// ============= CORRELATION MATRIX =============

export const generateCorrelationTableData = (results: any, type: 'pearson' | 'spearman'): TableData | null => {
  if (!results?.matrix || !results?.variables) return null;
  
  const variables = results.variables;
  const headers = ['Variable', ...variables];
  const rows = results.matrix.map((row: any[], i: number) => {
    const rowData = [variables[i]];
    row.forEach((cell: any) => {
      const value = type === 'pearson' ? cell.r : cell.rho;
      const sig = getSignificanceMarker(cell.pValue);
      rowData.push(`${formatNumber(value, 3)}${sig}`);
    });
    return rowData;
  });

  return {
    title: type === 'pearson' ? 'Pearson Correlation Matrix' : 'Spearman Rank Correlation Matrix',
    headers,
    rows,
    footnote: '* p < .05, ** p < .01, *** p < .001'
  };
};

// ============= T-TEST TABLES =============

export const generateTTestTableData = (results: any, type: 'independent' | 'paired'): TableData | null => {
  if (!results) return null;

  const headers = type === 'independent' 
    ? ['Statistic', 'Value']
    : ['Statistic', 'Value'];
  
  const rows: string[][] = [
    ['t-value', formatNumber(results.tValue, 3)],
    ['Degrees of Freedom (df)', String(results.df ?? 'N/A')],
    ['p-value (two-tailed)', formatPValue(results.pValue)],
    ['Mean Difference', formatNumber(results.meanDiff, 3)],
  ];

  if (results.effectSize !== undefined) {
    rows.push(["Cohen's d (Effect Size)", formatEffectSize(results.effectSize, 'cohensD')]);
  }

  if (results.confidenceInterval) {
    rows.push(['95% CI', `[${formatNumber(results.confidenceInterval.lower, 3)}, ${formatNumber(results.confidenceInterval.upper, 3)}]`]);
  }

  return {
    title: type === 'independent' ? 'Independent Samples T-Test Results' : 'Paired Samples T-Test Results',
    headers,
    rows,
    footnote: `Significance: ${results.pValue < 0.05 ? 'The difference is statistically significant (p < .05)' : 'The difference is not statistically significant (p ≥ .05)'}`
  };
};

export const generateGroupMeansTableData = (results: any): TableData | null => {
  if (!results?.groupMeans && !results?.groupStats) return null;
  
  const stats = results.groupStats || results.groupMeans;
  const headers = ['Group', 'N', 'Mean', 'Std. Dev.'];
  const rows: string[][] = [];

  if (results.groupStats) {
    Object.entries(results.groupStats).forEach(([group, data]: [string, any]) => {
      rows.push([
        group,
        String(data.n ?? 'N/A'),
        formatNumber(data.mean),
        formatNumber(data.stdDev)
      ]);
    });
  } else if (results.groupMeans) {
    Object.entries(results.groupMeans).forEach(([group, mean]: [string, any]) => {
      rows.push([group, 'N/A', formatNumber(mean), 'N/A']);
    });
  }

  return {
    title: 'Group Statistics',
    headers,
    rows
  };
};

// ============= ANOVA TABLES =============

export const generateAnovaTableData = (results: any): TableData | null => {
  if (!results) return null;
  
  const headers = ['Source', 'Sum of Squares', 'df', 'Mean Square', 'F', 'Sig.', 'Partial η²'];
  const rows: string[][] = [];

  // Between groups
  rows.push([
    'Between Groups',
    formatNumber(results.ssBetween, 3),
    String(results.dfBetween ?? 'N/A'),
    formatNumber(results.msBetween, 3),
    formatNumber(results.fValue, 3),
    formatPValue(results.pValue),
    formatNumber(results.etaSquared, 3)
  ]);

  // Within groups
  rows.push([
    'Within Groups (Error)',
    formatNumber(results.ssWithin, 3),
    String(results.dfWithin ?? 'N/A'),
    formatNumber(results.msWithin, 3),
    '-',
    '-',
    '-'
  ]);

  // Total
  const ssTotal = (results.ssBetween || 0) + (results.ssWithin || 0);
  const dfTotal = (results.dfBetween || 0) + (results.dfWithin || 0);
  rows.push([
    'Total',
    formatNumber(ssTotal, 3),
    String(dfTotal),
    '-',
    '-',
    '-',
    '-'
  ]);

  return {
    title: 'ANOVA Summary Table',
    headers,
    rows,
    footnote: results.pValue < 0.05 
      ? 'The F-test is significant (p < .05), indicating significant differences between group means.'
      : 'The F-test is not significant (p ≥ .05), indicating no significant differences between group means.'
  };
};

export const generateTwoWayAnovaTableData = (results: any): TableData | null => {
  if (!results) return null;
  
  const headers = ['Source', 'Sum of Squares', 'df', 'Mean Square', 'F', 'Sig.', 'Partial η²'];
  const rows: string[][] = [];

  // Factor A
  if (results.factorA) {
    rows.push([
      results.factorA.name || 'Factor A',
      formatNumber(results.factorA.ss, 3),
      String(results.factorA.df ?? 'N/A'),
      formatNumber(results.factorA.ms, 3),
      formatNumber(results.factorA.F, 3),
      formatPValue(results.factorA.pValue),
      formatNumber(results.factorA.etaSquared, 3)
    ]);
  }

  // Factor B
  if (results.factorB) {
    rows.push([
      results.factorB.name || 'Factor B',
      formatNumber(results.factorB.ss, 3),
      String(results.factorB.df ?? 'N/A'),
      formatNumber(results.factorB.ms, 3),
      formatNumber(results.factorB.F, 3),
      formatPValue(results.factorB.pValue),
      formatNumber(results.factorB.etaSquared, 3)
    ]);
  }

  // Interaction
  if (results.interaction) {
    rows.push([
      `${results.factorA?.name || 'A'} × ${results.factorB?.name || 'B'}`,
      formatNumber(results.interaction.ss, 3),
      String(results.interaction.df ?? 'N/A'),
      formatNumber(results.interaction.ms, 3),
      formatNumber(results.interaction.F, 3),
      formatPValue(results.interaction.pValue),
      formatNumber(results.interaction.etaSquared, 3)
    ]);
  }

  // Error
  if (results.error) {
    rows.push([
      'Error',
      formatNumber(results.error.ss, 3),
      String(results.error.df ?? 'N/A'),
      formatNumber(results.error.ms, 3),
      '-',
      '-',
      '-'
    ]);
  }

  return {
    title: 'Two-Way ANOVA Summary Table',
    headers,
    rows
  };
};

export const generatePostHocTableData = (results: any): TableData | null => {
  if (!results?.postHoc || results.postHoc.length === 0) return null;
  
  const headers = ['(I) Group', '(J) Group', 'Mean Difference (I-J)', 'Std. Error', 'Sig.', '95% CI'];
  const rows = results.postHoc.map((comparison: any) => [
    comparison.group1 || comparison.groupI,
    comparison.group2 || comparison.groupJ,
    formatNumber(comparison.meanDiff, 3),
    formatNumber(comparison.stdError, 3),
    formatPValue(comparison.pValue),
    comparison.ci 
      ? `[${formatNumber(comparison.ci.lower, 3)}, ${formatNumber(comparison.ci.upper, 3)}]`
      : 'N/A'
  ]);

  return {
    title: 'Post-Hoc Multiple Comparisons (Tukey HSD)',
    headers,
    rows,
    footnote: '* The mean difference is significant at the .05 level.'
  };
};

export const generateGroupMeansForAnovaTableData = (results: any): TableData | null => {
  if (!results?.groupMeans) return null;
  
  const headers = ['Group', 'N', 'Mean', 'Std. Dev.', 'Std. Error', '95% CI'];
  const rows: string[][] = [];

  Object.entries(results.groupMeans).forEach(([group, data]: [string, any]) => {
    if (typeof data === 'object' && data !== null) {
      rows.push([
        group,
        String(data.n ?? 'N/A'),
        formatNumber(data.mean),
        formatNumber(data.stdDev),
        formatNumber(data.stdError),
        data.ci ? `[${formatNumber(data.ci.lower, 2)}, ${formatNumber(data.ci.upper, 2)}]` : 'N/A'
      ]);
    } else {
      rows.push([group, 'N/A', formatNumber(data), 'N/A', 'N/A', 'N/A']);
    }
  });

  return {
    title: 'Descriptive Statistics by Group',
    headers,
    rows
  };
};

// ============= REGRESSION TABLES =============

export const generateRegressionModelSummaryData = (results: any): TableData | null => {
  if (!results) return null;
  
  const headers = ['Statistic', 'Value'];
  const rows: string[][] = [
    ['R', formatNumber(results.r, 3)],
    ['R Square (R²)', formatNumber(results.rSquared, 3)],
    ['Adjusted R Square', formatNumber(results.adjustedRSquared, 3)],
    ['Std. Error of the Estimate', formatNumber(results.stdError, 3)],
    ['F-statistic', formatNumber(results.fStatistic, 3)],
    ['Sig. (of F)', formatPValue(results.fPValue || results.pValue)]
  ];

  return {
    title: 'Model Summary',
    headers,
    rows,
    footnote: `Predictors: ${results.predictors?.join(', ') || 'Independent variables'}; Dependent Variable: ${results.dependent || 'Y'}`
  };
};

export const generateRegressionCoefficientsTableData = (results: any): TableData | null => {
  if (!results?.coefficients) return null;
  
  const headers = ['Model', 'Unstandardized B', 'Std. Error', 'Standardized Beta (β)', 't', 'Sig.'];
  const rows: string[][] = [];

  // Constant/Intercept
  if (results.intercept !== undefined) {
    rows.push([
      '(Constant)',
      formatNumber(results.intercept, 3),
      formatNumber(results.interceptStdError, 3),
      '-',
      formatNumber(results.interceptT, 3),
      formatPValue(results.interceptPValue)
    ]);
  }

  // Coefficients
  results.coefficients.forEach((coef: any) => {
    rows.push([
      coef.name || coef.variable,
      formatNumber(coef.b || coef.coefficient, 3),
      formatNumber(coef.stdError, 3),
      formatNumber(coef.beta, 3),
      formatNumber(coef.t, 3),
      formatPValue(coef.pValue)
    ]);
  });

  return {
    title: 'Regression Coefficients',
    headers,
    rows,
    footnote: 'Dependent Variable: ' + (results.dependent || 'Y')
  };
};

export const generateLogisticRegressionTableData = (results: any): TableData | null => {
  if (!results?.coefficients) return null;
  
  const headers = ['Variable', 'B', 'S.E.', 'Wald', 'df', 'Sig.', 'Exp(B) / Odds Ratio'];
  const rows: string[][] = [];

  if (results.intercept !== undefined) {
    rows.push([
      'Constant',
      formatNumber(results.intercept, 3),
      formatNumber(results.interceptStdError, 3),
      formatNumber(results.interceptWald, 3),
      '1',
      formatPValue(results.interceptPValue),
      formatNumber(Math.exp(results.intercept), 3)
    ]);
  }

  results.coefficients.forEach((coef: any) => {
    rows.push([
      coef.name || coef.variable,
      formatNumber(coef.b || coef.coefficient, 3),
      formatNumber(coef.stdError, 3),
      formatNumber(coef.wald, 3),
      '1',
      formatPValue(coef.pValue),
      formatNumber(coef.oddsRatio || Math.exp(coef.b || coef.coefficient), 3)
    ]);
  });

  return {
    title: 'Logistic Regression Coefficients (Variables in the Equation)',
    headers,
    rows,
    footnote: `Model χ² = ${formatNumber(results.modelChiSquare, 3)}, p ${formatPValue(results.modelPValue)}; Nagelkerke R² = ${formatNumber(results.nagelkerkeR2, 3)}`
  };
};

// ============= CHI-SQUARE TABLES =============

export const generateChiSquareTableData = (results: any): TableData | null => {
  if (!results) return null;
  
  // Observed frequencies table
  const tables: TableData[] = [];

  if (results.observedMatrix) {
    const categories = results.categories || [];
    const groups = results.groups || [];
    const headers = ['', ...groups, 'Total'];
    const rows: string[][] = [];

    results.observedMatrix.forEach((row: number[], i: number) => {
      const rowTotal = row.reduce((a, b) => a + b, 0);
      rows.push([
        categories[i] || `Category ${i + 1}`,
        ...row.map(String),
        String(rowTotal)
      ]);
    });

    // Column totals
    const colTotals = groups.map((_: any, j: number) => 
      results.observedMatrix.reduce((sum: number, row: number[]) => sum + row[j], 0)
    );
    const grandTotal = colTotals.reduce((a: number, b: number) => a + b, 0);
    rows.push(['Total', ...colTotals.map(String), String(grandTotal)]);

    tables.push({
      title: 'Cross-Tabulation (Observed Frequencies)',
      headers,
      rows
    });
  }

  // Chi-square statistics
  const statsHeaders = ['Statistic', 'Value', 'df', 'Asymp. Sig. (2-sided)'];
  const statsRows: string[][] = [
    ['Pearson Chi-Square', formatNumber(results.chiSquare, 3), String(results.df ?? 'N/A'), formatPValue(results.pValue)],
  ];

  if (results.cramersV !== undefined) {
    statsRows.push(["Cramér's V", formatEffectSize(results.cramersV, 'cramersV'), '-', '-']);
  }

  return {
    title: 'Chi-Square Test Statistics',
    headers: statsHeaders,
    rows: statsRows,
    footnote: results.pValue < 0.05 
      ? 'The association between variables is statistically significant (p < .05).'
      : 'There is no statistically significant association between variables (p ≥ .05).'
  };
};

// ============= FACTOR ANALYSIS TABLES =============

export const generateKMOTableData = (results: any): TableData | null => {
  if (!results?.kmo) return null;
  
  const headers = ['Test', 'Value'];
  const rows: string[][] = [
    ['Kaiser-Meyer-Olkin Measure of Sampling Adequacy', formatNumber(results.kmo, 3)],
    ["Bartlett's Test of Sphericity - Approx. Chi-Square", formatNumber(results.bartlett?.chiSquare, 3)],
    ["Bartlett's Test of Sphericity - df", String(results.bartlett?.df ?? 'N/A')],
    ["Bartlett's Test of Sphericity - Sig.", formatPValue(results.bartlett?.pValue)]
  ];

  let kmoInterpretation = '';
  if (results.kmo >= 0.9) kmoInterpretation = 'Marvelous';
  else if (results.kmo >= 0.8) kmoInterpretation = 'Meritorious';
  else if (results.kmo >= 0.7) kmoInterpretation = 'Middling';
  else if (results.kmo >= 0.6) kmoInterpretation = 'Mediocre';
  else if (results.kmo >= 0.5) kmoInterpretation = 'Miserable';
  else kmoInterpretation = 'Unacceptable';

  return {
    title: 'KMO and Bartlett\'s Test',
    headers,
    rows,
    footnote: `KMO value of ${formatNumber(results.kmo, 3)} is considered ${kmoInterpretation}.${results.bartlett?.pValue < 0.05 ? ' Bartlett\'s test is significant, indicating correlation matrix is suitable for factor analysis.' : ''}`
  };
};

export const generateTotalVarianceTableData = (results: any): TableData | null => {
  if (!results?.eigenvalues || !results?.varianceExplained) return null;
  
  const headers = ['Component', 'Initial Eigenvalue', '% of Variance', 'Cumulative %'];
  const rows: string[][] = [];
  let cumulative = 0;

  results.eigenvalues.forEach((eigenvalue: number, i: number) => {
    const variance = results.varianceExplained[i] || (eigenvalue / results.eigenvalues.reduce((a: number, b: number) => a + b, 0)) * 100;
    cumulative += variance;
    rows.push([
      String(i + 1),
      formatNumber(eigenvalue, 3),
      formatNumber(variance, 2),
      formatNumber(cumulative, 2)
    ]);
  });

  return {
    title: 'Total Variance Explained',
    headers,
    rows,
    footnote: `Extraction Method: Principal Component Analysis. ${results.factorsExtracted || results.eigenvalues.filter((e: number) => e >= 1).length} components extracted explaining ${formatNumber(cumulative, 1)}% of total variance.`
  };
};

export const generateFactorLoadingsTableData = (results: any): TableData | null => {
  if (!results?.loadings) return null;
  
  const numFactors = results.loadings[0]?.length || 0;
  const headers = ['Variable', ...Array.from({ length: numFactors }, (_, i) => `Factor ${i + 1}`)];
  const rows: string[][] = [];

  const variables = results.variables || results.loadings.map((_: any, i: number) => `Variable ${i + 1}`);
  
  results.loadings.forEach((loadings: number[], i: number) => {
    const row = [variables[i]];
    loadings.forEach(loading => {
      // Suppress low loadings (< 0.3 is typically not reported)
      row.push(Math.abs(loading) >= 0.3 ? formatNumber(loading, 3) : '');
    });
    rows.push(row);
  });

  return {
    title: 'Rotated Component Matrix',
    headers,
    rows,
    footnote: 'Extraction Method: Principal Component Analysis. Rotation Method: Varimax with Kaiser Normalization. Loadings < .30 suppressed.'
  };
};

// ============= NON-PARAMETRIC TESTS =============

export const generateMannWhitneyTableData = (results: any): TableData | null => {
  if (!results) return null;
  
  const headers = ['Statistic', 'Value'];
  const rows: string[][] = [
    ['Mann-Whitney U', formatNumber(results.uStatistic, 3)],
    ['Wilcoxon W', formatNumber(results.wilcoxonW, 3)],
    ['Z', formatNumber(results.zScore, 3)],
    ['Asymp. Sig. (2-tailed)', formatPValue(results.pValue)]
  ];

  if (results.effectSize !== undefined) {
    rows.push(['Effect Size (r)', formatNumber(results.effectSize, 3)]);
  }

  return {
    title: 'Mann-Whitney U Test Statistics',
    headers,
    rows,
    footnote: results.pValue < 0.05 
      ? 'The difference between groups is statistically significant (p < .05).'
      : 'There is no statistically significant difference between groups (p ≥ .05).'
  };
};

export const generateKruskalWallisTableData = (results: any): TableData | null => {
  if (!results) return null;
  
  const headers = ['Statistic', 'Value'];
  const rows: string[][] = [
    ['Kruskal-Wallis H', formatNumber(results.hStatistic, 3)],
    ['df', String(results.df ?? 'N/A')],
    ['Asymp. Sig.', formatPValue(results.pValue)]
  ];

  return {
    title: 'Kruskal-Wallis H Test Statistics',
    headers,
    rows,
    footnote: results.pValue < 0.05 
      ? 'The difference between groups is statistically significant (p < .05).'
      : 'There is no statistically significant difference between groups (p ≥ .05).'
  };
};

export const generateWilcoxonTableData = (results: any): TableData | null => {
  if (!results) return null;
  
  const headers = ['Statistic', 'Value'];
  const rows: string[][] = [
    ['Z', formatNumber(results.zScore, 3)],
    ['Asymp. Sig. (2-tailed)', formatPValue(results.pValue)],
    ['Positive Ranks', String(results.positiveRanks ?? 'N/A')],
    ['Negative Ranks', String(results.negativeRanks ?? 'N/A')],
    ['Ties', String(results.ties ?? 'N/A')]
  ];

  if (results.effectSize !== undefined) {
    rows.push(['Effect Size (r)', formatNumber(results.effectSize, 3)]);
  }

  return {
    title: 'Wilcoxon Signed-Rank Test Statistics',
    headers,
    rows,
    footnote: results.pValue < 0.05 
      ? 'The difference is statistically significant (p < .05).'
      : 'There is no statistically significant difference (p ≥ .05).'
  };
};

// ============= ANCOVA TABLE =============

export const generateAncovaTableData = (results: any): TableData | null => {
  if (!results) return null;
  
  const headers = ['Source', 'Type III Sum of Squares', 'df', 'Mean Square', 'F', 'Sig.', 'Partial η²'];
  const rows: string[][] = [];

  // Corrected Model
  if (results.correctedModel) {
    rows.push([
      'Corrected Model',
      formatNumber(results.correctedModel.ss, 3),
      String(results.correctedModel.df ?? 'N/A'),
      formatNumber(results.correctedModel.ms, 3),
      formatNumber(results.correctedModel.F, 3),
      formatPValue(results.correctedModel.pValue),
      formatNumber(results.correctedModel.etaSquared, 3)
    ]);
  }

  // Covariate
  if (results.covariate) {
    rows.push([
      results.covariate.name || 'Covariate',
      formatNumber(results.covariate.ss, 3),
      String(results.covariate.df ?? 1),
      formatNumber(results.covariate.ms, 3),
      formatNumber(results.covariate.F, 3),
      formatPValue(results.covariate.pValue),
      formatNumber(results.covariate.etaSquared, 3)
    ]);
  }

  // Main effect (factor)
  if (results.factor) {
    rows.push([
      results.factor.name || 'Factor',
      formatNumber(results.factor.ss, 3),
      String(results.factor.df ?? 'N/A'),
      formatNumber(results.factor.ms, 3),
      formatNumber(results.factor.F, 3),
      formatPValue(results.factor.pValue),
      formatNumber(results.factor.etaSquared, 3)
    ]);
  }

  // Error
  if (results.error) {
    rows.push([
      'Error',
      formatNumber(results.error.ss, 3),
      String(results.error.df ?? 'N/A'),
      formatNumber(results.error.ms, 3),
      '-',
      '-',
      '-'
    ]);
  }

  // Total
  if (results.total) {
    rows.push([
      'Corrected Total',
      formatNumber(results.total.ss, 3),
      String(results.total.df ?? 'N/A'),
      '-',
      '-',
      '-',
      '-'
    ]);
  }

  return {
    title: 'Tests of Between-Subjects Effects (ANCOVA)',
    headers,
    rows,
    footnote: 'R Squared = ' + formatNumber(results.rSquared, 3) + ' (Adjusted R Squared = ' + formatNumber(results.adjustedRSquared, 3) + ')'
  };
};

// ============= ASSUMPTION CHECKS =============

export const generateNormalityTableData = (assumptions: any): TableData | null => {
  if (!assumptions?.normality) return null;
  
  const headers = ['Group/Variable', 'W (Shapiro-Wilk)', 'p-value', 'Skewness', 'Kurtosis', 'Result'];
  const rows = assumptions.normality.map((norm: any) => [
    norm.group || norm.variable || 'Data',
    formatNumber(norm.W, 4),
    formatPValue(norm.pValue),
    formatNumber(norm.skewness, 3),
    formatNumber(norm.kurtosis, 3),
    norm.isNormal ? 'Normal' : 'Non-Normal'
  ]);

  return {
    title: 'Test of Normality (Shapiro-Wilk)',
    headers,
    rows,
    footnote: 'p > .05 indicates data is normally distributed (assumption met).'
  };
};

export const generateHomogeneityTableData = (assumptions: any): TableData | null => {
  if (!assumptions?.homogeneity) return null;
  
  const h = assumptions.homogeneity;
  const headers = ['Test', 'F', 'df1', 'df2', 'Sig.', 'Result'];
  const rows: string[][] = [[
    "Levene's Test",
    formatNumber(h.F, 3),
    String(h.df1 ?? 'N/A'),
    String(h.df2 ?? 'N/A'),
    formatPValue(h.pValue),
    h.isHomogeneous ? 'Equal Variances' : 'Unequal Variances'
  ]];

  return {
    title: 'Test of Homogeneity of Variances (Levene\'s)',
    headers,
    rows,
    footnote: 'p > .05 indicates equal variances across groups (assumption met).'
  };
};

// ============= LIKERT SCALE TABLES =============

export const generateLikertTableData = (results: any): TableData[] => {
  if (!results) return [];
  
  const tables: TableData[] = [];
  
  Object.entries(results).forEach(([variable, data]: [string, any]) => {
    if (variable === 'interpretation' || !data?.distribution) return;
    
    const headers = ['Rating', 'Frequency', 'Percentage (%)', 'Weighted Score'];
    const rows: string[][] = [];
    let totalResponses = 0;
    let weightedSum = 0;

    Object.entries(data.distribution).forEach(([rating, stats]: [string, any]) => {
      const ratingNum = parseInt(rating) || 0;
      const count = stats.count || 0;
      totalResponses += count;
      weightedSum += ratingNum * count;
      
      rows.push([
        rating,
        String(count),
        formatNumber(stats.percentage, 1),
        String(ratingNum * count)
      ]);
    });

    // Summary row
    const weightedMean = totalResponses > 0 ? weightedSum / totalResponses : 0;
    rows.push(['Total', String(totalResponses), '100.0', formatNumber(weightedSum, 0)]);
    rows.push(['Weighted Mean', '-', '-', formatNumber(weightedMean, 2)]);

    tables.push({
      title: `Likert Scale Analysis: ${variable}`,
      headers,
      rows,
      footnote: `Weighted Mean = ${formatNumber(data.weightedMean, 2)}; Interpretation: ${data.interpretation || 'N/A'}`
    });
  });

  return tables;
};

// ============= MASTER GENERATOR =============

export interface Chapter4Section {
  title: string;
  tables: TableData[];
  interpretation?: string;
  figureDescription?: string;
}

export const generateChapter4Sections = (results: any): Chapter4Section[] => {
  const sections: Chapter4Section[] = [];

  // Descriptive Statistics
  if (results.descriptive) {
    const table = generateDescriptiveTableData(results.descriptive);
    if (table) {
      sections.push({
        title: 'Descriptive Statistics',
        tables: [table],
        interpretation: results.descriptive.interpretation,
        figureDescription: 'The distribution histograms presented below illustrate the frequency distribution of each numeric variable in the study. These visual representations help identify the shape of the data distribution, including any skewness or presence of outliers.'
      });
    }
  }

  // Frequencies
  if (results.frequencies) {
    const tables = generateFrequencyTableData(results.frequencies);
    if (tables.length > 0) {
      sections.push({
        title: 'Socio-Demographic Characteristics of Respondents',
        tables,
        interpretation: results.frequencies.interpretation,
        figureDescription: 'Pie charts depicting the distribution of respondents across various demographic categories are presented to provide a visual summary of the sample composition.'
      });
    }
  }

  // Likert Scale
  if (results.likert) {
    const tables = generateLikertTableData(results.likert);
    if (tables.length > 0) {
      sections.push({
        title: 'Likert Scale Analysis',
        tables,
        interpretation: results.likert?.interpretation
      });
    }
  }

  // Pearson Correlation
  if (results.correlation_pearson) {
    const table = generateCorrelationTableData(results.correlation_pearson, 'pearson');
    if (table) {
      sections.push({
        title: 'Pearson Correlation Analysis',
        tables: [table],
        interpretation: results.correlation_pearson.interpretation
      });
    }
  }

  // Spearman Correlation
  if (results.correlation_spearman) {
    const table = generateCorrelationTableData(results.correlation_spearman, 'spearman');
    if (table) {
      sections.push({
        title: 'Spearman Rank Correlation Analysis',
        tables: [table],
        interpretation: results.correlation_spearman.interpretation
      });
    }
  }

  // Independent T-Test
  if (results.ttest_independent) {
    const tables: TableData[] = [];
    const groupTable = generateGroupMeansTableData(results.ttest_independent);
    if (groupTable) tables.push(groupTable);
    const testTable = generateTTestTableData(results.ttest_independent, 'independent');
    if (testTable) tables.push(testTable);
    
    // Add assumption tables
    if (results.ttest_independent.assumptions) {
      const normTable = generateNormalityTableData(results.ttest_independent.assumptions);
      if (normTable) tables.push(normTable);
      const homTable = generateHomogeneityTableData(results.ttest_independent.assumptions);
      if (homTable) tables.push(homTable);
    }
    
    if (tables.length > 0) {
      sections.push({
        title: 'Independent Samples T-Test',
        tables,
        interpretation: results.ttest_independent.interpretation,
        figureDescription: 'Bar chart comparing mean scores between the two groups is presented to visualize the magnitude of difference.'
      });
    }
  }

  // Paired T-Test
  if (results.ttest_paired) {
    const tables: TableData[] = [];
    const testTable = generateTTestTableData(results.ttest_paired, 'paired');
    if (testTable) tables.push(testTable);
    
    if (tables.length > 0) {
      sections.push({
        title: 'Paired Samples T-Test',
        tables,
        interpretation: results.ttest_paired.interpretation
      });
    }
  }

  // One-Way ANOVA
  if (results.anova_oneway) {
    const tables: TableData[] = [];
    const groupTable = generateGroupMeansForAnovaTableData(results.anova_oneway);
    if (groupTable) tables.push(groupTable);
    const anovaTable = generateAnovaTableData(results.anova_oneway);
    if (anovaTable) tables.push(anovaTable);
    const postHocTable = generatePostHocTableData(results.anova_oneway);
    if (postHocTable) tables.push(postHocTable);
    
    // Assumption tables
    if (results.anova_oneway.assumptions) {
      const normTable = generateNormalityTableData(results.anova_oneway.assumptions);
      if (normTable) tables.push(normTable);
      const homTable = generateHomogeneityTableData(results.anova_oneway.assumptions);
      if (homTable) tables.push(homTable);
    }
    
    if (tables.length > 0) {
      sections.push({
        title: 'One-Way Analysis of Variance (ANOVA)',
        tables,
        interpretation: results.anova_oneway.interpretation,
        figureDescription: 'Bar chart comparing mean scores across groups with error bars representing 95% confidence intervals.'
      });
    }
  }

  // Two-Way ANOVA
  if (results.anova_twoway) {
    const tables: TableData[] = [];
    const anovaTable = generateTwoWayAnovaTableData(results.anova_twoway);
    if (anovaTable) tables.push(anovaTable);
    
    if (tables.length > 0) {
      sections.push({
        title: 'Two-Way Analysis of Variance (ANOVA)',
        tables,
        interpretation: results.anova_twoway.interpretation
      });
    }
  }

  // ANCOVA
  if (results.ancova) {
    const tables: TableData[] = [];
    const ancovaTable = generateAncovaTableData(results.ancova);
    if (ancovaTable) tables.push(ancovaTable);
    
    if (tables.length > 0) {
      sections.push({
        title: 'Analysis of Covariance (ANCOVA)',
        tables,
        interpretation: results.ancova.interpretation
      });
    }
  }

  // Linear Regression
  if (results.regression_linear) {
    const tables: TableData[] = [];
    const summaryTable = generateRegressionModelSummaryData(results.regression_linear);
    if (summaryTable) tables.push(summaryTable);
    const coeffTable = generateRegressionCoefficientsTableData(results.regression_linear);
    if (coeffTable) tables.push(coeffTable);
    
    if (tables.length > 0) {
      sections.push({
        title: 'Linear Regression Analysis',
        tables,
        interpretation: results.regression_linear.interpretation
      });
    }
  }

  // Logistic Regression
  if (results.regression_logistic) {
    const tables: TableData[] = [];
    const logisticTable = generateLogisticRegressionTableData(results.regression_logistic);
    if (logisticTable) tables.push(logisticTable);
    
    if (tables.length > 0) {
      sections.push({
        title: 'Logistic Regression Analysis',
        tables,
        interpretation: results.regression_logistic.interpretation
      });
    }
  }

  // Chi-Square
  if (results.chi_square) {
    const tables: TableData[] = [];
    const chiTable = generateChiSquareTableData(results.chi_square);
    if (chiTable) tables.push(chiTable);
    
    if (tables.length > 0) {
      sections.push({
        title: 'Chi-Square Test of Independence',
        tables,
        interpretation: results.chi_square.interpretation
      });
    }
  }

  // Factor Analysis
  if (results.factor_analysis) {
    const tables: TableData[] = [];
    const kmoTable = generateKMOTableData(results.factor_analysis);
    if (kmoTable) tables.push(kmoTable);
    const varianceTable = generateTotalVarianceTableData(results.factor_analysis);
    if (varianceTable) tables.push(varianceTable);
    const loadingsTable = generateFactorLoadingsTableData(results.factor_analysis);
    if (loadingsTable) tables.push(loadingsTable);
    
    if (tables.length > 0) {
      sections.push({
        title: 'Exploratory Factor Analysis',
        tables,
        interpretation: results.factor_analysis.interpretation,
        figureDescription: 'Scree plot showing eigenvalues plotted against component numbers to determine the optimal number of factors to retain.'
      });
    }
  }

  // Mann-Whitney U
  if (results.mannwhitney_u) {
    const tables: TableData[] = [];
    const mwTable = generateMannWhitneyTableData(results.mannwhitney_u);
    if (mwTable) tables.push(mwTable);
    
    if (tables.length > 0) {
      sections.push({
        title: 'Mann-Whitney U Test',
        tables,
        interpretation: results.mannwhitney_u.interpretation
      });
    }
  }

  // Kruskal-Wallis
  if (results.kruskal_wallis) {
    const tables: TableData[] = [];
    const kwTable = generateKruskalWallisTableData(results.kruskal_wallis);
    if (kwTable) tables.push(kwTable);
    
    if (tables.length > 0) {
      sections.push({
        title: 'Kruskal-Wallis H Test',
        tables,
        interpretation: results.kruskal_wallis.interpretation
      });
    }
  }

  // Wilcoxon Signed-Rank
  if (results.wilcoxon_signed_rank) {
    const tables: TableData[] = [];
    const wTable = generateWilcoxonTableData(results.wilcoxon_signed_rank);
    if (wTable) tables.push(wTable);
    
    if (tables.length > 0) {
      sections.push({
        title: 'Wilcoxon Signed-Rank Test',
        tables,
        interpretation: results.wilcoxon_signed_rank.interpretation
      });
    }
  }

  return sections;
};
