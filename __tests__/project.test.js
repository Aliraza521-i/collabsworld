import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import Project from '../model/Project.js';
import projectRouter from '../Router/ProjectRouter.js';
import { authenticateToken, requireAdmin, requireAdvertiser } from '../middleware/auth.js';

// Mock middleware
jest.mock('../middleware/auth.js', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'user123', role: 'advertiser' };
    next();
  },
  requireAdmin: (req, res, next) => {
    req.user = { id: 'admin123', role: 'admin' };
    next();
  },
  requireAdvertiser: (req, res, next) => {
    req.user = { id: 'user123', role: 'advertiser' };
    next();
  }
}));

// Create express app for testing
const app = express();
app.use(express.json());
app.use('/api/v1/advertiser/projects', projectRouter);
app.use('/api/v1/admin/projects', projectRouter);

describe('Project API', () => {
  // Clear database before each test
  beforeEach(async () => {
    await Project.deleteMany({});
  });

  // Clear database after all tests
  afterAll(async () => {
    await Project.deleteMany({});
    await mongoose.connection.close();
  });

  describe('POST /api/v1/advertiser/projects', () => {
    it('should create a new project', async () => {
      const projectData = {
        title: 'Test Project',
        website: 'https://example.com',
        categories: ['Technology', 'Business'],
        budget: 1000,
        postsRequired: 5,
        description: 'Test project description'
      };

      const response = await request(app)
        .post('/api/v1/advertiser/projects')
        .send(projectData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(projectData.title);
      expect(response.body.data.website).toBe(projectData.website);
      expect(response.body.data.categories).toEqual(projectData.categories);
    });

    it('should return validation error for invalid data', async () => {
      const invalidData = {
        title: '',
        website: 'invalid-url',
        categories: [],
        budget: -100,
        postsRequired: 0
      };

      const response = await request(app)
        .post('/api/v1/advertiser/projects')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation errors');
    });
  });

  describe('GET /api/v1/advertiser/projects', () => {
    it('should get advertiser projects', async () => {
      // Create test project
      const project = new Project({
        title: 'Test Project',
        website: 'https://example.com',
        categories: ['Technology'],
        budget: 1000,
        postsRequired: 5,
        userId: 'user123'
      });
      await project.save();

      const response = await request(app)
        .get('/api/v1/advertiser/projects')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].title).toBe('Test Project');
    });
  });

  describe('GET /api/v1/admin/projects/admin/all', () => {
    it('should get all projects for admin', async () => {
      // Mock admin middleware
      jest.mock('../middleware/auth.js', () => ({
        authenticateToken: (req, res, next) => {
          req.user = { id: 'admin123', role: 'admin' };
          next();
        },
        requireAdmin: (req, res, next) => {
          req.user = { id: 'admin123', role: 'admin' };
          next();
        },
        requireAdvertiser: (req, res, next) => {
          req.user = { id: 'user123', role: 'advertiser' };
          next();
        }
      }));

      // Create test project
      const project = new Project({
        title: 'Test Project',
        website: 'https://example.com',
        categories: ['Technology'],
        budget: 1000,
        postsRequired: 5,
        userId: 'user123'
      });
      await project.save();

      const response = await request(app)
        .get('/api/v1/admin/projects/admin/all')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });
});