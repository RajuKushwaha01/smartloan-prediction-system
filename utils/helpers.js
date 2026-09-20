/**
 * Debt-to-Income Ratio = Monthly Debt / Monthly Income × 100
 * Project-defined calculation used across the application.
 */
function calculateDTI(monthlyIncome, coApplicantIncome, existingEMI) {
  const totalIncome = (Number(monthlyIncome) || 0) + (Number(coApplicantIncome) || 0);
  if (totalIncome <= 0) return 0;
  const dti = ((Number(existingEMI) || 0) / totalIncome) * 100;
  return Math.round(dti * 10) / 10;
}

/**
 * Generates a unique, human-readable application ID.
 */
function generateApplicationId() {
  return 'SL-' + Date.now().toString().slice(-6);
}

/**
 * Formats a number as Indian Rupees with lakh/crore grouping.
 */
function formatINR(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN');
}

/**
 * Classifies a model probability into a prediction label using
 * the project's documented thresholds.
 */
function classifyPrediction(probability) {
  if (probability >= 65) return 'Eligible';
  if (probability >= 40) return 'Review';
  return 'Not Eligible';
}

module.exports = { calculateDTI, generateApplicationId, formatINR, classifyPrediction };