require('./setup');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const { calculateDTI, classifyPrediction, generateApplicationId } = require('../utils/helpers');
const { runDataQualityChecks } = require('../services/dataQualityService');

afterAll(async () => { await mongoose.connection.close(); });

describe('Loan Application — Data Quality', () => {
  test('rejects a loan amount of 0', () => {
    const result = runDataQualityChecks({
      gender: 'Male', maritalStatus: 'Single', education: 'Graduate',
      monthlyIncome: 50000, loanAmount: 0, loanTenure: 60,
      creditHistory: 'Good', residentialStatus: 'Owned'
    });
    expect(result.passed).toBe(false);
  });

  test('accepts a logically consistent application', () => {
    const result = runDataQualityChecks({
      gender: 'Male', maritalStatus: 'Single', education: 'Graduate',
      monthlyIncome: 50000, loanAmount: 500000, loanTenure: 60,
      creditHistory: 'Good', residentialStatus: 'Owned'
    });
    expect(result.passed).toBe(true);
  });

  test('flags existing EMI greater than income', () => {
    const result = runDataQualityChecks({
      gender: 'Male', maritalStatus: 'Single', education: 'Graduate',
      monthlyIncome: 20000, existingEMI: 25000, loanAmount: 500000, loanTenure: 60,
      creditHistory: 'Good', residentialStatus: 'Owned'
    });
    expect(result.passed).toBe(false);
  });
});

describe('Financial Calculations', () => {
  test('DTI calculation matches spec example (24.6%)', () => {
    expect(calculateDTI(50000, 0, 12300)).toBeCloseTo(24.6, 1);
  });

  test('classifyPrediction thresholds', () => {
    expect(classifyPrediction(84)).toBe('Eligible');
    expect(classifyPrediction(50)).toBe('Review');
    expect(classifyPrediction(20)).toBe('Not Eligible');
  });

  test('generateApplicationId produces SL-prefixed IDs', () => {
    expect(generateApplicationId()).toMatch(/^SL-\d{6}$/);
  });
});

describe('Protected Routes', () => {
  test('New Application form requires authentication', async () => {
    const res = await request(app).get('/loan/apply');
    expect(res.status).toBe(302);
  });

  test('EMI Calculator page requires authentication', async () => {
    const res = await request(app).get('/loan/calculator');
    expect(res.status).toBe(302);
  });
});