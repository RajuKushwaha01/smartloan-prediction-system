const { body, validationResult } = require('express-validator');

// Authentication & Account Validation Rules
exports.registerRules = [
  body('fullName').trim().notEmpty().withMessage('Full name is required').isLength({ min: 2 }).withMessage('Full name too short'),
  body('email').trim().isEmail().withMessage('Enter a valid email address').normalizeEmail(),
  body('phone').optional({ checkFalsy: true }).isMobilePhone('any').withMessage('Enter a valid phone number'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) throw new Error('Passwords do not match');
    return true;
  })
];

exports.loginRules = [
  body('email').trim().isEmail().withMessage('Enter a valid email address').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required')
];

exports.forgotPasswordRules = [
  body('email').trim().isEmail().withMessage('Enter a valid email address').normalizeEmail()
];

exports.resetPasswordRules = [
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) throw new Error('Passwords do not match');
    return true;
  })
];

// Loan Application Validation Rules
exports.loanApplicationRules = [
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('age').isInt({ min: 18, max: 70 }).withMessage('Age must be between 18 and 70'),
  body('gender').notEmpty().withMessage('Gender is required'),
  body('maritalStatus').notEmpty().withMessage('Marital status is required'),
  body('dependents').isInt({ min: 0, max: 15 }).withMessage('Dependents must be a valid number'),
  body('education').notEmpty().withMessage('Education is required'),
  body('residentialStatus').notEmpty().withMessage('Residential status is required'),

  body('employmentType').notEmpty().withMessage('Employment type is required'),
  body('occupation').trim().notEmpty().withMessage('Occupation is required'),
  body('yearsOfEmployment').isFloat({ min: 0, max: 50 }).withMessage('Years of employment must be valid'),

  body('annualIncome').isFloat({ min: 50000 }).withMessage('Annual income must be at least ₹50,000'),
  body('monthlyIncome').isFloat({ min: 0 }).withMessage('Monthly income must be valid'),
  body('coApplicantIncome').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Co-applicant income must be valid'),
  body('monthlyExpenses').isFloat({ min: 0 }).withMessage('Monthly expenses must be valid'),
  body('existingEMI').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Existing EMI must be valid'),
  body('assets').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Assets value must be valid'),

  body('loanAmount').isFloat({ min: 10000, max: 50000000 }).withMessage('Loan amount must be between ₹10,000 and ₹5,00,00,000'),
  body('loanTenure').isInt({ min: 3, max: 360 }).withMessage('Loan tenure must be valid (in months)'),
  body('loanPurpose').notEmpty().withMessage('Loan purpose is required'),
  body('repaymentPreference').notEmpty().withMessage('Repayment preference is required'),

  body('creditHistory').notEmpty().withMessage('Credit history is required'),
  body('previousLoanStatus').notEmpty().withMessage('Previous loan status is required'),
  body('existingCredit').optional({ checkFalsy: true }).isInt({ min: 0 }).withMessage('Existing credit must be valid'),
  body('creditScore').optional({ checkFalsy: true }).isInt({ min: 300, max: 900 }).withMessage('Credit score must be between 300 and 900')
];

// Helper method to extract the first validation error message
exports.firstError = (req) => {
  const result = validationResult(req);
  if (result.isEmpty()) return null;
  return result.array()[0].msg;
};