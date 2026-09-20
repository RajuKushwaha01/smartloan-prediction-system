/**
 * The full application workflow pipeline, per spec 4.3/4.5.
 * Each stage is pushed onto statusHistory with a timestamp exactly once
 * when the application first reaches it.
 */
const STAGES = [
  'Draft',
  'Submitted',
  'Validation',
  'AI Analysis',
  'Prediction Generated',
  'Under Review',
  'Administrative Decision',
  'Completed'
];

// Maps internal stage names to the exact timeline labels from spec 4.5
const STAGE_LABELS = {
  Draft: 'Application Created',
  Submitted: 'Application Submitted',
  Validation: 'Validation Completed',
  'AI Analysis': 'AI Analysis',
  'Prediction Generated': 'Prediction Generated',
  'Under Review': 'Manual Review',
  'Administrative Decision': 'Administrative Decision',
  Completed: 'Completed'
};

async function pushStage(application, stage) {
  if (!STAGES.includes(stage)) return application;
  const alreadyThere = application.statusHistory.some(s => s.stage === stage);
  if (!alreadyThere) {
    application.statusHistory.push({ stage, timestamp: new Date() });
  }
  application.workflowStage = stage;
  await application.save();
  return application;
}

module.exports = { STAGES, STAGE_LABELS, pushStage };