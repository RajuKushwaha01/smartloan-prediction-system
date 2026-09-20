const LoanApplication = require('../../models/LoanApplication');
const Prediction = require('../../models/Prediction');
const { calculateEMI, generateRecommendation } = require('../../services/recommendationService');
const { simulatePrediction } = require('../../services/predictionService');
const { calculateDTI } = require('../../utils/helpers');
const Scenario = require('../../models/Scenario');

exports.calculateEmi = (req, res) => {
  const { loanAmount, interestRate, tenure } = req.body;
  const principal = Number(loanAmount), rate = Number(interestRate), months = Number(tenure);
  if (!principal || !rate || !months || principal <= 0 || rate <= 0 || months <= 0) {
    return res.status(400).json({ error: 'Invalid input values' });
  }
  const emi = calculateEMI(principal, rate, months);
  const totalRepayment = emi * months;
  res.json({ emi: Math.round(emi), totalInterest: Math.round(totalRepayment - principal), totalRepayment: Math.round(totalRepayment) });
};

exports.recommendation = async (req, res) => {
  const application = await LoanApplication.findOne({ _id: req.body.applicationId, user: req.session.user.id });
  if (!application) return res.status(404).json({ error: 'Not found' });
  const prediction = await Prediction.findOne({ application: application._id }).sort({ createdAt: -1 });
  const recommendation = generateRecommendation(application.toObject(), prediction ? { prediction: prediction.prediction } : null);
  res.json({ recommendation });
};

exports.scenario = async (req, res) => {
  const prediction = await Prediction.findById(req.body.predictionId).populate('application');
  if (!prediction || String(prediction.user) !== req.session.user.id) return res.status(404).json({ error: 'Not found' });

  const overrides = req.body.overrides || {};
  const baseData = prediction.application.toObject();
  const result = await simulatePrediction(baseData, overrides);

  const merged = { ...baseData, ...overrides };
  const simulatedEMI = Math.round(calculateEMI(merged.loanAmount, 10.5, merged.loanTenure));
  const simulatedDTI = calculateDTI(merged.monthlyIncome, merged.coApplicantIncome, merged.existingEMI);

  if (req.body.save) {
    const scenario = await Scenario.create({
      user: req.session.user.id, basePrediction: prediction._id,
      label: req.body.label || 'Untitled Scenario', changedInputs: overrides,
      simulatedPrediction: result.prediction, simulatedProbability: result.probability,
      simulatedEMI, simulatedDTI
    });
    return res.status(201).json({ success: true, result, simulatedEMI, simulatedDTI, scenario });
  }

  res.json({ success: true, result, simulatedEMI, simulatedDTI });
};

exports.financialHealth = async (req, res) => {
  const prediction = await Prediction.findOne({ application: req.params.applicationId, user: req.session.user.id }).sort({ createdAt: -1 });
  if (!prediction) return res.status(404).json({ error: 'No prediction found for this application' });
  res.json({ financialHealth: prediction.financialHealth });
};