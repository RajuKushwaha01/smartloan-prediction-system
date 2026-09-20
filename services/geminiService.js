const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_ENABLED = !!GEMINI_API_KEY;

/**
 * Rewrites an existing model-generated interpretation into plain,
 * natural language. NEVER used to generate the prediction, probability,
 * or any decision — those always come from the ML service. If Gemini
 * is not configured or the call fails, the original text is returned
 * unchanged — the app never depends on this working.
 */
async function rewriteExplanation(originalInterpretation, factors) {
  if (!GEMINI_ENABLED) return originalInterpretation;

  try {
    const factorSummary = factors.map(f => `${f.name} (${f.impact}, ${Math.round(f.contribution)}%)`).join(', ');
    const prompt = `Rewrite this loan-prediction explanation in one friendly, plain-language paragraph for a non-technical reader. Do not invent numbers or change the prediction. Do not claim this guarantees a real bank decision.\n\nOriginal: "${originalInterpretation}"\nContributing factors: ${factorSummary}`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: prompt }] }] },
      { timeout: 6000 }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? text.trim() : originalInterpretation;
  } catch (e) {
    console.warn('⚠️ Gemini rewrite failed (non-blocking, using original explanation):', e.message);
    return originalInterpretation;
  }
}

module.exports = { rewriteExplanation, GEMINI_ENABLED };