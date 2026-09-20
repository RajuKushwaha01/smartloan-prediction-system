const axios = require('axios');

/**
 * Maps the Node.js application's internal camelCase fields to the
 * ML service's exact snake_case contract, calls FastAPI, and returns
 * the raw response (already spec-shaped) for the controller to store.
 */
async function getPrediction(applicationData) {
  const ML_API_URL = process.env.ML_API_URL || 'http://127.0.0.1:8000';

  const dependentsBucket = applicationData.dependents >= 3 ? '3+' : String(applicationData.dependents || 0);
  const propertyAreaMap = { Owned: 'Urban', Rented: 'Semiurban', 'Living with Family': 'Rural' };
  const creditMap = { Good: 1.0, Average: 0.5, Poor: 0.0 };

  const payload = {
    gender: applicationData.gender || 'Male',
    married: applicationData.maritalStatus === 'Married' ? 'Yes' : 'No',
    dependents: dependentsBucket,
    education: applicationData.education && applicationData.education.includes('Not') ? 'Not Graduate' : 'Graduate',
    self_employed: applicationData.selfEmployed ? 'Yes' : 'No',
    applicant_income: applicationData.monthlyIncome || 0,
    coapplicant_income: applicationData.coApplicantIncome || 0,
    loan_amount: (applicationData.loanAmount || 0) / 1000, // dataset convention: thousands
    loan_term: applicationData.loanTenure || 360,
    credit_history: creditMap[applicationData.creditHistory] ?? 0.5,
    property_area: propertyAreaMap[applicationData.residentialStatus] || 'Semiurban'
  };

  try {
    const response = await axios.post(`${ML_API_URL}/predict`, payload, { timeout: 6000 });
    return response.data;
  } catch (err) {
    console.warn('⚠️ ML API unreachable, using fallback estimator:', err.message);
    return fallbackEstimate(applicationData);
  }
}

/**
 * Runs a What-If simulation against the ML service using a modified
 * copy of the original application data. Never persisted server-side
 * as an official prediction — caller decides whether to save as a Scenario.
 */
async function simulatePrediction(baseApplicationData, overrides) {
  const ML_API_URL = process.env.ML_API_URL || 'http://127.0.0.1:8000';
  const merged = { ...baseApplicationData, ...overrides };

  const dependentsBucket = merged.dependents >= 3 ? '3+' : String(merged.dependents || 0);
  const propertyAreaMap = { Owned: 'Urban', Rented: 'Semiurban', 'Living with Family': 'Rural' };
  const creditMap = { Good: 1.0, Average: 0.5, Poor: 0.0 };

  const payload = {
    gender: merged.gender || 'Male',
    married: merged.maritalStatus === 'Married' ? 'Yes' : 'No',
    dependents: dependentsBucket,
    education: merged.education && merged.education.includes('Not') ? 'Not Graduate' : 'Graduate',
    self_employed: merged.selfEmployed ? 'Yes' : 'No',
    applicant_income: merged.monthlyIncome || 0,
    coapplicant_income: merged.coApplicantIncome || 0,
    loan_amount: (merged.loanAmount || 0) / 1000,
    loan_term: merged.loanTenure || 360,
    credit_history: creditMap[merged.creditHistory] ?? 0.5,
    property_area: propertyAreaMap[merged.residentialStatus] || 'Semiurban'
  };

  try {
    const response = await axios.post(`${ML_API_URL}/predict/simulate`, payload, { timeout: 6000 });
    return response.data;
  } catch (err) {
    console.warn('⚠️ Simulation ML call failed, using fallback:', err.message);
    const fallback = fallbackEstimate(merged);
    fallback.is_simulation = true;
    return fallback;
  }
}

function fallbackEstimate(data) {
  let score = 0.5; // 0-1 scale to match the real API contract
  const totalIncome = (data.monthlyIncome || 0) + (data.coApplicantIncome || 0);
  const emiRatio = (data.existingEMI || 0) / (totalIncome || 1);
  const loanToIncome = data.loanAmount / (data.annualIncome || (data.monthlyIncome || 1) * 12);

  if (data.creditHistory === 'Good') score += 0.2;
  else if (data.creditHistory === 'Poor') score -= 0.2;
  if ((data.annualIncome || 0) > 600000) score += 0.1;
  if (loanToIncome > 5) score -= 0.15;
  if (emiRatio > 0.4) score -= 0.15;
  if ((data.yearsOfEmployment || 0) >= 2) score += 0.05;

  score = Math.max(0.05, Math.min(0.95, score));
  let prediction = 'Review';
  if (score >= 0.65) prediction = 'Eligible';
  else if (score < 0.40) prediction = 'Not Eligible';

  const incomeStability = Math.min(100, Math.max(0, (totalIncome / 100000) * 100));
  const debtBurden = Math.min(100, emiRatio * 100);
  const loanAffordability = Math.max(0, 100 - debtBurden);

  return {
    prediction,
    probability: Math.round(score * 10000) / 10000,
    model_name: 'Fallback Rule-Based Estimator',
    model_version: 'FALLBACK-v1.0',
    feature_version: 'n/a',
    explanation_method: 'Rule-Based Heuristic (ML service unreachable)',
    interpretation: `The fallback estimator assigns the submitted application a predicted probability of ${score.toFixed(2)} for the '${prediction}' class.`,
    calibration_note: 'The ML service was unreachable; this is a simple rule-based estimate, not a model prediction.',
    feature_values: { note: 'ML service unreachable — no model feature vector was generated.' },
    factors: [
      { name: 'Credit History', contribution: data.creditHistory === 'Good' ? 85 : data.creditHistory === 'Poor' ? 20 : 50, impact: data.creditHistory === 'Poor' ? 'Negative' : 'Positive' },
      { name: 'Income', contribution: Math.min(90, ((data.annualIncome || 0) / 1000000) * 100), impact: 'Positive' },
      { name: 'Loan-to-Income Ratio', contribution: Math.min(90, loanToIncome * 20), impact: loanToIncome > 5 ? 'Negative' : 'Neutral' },
      { name: 'Existing Obligations', contribution: Math.min(90, emiRatio * 100), impact: emiRatio > 0.4 ? 'Negative' : 'Neutral' }
    ],
    financial_health: {
      income_stability: Math.round(incomeStability * 10) / 10,
      loan_affordability: Math.round(loanAffordability * 10) / 10,
      debt_burden: Math.round(debtBurden * 10) / 10
    }
  };
}

module.exports = { 
  getPrediction, 
  simulatePrediction 
};