const axios = require('axios');
const LoanApplication = require('../models/LoanApplication');

const ML_API_URL = process.env.ML_API_URL || 'http://127.0.0.1:8000';

/**
 * Anomaly Detection — a separate system from the eligibility ML model.
 * Combines rule-based checks (run here in Node) with a statistical
 * Isolation Forest score (run via the Python ML service).
 * Flags are informational ("Anomaly Flag"), never accusatory.
 */
async function detectAnomalies(application, userId) {
  const flags = [];

  // ---- Rule-based: extreme income/loan combination ----
  const monthlyIncome = application.monthlyIncome || 0;
  const loanAmount = application.loanAmount || 0;
  if (monthlyIncome > 0 && loanAmount / (monthlyIncome * 12) > 15) {
    flags.push({
      type: 'invalid_combination',
      message: `Requested loan amount is unusually large relative to reported income.`,
      severity: 'Medium'
    });
  }

  // ---- Rule-based: duplicate/repeated application ----
  const recentDuplicates = await LoanApplication.countDocuments({
    user: userId,
    isDraft: false,
    loanAmount: application.loanAmount,
    loanPurpose: application.loanPurpose,
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  });
  if (recentDuplicates > 0) {
    flags.push({
      type: 'duplicate',
      message: 'A very similar application was submitted by this user within the last 24 hours.',
      severity: 'Low'
    });
  }

  // ---- Rule-based: repeated applications overall ----
  const totalRecentApps = await LoanApplication.countDocuments({
    user: userId, isDraft: false,
    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  });
  if (totalRecentApps >= 5) {
    flags.push({
      type: 'repeated_applications',
      message: `${totalRecentApps} applications submitted by this user in the past 7 days.`,
      severity: 'Medium'
    });
  }

  // ---- Statistical: Isolation Forest via ML service ----
  try {
    const payload = {
      applicant_income: monthlyIncome,
      coapplicant_income: application.coApplicantIncome || 0,
      loan_amount: loanAmount / 1000,
      loan_term: application.loanTenure || 360
    };
    const response = await axios.post(`${ML_API_URL}/anomaly/detect`, payload, { timeout: 5000 });
    if (response.data.is_anomaly) {
      flags.push({
        type: 'statistical_outlier',
        message: 'This application\'s financial profile falls outside the typical statistical range seen in the training data.',
        severity: 'Medium'
      });
    }
  } catch (e) {
    console.warn('⚠️ Anomaly detection ML call failed (non-blocking):', e.message);
  }

  return flags;
}

module.exports = { detectAnomalies };