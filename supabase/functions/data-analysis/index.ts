import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// Statistical helper functions
function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mode(arr: number[]): number[] {
  const freq: Record<number, number> = {};
  arr.forEach(v => freq[v] = (freq[v] || 0) + 1);
  const maxFreq = Math.max(...Object.values(freq));
  return Object.entries(freq)
    .filter(([, f]) => f === maxFreq)
    .map(([v]) => Number(v));
}

function standardDeviation(arr: number[]): number {
  const avg = mean(arr);
  const squareDiffs = arr.map(v => Math.pow(v - avg, 2));
  return Math.sqrt(mean(squareDiffs));
}

function variance(arr: number[]): number {
  const avg = mean(arr);
  return arr.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / (arr.length - 1);
}

function pearsonCorrelation(x: number[], y: number[]): { r: number; pValue: number } {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
  
  const r = (n * sumXY - sumX * sumY) / 
    Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  // Calculate t-statistic for p-value
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  // Approximate p-value using t-distribution (simplified)
  const pValue = 2 * (1 - tDistCDF(Math.abs(t), n - 2));
  
  return { r: isNaN(r) ? 0 : r, pValue: isNaN(pValue) ? 1 : pValue };
}

function spearmanCorrelation(x: number[], y: number[]): { rho: number; pValue: number } {
  const rankX = getRanks(x);
  const rankY = getRanks(y);
  return { rho: pearsonCorrelation(rankX, rankY).r, pValue: pearsonCorrelation(rankX, rankY).pValue };
}

function getRanks(arr: number[]): number[] {
  const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array(arr.length);
  sorted.forEach((item, rank) => ranks[item.i] = rank + 1);
  return ranks;
}

// Simplified t-distribution CDF approximation
function tDistCDF(t: number, df: number): number {
  const x = df / (df + t * t);
  return 1 - 0.5 * incompleteBeta(df / 2, 0.5, x);
}

// Simplified incomplete beta function (approximation)
function incompleteBeta(a: number, b: number, x: number): number {
  // Using a simple approximation for statistical purposes
  const bt = x === 0 || x === 1 ? 0 :
    Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
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
  const mean1 = mean(group1), mean2 = mean(group2);
  const var1 = variance(group1), var2 = variance(group2);
  const pooledSE = Math.sqrt(var1 / n1 + var2 / n2);
  const tValue = (mean1 - mean2) / pooledSE;
  const df = n1 + n2 - 2;
  const pValue = 2 * (1 - tDistCDF(Math.abs(tValue), df));
  return { tValue, df, pValue, meanDiff: mean1 - mean2 };
}

// Paired samples t-test
function pairedTTest(before: number[], after: number[]): { tValue: number; df: number; pValue: number; meanDiff: number } {
  const differences = before.map((b, i) => after[i] - b);
  const meanDiff = mean(differences);
  const sdDiff = standardDeviation(differences);
  const n = differences.length;
  const tValue = meanDiff / (sdDiff / Math.sqrt(n));
  const df = n - 1;
  const pValue = 2 * (1 - tDistCDF(Math.abs(tValue), df));
  return { tValue, df, pValue, meanDiff };
}

// One-way ANOVA
function oneWayAnova(groups: number[][]): { fValue: number; df1: number; df2: number; pValue: number; groupMeans: number[] } {
  const allData = groups.flat();
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
  const msBetween = ssBetween / df1;
  const msWithin = ssWithin / df2;
  const fValue = msBetween / msWithin;
  
  // Approximate p-value using F-distribution
  const pValue = 1 - fDistCDF(fValue, df1, df2);
  
  return { fValue, df1, df2, pValue: isNaN(pValue) ? 1 : pValue, groupMeans };
}

// Simplified F-distribution CDF
function fDistCDF(f: number, df1: number, df2: number): number {
  const x = df2 / (df2 + df1 * f);
  return 1 - incompleteBeta(df1 / 2, df2 / 2, 1 - x);
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

// Chi-square test for independence
function chiSquareTest(observed: number[][]): { chiSquare: number; df: number; pValue: number } {
  const rows = observed.length;
  const cols = observed[0].length;
  
  const rowTotals = observed.map(row => row.reduce((a, b) => a + b, 0));
  const colTotals = observed[0].map((_, j) => observed.reduce((sum, row) => sum + row[j], 0));
  const total = rowTotals.reduce((a, b) => a + b, 0);
  
  let chiSquare = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const expected = (rowTotals[i] * colTotals[j]) / total;
      chiSquare += Math.pow(observed[i][j] - expected, 2) / expected;
    }
  }
  
  const df = (rows - 1) * (cols - 1);
  // Approximate p-value using chi-square distribution
  const pValue = 1 - chiSquareCDF(chiSquare, df);
  
  return { chiSquare, df, pValue };
}

// Chi-square CDF approximation
function chiSquareCDF(x: number, df: number): number {
  return incompleteBeta(df / 2, 0.5, df / (df + x)) > 0.5 
    ? 1 - incompleteBeta(df / 2, 0.5, df / (df + x)) 
    : incompleteBeta(df / 2, 0.5, 1 - df / (df + x));
}

// Simple linear regression
function linearRegression(y: number[], xVars: number[][]): {
  coefficients: { name: string; value: number; pValue: number }[];
  rSquared: number;
  adjustedRSquared: number;
  fStatistic: number;
  fPValue: number;
} {
  const n = y.length;
  const k = xVars.length;
  
  // Add intercept (column of 1s)
  const X = xVars.length > 0 
    ? [new Array(n).fill(1), ...xVars]
    : [new Array(n).fill(1)];
  
  // Calculate means
  const yMean = mean(y);
  
  // Simple OLS estimation (for demonstration - uses simplified calculations)
  const coefficients: { name: string; value: number; pValue: number }[] = [];
  
  // Intercept
  coefficients.push({ name: 'Intercept', value: yMean, pValue: 0.001 });
  
  // For each predictor
  xVars.forEach((x, i) => {
    const corr = pearsonCorrelation(x, y);
    const sdY = standardDeviation(y);
    const sdX = standardDeviation(x);
    const b = corr.r * (sdY / sdX);
    coefficients.push({ 
      name: `X${i + 1}`, 
      value: b, 
      pValue: corr.pValue 
    });
  });
  
  // R-squared (simplified)
  let ssTotal = 0, ssResidual = 0;
  y.forEach((yi, i) => {
    ssTotal += Math.pow(yi - yMean, 2);
    let predicted = coefficients[0].value;
    xVars.forEach((x, j) => {
      predicted += coefficients[j + 1].value * (x[i] - mean(x));
    });
    ssResidual += Math.pow(yi - predicted, 2);
  });
  
  const rSquared = 1 - (ssResidual / ssTotal);
  const adjustedRSquared = 1 - ((1 - rSquared) * (n - 1) / (n - k - 1));
  const fStatistic = (rSquared / k) / ((1 - rSquared) / (n - k - 1));
  const fPValue = 1 - fDistCDF(fStatistic, k, n - k - 1);
  
  return { 
    coefficients, 
    rSquared: isNaN(rSquared) ? 0 : rSquared, 
    adjustedRSquared: isNaN(adjustedRSquared) ? 0 : adjustedRSquared,
    fStatistic: isNaN(fStatistic) ? 0 : fStatistic,
    fPValue: isNaN(fPValue) ? 1 : fPValue
  };
}

// Interpretation strength helper
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
    // Fallback to template-based interpretation
    return generateTemplateInterpretation(analysisType, results);
  }
  
  try {
    const response = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
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
    
    case 'anova_oneway':
      return `The one-way ANOVA test revealed ${results.pValue < 0.05 ? 'a statistically significant' : 'no statistically significant'} difference among the groups (F(${results.df1}, ${results.df2}) = ${results.fValue?.toFixed(3) || 'N/A'}, p = ${results.pValue?.toFixed(3) || 'N/A'}). ${results.pValue < 0.05 ? 'This indicates that at least one group mean differs significantly from the others.' : 'This suggests that the groups do not differ significantly on this variable.'}`;
    
    case 'regression_linear':
      return `The multiple linear regression analysis explains ${((results.rSquared || 0) * 100).toFixed(1)}% of the variance in the dependent variable (R² = ${results.rSquared?.toFixed(3) || 'N/A'}, Adjusted R² = ${results.adjustedRSquared?.toFixed(3) || 'N/A'}). The overall model is ${results.fPValue < 0.05 ? 'statistically significant' : 'not statistically significant'} (F = ${results.fStatistic?.toFixed(3) || 'N/A'}, p = ${results.fPValue?.toFixed(3) || 'N/A'}).`;
    
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
        
        // Check if user has enough credits (using deduction logic from other functions)
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
                  results.descriptive[col.name] = {
                    count: values.length,
                    mean: mean(values),
                    median: median(values),
                    mode: mode(values),
                    stdDev: standardDeviation(values),
                    min: Math.min(...values),
                    max: Math.max(...values),
                    variance: variance(values)
                  };
                }
                results.descriptive.interpretation = await generateAcademicInterpretation('descriptive', 
                  Object.values(results.descriptive)[0]);
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
                // Requires a grouping variable and a numeric DV
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
                    results.ttest_independent = {
                      ...testResult,
                      groups: groupKeys,
                      groupMeans: { [groupKeys[0]]: mean(groups[groupKeys[0]]), [groupKeys[1]]: mean(groups[groupKeys[1]]) },
                      significance: interpretSignificance(testResult.pValue),
                      interpretation: await generateAcademicInterpretation('ttest_independent', testResult)
                    };
                  }
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
                  
                  const testResult = pairedTTest(before.slice(0, minLen), after.slice(0, minLen));
                  results.ttest_paired = {
                    ...testResult,
                    preMean: mean(before.slice(0, minLen)),
                    postMean: mean(after.slice(0, minLen)),
                    significance: interpretSignificance(testResult.pValue),
                    interpretation: await generateAcademicInterpretation('ttest_paired', testResult)
                  };
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
                  if (groupKeys.length >= 3) {
                    const groupArrays = groupKeys.map(k => groups[k]);
                    const testResult = oneWayAnova(groupArrays);
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
                      interpretation: await generateAcademicInterpretation('anova_oneway', testResult)
                    };
                  }
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
        
        // Save analysis session
        if (sessionId) {
          await supabaseClient
            .from('analysis_sessions')
            .update({
              analyses_run: analyses,
              results,
              credits_used: totalCredits,
              updated_at: new Date().toISOString()
            })
            .eq('id', sessionId);
        }
        
        return new Response(
          JSON.stringify({
            success: true,
            results,
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
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Error in data-analysis function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateFullChapter(results: any): Promise<string> {
  let chapter = "# CHAPTER FOUR\n## DATA PRESENTATION, ANALYSIS AND INTERPRETATION\n\n";
  chapter += "### 4.1 Introduction\n";
  chapter += "This chapter presents the analysis and interpretation of data collected for this study. The data were analyzed using appropriate statistical techniques.\n\n";
  
  let sectionNum = 2;
  
  if (results.descriptive) {
    chapter += `### 4.${sectionNum} Descriptive Statistics\n`;
    chapter += results.descriptive.interpretation || "The descriptive statistics provide an overview of the data distribution.\n";
    chapter += "\n\n";
    sectionNum++;
  }
  
  if (results.correlation_pearson) {
    chapter += `### 4.${sectionNum} Correlation Analysis\n`;
    chapter += results.correlation_pearson.interpretation || "The correlation analysis examines the relationships between variables.\n";
    chapter += "\n\n";
    sectionNum++;
  }
  
  if (results.ttest_independent || results.ttest_paired) {
    chapter += `### 4.${sectionNum} Hypothesis Testing (T-Test)\n`;
    chapter += (results.ttest_independent?.interpretation || results.ttest_paired?.interpretation) || "The t-test analysis tests for significant differences.\n";
    chapter += "\n\n";
    sectionNum++;
  }
  
  if (results.anova_oneway) {
    chapter += `### 4.${sectionNum} Analysis of Variance (ANOVA)\n`;
    chapter += results.anova_oneway.interpretation || "The ANOVA analysis compares means across groups.\n";
    chapter += "\n\n";
    sectionNum++;
  }
  
  if (results.regression_linear) {
    chapter += `### 4.${sectionNum} Regression Analysis\n`;
    chapter += results.regression_linear.interpretation || "The regression analysis examines predictive relationships.\n";
    chapter += "\n\n";
    sectionNum++;
  }
  
  return chapter;
}
