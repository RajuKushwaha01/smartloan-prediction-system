const mongoose = require('mongoose');

const loanApplicationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    applicationId: { type: String, required: true, unique: true },

    // Step 1 — Personal
    fullName: String,
    age: Number,
    gender: String,
    maritalStatus: String,
    dependents: Number,
    education: String,
    residentialStatus: { 
      type: String, 
      enum: ['Owned', 'Rented', 'Living with Family'], 
      default: 'Rented' 
    },

    // Step 2 — Employment
    employmentType: String,
    occupation: String,
    employer: String,
    yearsOfEmployment: Number,
    selfEmployed: { type: Boolean, default: false },
    employmentStability: { 
      type: String, 
      enum: ['Stable', 'Moderate', 'Unstable'], 
      default: 'Stable' 
    },

    // Step 3 — Financial
    annualIncome: Number,
    monthlyIncome: Number,
    coApplicantIncome: { type: Number, default: 0 },
    monthlyExpenses: Number,
    hasExistingLoan: { type: Boolean, default: false },
    existingEMI: { type: Number, default: 0 },
    assets: { type: Number, default: 0 },
    liabilities: { type: Number, default: 0 },

    // Step 4 — Loan
    loanAmount: Number,
    loanTenure: Number,
    loanPurpose: String,
    repaymentPreference: { 
      type: String, 
      enum: ['EMI', 'Lump Sum', 'Flexible'], 
      default: 'EMI' 
    },

    // Step 5 — Credit
    creditHistory: { 
      type: String, 
      enum: ['Good', 'Average', 'Poor'], 
      default: 'Average' 
    },
    previousLoanStatus: { 
      type: String, 
      enum: ['None', 'Fully Repaid', 'Currently Active', 'Defaulted'], 
      default: 'None' 
    },
    existingCredit: { type: Number, default: 0 },
    creditScore: { type: Number },
    debtToIncomeRatio: Number,

    // Draft & Progress Support
    currentStep: { type: Number, default: 1 },
    isDraft: { type: Boolean, default: true },

    // Status Tracking
    status: { 
      type: String, 
      enum: ['Draft', 'Pending', 'Analyzed'], 
      default: 'Draft' 
    },
    workflowStatus: {
      type: String,
      enum: ['Submitted', 'Under Review', 'Approved', 'Rejected'],
      default: 'Submitted'
    },

    // Internal Notes for Admin Tracking
    internalNotes: [
      {
        note: String,
        addedBy: String,
        addedAt: { type: Date, default: Date.now }
      }
    ],

    // Pipeline & Anomaly Tracking Fields
    workflowStage: { 
      type: String, 
      enum: [
        'Draft', 
        'Submitted', 
        'Validation', 
        'AI Analysis', 
        'Prediction Generated', 
        'Under Review', 
        'Administrative Decision', 
        'Completed'
      ], 
      default: 'Draft' 
    },
    statusHistory: [
      { 
        stage: String, 
        timestamp: { type: Date, default: Date.now } 
      }
    ],
    anomalyFlags: [
      {
        type: { type: String }, // 'duplicate', 'outlier', 'invalid_combination', 'statistical_outlier'
        message: String,
        severity: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
        detectedAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

loanApplicationSchema.index({ user: 1, isDraft: 1, createdAt: -1 });
loanApplicationSchema.index({ workflowStage: 1 });
loanApplicationSchema.index({ status: 1 });

module.exports = mongoose.model('LoanApplication', loanApplicationSchema);