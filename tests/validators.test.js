const { calculateDTI, classifyPrediction, formatINR } = require('../utils/helpers');

describe('calculateDTI', () => {
  test('calculates correct DTI with income and EMI', () => {
    expect(calculateDTI(50000, 0, 12300)).toBeCloseTo(24.6, 1);
  });

  test('includes co-applicant income in the total', () => {
    expect(calculateDTI(40000, 20000, 12000)).toBeCloseTo(20.0, 1);
  });

  test('returns 0 when total income is 0', () => {
    expect(calculateDTI(0, 0, 5000)).toBe(0);
  });

  test('returns 0 when there is no existing EMI', () => {
    expect(calculateDTI(50000, 0, 0)).toBe(0);
  });
});

describe('classifyPrediction', () => {
  test('classifies >= 65 as Eligible', () => {
    expect(classifyPrediction(84)).toBe('Eligible');
    expect(classifyPrediction(65)).toBe('Eligible');
  });

  test('classifies 40-64 as Review', () => {
    expect(classifyPrediction(50)).toBe('Review');
    expect(classifyPrediction(40)).toBe('Review');
  });

  test('classifies < 40 as Not Eligible', () => {
    expect(classifyPrediction(39)).toBe('Not Eligible');
    expect(classifyPrediction(5)).toBe('Not Eligible');
  });
});

describe('formatINR', () => {
  test('formats numbers with Indian lakh/crore grouping', () => {
    expect(formatINR(500000)).toBe('₹5,00,000');
    expect(formatINR(1000)).toBe('₹1,000');
  });
});