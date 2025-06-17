import request from 'supertest';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, '..', 'public');

describe('Server', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.static(publicPath));
    
    app.get('/', (req, res) => {
      res.sendFile(path.join(publicPath, 'index.html'));
    });

    app.get('/pages/*', (req, res) => {
      res.sendFile(path.join(publicPath, req.path));
    });
  });

  describe('GET /', () => {
    it('should return 200 OK', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
    });
  });

  describe('GET /pages/*', () => {
    it('should return 200 OK for valid pages', async () => {
      const response = await request(app).get('/pages/about');
      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent pages', async () => {
      const response = await request(app).get('/pages/nonexistent');
      expect(response.status).toBe(404);
    });
  });
}); 