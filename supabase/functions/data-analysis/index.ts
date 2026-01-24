import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Credit costs for each analysis type
const ANALYSIS_CREDITS: Record<string, number> = {
  'descriptive': 20,
  'frequencies': 20,
  'likert': 25,
  'correlation_pearson': 30,
  'correlation_spearman': 30,
  'ttest_independent': 30,
  'ttest_paired': 30,
  'chi_square': 30,
  'anova_oneway': 40,
  'anova_twoway': 60,
  'ancova': 60,
  'regression_linear': 50,
  'regression_logistic': 60,
  'factor_analysis': 80,
};

// Utility function to sanitize results - converts NaN and Infinity to null
function sanitizeResults(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'number') {
    if (isNaN(obj)) return null;
    if (!isFinite(obj)) return null;
    return obj;
  }
  if (Array.isArray(obj)) return obj.map(sanitizeResults);
  if (typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, sanitizeResults(v)])
    );
  }
  return obj;
}

// Statistical helper functions
function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mode(arr: number[]): number[] {
  if (arr.length === 0) return [];
  const freq: Record<number, number> = {};
  arr.forEach(v => freq[v] = (freq[v] || 0) + 1);
  const maxFreq = Math.max(...Object.values(freq));
  return Object.entries(freq)
    .filter(([, f]) => f === maxFreq)
    .map(([v]) => Number(v));
}

function standardDeviation(arr: number[]): number {
  if (arr.length <= 1) return 0;
  const avg = mean(arr);
  const squareDiffs = arr.map(v => Math.pow(v - avg, 2));
  return Math.sqrt(mean(squareDiffs));
}

function variance(arr: number[]): number {
  if (arr.length <= 1) return 0;
  const avg = mean(arr);
  return arr.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / (arr.length - 1);
}

function pearsonCorrelation(x: number[], y: number[]): { r: number; pValue: number } {
  const n = x.length;
  if (n < 3) return { r: 0, pValue: 1 };
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
  
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (denominator === 0) return { r: 0, pValue: 1 };
  
  const r = (n * sumXY - sumX * sumY) / denominator;
  
  // Calculate t-statistic for p-value
  if (Math.abs(r) >= 1) return { r: r > 0 ? 1 : -1, pValue: 0 };
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  // Approximate p-value using t-distribution (simplified)
  const pValue = 2 * (1 - tDistCDF(Math.abs(t), n - 2));
  
  return { r: isNaN(r) ? 0 : r, pValue: isNaN(pValue) ? 1 : pValue };
}

function spearmanCorrelation(x: number[], y: number[]): { rho: number; pValue: number } {
  const rankX = getRanks(x);
  const rankY = getRanks(y);
  const result = pearsonCorrelation(rankX, rankY);
  return { rho: result.r, pValue: result.pValue };
}

function getRanks(arr: number[]): number[] {
  const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array(arr.length);
  sorted.forEach((item, rank) => ranks[item.i] = rank + 1);
  return ranks;
}

// Simplified t-distribution CDF approximation
function tDistCDF(t: number, df: number): number {
  if (df <= 0) return 0.5;
  const x = df / (df + t * t);
  return 1 - 0.5 * incompleteBeta(df / 2, 0.5, x);
}

// Simplified incomplete beta function (approximation)
function incompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  // Using a simple approximation for statistical purposes
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) {
    return bt * betaCF(a, b, x) / a;
  }
  return 1 - bt * betaCF(b, a, 1 - x) / b;
}

function lgamma(x: number): number {
  const cof = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let ser = 1.000000000190015;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  for (let j = 0; j < 6; j++) ser += cof[j] / (x + j + 1);
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function betaCF(a: number, b: number, x: number): number {
  const maxIter = 100;
  const eps = 3e-7;
  let qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h;
}

// Independent samples t-test
function independentTTest(group1: number[], group2: number[]): { tValue: number; df: number; pValue: number; meanDiff: number } {
  const n1 = group1.length, n2 = group2.length;
  if (n1 < 2 || n2 < 2) return { tValue: 0, df: 0, pValue: 1, meanDiff: 0 };
  
  const mean1 = mean(group1), mean2 = mean(group2);
  const var1 = variance(group1), var2 = variance(group2);
  const pooledSE = Math.sqrt(var1 / n1 + var2 / n2);
  if (pooledSE === 0) return { tValue: 0, df: n1 + n2 - 2, pValue: 1, meanDiff: mean1 - mean2 };
  
  const tValue = (mean1 - mean2) / pooledSE;
  const df = n1 + n2 - 2;
  const pValue = 2 * (1 - tDistCDF(Math.abs(tValue), df));
  return { tValue, df, pValue, meanDiff: mean1 - mean2 };
}

// Paired samples t-test
function pairedTTest(before: number[], after: number[]): { tValue: number; df: number; pValue: number; meanDiff: number } {
  if (before.length < 2) return { tValue: 0, df: 0, pValue: 1, meanDiff: 0 };
  
  const differences = before.map((b, i) => after[i] - b);
  const meanDiff = mean(differences);
  const sdDiff = standardDeviation(differences);
  const n = differences.length;
  if (sdDiff === 0) return { tValue: 0, df: n - 1, pValue: 1, meanDiff };
  
  const tValue = meanDiff / (sdDiff / Math.sqrt(n));
  const df = n - 1;
  const pValue = 2 * (1 - tDistCDF(Math.abs(tValue), df));
  return { tValue, df, pValue, meanDiff };
}

// Post-hoc: Tukey HSD test
function tukeyHSD(
  groups: Record<string, number[]>,
  groupNames: string[],
  msWithin: number,
  dfWithin: number
): {
  comparisons: { group1: string; group2: string; meanDiff: number; se: number; qValue: number; pValue: number; significant: boolean; ci: [number, number] }[];
} {
  const comparisons: { group1: string; group2: string; meanDiff: number; se: number; qValue: number; pValue: number; significant: boolean; ci: [number, number] }[] = [];
  const k = groupNames.length;
  
  // Critical q-value approximation for Tukey at alpha=0.05
  const qCritical = getStudentizedRangeCritical(k, dfWithin);
  
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const g1 = groups[groupNames[i]];
      const g2 = groups[groupNames[j]];
      const n1 = g1.length, n2 = g2.length;
      const mean1 = mean(g1), mean2 = mean(g2);
      const meanDiff = mean1 - mean2;
      
      // Standard error for Tukey (harmonic mean of sample sizes)
      const nHarmonic = 2 / (1/n1 + 1/n2);
      const se = Math.sqrt(msWithin / nHarmonic);
      const qValue = Math.abs(meanDiff) / se;
      
      // P-value approximation using studentized range
      const pValue = getStudentizedRangePValue(qValue, k, dfWithin);
      const significant = qValue > qCritical;
      
      // 95% Confidence Interval
      const ciMargin = qCritical * se;
      const ci: [number, number] = [meanDiff - ciMargin, meanDiff + ciMargin];
      
      comparisons.push({ group1: groupNames[i], group2: groupNames[j], meanDiff, se, qValue, pValue, significant, ci });
    }
  }
  return { comparisons };
}

// Get studentized range critical value (approximation for alpha=0.05)
function getStudentizedRangeCritical(k: number, df: number): number {
  // Simplified critical values for common cases
  const criticalTable: Record<number, Record<number, number>> = {
    3: { 10: 3.88, 20: 3.58, 30: 3.49, 60: 3.40, 120: 3.36 },
    4: { 10: 4.33, 20: 3.96, 30: 3.85, 60: 3.74, 120: 3.68 },
    5: { 10: 4.65, 20: 4.23, 30: 4.10, 60: 3.98, 120: 3.92 },
    6: { 10: 4.91, 20: 4.45, 30: 4.30, 60: 4.16, 120: 4.10 },
  };
  
  const kKey = Math.min(6, Math.max(3, k));
  let dfKey = 120;
  if (df <= 10) dfKey = 10;
  else if (df <= 20) dfKey = 20;
  else if (df <= 30) dfKey = 30;
  else if (df <= 60) dfKey = 60;
  
  return criticalTable[kKey]?.[dfKey] || 3.5;
}

// Approximate p-value for studentized range
function getStudentizedRangePValue(q: number, k: number, df: number): number {
  // Simple approximation based on the relationship with F-distribution
  const fApprox = Math.pow(q, 2) / 2;
  const pValue = 1 - fDistCDF(fApprox, k - 1, df);
  return Math.max(0, Math.min(1, pValue));
}

// Post-hoc: Bonferroni correction
function bonferroniPostHoc(
  groups: Record<string, number[]>,
  groupNames: string[],
  msWithin: number,
  dfWithin: number
): {
  comparisons: { group1: string; group2: string; meanDiff: number; tValue: number; pValue: number; adjustedP: number; significant: boolean }[];
  correctionFactor: number;
} {
  const comparisons: { group1: string; group2: string; meanDiff: number; tValue: number; pValue: number; adjustedP: number; significant: boolean }[] = [];
  const k = groupNames.length;
  const numComparisons = k * (k - 1) / 2;
  
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const g1 = groups[groupNames[i]];
      const g2 = groups[groupNames[j]];
      const n1 = g1.length, n2 = g2.length;
      const mean1 = mean(g1), mean2 = mean(g2);
      const meanDiff = mean1 - mean2;
      
      // Pooled standard error
      const se = Math.sqrt(msWithin * (1/n1 + 1/n2));
      const tValue = se > 0 ? meanDiff / se : 0;
      
      // Two-tailed p-value
      const pValue = 2 * (1 - tDistCDF(Math.abs(tValue), dfWithin));
      const adjustedP = Math.min(1, pValue * numComparisons);
      const significant = adjustedP < 0.05;
      
      comparisons.push({ group1: groupNames[i], group2: groupNames[j], meanDiff, tValue, pValue, adjustedP, significant });
    }
  }
  
  return { comparisons, correctionFactor: numComparisons };
}

// Shapiro-Wilk normality test (approximation)
function shapiroWilkTest(data: number[]): { 
  W: number; 
  pValue: number; 
  isNormal: boolean;
  skewness: number;
  kurtosis: number;
} {
  const n = data.length;
  if (n < 3 || n > 5000) return { W: 0, pValue: 0, isNormal: false, skewness: 0, kurtosis: 0 };
  
  const sorted = [...data].sort((a, b) => a - b);
  const avg = mean(data);
  const sd = standardDeviation(data);
  
  // Calculate SS (sum of squared deviations)
  const ss = data.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0);
  
  // Simplified Shapiro-Wilk calculation
  // Calculate b using approximate coefficients
  let b = 0;
  const halfN = Math.floor(n / 2);
  for (let i = 0; i < halfN; i++) {
    // Approximate Shapiro-Wilk coefficients
    const m = normalQuantile((i + 1 - 0.375) / (n + 0.25));
    const a = m / Math.sqrt(2);
    b += a * (sorted[n - 1 - i] - sorted[i]);
  }
  
  const W = ss > 0 ? Math.pow(b, 2) / ss : 0;
  
  // Skewness calculation
  const skewness = sd > 0 ? data.reduce((sum, v) => sum + Math.pow((v - avg) / sd, 3), 0) / n : 0;
  
  // Kurtosis calculation (excess kurtosis)
  const kurtosis = sd > 0 ? data.reduce((sum, v) => sum + Math.pow((v - avg) / sd, 4), 0) / n - 3 : 0;
  
  // P-value approximation using normal transformation
  const pValue = approximateShapiroPValue(W, n);
  
  return { W: Math.min(1, W), pValue, isNormal: pValue > 0.05, skewness, kurtosis };
}

// Approximate Shapiro-Wilk p-value
function approximateShapiroPValue(W: number, n: number): number {
  if (W >= 1) return 1;
  if (W <= 0) return 0;
  
  // Transform W to normal using Royston's algorithm approximation
  const y = Math.log(1 - W);
  const mu = -1.2725 + 1.0521 * Math.log(n - 1);
  const sigma = 1.0308 - 0.26758 * Math.log(n);
  
  const z = (y - mu) / sigma;
  const pValue = 1 - normalCDF(z);
  
  return Math.max(0, Math.min(1, pValue));
}

// Standard normal CDF approximation
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

// Inverse normal CDF (quantile function)
function normalQuantile(p: number): number {
  if (p <= 0) return -4;
  if (p >= 1) return 4;
  
  const a = [0, -3.969683028665376, 220.9460984245205, -275.9285104469687, 138.3577518672690, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  
  const pLow = 0.02425, pHigh = 1 - pLow;
  let q: number, r: number;
  
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[1]*r+a[2])*r+a[3])*r+a[4])*r+a[5])*r+a[6])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
}

// Levene's test for homogeneity of variance
function levenesTest(groups: number[][]): {
  F: number;
  df1: number;
  df2: number;
  pValue: number;
  isHomogeneous: boolean;
  groupVariances: { name: string; variance: number }[];
} {
  const k = groups.length;
  const N = groups.flat().length;
  
  // Calculate absolute deviations from group medians
  const deviations: number[][] = groups.map(g => {
    const med = median(g);
    return g.map(v => Math.abs(v - med));
  });
  
  // Apply one-way ANOVA to the deviations
  const grandMean = mean(deviations.flat());
  const groupMeans = deviations.map(d => mean(d));
  
  // Between-group sum of squares
  let ssBetween = 0;
  deviations.forEach((d, i) => {
    ssBetween += d.length * Math.pow(groupMeans[i] - grandMean, 2);
  });
  
  // Within-group sum of squares
  let ssWithin = 0;
  deviations.forEach((d, i) => {
    d.forEach(v => {
      ssWithin += Math.pow(v - groupMeans[i], 2);
    });
  });
  
  const df1 = k - 1;
  const df2 = N - k;
  
  const msBetween = df1 > 0 ? ssBetween / df1 : 0;
  const msWithin = df2 > 0 ? ssWithin / df2 : 1;
  const F = msWithin > 0 ? msBetween / msWithin : 0;
  const pValue = df1 > 0 && df2 > 0 ? 1 - fDistCDF(F, df1, df2) : 1;
  
  // Calculate variance for each original group
  const groupVariances = groups.map((g, i) => ({
    name: `Group ${i + 1}`,
    variance: variance(g)
  }));
  
  return {
    F,
    df1,
    df2,
    pValue,
    isHomogeneous: pValue > 0.05,
    groupVariances,
  };
}

// Generate Q-Q plot data for normality visualization
function generateQQPlotData(data: number[]): { theoretical: number; observed: number }[] {
  const n = data.length;
  if (n < 3) return [];
  
  const sorted = [...data].sort((a, b) => a - b);
  const avg = mean(data);
  const sd = standardDeviation(data) || 1;
  
  // Standardize and compute theoretical quantiles
  return sorted.map((value, i) => {
    const p = (i + 0.5) / n; // Plotting position
    const theoretical = normalQuantile(p); // Z-score from standard normal
    const observed = (value - avg) / sd; // Standardized observed value
    return { theoretical, observed };
  });
}

// One-way ANOVA
function oneWayAnova(groups: number[][]): { fValue: number; df1: number; df2: number; pValue: number; groupMeans: number[]; msWithin: number; ssWithin: number } {
  const allData = groups.flat();
  if (allData.length < 3) return { fValue: 0, df1: 0, df2: 0, pValue: 1, groupMeans: [], msWithin: 0, ssWithin: 0 };
  
  const grandMean = mean(allData);
  const k = groups.length;
  const N = allData.length;
  
  // Between-group sum of squares
  let ssBetween = 0;
  const groupMeans = groups.map(g => mean(g));
  groups.forEach((g, i) => {
    ssBetween += g.length * Math.pow(groupMeans[i] - grandMean, 2);
  });
  
  // Within-group sum of squares
  let ssWithin = 0;
  groups.forEach((g, i) => {
    g.forEach(v => {
      ssWithin += Math.pow(v - groupMeans[i], 2);
    });
  });
  
  const df1 = k - 1;
  const df2 = N - k;
  if (df1 <= 0 || df2 <= 0 || ssWithin === 0) return { fValue: 0, df1, df2, pValue: 1, groupMeans, msWithin: 0, ssWithin };
  
  const msBetween = ssBetween / df1;
  const msWithin = ssWithin / df2;
  const fValue = msBetween / msWithin;
  
  // Approximate p-value using F-distribution
  const pValue = 1 - fDistCDF(fValue, df1, df2);
  
  return { fValue, df1, df2, pValue: isNaN(pValue) ? 1 : pValue, groupMeans, msWithin, ssWithin };
}

// Two-way ANOVA
function twoWayAnova(
  data: any[],
  factor1Col: any,
  factor2Col: any,
  dvCol: any
): {
  mainEffect1: { ssValue: number; df: number; fValue: number; pValue: number };
  mainEffect2: { ssValue: number; df: number; fValue: number; pValue: number };
  interaction: { ssValue: number; df: number; fValue: number; pValue: number };
  residual: { ssValue: number; df: number };
  cellMeans: Record<string, { mean: number; n: number }>;
  factor1Levels: string[];
  factor2Levels: string[];
} {
  // Extract data by cells
  const cells: Record<string, number[]> = {};
  const factor1Values = new Set<string>();
  const factor2Values = new Set<string>();
  
  data.forEach((row: any) => {
    const f1 = String(row[factor1Col.index]);
    const f2 = String(row[factor2Col.index]);
    const dv = Number(row[dvCol.index]);
    
    if (!isNaN(dv)) {
      factor1Values.add(f1);
      factor2Values.add(f2);
      const key = `${f1}_${f2}`;
      if (!cells[key]) cells[key] = [];
      cells[key].push(dv);
    }
  });
  
  const factor1Levels = Array.from(factor1Values);
  const factor2Levels = Array.from(factor2Values);
  const a = factor1Levels.length;
  const b = factor2Levels.length;
  
  // Calculate cell means
  const cellMeans: Record<string, { mean: number; n: number }> = {};
  Object.entries(cells).forEach(([key, values]) => {
    cellMeans[key] = { mean: mean(values), n: values.length };
  });
  
  // Grand mean
  const allValues = Object.values(cells).flat();
  const grandMean = mean(allValues);
  const N = allValues.length;
  
  // Row (Factor 1) means
  const rowMeans: Record<string, number> = {};
  factor1Levels.forEach(f1 => {
    const rowValues: number[] = [];
    factor2Levels.forEach(f2 => {
      const key = `${f1}_${f2}`;
      if (cells[key]) rowValues.push(...cells[key]);
    });
    rowMeans[f1] = mean(rowValues);
  });
  
  // Column (Factor 2) means
  const colMeans: Record<string, number> = {};
  factor2Levels.forEach(f2 => {
    const colValues: number[] = [];
    factor1Levels.forEach(f1 => {
      const key = `${f1}_${f2}`;
      if (cells[key]) colValues.push(...cells[key]);
    });
    colMeans[f2] = mean(colValues);
  });
  
  // Calculate sum of squares
  let ssTotal = 0;
  allValues.forEach(v => ssTotal += Math.pow(v - grandMean, 2));
  
  // SS for Factor 1 (rows)
  let ssA = 0;
  factor1Levels.forEach(f1 => {
    let nRow = 0;
    factor2Levels.forEach(f2 => {
      const key = `${f1}_${f2}`;
      if (cells[key]) nRow += cells[key].length;
    });
    ssA += nRow * Math.pow(rowMeans[f1] - grandMean, 2);
  });
  
  // SS for Factor 2 (columns)
  let ssB = 0;
  factor2Levels.forEach(f2 => {
    let nCol = 0;
    factor1Levels.forEach(f1 => {
      const key = `${f1}_${f2}`;
      if (cells[key]) nCol += cells[key].length;
    });
    ssB += nCol * Math.pow(colMeans[f2] - grandMean, 2);
  });
  
  // SS for interaction
  let ssAB = 0;
  factor1Levels.forEach(f1 => {
    factor2Levels.forEach(f2 => {
      const key = `${f1}_${f2}`;
      if (cells[key] && cells[key].length > 0) {
        const cellMean = cellMeans[key].mean;
        const n = cells[key].length;
        const interaction = cellMean - rowMeans[f1] - colMeans[f2] + grandMean;
        ssAB += n * Math.pow(interaction, 2);
      }
    });
  });
  
  // SS within (error/residual)
  let ssWithin = 0;
  Object.entries(cells).forEach(([key, values]) => {
    const cellMean = cellMeans[key].mean;
    values.forEach(v => ssWithin += Math.pow(v - cellMean, 2));
  });
  
  // Degrees of freedom
  const dfA = a - 1;
  const dfB = b - 1;
  const dfAB = dfA * dfB;
  const dfWithin = N - a * b;
  
  // Mean squares
  const msA = dfA > 0 ? ssA / dfA : 0;
  const msB = dfB > 0 ? ssB / dfB : 0;
  const msAB = dfAB > 0 ? ssAB / dfAB : 0;
  const msWithin = dfWithin > 0 ? ssWithin / dfWithin : 1;
  
  // F values
  const fA = msWithin > 0 ? msA / msWithin : 0;
  const fB = msWithin > 0 ? msB / msWithin : 0;
  const fAB = msWithin > 0 ? msAB / msWithin : 0;
  
  // P values
  const pA = dfA > 0 && dfWithin > 0 ? 1 - fDistCDF(fA, dfA, dfWithin) : 1;
  const pB = dfB > 0 && dfWithin > 0 ? 1 - fDistCDF(fB, dfB, dfWithin) : 1;
  const pAB = dfAB > 0 && dfWithin > 0 ? 1 - fDistCDF(fAB, dfAB, dfWithin) : 1;
  
  return {
    mainEffect1: { ssValue: ssA, df: dfA, fValue: fA, pValue: pA },
    mainEffect2: { ssValue: ssB, df: dfB, fValue: fB, pValue: pB },
    interaction: { ssValue: ssAB, df: dfAB, fValue: fAB, pValue: pAB },
    residual: { ssValue: ssWithin, df: dfWithin },
    cellMeans,
    factor1Levels,
    factor2Levels,
  };
}

// ANCOVA - Analysis of Covariance
function ancova(
  data: any[],
  groupCol: any,
  covariateCol: any,
  dvCol: any
): {
  fValue: number;
  df1: number;
  df2: number;
  pValue: number;
  adjustedMeans: Record<string, number>;
  covariateEffect: { b: number; se: number; tValue: number; pValue: number };
  groups: string[];
  grandCovMean: number;
} {
  // Extract data by groups
  const groups: Record<string, { dv: number[]; cov: number[] }> = {};
  
  data.forEach((row: any) => {
    const groupKey = String(row[groupCol.index]);
    const dv = Number(row[dvCol.index]);
    const cov = Number(row[covariateCol.index]);
    
    if (!isNaN(dv) && !isNaN(cov)) {
      if (!groups[groupKey]) groups[groupKey] = { dv: [], cov: [] };
      groups[groupKey].dv.push(dv);
      groups[groupKey].cov.push(cov);
    }
  });
  
  const groupKeys = Object.keys(groups);
  const k = groupKeys.length;
  
  // Calculate overall covariate mean
  const allCov = Object.values(groups).flatMap(g => g.cov);
  const allDv = Object.values(groups).flatMap(g => g.dv);
  const grandCovMean = mean(allCov);
  const grandDvMean = mean(allDv);
  const N = allDv.length;
  
  // Pool the regression coefficient (b) across groups
  let ssCovTotal = 0;
  let spTotal = 0; // sum of products
  
  Object.values(groups).forEach(g => {
    const covMean = mean(g.cov);
    const dvMean = mean(g.dv);
    g.cov.forEach((cov, i) => {
      ssCovTotal += Math.pow(cov - covMean, 2);
      spTotal += (cov - covMean) * (g.dv[i] - dvMean);
    });
  });
  
  const bPooled = ssCovTotal > 0 ? spTotal / ssCovTotal : 0;
  
  // Calculate adjusted means
  const adjustedMeans: Record<string, number> = {};
  groupKeys.forEach(gk => {
    const groupCovMean = mean(groups[gk].cov);
    const groupDvMean = mean(groups[gk].dv);
    adjustedMeans[gk] = groupDvMean - bPooled * (groupCovMean - grandCovMean);
  });
  
  // Calculate SS for adjusted means (between groups after adjustment)
  let ssAdjBetween = 0;
  groupKeys.forEach(gk => {
    const n = groups[gk].dv.length;
    ssAdjBetween += n * Math.pow(adjustedMeans[gk] - grandDvMean, 2);
  });
  
  // Calculate residual SS
  let ssResidual = 0;
  Object.values(groups).forEach(g => {
    const dvMean = mean(g.dv);
    const covMean = mean(g.cov);
    g.dv.forEach((dv, i) => {
      const predicted = dvMean + bPooled * (g.cov[i] - covMean);
      ssResidual += Math.pow(dv - predicted, 2);
    });
  });
  
  // Degrees of freedom
  const df1 = k - 1;
  const df2 = N - k - 1; // Adjusted for covariate
  
  // Mean squares and F
  const msAdjBetween = df1 > 0 ? ssAdjBetween / df1 : 0;
  const msResidual = df2 > 0 ? ssResidual / df2 : 1;
  const fValue = msResidual > 0 ? msAdjBetween / msResidual : 0;
  const pValue = df1 > 0 && df2 > 0 ? 1 - fDistCDF(fValue, df1, df2) : 1;
  
  // Covariate effect
  const seB = Math.sqrt(msResidual / ssCovTotal);
  const tB = seB > 0 ? bPooled / seB : 0;
  const pB = 2 * (1 - tDistCDF(Math.abs(tB), df2));
  
  return {
    fValue,
    df1,
    df2,
    pValue,
    adjustedMeans,
    covariateEffect: { b: bPooled, se: seB, tValue: tB, pValue: pB },
    groups: groupKeys,
    grandCovMean,
  };
}

// Logistic Regression using iteratively reweighted least squares (simplified)
function logisticRegression(
  y: number[],
  xVars: number[][],
  varNames: string[]
): {
  coefficients: { name: string; b: number; se: number; wald: number; pValue: number; oddsRatio: number; ci95: [number, number] }[];
  modelFit: { logLikelihood: number; pseudoRSquared: number; chiSquare: number; pValue: number; devianceNull: number; devianceResidual: number };
  classificationTable: { truePositive: number; trueNegative: number; falsePositive: number; falseNegative: number; accuracy: number };
} {
  const n = y.length;
  const k = xVars.length + 1; // Including intercept
  
  // Convert y to 0/1 if not already
  const yBinary = y.map(v => v > 0 ? 1 : 0);
  const p1 = mean(yBinary);
  
  // Add intercept column
  const X: number[][] = [new Array(n).fill(1), ...xVars];
  
  // Initialize coefficients
  let beta = new Array(k).fill(0);
  beta[0] = Math.log(p1 / (1 - p1)); // Initial intercept
  
  // IRLS iterations
  const maxIter = 25;
  for (let iter = 0; iter < maxIter; iter++) {
    // Calculate probabilities
    const p: number[] = [];
    for (let i = 0; i < n; i++) {
      let eta = 0;
      for (let j = 0; j < k; j++) {
        eta += beta[j] * X[j][i];
      }
      p.push(1 / (1 + Math.exp(-eta)));
    }
    
    // Weight matrix (diagonal)
    const W = p.map(pi => pi * (1 - pi) + 1e-10);
    
    // Gradient
    const gradient = new Array(k).fill(0);
    for (let j = 0; j < k; j++) {
      for (let i = 0; i < n; i++) {
        gradient[j] += X[j][i] * (yBinary[i] - p[i]);
      }
    }
    
    // Simplified update (gradient ascent with fixed step)
    const stepSize = 0.5;
    for (let j = 0; j < k; j++) {
      beta[j] += stepSize * gradient[j] / n;
    }
  }
  
  // Calculate final probabilities
  const pFinal: number[] = [];
  for (let i = 0; i < n; i++) {
    let eta = 0;
    for (let j = 0; j < k; j++) {
      eta += beta[j] * X[j][i];
    }
    pFinal.push(1 / (1 + Math.exp(-eta)));
  }
  
  // Log-likelihood
  let logLik = 0;
  for (let i = 0; i < n; i++) {
    const pi = Math.max(1e-10, Math.min(1 - 1e-10, pFinal[i]));
    logLik += yBinary[i] * Math.log(pi) + (1 - yBinary[i]) * Math.log(1 - pi);
  }
  
  // Null log-likelihood
  const logLikNull = n * (p1 * Math.log(p1) + (1 - p1) * Math.log(1 - p1));
  
  // Model fit statistics
  const devianceNull = -2 * logLikNull;
  const devianceResidual = -2 * logLik;
  const chiSquare = devianceNull - devianceResidual;
  const pseudoRSquared = 1 - (logLik / logLikNull);
  const pValueModel = 1 - chiSquareCDF(chiSquare, k - 1);
  
  // Standard errors (approximate using Fisher information)
  const coefficients: { name: string; b: number; se: number; wald: number; pValue: number; oddsRatio: number; ci95: [number, number] }[] = [];
  
  for (let j = 0; j < k; j++) {
    // Approximate SE
    let info = 0;
    for (let i = 0; i < n; i++) {
      info += X[j][i] * X[j][i] * pFinal[i] * (1 - pFinal[i]);
    }
    const se = info > 0 ? 1 / Math.sqrt(info) : 0.5;
    const wald = se > 0 ? Math.pow(beta[j] / se, 2) : 0;
    const pValue = 1 - chiSquareCDF(wald, 1);
    const oddsRatio = Math.exp(beta[j]);
    const ci95: [number, number] = [Math.exp(beta[j] - 1.96 * se), Math.exp(beta[j] + 1.96 * se)];
    
    coefficients.push({
      name: j === 0 ? 'Intercept' : (varNames[j - 1] || `X${j}`),
      b: beta[j],
      se,
      wald,
      pValue,
      oddsRatio,
      ci95,
    });
  }
  
  // Classification table
  let tp = 0, tn = 0, fp = 0, fn = 0;
  for (let i = 0; i < n; i++) {
    const predicted = pFinal[i] >= 0.5 ? 1 : 0;
    if (yBinary[i] === 1 && predicted === 1) tp++;
    else if (yBinary[i] === 0 && predicted === 0) tn++;
    else if (yBinary[i] === 0 && predicted === 1) fp++;
    else fn++;
  }
  
  return {
    coefficients,
    modelFit: {
      logLikelihood: logLik,
      pseudoRSquared,
      chiSquare,
      pValue: pValueModel,
      devianceNull,
      devianceResidual,
    },
    classificationTable: {
      truePositive: tp,
      trueNegative: tn,
      falsePositive: fp,
      falseNegative: fn,
      accuracy: (tp + tn) / n,
    },
  };
}

// Factor Analysis (Exploratory) - Principal Component Analysis based
function exploratoryFactorAnalysis(
  data: number[][],
  variableNames: string[]
): {
  kmo: number;
  bartlettTest: { chiSquare: number; df: number; pValue: number };
  eigenvalues: { value: number; percentVariance: number; cumulative: number }[];
  factorLoadings: { variable: string; loadings: number[] }[];
  communalities: { variable: string; initial: number; extracted: number }[];
  recommendedFactors: number;
  totalVarianceExplained: number;
} {
  const n = data.length; // Number of observations
  const p = variableNames.length; // Number of variables
  
  if (n < 5 || p < 2) {
    return {
      kmo: 0,
      bartlettTest: { chiSquare: 0, df: 0, pValue: 1 },
      eigenvalues: [],
      factorLoadings: [],
      communalities: [],
      recommendedFactors: 0,
      totalVarianceExplained: 0,
    };
  }
  
  // Standardize data
  const means = new Array(p).fill(0);
  const sds = new Array(p).fill(0);
  
  for (let j = 0; j < p; j++) {
    const col = data.map(row => row[j]);
    means[j] = mean(col);
    sds[j] = standardDeviation(col) || 1;
  }
  
  const standardized = data.map(row => 
    row.map((val, j) => (val - means[j]) / sds[j])
  );
  
  // Calculate correlation matrix
  const R: number[][] = [];
  for (let i = 0; i < p; i++) {
    R[i] = [];
    for (let j = 0; j < p; j++) {
      if (i === j) {
        R[i][j] = 1;
      } else {
        const xi = standardized.map(row => row[i]);
        const xj = standardized.map(row => row[j]);
        R[i][j] = pearsonCorrelation(xi, xj).r;
      }
    }
  }
  
  // KMO (Kaiser-Meyer-Olkin) measure
  let sumR2 = 0;
  let sumQ2 = 0;
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) {
      if (i !== j) {
        sumR2 += R[i][j] * R[i][j];
        // Partial correlations approximation
        let partial = R[i][j];
        for (let k = 0; k < p; k++) {
          if (k !== i && k !== j) {
            partial -= R[i][k] * R[k][j] / p;
          }
        }
        sumQ2 += partial * partial;
      }
    }
  }
  const kmo = sumR2 / (sumR2 + sumQ2) || 0;
  
  // Bartlett's test of sphericity
  const detR = calculateDeterminant(R);
  const bartlettChi = -(n - 1 - (2 * p + 5) / 6) * Math.log(Math.max(detR, 1e-10));
  const bartlettDf = p * (p - 1) / 2;
  const bartlettP = 1 - chiSquareCDF(bartlettChi, bartlettDf);
  
  // Calculate eigenvalues using power iteration (simplified)
  const eigenvalues = calculateEigenvalues(R, p);
  
  // Determine recommended factors (Kaiser criterion: eigenvalue > 1)
  const recommendedFactors = eigenvalues.filter(e => e.value > 1).length;
  const numFactors = Math.max(1, Math.min(recommendedFactors, 5));
  
  // Calculate total variance explained by recommended factors
  const totalVarianceExplained = eigenvalues
    .slice(0, numFactors)
    .reduce((sum, e) => sum + e.percentVariance, 0);
  
  // Factor loadings (simplified using eigenvalue decomposition approximation)
  const factorLoadings: { variable: string; loadings: number[] }[] = [];
  for (let i = 0; i < p; i++) {
    const loadings: number[] = [];
    for (let f = 0; f < numFactors; f++) {
      // Approximate loading as correlation with principal component
      const loading = Math.sqrt(eigenvalues[f]?.value || 0) * R[i][f % p] / Math.sqrt(p);
      loadings.push(Math.max(-1, Math.min(1, loading)));
    }
    factorLoadings.push({ variable: variableNames[i], loadings });
  }
  
  // Communalities
  const communalities: { variable: string; initial: number; extracted: number }[] = [];
  for (let i = 0; i < p; i++) {
    const extracted = factorLoadings[i].loadings.reduce((sum, l) => sum + l * l, 0);
    communalities.push({
      variable: variableNames[i],
      initial: 1,
      extracted: Math.min(1, extracted),
    });
  }
  
  return {
    kmo,
    bartlettTest: { chiSquare: bartlettChi, df: bartlettDf, pValue: bartlettP },
    eigenvalues,
    factorLoadings,
    communalities,
    recommendedFactors,
    totalVarianceExplained,
  };
}

// Chi-square test for independence
function chiSquareTest(observed: number[][]): { chiSquare: number; df: number; pValue: number; cramersV: number } {
  const rows = observed.length;
  const cols = observed[0].length;
  
  const rowTotals = observed.map(row => row.reduce((a, b) => a + b, 0));
  const colTotals = observed[0].map((_, j) => observed.reduce((sum, row) => sum + row[j], 0));
  const total = rowTotals.reduce((a, b) => a + b, 0);
  
  if (total === 0) return { chiSquare: 0, df: 0, pValue: 1, cramersV: 0 };
  
  let chiSquare = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const expected = (rowTotals[i] * colTotals[j]) / total;
      if (expected > 0) {
        chiSquare += Math.pow(observed[i][j] - expected, 2) / expected;
      }
    }
  }
  
  const df = (rows - 1) * (cols - 1);
  const pValue = 1 - chiSquareCDF(chiSquare, df);
  
  // Cramer's V effect size
  const minDim = Math.min(rows - 1, cols - 1);
  const cramersV = minDim > 0 ? Math.sqrt(chiSquare / (total * minDim)) : 0;
  
  return { chiSquare, df, pValue, cramersV };
}

// Helper: Calculate determinant of a matrix (simplified for correlation matrices)
function calculateDeterminant(matrix: number[][]): number {
  const n = matrix.length;
  if (n === 1) return matrix[0][0];
  if (n === 2) return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
  
  // For larger matrices, use LU decomposition approximation
  // This is a simplified version
  let det = 1;
  const temp = matrix.map(row => [...row]);
  
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(temp[k][i]) > Math.abs(temp[maxRow][i])) {
        maxRow = k;
      }
    }
    
    if (maxRow !== i) {
      [temp[i], temp[maxRow]] = [temp[maxRow], temp[i]];
      det *= -1;
    }
    
    if (Math.abs(temp[i][i]) < 1e-10) return 0;
    
    det *= temp[i][i];
    
    for (let k = i + 1; k < n; k++) {
      const factor = temp[k][i] / temp[i][i];
      for (let j = i; j < n; j++) {
        temp[k][j] -= factor * temp[i][j];
      }
    }
  }
  
  return det;
}

// Matrix utility functions for OLS regression
function matrixMultiply(A: number[][], B: number[][]): number[][] {
  const rowsA = A.length, colsA = A[0].length, colsB = B[0].length;
  const result: number[][] = Array.from({ length: rowsA }, () => new Array(colsB).fill(0));
  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      for (let k = 0; k < colsA; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return result;
}

function matrixTranspose(A: number[][]): number[][] {
  return A[0].map((_, j) => A.map(row => row[j]));
}

// Matrix inverse using Gauss-Jordan elimination
function matrixInverse(matrix: number[][]): number[][] | null {
  const n = matrix.length;
  const augmented = matrix.map((row, i) => [...row, ...Array(n).fill(0).map((_, j) => i === j ? 1 : 0)]);
  
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) maxRow = k;
    }
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
    
    if (Math.abs(augmented[i][i]) < 1e-10) return null; // Singular matrix
    
    const pivot = augmented[i][i];
    for (let j = 0; j < 2 * n; j++) augmented[i][j] /= pivot;
    
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = augmented[k][i];
        for (let j = 0; j < 2 * n; j++) augmented[k][j] -= factor * augmented[i][j];
      }
    }
  }
  
  return augmented.map(row => row.slice(n));
}

// Helper: Calculate eigenvalues using Power Iteration with Deflation
function calculateEigenvalues(matrix: number[][], p: number): { value: number; percentVariance: number; cumulative: number; eigenvector: number[] }[] {
  const maxIterations = 100;
  const tolerance = 1e-8;
  const totalVariance = p;
  const eigenvalues: { value: number; percentVariance: number; cumulative: number; eigenvector: number[] }[] = [];
  
  // Work with a copy of the matrix for deflation
  let A = matrix.map(row => [...row]);
  
  for (let ev = 0; ev < p; ev++) {
    // Initialize with random vector
    let v = Array(p).fill(0).map((_, i) => Math.sin((ev + 1) * (i + 1)));
    let norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
    v = v.map(x => x / norm);
    
    let eigenvalue = 0;
    
    // Power iteration
    for (let iter = 0; iter < maxIterations; iter++) {
      // Multiply: w = A * v
      const w = A.map(row => row.reduce((sum, val, j) => sum + val * v[j], 0));
      
      // Calculate Rayleigh quotient (eigenvalue estimate)
      const newEigenvalue = v.reduce((sum, vi, i) => sum + vi * w[i], 0);
      
      // Normalize
      norm = Math.sqrt(w.reduce((sum, x) => sum + x * x, 0));
      if (norm < tolerance) break;
      v = w.map(x => x / norm);
      
      // Check convergence
      if (Math.abs(newEigenvalue - eigenvalue) < tolerance) {
        eigenvalue = newEigenvalue;
        break;
      }
      eigenvalue = newEigenvalue;
    }
    
    // Ensure non-negative eigenvalue for correlation matrix
    eigenvalue = Math.max(0, eigenvalue);
    
    const percentVariance = (eigenvalue / totalVariance) * 100;
    const cumulative = eigenvalues.reduce((sum, e) => sum + e.percentVariance, 0) + percentVariance;
    
    eigenvalues.push({
      value: eigenvalue,
      percentVariance,
      cumulative,
      eigenvector: v,
    });
    
    // Deflation: A = A - λ * v * v'
    for (let i = 0; i < p; i++) {
      for (let j = 0; j < p; j++) {
        A[i][j] -= eigenvalue * v[i] * v[j];
      }
    }
  }
  
  // Sort by eigenvalue descending
  eigenvalues.sort((a, b) => b.value - a.value);
  
  // Recalculate cumulative after sorting
  let runningCumulative = 0;
  eigenvalues.forEach(e => {
    runningCumulative += e.percentVariance;
    e.cumulative = runningCumulative;
  });
  
  return eigenvalues;
}

// Generate histogram bins using actual data distribution
function generateHistogramBins(values: number[], binCount?: number): { range: string; count: number; start: number; end: number }[] {
  if (values.length === 0) return [];
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  if (min === max) {
    return [{ range: `${min.toFixed(1)}`, count: values.length, start: min, end: max }];
  }
  
  // Use Sturges' rule or sqrt rule for bin count
  const n = values.length;
  const calculatedBinCount = binCount ?? Math.min(10, Math.max(5, Math.ceil(Math.sqrt(n))));
  const binWidth = (max - min) / calculatedBinCount;
  
  const bins: { range: string; count: number; start: number; end: number }[] = [];
  
  for (let i = 0; i < calculatedBinCount; i++) {
    const start = min + i * binWidth;
    const end = i === calculatedBinCount - 1 ? max + 0.001 : start + binWidth;
    const count = values.filter(v => v >= start && v < end).length;
    bins.push({
      range: `${start.toFixed(1)}-${end.toFixed(1)}`,
      count,
      start,
      end
    });
  }
  
  return bins;
}

// Simplified F-distribution CDF
function fDistCDF(f: number, df1: number, df2: number): number {
  if (f <= 0 || df1 <= 0 || df2 <= 0) return 0;
  const x = df2 / (df2 + df1 * f);
  return 1 - incompleteBeta(df1 / 2, df2 / 2, 1 - x);
}

// Chi-square CDF approximation
function chiSquareCDF(x: number, df: number): number {
  if (x <= 0 || df <= 0) return 0;
  return 1 - incompleteBeta(df / 2, 0.5, df / (df + x));
}

// Frequency analysis
function frequencyAnalysis(data: (string | number)[]): { categories: Record<string, { count: number; percentage: number }> } {
  const freq: Record<string, number> = {};
  data.forEach(v => {
    const key = String(v);
    freq[key] = (freq[key] || 0) + 1;
  });
  
  const total = data.length;
  const categories: Record<string, { count: number; percentage: number }> = {};
  Object.entries(freq).forEach(([key, count]) => {
    categories[key] = { count, percentage: (count / total) * 100 };
  });
  
  return { categories };
}

// Likert scale analysis
function likertAnalysis(data: number[]): { 
  distribution: Record<number, { count: number; percentage: number }>;
  weightedMean: number;
  mode: number[];
  interpretation: string;
} {
  const freq: Record<number, number> = {};
  data.forEach(v => freq[v] = (freq[v] || 0) + 1);
  
  const total = data.length;
  const distribution: Record<number, { count: number; percentage: number }> = {};
  Object.entries(freq).forEach(([key, count]) => {
    distribution[Number(key)] = { count, percentage: (count / total) * 100 };
  });
  
  const weightedMean = mean(data);
  const modeValues = mode(data);
  
  // Interpretation based on 5-point Likert scale
  let interpretation = "";
  if (weightedMean >= 4.5) interpretation = "Very Strong Agreement / Highly Positive";
  else if (weightedMean >= 3.5) interpretation = "Agreement / Positive";
  else if (weightedMean >= 2.5) interpretation = "Neutral / Mixed";
  else if (weightedMean >= 1.5) interpretation = "Disagreement / Negative";
  else interpretation = "Strong Disagreement / Highly Negative";
  
  return { distribution, weightedMean, mode: modeValues, interpretation };
}

// OLS Linear regression using matrix operations (Normal Equations)
function linearRegression(y: number[], xVars: number[][], varNames?: string[]): {
  coefficients: { name: string; value: number; se: number; tValue: number; pValue: number }[];
  rSquared: number;
  adjustedRSquared: number;
  fStatistic: number;
  fPValue: number;
} {
  const n = y.length;
  const k = xVars.length;
  
  if (n < 3 || k === 0) {
    return { coefficients: [], rSquared: 0, adjustedRSquared: 0, fStatistic: 0, fPValue: 1 };
  }
  
  // Build design matrix X with intercept column
  const X: number[][] = [];
  for (let i = 0; i < n; i++) {
    X[i] = [1, ...xVars.map(xVar => xVar[i])];
  }
  
  // OLS: β = (X'X)^(-1) * X'y
  const Xt = matrixTranspose(X);
  const XtX = matrixMultiply(Xt, X);
  const XtXinv = matrixInverse(XtX);
  
  // Fallback if matrix is singular (multicollinearity)
  if (!XtXinv) {
    const yMean = mean(y);
    const coefficients: { name: string; value: number; se: number; tValue: number; pValue: number }[] = [];
    coefficients.push({ name: 'Intercept', value: yMean, se: 0, tValue: 0, pValue: 1 });
    xVars.forEach((x, i) => {
      const corr = pearsonCorrelation(x, y);
      const sdY = standardDeviation(y);
      const sdX = standardDeviation(x);
      const b = sdX > 0 ? corr.r * (sdY / sdX) : 0;
      coefficients.push({ name: varNames?.[i] ?? `X${i + 1}`, value: b, se: 0, tValue: 0, pValue: corr.pValue });
    });
    return { coefficients, rSquared: 0, adjustedRSquared: 0, fStatistic: 0, fPValue: 1 };
  }
  
  const yMatrix = y.map(v => [v]);
  const Xty = matrixMultiply(Xt, yMatrix);
  const betaMatrix = matrixMultiply(XtXinv, Xty);
  const beta = betaMatrix.map(row => row[0]);
  
  // Calculate predictions and residuals
  const yMean = mean(y);
  let ssTotal = 0, ssResidual = 0;
  const residuals: number[] = [];
  
  y.forEach((yi, i) => {
    ssTotal += Math.pow(yi - yMean, 2);
    let predicted = 0;
    for (let j = 0; j <= k; j++) {
      predicted += beta[j] * X[i][j];
    }
    const resid = yi - predicted;
    residuals.push(resid);
    ssResidual += resid * resid;
  });
  
  // Calculate standard errors using MSE and (X'X)^-1 diagonal
  const mse = n > k + 1 ? ssResidual / (n - k - 1) : ssResidual;
  const dfResid = n - k - 1;
  
  const coefficients = beta.map((b, j) => {
    const se = Math.sqrt(Math.max(0, mse * XtXinv[j][j]));
    const tValue = se > 0 ? b / se : 0;
    const pValue = dfResid > 0 && se > 0 ? 2 * (1 - tDistCDF(Math.abs(tValue), dfResid)) : 1;
    return {
      name: j === 0 ? 'Intercept' : (varNames?.[j - 1] ?? `X${j}`),
      value: b,
      se,
      tValue,
      pValue: isNaN(pValue) ? 1 : pValue
    };
  });
  
  // R-squared and F-statistic
  const rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;
  const adjustedRSquared = n > k + 1 ? 1 - ((1 - rSquared) * (n - 1) / (n - k - 1)) : 0;
  const ssRegression = ssTotal - ssResidual;
  const msRegression = k > 0 ? ssRegression / k : 0;
  const fStatistic = mse > 0 && k > 0 ? msRegression / mse : 0;
  const fPValue = fStatistic > 0 && dfResid > 0 ? 1 - fDistCDF(fStatistic, k, dfResid) : 1;
  
  return { 
    coefficients, 
    rSquared: isNaN(rSquared) ? 0 : Math.max(0, Math.min(1, rSquared)), 
    adjustedRSquared: isNaN(adjustedRSquared) ? 0 : adjustedRSquared,
    fStatistic: isNaN(fStatistic) ? 0 : fStatistic,
    fPValue: isNaN(fPValue) ? 1 : fPValue
  };
}

// Interpretation helpers
function interpretCorrelationStrength(r: number): string {
  const absR = Math.abs(r);
  if (absR >= 0.9) return "Very Strong";
  if (absR >= 0.7) return "Strong";
  if (absR >= 0.5) return "Moderate";
  if (absR >= 0.3) return "Weak";
  return "Very Weak / Negligible";
}

function interpretSignificance(pValue: number): string {
  if (pValue < 0.001) return "Highly significant (p < 0.001)";
  if (pValue < 0.01) return "Very significant (p < 0.01)";
  if (pValue < 0.05) return "Significant (p < 0.05)";
  return "Not significant (p ≥ 0.05)";
}

// Generate AI interpretation using Lovable AI
async function generateAcademicInterpretation(analysisType: string, results: any): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    return generateTemplateInterpretation(analysisType, results);
  }
  
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are an academic research assistant helping Nigerian undergraduate and postgraduate students write Chapter 4 (Results & Analysis).

WRITING STYLE:
- Use formal academic English
- Reference tables and figures by number (e.g., "As shown in Table 4.x...")
- Explain what was tested, what was found, and what it means
- Never use raw statistical jargon without explanation
- Use phrases like "The results indicate that...", "This finding suggests..."

OUTPUT FORMAT:
- Write 3-5 sentences as a paragraph
- Include the key statistics with their values
- Provide a brief interpretation of what the result means for the research`
          },
          {
            role: 'user',
            content: `Generate a Chapter 4 interpretation for this ${analysisType} analysis:\n\n${JSON.stringify(results, null, 2)}`
          }
        ],
        max_tokens: 500,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.choices[0].message.content;
    }
  } catch (error) {
    console.error('AI interpretation error:', error);
  }
  
  return generateTemplateInterpretation(analysisType, results);
}

function generateTemplateInterpretation(analysisType: string, results: any): string {
  switch (analysisType) {
    case 'descriptive':
      return `The descriptive statistics analysis reveals that the variable has a mean of ${results.mean?.toFixed(2) || 'N/A'}, with a standard deviation of ${results.stdDev?.toFixed(2) || 'N/A'}. The median value is ${results.median?.toFixed(2) || 'N/A'}, indicating the central tendency of the distribution. These findings provide a foundational understanding of the data distribution for subsequent analyses.`;
    
    case 'correlation_pearson':
      const strength = interpretCorrelationStrength(results.r);
      const direction = results.r > 0 ? 'positive' : 'negative';
      return `The Pearson correlation analysis indicates a ${strength.toLowerCase()} ${direction} relationship between the variables (r = ${results.r?.toFixed(3) || 'N/A'}). ${interpretSignificance(results.pValue)}. This suggests that as one variable increases, the other tends to ${direction === 'positive' ? 'increase' : 'decrease'} accordingly.`;
    
    case 'ttest_independent':
      return `The independent samples t-test revealed ${results.pValue < 0.05 ? 'a statistically significant' : 'no statistically significant'} difference between the two groups (t = ${results.tValue?.toFixed(3) || 'N/A'}, df = ${results.df || 'N/A'}, p = ${results.pValue?.toFixed(3) || 'N/A'}). The mean difference of ${results.meanDiff?.toFixed(2) || 'N/A'} ${results.pValue < 0.05 ? 'indicates that' : 'suggests that while there is a numerical difference,'} the groups ${results.pValue < 0.05 ? 'differ significantly' : 'do not differ significantly'} on this measure.`;
    
    case 'ttest_paired':
      return `The paired samples t-test revealed ${results.pValue < 0.05 ? 'a statistically significant' : 'no statistically significant'} difference between pre-test and post-test scores (t = ${results.tValue?.toFixed(3) || 'N/A'}, df = ${results.df || 'N/A'}, p = ${results.pValue?.toFixed(3) || 'N/A'}). The mean difference of ${results.meanDiff?.toFixed(2) || 'N/A'} suggests that ${results.pValue < 0.05 ? 'the intervention had a significant effect' : 'there was no significant change'} over time.`;
    
    case 'anova_oneway':
      return `The one-way ANOVA test revealed ${results.pValue < 0.05 ? 'a statistically significant' : 'no statistically significant'} difference among the groups (F(${results.df1}, ${results.df2}) = ${results.fValue?.toFixed(3) || 'N/A'}, p = ${results.pValue?.toFixed(3) || 'N/A'}). ${results.pValue < 0.05 ? 'This indicates that at least one group mean differs significantly from the others.' : 'This suggests that the groups do not differ significantly on this variable.'}`;
    
    case 'anova_twoway':
      return `The two-way ANOVA revealed the following effects: Main effect of Factor 1 (F = ${results.mainEffect1?.fValue?.toFixed(3) || 'N/A'}, p = ${results.mainEffect1?.pValue?.toFixed(3) || 'N/A'}), Main effect of Factor 2 (F = ${results.mainEffect2?.fValue?.toFixed(3) || 'N/A'}, p = ${results.mainEffect2?.pValue?.toFixed(3) || 'N/A'}), and Interaction effect (F = ${results.interaction?.fValue?.toFixed(3) || 'N/A'}, p = ${results.interaction?.pValue?.toFixed(3) || 'N/A'}). ${results.interaction?.pValue < 0.05 ? 'The significant interaction suggests that the effect of one factor depends on the level of the other factor.' : 'The non-significant interaction indicates that the factors act independently.'}`;
    
    case 'ancova':
      return `The ANCOVA analysis, controlling for the covariate, revealed ${results.pValue < 0.05 ? 'a statistically significant' : 'no statistically significant'} difference among the adjusted group means (F(${results.df1}, ${results.df2}) = ${results.fValue?.toFixed(3) || 'N/A'}, p = ${results.pValue?.toFixed(3) || 'N/A'}). The covariate had ${results.covariateEffect?.pValue < 0.05 ? 'a significant' : 'no significant'} relationship with the dependent variable (b = ${results.covariateEffect?.b?.toFixed(3) || 'N/A'}).`;
    
    case 'regression_linear':
      return `The multiple linear regression analysis explains ${((results.rSquared || 0) * 100).toFixed(1)}% of the variance in the dependent variable (R² = ${results.rSquared?.toFixed(3) || 'N/A'}, Adjusted R² = ${results.adjustedRSquared?.toFixed(3) || 'N/A'}). The overall model is ${results.fPValue < 0.05 ? 'statistically significant' : 'not statistically significant'} (F = ${results.fStatistic?.toFixed(3) || 'N/A'}, p = ${results.fPValue?.toFixed(3) || 'N/A'}).`;
    
    case 'regression_logistic':
      return `The logistic regression model demonstrated ${results.modelFit?.pValue < 0.05 ? 'good' : 'poor'} overall fit (χ² = ${results.modelFit?.chiSquare?.toFixed(3) || 'N/A'}, p = ${results.modelFit?.pValue?.toFixed(3) || 'N/A'}). The model achieved an accuracy of ${((results.classificationTable?.accuracy || 0) * 100).toFixed(1)}% in classifying cases. The Nagelkerke pseudo R² of ${results.modelFit?.pseudoRSquared?.toFixed(3) || 'N/A'} indicates the proportion of variance explained.`;
    
    case 'factor_analysis':
      return `The factor analysis revealed ${results.recommendedFactors || 'N/A'} factors with eigenvalues greater than 1, explaining ${results.totalVarianceExplained?.toFixed(1) || 'N/A'}% of the total variance. The KMO measure of sampling adequacy was ${results.kmo?.toFixed(3) || 'N/A'}, ${results.kmo >= 0.7 ? 'indicating good suitability for factor analysis' : results.kmo >= 0.5 ? 'indicating adequate suitability' : 'suggesting the data may not be ideal for factor analysis'}. Bartlett's test of sphericity was ${results.bartlettTest?.pValue < 0.05 ? 'significant' : 'not significant'} (χ² = ${results.bartlettTest?.chiSquare?.toFixed(2) || 'N/A'}, p = ${results.bartlettTest?.pValue?.toFixed(3) || 'N/A'}).`;
    
    case 'chi_square':
      return `The chi-square test of independence revealed ${results.pValue < 0.05 ? 'a statistically significant' : 'no statistically significant'} association between the categorical variables (χ² = ${results.chiSquare?.toFixed(3) || 'N/A'}, df = ${results.df || 'N/A'}, p = ${results.pValue?.toFixed(3) || 'N/A'}). Cramer's V of ${results.cramersV?.toFixed(3) || 'N/A'} indicates ${results.cramersV >= 0.5 ? 'a strong' : results.cramersV >= 0.3 ? 'a moderate' : 'a weak'} effect size.`;
    
    default:
      return `The analysis has been completed. Please review the statistical results in the table above for detailed findings.`;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, data, columns, analyses, sessionId } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user profile for access control
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    const isFreeUser = profile.plan_type === 'free';
    
    switch (action) {
      case 'parse_data': {
        // Parse uploaded file data (base64 encoded)
        const fileBuffer = Uint8Array.from(atob(data), c => c.charCodeAt(0));
        const workbook = XLSX.read(fileBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        if (jsonData.length < 2) {
          throw new Error('File must contain at least a header row and one data row');
        }
        
        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1) as any[][];
        
        // Auto-detect column types
        const columnConfig = headers.map((name, index) => {
          const values = rows.map(row => row[index]).filter(v => v !== undefined && v !== null && v !== '');
          const numericValues = values.filter(v => !isNaN(Number(v)));
          
          let detectedType = 'categorical';
          if (numericValues.length === values.length && values.length > 0) {
            // Check if Likert (1-5 or 1-7 scale)
            const numVals = numericValues.map(Number);
            const min = Math.min(...numVals);
            const max = Math.max(...numVals);
            if (min >= 1 && max <= 7 && Number.isInteger(min) && Number.isInteger(max)) {
              detectedType = 'likert';
            } else {
              detectedType = 'numeric';
            }
          }
          
          return {
            name,
            index,
            type: detectedType,
            included: true,
            sampleValues: values.slice(0, 5)
          };
        });
        
        return new Response(
          JSON.stringify({
            success: true,
            headers,
            rowCount: rows.length,
            columnConfig,
            preview: rows.slice(0, 10)
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      case 'run_analysis': {
        // Check free user monthly limit
        if (isFreeUser) {
          const now = new Date();
          const resetDate = profile.monthly_analysis_reset_date 
            ? new Date(profile.monthly_analysis_reset_date) 
            : new Date(0);
          
          // Reset if new month
          if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
            await supabaseClient
              .from('profiles')
              .update({ 
                monthly_analysis_count: 0,
                monthly_analysis_reset_date: now.toISOString()
              })
              .eq('id', user.id);
          } else if (profile.monthly_analysis_count >= 1) {
            return new Response(
              JSON.stringify({ error: 'Free users can only analyze 1 dataset per month. Upgrade for unlimited access.' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          // Free users can only use descriptive and correlation
          const allowedFreeAnalyses = ['descriptive', 'frequencies', 'correlation_pearson'];
          const requestedAnalyses = analyses.filter((a: string) => allowedFreeAnalyses.includes(a));
          if (requestedAnalyses.length !== analyses.length) {
            return new Response(
              JSON.stringify({ error: 'Free users can only access Descriptive Statistics and Correlation Analysis. Upgrade for full access.' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
        
        // Calculate total credits needed
        const totalCredits = analyses.reduce((sum: number, a: string) => sum + (ANALYSIS_CREDITS[a] || 0), 0);
        
        // Check if user has enough credits
        const dailyCredits = profile.daily_credits || 0;
        const paidCredits = profile.paid_credits || 0;
        const availableCredits = dailyCredits + paidCredits;
        
        if (availableCredits < totalCredits) {
          return new Response(
            JSON.stringify({ 
              error: `Insufficient credits. You need ${totalCredits} credits but have ${availableCredits}.`,
              requiredCredits: totalCredits,
              availableCredits 
            }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Run the analyses
        const results: Record<string, any> = {};
        
        for (const analysisType of analyses) {
          try {
            switch (analysisType) {
              case 'descriptive': {
                const numericCols = columns.filter((c: any) => c.type === 'numeric' || c.type === 'likert');
                results.descriptive = {};
                for (const col of numericCols) {
                  const values = data.map((row: any) => Number(row[col.index])).filter((v: number) => !isNaN(v));
                  // Fix: Handle empty arrays to avoid Math.min/max returning Infinity
                  if (values.length === 0) {
                    results.descriptive[col.name] = {
                      count: 0,
                      mean: null,
                      median: null,
                      mode: [],
                      stdDev: null,
                      min: null,
                      max: null,
                      variance: null,
                      histogram: []
                    };
                  } else {
                    results.descriptive[col.name] = {
                      count: values.length,
                      mean: mean(values),
                      median: median(values),
                      mode: mode(values),
                      stdDev: standardDeviation(values),
                      min: Math.min(...values),
                      max: Math.max(...values),
                      variance: variance(values),
                      histogram: generateHistogramBins(values)  // Real histogram from actual data
                    };
                  }
                }
                const firstResult = Object.values(results.descriptive).find(v => typeof v === 'object' && v !== null && (v as any).count > 0);
                results.descriptive.interpretation = await generateAcademicInterpretation('descriptive', firstResult);
                break;
              }
              
              case 'frequencies': {
                results.frequencies = {};
                for (const col of columns.filter((c: any) => c.included)) {
                  const values = data.map((row: any) => row[col.index]).filter((v: any) => v !== undefined && v !== null);
                  results.frequencies[col.name] = frequencyAnalysis(values);
                }
                break;
              }
              
              case 'likert': {
                const likertCols = columns.filter((c: any) => c.type === 'likert');
                results.likert = {};
                for (const col of likertCols) {
                  const values = data.map((row: any) => Number(row[col.index])).filter((v: number) => !isNaN(v));
                  results.likert[col.name] = likertAnalysis(values);
                }
                break;
              }
              
              case 'correlation_pearson': {
                const numericCols = columns.filter((c: any) => (c.type === 'numeric' || c.type === 'likert') && c.included);
                results.correlation_pearson = { matrix: [], variables: numericCols.map((c: any) => c.name) };
                
                for (let i = 0; i < numericCols.length; i++) {
                  const row: any[] = [];
                  for (let j = 0; j < numericCols.length; j++) {
                    const x = data.map((r: any) => Number(r[numericCols[i].index])).filter((v: number) => !isNaN(v));
                    const y = data.map((r: any) => Number(r[numericCols[j].index])).filter((v: number) => !isNaN(v));
                    const minLen = Math.min(x.length, y.length);
                    const corr = pearsonCorrelation(x.slice(0, minLen), y.slice(0, minLen));
                    row.push({ ...corr, strength: interpretCorrelationStrength(corr.r) });
                  }
                  results.correlation_pearson.matrix.push(row);
                }
                
                if (numericCols.length >= 2) {
                  results.correlation_pearson.interpretation = await generateAcademicInterpretation(
                    'correlation_pearson', 
                    results.correlation_pearson.matrix[0][1]
                  );
                }
                break;
              }
              
              case 'correlation_spearman': {
                const numericCols = columns.filter((c: any) => (c.type === 'numeric' || c.type === 'likert') && c.included);
                results.correlation_spearman = { matrix: [], variables: numericCols.map((c: any) => c.name) };
                
                for (let i = 0; i < numericCols.length; i++) {
                  const row: any[] = [];
                  for (let j = 0; j < numericCols.length; j++) {
                    const x = data.map((r: any) => Number(r[numericCols[i].index])).filter((v: number) => !isNaN(v));
                    const y = data.map((r: any) => Number(r[numericCols[j].index])).filter((v: number) => !isNaN(v));
                    const minLen = Math.min(x.length, y.length);
                    const corr = spearmanCorrelation(x.slice(0, minLen), y.slice(0, minLen));
                    row.push({ ...corr, strength: interpretCorrelationStrength(corr.rho) });
                  }
                  results.correlation_spearman.matrix.push(row);
                }
                break;
              }
              
              case 'ttest_independent': {
                const groupCol = columns.find((c: any) => c.type === 'categorical' && c.isGrouping);
                const dvCol = columns.find((c: any) => (c.type === 'numeric' || c.type === 'likert') && c.isDependentVariable);
                
                if (groupCol && dvCol) {
                  const groups: Record<string, number[]> = {};
                  data.forEach((row: any) => {
                    const groupKey = String(row[groupCol.index]);
                    const value = Number(row[dvCol.index]);
                    if (!isNaN(value)) {
                      if (!groups[groupKey]) groups[groupKey] = [];
                      groups[groupKey].push(value);
                    }
                  });
                  
                  const groupKeys = Object.keys(groups);
                  if (groupKeys.length === 2) {
                    const testResult = independentTTest(groups[groupKeys[0]], groups[groupKeys[1]]);
                    const groupArrays = groupKeys.map(k => groups[k]);
                    
                    results.ttest_independent = {
                      ...testResult,
                      groups: groupKeys,
                      groupMeans: { [groupKeys[0]]: mean(groups[groupKeys[0]]), [groupKeys[1]]: mean(groups[groupKeys[1]]) },
                      significance: interpretSignificance(testResult.pValue),
                      interpretation: await generateAcademicInterpretation('ttest_independent', testResult),
                      // Add assumption checks for t-test
                      assumptions: {
                        normality: groupKeys.map(k => ({
                          group: k,
                          ...shapiroWilkTest(groups[k])
                        })),
                        homogeneity: {
                          ...levenesTest(groupArrays),
                          groupVariances: groupKeys.map(k => ({
                            name: k,
                            variance: variance(groups[k])
                          }))
                        },
                        qqPlotData: groupKeys.reduce((acc, k) => {
                          acc[k] = generateQQPlotData(groups[k]);
                          return acc;
                        }, {} as Record<string, any>)
                      }
                    };
                  }
                } else {
                  results.ttest_independent = { error: 'Please configure grouping variable and dependent variable' };
                }
                break;
              }
              
              case 'ttest_paired': {
                const beforeCol = columns.find((c: any) => c.isPre);
                const afterCol = columns.find((c: any) => c.isPost);
                
                if (beforeCol && afterCol) {
                  const before = data.map((r: any) => Number(r[beforeCol.index])).filter((v: number) => !isNaN(v));
                  const after = data.map((r: any) => Number(r[afterCol.index])).filter((v: number) => !isNaN(v));
                  const minLen = Math.min(before.length, after.length);
                  
                  const beforeTrimmed = before.slice(0, minLen);
                  const afterTrimmed = after.slice(0, minLen);
                  const differences = beforeTrimmed.map((b: number, i: number) => afterTrimmed[i] - b);
                  
                  const testResult = pairedTTest(beforeTrimmed, afterTrimmed);
                  results.ttest_paired = {
                    ...testResult,
                    preMean: mean(beforeTrimmed),
                    postMean: mean(afterTrimmed),
                    significance: interpretSignificance(testResult.pValue),
                    interpretation: await generateAcademicInterpretation('ttest_paired', testResult),
                    // Add assumption checks for paired t-test (normality of differences)
                    assumptions: {
                      normality: [
                        { group: 'Pre-test', ...shapiroWilkTest(beforeTrimmed) },
                        { group: 'Post-test', ...shapiroWilkTest(afterTrimmed) },
                        { group: 'Differences', ...shapiroWilkTest(differences) }
                      ],
                      qqPlotData: {
                        'Pre-test': generateQQPlotData(beforeTrimmed),
                        'Post-test': generateQQPlotData(afterTrimmed),
                        'Differences': generateQQPlotData(differences)
                      }
                    }
                  };
                } else {
                  results.ttest_paired = { error: 'Please configure pre-test and post-test columns' };
                }
                break;
              }
              
              case 'anova_oneway': {
                const groupCol = columns.find((c: any) => c.type === 'categorical' && c.isGrouping);
                const dvCol = columns.find((c: any) => (c.type === 'numeric' || c.type === 'likert') && c.isDependentVariable);
                
                if (groupCol && dvCol) {
                  const groups: Record<string, number[]> = {};
                  data.forEach((row: any) => {
                    const groupKey = String(row[groupCol.index]);
                    const value = Number(row[dvCol.index]);
                    if (!isNaN(value)) {
                      if (!groups[groupKey]) groups[groupKey] = [];
                      groups[groupKey].push(value);
                    }
                  });
                  
                  const groupKeys = Object.keys(groups);
                  if (groupKeys.length >= 2) {
                    const groupArrays = groupKeys.map(k => groups[k]);
                    const testResult = oneWayAnova(groupArrays);
                    
                    // Build base result
                    results.anova_oneway = {
                      ...testResult,
                      groups: groupKeys,
                      groupStats: groupKeys.map((k, i) => ({
                        name: k,
                        n: groups[k].length,
                        mean: testResult.groupMeans[i],
                        stdDev: standardDeviation(groups[k])
                      })),
                      significance: interpretSignificance(testResult.pValue),
                      interpretation: await generateAcademicInterpretation('anova_oneway', testResult),
                      // Add assumption checks
                      assumptions: {
                        normality: groupKeys.map(k => ({
                          group: k,
                          ...shapiroWilkTest(groups[k])
                        })),
                        homogeneity: {
                          ...levenesTest(groupArrays),
                          groupVariances: groupKeys.map((k, i) => ({
                            name: k,
                            variance: variance(groups[k])
                          }))
                        },
                        qqPlotData: groupKeys.reduce((acc, k) => {
                          acc[k] = generateQQPlotData(groups[k]);
                          return acc;
                        }, {} as Record<string, any>)
                      },
                      // Add post-hoc tests if ANOVA is significant and 3+ groups
                      postHoc: testResult.pValue < 0.05 && groupKeys.length >= 3 ? {
                        tukey: tukeyHSD(groups, groupKeys, testResult.msWithin, testResult.df2),
                        bonferroni: bonferroniPostHoc(groups, groupKeys, testResult.msWithin, testResult.df2)
                      } : null
                    };
                  }
                } else {
                  results.anova_oneway = { error: 'Please configure grouping variable and dependent variable' };
                }
                break;
              }
              
              case 'anova_twoway': {
                const factor1Col = columns.find((c: any) => c.type === 'categorical' && c.isGrouping);
                const factor2Col = columns.find((c: any) => c.type === 'categorical' && c.isSecondaryGrouping);
                const dvCol = columns.find((c: any) => (c.type === 'numeric' || c.type === 'likert') && c.isDependentVariable);
                
                if (factor1Col && factor2Col && dvCol) {
                  const anovaResult = twoWayAnova(data, factor1Col, factor2Col, dvCol);
                  results.anova_twoway = {
                    ...anovaResult,
                    factor1Name: factor1Col.name,
                    factor2Name: factor2Col.name,
                    dvName: dvCol.name,
                    interpretation: await generateAcademicInterpretation('anova_twoway', anovaResult)
                  };
                } else {
                  results.anova_twoway = { error: 'Please configure both grouping variables and dependent variable' };
                }
                break;
              }
              
              case 'ancova': {
                const groupCol = columns.find((c: any) => c.type === 'categorical' && c.isGrouping);
                const covariateCol = columns.find((c: any) => c.isCovariate);
                const dvCol = columns.find((c: any) => (c.type === 'numeric' || c.type === 'likert') && c.isDependentVariable);
                
                if (groupCol && covariateCol && dvCol) {
                  const ancovaResult = ancova(data, groupCol, covariateCol, dvCol);
                  results.ancova = {
                    ...ancovaResult,
                    groupName: groupCol.name,
                    covariateName: covariateCol.name,
                    dvName: dvCol.name,
                    interpretation: await generateAcademicInterpretation('ancova', ancovaResult)
                  };
                } else {
                  results.ancova = { error: 'Please configure grouping variable, covariate, and dependent variable' };
                }
                break;
              }
              
              case 'regression_linear': {
                const dvCol = columns.find((c: any) => c.isDependentVariable && (c.type === 'numeric' || c.type === 'likert'));
                const ivCols = columns.filter((c: any) => c.isIndependentVariable && (c.type === 'numeric' || c.type === 'likert'));
                
                if (dvCol && ivCols.length > 0) {
                  const y = data.map((r: any) => Number(r[dvCol.index])).filter((v: number) => !isNaN(v));
                  const xVars = ivCols.map((col: any) => 
                    data.map((r: any) => Number(r[col.index])).filter((v: number) => !isNaN(v))
                  );
                  
                  const minLen = Math.min(y.length, ...xVars.map((x: number[]) => x.length));
                  const yTrimmed = y.slice(0, minLen);
                  const xVarsTrimmed = xVars.map((x: number[]) => x.slice(0, minLen));
                  
                  const regResult = linearRegression(yTrimmed, xVarsTrimmed);
                  
                  // Update coefficient names
                  regResult.coefficients = regResult.coefficients.map((coef, i) => ({
                    ...coef,
                    name: i === 0 ? 'Intercept' : ivCols[i - 1].name
                  }));
                  
                  results.regression_linear = {
                    ...regResult,
                    dependentVariable: dvCol.name,
                    independentVariables: ivCols.map((c: any) => c.name),
                    sampleSize: minLen,
                    significance: interpretSignificance(regResult.fPValue),
                    interpretation: await generateAcademicInterpretation('regression_linear', regResult)
                  };
                } else {
                  results.regression_linear = { error: 'Please configure dependent and independent variables' };
                }
                break;
              }
              
              case 'regression_logistic': {
                const dvCol = columns.find((c: any) => c.isDependentVariable && c.type === 'categorical');
                const ivCols = columns.filter((c: any) => c.isIndependentVariable && (c.type === 'numeric' || c.type === 'likert'));
                
                if (dvCol && ivCols.length > 0) {
                  // Convert DV to binary (0/1)
                  const uniqueValues = [...new Set(data.map((r: any) => r[dvCol.index]))];
                  const y = data.map((r: any) => uniqueValues.indexOf(r[dvCol.index]) > 0 ? 1 : 0);
                  
                  const xVars = ivCols.map((col: any) => 
                    data.map((r: any) => Number(r[col.index]))
                  );
                  
                  const varNames = ivCols.map((c: any) => c.name);
                  const logitResult = logisticRegression(y, xVars, varNames);
                  
                  results.regression_logistic = {
                    ...logitResult,
                    dependentVariable: dvCol.name,
                    independentVariables: varNames,
                    outcomeCategories: uniqueValues,
                    interpretation: await generateAcademicInterpretation('regression_logistic', logitResult)
                  };
                } else {
                  results.regression_logistic = { error: 'Please configure a binary dependent variable and independent variables' };
                }
                break;
              }
              
              case 'chi_square': {
                const cat1Col = columns.find((c: any) => c.type === 'categorical' && c.isGrouping);
                const cat2Col = columns.find((c: any) => c.type === 'categorical' && c.isSecondaryGrouping);
                
                if (cat1Col && cat2Col) {
                  // Build contingency table
                  const cat1Values = [...new Set(data.map((r: any) => String(r[cat1Col.index])))];
                  const cat2Values = [...new Set(data.map((r: any) => String(r[cat2Col.index])))];
                  
                  const observed: number[][] = cat1Values.map(() => cat2Values.map(() => 0));
                  
                  data.forEach((row: any) => {
                    const i = cat1Values.indexOf(String(row[cat1Col.index]));
                    const j = cat2Values.indexOf(String(row[cat2Col.index]));
                    if (i >= 0 && j >= 0) observed[i][j]++;
                  });
                  
                  const chiResult = chiSquareTest(observed);
                  
                  results.chi_square = {
                    ...chiResult,
                    variable1: cat1Col.name,
                    variable2: cat2Col.name,
                    categories1: cat1Values,
                    categories2: cat2Values,
                    observed,
                    interpretation: await generateAcademicInterpretation('chi_square', chiResult)
                  };
                } else {
                  results.chi_square = { error: 'Please configure two categorical variables' };
                }
                break;
              }
              
              case 'factor_analysis': {
                const likertCols = columns.filter((c: any) => c.type === 'likert' && c.included);
                
                if (likertCols.length >= 5) {
                  // Prepare data matrix
                  const dataMatrix: number[][] = data.map((row: any) => 
                    likertCols.map((col: any) => Number(row[col.index]))
                  ).filter((row: number[]) => row.every(v => !isNaN(v)));
                  
                  const varNames = likertCols.map((c: any) => c.name);
                  const efaResult = exploratoryFactorAnalysis(dataMatrix, varNames);
                  
                  results.factor_analysis = {
                    ...efaResult,
                    sampleSize: dataMatrix.length,
                    variableCount: varNames.length,
                    interpretation: await generateAcademicInterpretation('factor_analysis', efaResult)
                  };
                } else {
                  results.factor_analysis = { error: 'Factor analysis requires at least 5 Likert scale items' };
                }
                break;
              }
            }
          } catch (analysisError) {
            console.error(`Error in ${analysisType}:`, analysisError);
            results[analysisType] = { error: `Failed to run ${analysisType}: ${analysisError}` };
          }
        }
        
        // Deduct credits
        let creditsToDeduct = totalCredits;
        let newDailyCredits = dailyCredits;
        let newPaidCredits = paidCredits;
        
        if (dailyCredits >= creditsToDeduct) {
          newDailyCredits = dailyCredits - creditsToDeduct;
        } else {
          creditsToDeduct -= dailyCredits;
          newDailyCredits = 0;
          newPaidCredits = Math.max(0, paidCredits - creditsToDeduct);
        }
        
        // Update profile with new credits
        const updateData: any = { 
          daily_credits: newDailyCredits,
          paid_credits: newPaidCredits
        };
        
        if (isFreeUser) {
          updateData.monthly_analysis_count = (profile.monthly_analysis_count || 0) + 1;
        }
        
        await supabaseClient
          .from('profiles')
          .update(updateData)
          .eq('id', user.id);
        
        // Sanitize results to remove NaN and Infinity values before saving/returning
        const sanitizedResults = sanitizeResults(results);
        
        // Save analysis session
        if (sessionId) {
          await supabaseClient
            .from('analysis_sessions')
            .update({
              analyses_run: analyses,
              results: sanitizedResults,
              credits_used: totalCredits,
              updated_at: new Date().toISOString()
            })
            .eq('id', sessionId);
        }
        
        return new Response(
          JSON.stringify({
            success: true,
            results: sanitizedResults,
            creditsUsed: totalCredits,
            remainingCredits: {
              daily: newDailyCredits,
              paid: newPaidCredits
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      case 'generate_chapter': {
        // Generate full Chapter 4 text from all results
        const chapterText = await generateFullChapter(data);
        
        return new Response(
          JSON.stringify({ success: true, chapterText }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      default:
        throw new Error('Invalid action');
    }
  } catch (error) {
    console.error('Data analysis error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateFullChapter(results: any): Promise<string> {
  let chapter = `CHAPTER FOUR
DATA PRESENTATION, ANALYSIS AND INTERPRETATION

4.1 Introduction

This chapter presents the analysis and interpretation of data collected for this study. The data were analyzed using appropriate statistical techniques to test the research hypotheses and answer the research questions. The results are presented in tables and figures with accompanying interpretations.

`;

  let sectionNum = 2;
  
  for (const [key, value] of Object.entries(results)) {
    if (value && typeof value === 'object' && 'interpretation' in value) {
      const result = value as any;
      chapter += `4.${sectionNum} ${getAnalysisTitle(key)}

${result.interpretation || 'Analysis completed. Please refer to the tables above for detailed results.'}

`;
      sectionNum++;
    }
  }

  return chapter;
}

function getAnalysisTitle(key: string): string {
  const titles: Record<string, string> = {
    descriptive: 'Descriptive Statistics',
    frequencies: 'Frequency Analysis',
    likert: 'Likert Scale Analysis',
    correlation_pearson: 'Pearson Correlation Analysis',
    correlation_spearman: 'Spearman Correlation Analysis',
    ttest_independent: 'Independent Samples T-Test',
    ttest_paired: 'Paired Samples T-Test',
    chi_square: 'Chi-Square Test of Independence',
    anova_oneway: 'One-Way Analysis of Variance (ANOVA)',
    anova_twoway: 'Two-Way Analysis of Variance (ANOVA)',
    ancova: 'Analysis of Covariance (ANCOVA)',
    regression_linear: 'Multiple Linear Regression Analysis',
    regression_logistic: 'Binary Logistic Regression Analysis',
    factor_analysis: 'Exploratory Factor Analysis',
  };
  return titles[key] || key;
}
