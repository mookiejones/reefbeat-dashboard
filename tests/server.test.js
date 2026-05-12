const request = require('supertest');
const nock = require('nock');
const app = require('../server');

afterEach(() => nock.cleanAll());

describe('GET /api/:device/:endpoint', () => {
  test('proxies GET to correct device IP and returns JSON', async () => {
    nock('http://172.16.0.21').get('/mode').reply(200, { mode: 'auto' });
    const res = await request(app).get('/api/lights/mode');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ mode: 'auto' });
  });

  test('returns 404 for unknown device', async () => {
    const res = await request(app).get('/api/unknown/mode');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 502 when device is unreachable', async () => {
    nock('http://172.16.0.19').get('/mode').replyWithError('ECONNREFUSED');
    const res = await request(app).get('/api/wave/mode');
    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty('error');
  });
});

describe('POST /api/:device/:endpoint', () => {
  test('proxies POST with body to correct device IP', async () => {
    nock('http://172.16.0.20')
      .post('/mode', { mode: 'manual' })
      .reply(200, { success: true, message: '' });
    const res = await request(app).post('/api/ato/mode').send({ mode: 'manual' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: '' });
  });

  test('forwards non-200 device response status', async () => {
    nock('http://172.16.0.21')
      .post('/manual', { white: 50, blue: 50, moon: 0 })
      .reply(400, { success: false, message: 'not all channels are in body' });
    const res = await request(app).post('/api/lights/manual').send({ white: 50, blue: 50, moon: 0 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
