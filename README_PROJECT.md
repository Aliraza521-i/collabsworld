# Project Management Backend Implementation

## Overview
This document explains the backend implementation for the Project Management system in the CollabsWorld platform. The system allows advertisers to create and manage projects, while admins can oversee all projects on the platform.

## File Structure
```
collabsworld/
├── model/
│   └── Project.js              # Project Mongoose model
├── controllers/
│   └── ProjectController.js    # Project controller with CRUD operations
├── Router/
│   ├── ProjectRouter.js        # Project routes
│   ├── AdvertiserRouter.js     # Updated to include project routes
│   └── AdminRouter.js          # Updated to include project routes
├── __tests__/
│   └── project.test.js         # Unit tests for project API
├── docs/
│   └── project-api.md          # API documentation
└── test-project-api.js         # Simple test script
```

## Implementation Details

### 1. Project Model (Project.js)
- Defines the schema for project documents in MongoDB
- Includes fields for:
  - Basic information (title, website, description)
  - Categories and language
  - Budget information (total, min/max post budget)
  - Posts requirements
  - Status tracking
  - Statistics (finished posts, active posts, etc.)
- Uses Mongoose timestamps for createdAt/updatedAt

### 2. Project Controller (ProjectController.js)
- Implements all CRUD operations for projects
- Includes separate endpoints for:
  - Advertiser-specific operations (create, get own projects, update, delete)
  - Admin operations (get all projects, manage any project)
- Implements proper authorization checks
- Includes pagination and filtering capabilities
- Handles validation errors

### 3. Project Router (ProjectRouter.js)
- Defines RESTful routes for project management
- Implements validation middleware
- Separates advertiser and admin endpoints
- Uses proper authentication middleware

### 4. Integration with Existing Routers
- Updated AdvertiserRouter.js to include project routes
- Updated AdminRouter.js to include project routes

## API Endpoints

### Advertiser Endpoints
- `POST /advertiser/projects` - Create a new project
- `GET /advertiser/projects` - Get advertiser's projects
- `GET /advertiser/projects/:projectId` - Get specific project
- `PUT /advertiser/projects/:projectId` - Update project
- `DELETE /advertiser/projects/:projectId` - Delete project
- `PUT /advertiser/projects/:projectId/stats` - Update project statistics

### Admin Endpoints
- `GET /admin/projects` - Get all projects
- `GET /admin/projects/:projectId` - Get specific project
- `PUT /admin/projects/:projectId` - Update any project
- `DELETE /admin/projects/:projectId` - Delete any project

## Security Features
- JWT-based authentication for all endpoints
- Role-based authorization (advertiser vs admin)
- Input validation using express-validator
- Protection against unauthorized access to projects
- MongoDB injection prevention

## Testing
- Unit tests using Jest and Supertest
- Manual test script for quick verification
- API documentation with examples

## Deployment
The project management backend is ready to be deployed with the existing application. No additional setup is required beyond the standard application deployment process.

## Future Enhancements
- Add project templates
- Implement project sharing between advertisers
- Add project collaboration features
- Include project analytics and reporting
- Add project export functionality