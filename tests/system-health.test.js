require('./setup');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');

afterAll(async () => { await mongoose.connection.close(); });

describe('System Reliability', () => {
  test('404 page renders for unknown routes', async () => {
    const res = await request(app).get('/this-route-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.text).toMatch(/404/);
  });

  test('Home page loads even without seed data', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
  });

  test('Rate limiter headers are present', async () => {
    const res = await request(app).get('/');
    expect(res.headers).toHaveProperty('ratelimit-limit');
  });
});