require('./setup');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');

afterAll(async () => { await mongoose.connection.close(); });

describe('Authentication', () => {
  const testEmail = `test_${Date.now()}@example.com`;

  test('GET /auth/register returns the registration page', async () => {
    const res = await request(app).get('/auth/register');
    expect(res.status).toBe(200);
  });

  test('GET /auth/login returns the login page', async () => {
    const res = await request(app).get('/auth/login');
    expect(res.status).toBe(200);
  });

  test('Login with wrong credentials returns login page with error, not a crash', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: testEmail, password: 'wrongpassword' });
    expect([200, 302]).toContain(res.status); // renders error or redirects on validation
  });

  test('Unauthenticated user is redirected away from /loan/dashboard', async () => {
    const res = await request(app).get('/loan/dashboard');
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/login/);
  });
});