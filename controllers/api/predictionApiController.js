const LoanApplication = require('../../models/LoanApplication');
const Prediction = require('../../models/Prediction');
const { getPrediction } = require('../../services/predictionService');
const { generateRecommendation } = require('../../services/recommendationService');
const { pushStage } = require('../../utils/workflowStages');
const { logActivity } = require('../../services/activityService');

exports.predict = async (req, res) => {
  const application = await LoanApplication.findOne({ _id: req.body.applicationId, user: req.session.user.id });
  if (!application) return res.status(404).json({ error: 'Application not found' });

  await pushStage(application, 'AI Analysis');
  const result = await getPrediction(application.toObject());

  const prediction = await Prediction.create({
    application: application._id, user: req.session.user.id, applicationId: application.applicationId,
    prediction: result.prediction, probability: result.probability,
    modelName: result.model_name, modelVersion: result.model_version, featureVersion: result.feature_version,
    featureValues: result.feature_values, interpretation: result.interpretation,
    explanationMethod: result.explanation_method, factors: result.factors,
    financialHealth: {
      incomeStability: result.financial_health ? result.financial_health.income_stability : 0,
      loanAffordability: result.financial_health ? result.financial_health.loan_affordability : 0,
      debtBurden: result.financial_health ? result.financial_health.debt_burden : 0
    }
  });

  prediction.recommendation = generateRecommendation(application.toObject(), result);
  await prediction.save();

  application.status = 'Analyzed';
  if (result.prediction === 'Review' || application.anomalyFlags.length > 0) await pushStage(application, 'Under Review');
  else await application.save();

  await pushStage(application, 'Prediction Generated');
  await logActivity(req.session.user.id, 'Prediction Generated', `${application.applicationId} — ${result.prediction}`);

  res.status(201).json({ success: true, prediction });
};

exports.getOne = async (req, res) => {
  const prediction = await Prediction.findById(req.params.id).populate('application');
  if (!prediction || String(prediction.user) !== req.session.user.id) return res.status(404).json({ error: 'Not found' });
  res.json({ prediction });
};