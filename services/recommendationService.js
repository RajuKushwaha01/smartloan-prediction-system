/**
 * AI Loan Recommendation Engine
 * Project-derived recommendation logic — NOT financial advice or an
 * official lender offer. Combines the ML prediction with the applicant's
 * financial profile to suggest a more affordable loan range/tenure.
 */

function calculateEMI(principal, annualRatePercent, tenureMonths) {
  const r = annualRatePercent / 12 / 100;
  if (r === 0) return principal / tenureMonths;
  const emi = (principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1);
  return emi;
}

const ASSUMED_ANNUAL_RATE = 10.5; // project-assumed reference rate for recommendation purposes only

function generateRecommendation(application, predictionResult) {
  const totalMonthlyIncome = (application.monthlyIncome || 0) + (application.coApplicantIncome || 0);
  const existingEMI = application.existingEMI || 0;
  const monthlyExpenses = application.monthlyExpenses || 0;

  const availableIncome = totalMonthlyIncome - monthlyExpenses - existingEMI;

  // Affordable EMI: project-defined cap — at most 40% of available income
  // goes toward a new EMI, mirroring common (non-universal) lending caution.
  const affordableEMI = Math.max(0, availableIncome * 0.4);

  const requestedEMI = calculateEMI(application.loanAmount, ASSUMED_ANNUAL_RATE, application.loanTenure);

  // Solve backwards: what principal does the affordable EMI support at the same tenure?
  const r = ASSUMED_ANNUAL_RATE / 12 / 100;
  const tenure = application.loanTenure || 60;
  const maxAffordablePrincipal = affordableEMI > 0
    ? (affordableEMI * (Math.pow(1 + r, tenure) - 1)) / (r * Math.pow(1 + r, tenure))
    : 0;

  const recommendedMin = Math.max(10000, Math.round(maxAffordablePrincipal * 0.7 / 1000) * 1000);
  const recommendedMax = Math.max(recommendedMin, Math.round(maxAffordablePrincipal / 1000) * 1000);

  const dti = totalMonthlyIncome > 0 ? (existingEMI / totalMonthlyIncome) * 100 : 100;
  const loanToIncome = totalMonthlyIncome > 0 ? (application.loanAmount / (totalMonthlyIncome * 12)) * 100 : 999;
  const postLoanBurden = totalMonthlyIncome > 0 ? ((existingEMI + requestedEMI) / totalMonthlyIncome) * 100 : 100;

  let affordability = 'Low';
  if (postLoanBurden < 35) affordability = 'High';
  else if (postLoanBurden < 55) affordability = 'Moderate';

  const factors = [];
  factors.push(application.creditHistory === 'Good'
    ? { text: 'Positive credit history', positive: true }
    : application.creditHistory === 'Poor'
      ? { text: 'Weak credit history', positive: false }
      : { text: 'Average credit history', positive: true });

  factors.push(application.yearsOfEmployment >= 2
    ? { text: 'Stable employment history', positive: true }
    : { text: 'Limited employment history', positive: false });

  if (application.loanAmount > maxAffordablePrincipal * 1.3) {
    factors.push({ text: 'Requested amount exceeds recommended affordability', positive: false });
  }
  if (existingEMI > 0 && dti > 30) {
    factors.push({ text: 'Existing EMI burden is significant', positive: false });
  }
  if (availableIncome > totalMonthlyIncome * 0.3) {
    factors.push({ text: 'Healthy available income margin', positive: true });
  }

  const suggestedTenure = predictionResult && predictionResult.prediction === 'Not Eligible'
    ? Math.min(120, tenure + 24) // suggest a longer tenure to reduce EMI if not eligible
    : tenure;

  return {
    requestedLoan: application.loanAmount,
    recommendedMin,
    recommendedMax,
    recommendedTenure: suggestedTenure,
    estimatedEMI: Math.round(requestedEMI),
    affordability,
    dti: Math.round(dti * 10) / 10,
    loanToIncome: Math.round(loanToIncome * 10) / 10,
    postLoanBurden: Math.round(postLoanBurden * 10) / 10,
    availableIncome: Math.round(availableIncome),
    factors,
    disclaimer: 'This is a project-derived recommendation for academic/informational purposes only — not financial advice or an official lender offer.'
  };
}

module.exports = { generateRecommendation, calculateEMI };