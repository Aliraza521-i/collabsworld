# Article Data API Endpoints

## Overview
This document describes the API endpoints needed to support saving and retrieving article data for the "Choose My Own Article" feature.

## Endpoints

### 1. Save Article Data
**POST** `/api/v1/orders/:orderId/article`

#### Request Body
```json
{
  "articleTitle": "string",
  "permalinkSlug": "string",
  "anchorText": "string",
  "targetUrl": "string",
  "postText": "string",
  "metaTitle": "string",
  "metaKeywords": "string",
  "metaDescription": "string",
  "projectId": "string"
}
```

#### Response
```json
{
  "ok": true,
  "message": "Article data saved successfully",
  "data": {
    "articleId": "string",
    "orderId": "string",
    "articleTitle": "string",
    "permalinkSlug": "string",
    "anchorText": "string",
    "targetUrl": "string",
    "postText": "string",
    "metaTitle": "string",
    "metaKeywords": "string",
    "metaDescription": "string",
    "projectId": "string",
    "createdAt": "date",
    "updatedAt": "date"
  }
}
```

### 2. Get Article Data
**GET** `/api/v1/orders/:orderId/article`

#### Response
```json
{
  "ok": true,
  "message": "Article data retrieved successfully",
  "data": {
    "articleId": "string",
    "orderId": "string",
    "articleTitle": "string",
    "permalinkSlug": "string",
    "anchorText": "string",
    "targetUrl": "string",
    "postText": "string",
    "metaTitle": "string",
    "metaKeywords": "string",
    "metaDescription": "string",
    "projectId": "string",
    "createdAt": "date",
    "updatedAt": "date"
  }
}
```

## Database Schema

### Article Data Collection
```javascript
{
  _id: ObjectId,
  orderId: { type: String, required: true, unique: true },
  articleTitle: { type: String, required: true },
  permalinkSlug: { type: String, required: true },
  anchorText: { type: String, required: true },
  targetUrl: { type: String, required: true },
  postText: { type: String, required: true },
  metaTitle: { type: String },
  metaKeywords: { type: String },
  metaDescription: { type: String },
  projectId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

## Implementation Notes

1. **Data Validation**: All required fields should be validated on the backend
2. **Security**: Ensure only authorized users can access their own article data
3. **Error Handling**: Proper error responses should be returned for invalid requests
4. **Data Consistency**: Article data should be linked to the order ID to maintain consistency

## Integration with Existing Systems

1. **Order Creation**: When an order is created with "own article" type, the article data should be saved
2. **Order Updates**: When article data is updated, the order status should be updated accordingly
3. **Data Retrieval**: Article data should be retrievable for both viewing and editing

## Example Usage Flow

1. User selects "Write my own article" in the shopping cart
2. User fills in article details and saves
3. Frontend calls POST `/api/v1/orders/:orderId/article` to save data
4. Backend validates and saves the article data
5. User can later view or edit the article using GET `/api/v1/orders/:orderId/article`