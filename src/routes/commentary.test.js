import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { commentaryRouter } from './commentary.js';

describe('Commentary API', () => {
  const app = express();
  app.use(express.json());
  app.use('/matches/:id/commentary', commentaryRouter);

  describe('GET /matches/:id/commentary', () => {
    it('returns 400 for invalid match ID (not a number)', async () => {
      const response = await request(app).get('/matches/invalid-id/commentary');
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid match ID.');
      expect(response.body).toHaveProperty('details');
      expect(response.body.details[0].message).toMatch(/Expected number, received /i);
    });

    it('returns 400 for negative match ID', async () => {
      const response = await request(app).get('/matches/-5/commentary');
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid match ID.');
    });

    it('returns 400 for invalid query parameters', async () => {
      const response = await request(app).get('/matches/1/commentary?limit=-10');
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid query parameters.');
    });
  });

  describe('POST /matches/:id/commentary', () => {
    it('returns 400 for invalid match ID on POST', async () => {
      const response = await request(app).post('/matches/invalid-id/commentary').send({
          minute: 10,
          message: "Test message",
          eventType: "goal"
      });
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid match ID.');
    });

    it('returns 400 for invalid payload on POST', async () => {
      const response = await request(app).post('/matches/1/commentary').send({
          message: "Missing minute"
      });
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid commentary payload.');
    });
  });
});
