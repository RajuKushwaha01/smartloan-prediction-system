require('./setup');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');

afterAll(async () => { await mongoose.connection.close(); });

describe('Admin Authorization', () => {
  test('Unauthenticated request to admin dashboard redirects to login', async () => {
    const res = await request(app).get('/admin/dashboard');
    expect(res.status).toBe(302);
  });

  test('Unauthenticated request to admin users page redirects', async () => {
    const res = await request(app).get('/admin/users');
    expect(res.status).toBe(302);
  });

  test('Public verification page does not require authentication', async () => {
    const res = await request(app).get('/verify/SLR-2026-000001');
    expect(res.status).toBe(200); // renders "not found" state, but page loads without auth redirect
  });

  test('API endpoints reject unauthenticated requests with 401 JSON', async () => {
    const res = await request(app).get('/api/user/profile');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  test('API admin endpoints reject non-admin/unauthenticated with proper status', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect([401, 403]).toContain(res.status);
  });
});