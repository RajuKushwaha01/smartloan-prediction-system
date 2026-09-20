/**
 * Data Quality Engine — runs AFTER express-validator's field-level checks
 * but BEFORE the request reaches the ML service. Catches logical
 * inconsistencies that individual field validators can't see.
 */
function runDataQualityChecks(data) {
  const issues = [];

  // Feature compatibility — every field the ML service needs must be present
  const requiredForML = ['gender', 'maritalStatus', 'education', 'monthlyIncome', 'loanAmount', 'loanTenure', 'creditHistory', 'residentialStatus'];
  requiredForML.forEach(field => {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      issues.push(`Missing required field for prediction: ${field}`);
    }
  });

  // Logical consistency checks
  if (data.age && data.yearsOfEmployment && data.yearsOfEmployment > (data.age - 16)) {
    issues.push('Years of employment is inconsistent with applicant age.');
  }

  if (data.monthlyIncome && data.annualIncome) {
    const impliedAnnual = data.monthlyIncome * 12;
    const diff = Math.abs(impliedAnnual - data.annualIncome) / data.annualIncome;
    if (diff > 0.5) {
      issues.push('Monthly income and annual income figures are significantly inconsistent.');
    }
  }

  if (data.loanTenure && (data.loanTenure < 3 || data.loanTenure > 360)) {
    issues.push('Loan tenure is outside the supported range (3–360 months).');
  }

  if (data.loanAmount !== undefined && data.loanAmount <= 0) {
    issues.push('Loan amount must be greater than 0.');
  }

  if (data.monthlyIncome !== undefined && data.monthlyIncome <= 0) {
    issues.push('Monthly income must be a positive value.');
  }

  if (data.existingEMI && data.monthlyIncome && data.existingEMI > data.monthlyIncome) {
    issues.push('Existing EMI cannot exceed total monthly income.');
  }

  return { passed: issues.length === 0, issues };
}

module.exports = { runDataQualityChecks };