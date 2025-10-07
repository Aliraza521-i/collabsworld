# Project Management API Documentation

## Overview
The Project Management API allows advertisers to create and manage projects, while admins can view and manage all projects across the platform.

## Base URL
```
/api/v1
```

## Authentication
All endpoints require authentication via JWT tokens in the Authorization header:
```
Authorization: Bearer <token>
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

## Advertiser Endpoints

### Create Project
```
POST /advertiser/projects
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
  "description": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Project created successfully",
  "data": { /* Project object */ }
}
```

### Get Advertiser Projects
```
GET /advertiser/projects
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
GET /advertiser/projects/:projectId
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
PUT /advertiser/projects/:projectId
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
DELETE /advertiser/projects/:projectId
```

**Response:**
```json
{
  "success": true,
  "message": "Project deleted successfully"
}
```

### Update Project Statistics
```
PUT /advertiser/projects/:projectId/stats
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
Same as advertiser update endpoint

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

## Validation Rules

### Create Project
- `title`: Required, string
- `website`: Required, valid URL
- `categories`: Required, array with at least 1 item
- `budget`: Required, number >= 0
- `postsRequired`: Required, integer >= 1

## Error Responses

### Validation Error
```json
{
  "success": false,
  "message": "Validation errors",
  "errors": [ /* Array of validation errors */ ]
}
```

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
  "message": "Not authorized to perform this action"
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