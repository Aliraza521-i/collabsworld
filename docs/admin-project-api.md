# Admin Project Management API Documentation

## Overview
The Admin Project Management API allows administrators to view, manage, and moderate all advertiser projects in the system.

## Base URL
```
/api/v1/admin/projects
```

## Authentication
All endpoints require authentication via JWT tokens with admin role in the Authorization header:
```
Authorization: Bearer <admin_token>
```

## Project Object
```json
{
  "_id": "string",
  "title": "string",
  "website": "string",
  "userId": "string",
  "categories": ["string"],
  "language": "string",
  "budget": "number",
  "minPostBudget": "number",
  "maxPostBudget": "number",
  "postsRequired": "number",
  "description": "string",
  "status": "string",
  "stats": {
    "finishedPosts": "number",
    "activePosts": "number",
    "pendingReviews": "number",
    "totalOrders": "number"
  },
  "createdAt": "date",
  "updatedAt": "date"
}
```

## Admin Endpoints

### Get All Projects
```
GET /admin/projects
```

**Query Parameters:**
- `search` (string): Search by title or website
- `status` (string): Filter by status
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `sortBy` (string): Field to sort by (default: createdAt)
- `sortOrder` (string): Sort order (default: -1)

**Response:**
```json
{
  "success": true,
  "data": [ /* Array of Project objects */ ],
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "pages": "number"
  }
}
```

### Get Project by ID
```
GET /admin/projects/:projectId
```

**Response:**
```json
{
  "success": true,
  "data": { /* Project object */ }
}
```

### Update Project
```
PUT /admin/projects/:projectId
```

**Request Body:**
```json
{
  "title": "string",
  "website": "string",
  "categories": ["string"],
  "language": "string",
  "budget": "number",
  "minPostBudget": "number",
  "maxPostBudget": "number",
  "postsRequired": "number",
  "description": "string",
  "status": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Project updated successfully",
  "data": { /* Updated Project object */ }
}
```

### Delete Project
```
DELETE /admin/projects/:projectId
```

**Response:**
```json
{
  "success": true,
  "message": "Project deleted successfully"
}
```

### Update Project Status
```
PUT /admin/projects/:projectId/status
```

**Request Body:**
```json
{
  "status": "active|completed|pending|cancelled"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Project status updated successfully",
  "data": { /* Updated Project object */ }
}
```

### Get Project Statistics
```
GET /admin/projects/:projectId/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "finishedPosts": "number",
    "activePosts": "number",
    "pendingReviews": "number",
    "totalOrders": "number"
  }
}
```

### Update Project Statistics
```
PUT /admin/projects/:projectId/stats
```

**Request Body:**
```json
{
  "stats": {
    "finishedPosts": "number",
    "activePosts": "number",
    "pendingReviews": "number",
    "totalOrders": "number"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Project statistics updated successfully",
  "data": { /* Updated Project object */ }
}
```

## Error Responses

### Not Found
```json
{
  "success": false,
  "message": "Project not found"
}
```

### Unauthorized
```json
{
  "success": false,
  "message": "Access denied. Admin role required."
}
```

### Validation Error
```json
{
  "success": false,
  "message": "Validation errors",
  "errors": [ /* Array of validation errors */ ]
}
```

### Server Error
```json
{
  "success": false,
  "message": "Failed to process request",
  "error": "Error details"
}
```