# 07_API_ENGINEERING_STANDARDS.md

Version: 1.0

Status:
Mandatory

Applies To

Express API

Swagger

Frontend Integration

React Query

Third Party Integrations

---

# Philosophy

An API is a contract.

Once published,

breaking changes must be avoided.

Every API should be

✓ Predictable

✓ Consistent

✓ Versioned

✓ Documented

✓ Testable

✓ Secure

✓ Backward Compatible

---

# API Design Principles

REST Architecture

Resource Oriented

Stateless

Versioned

Consistent

Never expose database implementation.

Never expose Prisma models directly.

Never expose internal IDs unnecessarily.

---

# API Versioning

Base URL

/api/v1

Future

/api/v2

Never change existing endpoints.

Deprecate first.

Remove later.

---

# URL Naming

Good

/api/v1/products

/api/v1/orders

/api/v1/vendors

/api/v1/categories

Bad

/getProducts

/listVendor

/fetchOrders

/doCheckout

Always use nouns.

Never use verbs.

---

# HTTP Methods

GET

Read

POST

Create

PUT

Replace

PATCH

Partial Update

DELETE

Soft Delete

Never misuse HTTP methods.

---

# Endpoint Naming

Products

GET /products

GET /products/:id

POST /products

PATCH /products/:id

DELETE /products/:id

Orders

GET /orders

GET /orders/:id

POST /orders

PATCH /orders/:id

Delivery

GET /deliveries

PATCH /deliveries/:id/status

Customers

GET /customers/me

PATCH /customers/me

---

# Resource Hierarchy

Order

↓

Order Items

↓

Delivery

↓

OTP Verification

↓

Status History

Avoid deeply nested URLs.

Good

/orders/:id/status

Bad

/orders/:id/items/:itemId/vendor/:vendorId

---

# Request Validation

Every endpoint

Must validate

Headers

Params

Query

Body

Using

Zod

Never trust incoming data.

---

# Request DTO

Every endpoint

Has

Request DTO

Example

CreateOrderDTO

UpdateProfileDTO

CreateProductDTO

Never expose Prisma input directly.

---

# Response DTO

Every endpoint

Returns DTO

Never return Prisma models.

Example

ProductResponseDTO

OrderSummaryDTO

VendorProfileDTO

---

# Standard Success Response

{
  "success": true,
  "message": "Product created successfully.",
  "data": {}
}

---

# Standard Error Response

{
  "success": false,
  "message": "Validation failed.",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email address"
    }
  ],
  "code": "VALIDATION_ERROR"
}

---

# HTTP Status Codes

200

Success

201

Created

204

Deleted

400

Bad Request

401

Unauthorized

403

Forbidden

404

Not Found

409

Conflict

422

Validation Error

429

Rate Limited

500

Internal Server Error

Never return

200

for failures.

---

# Authentication

Bearer Token

Authorization:

Bearer JWT_TOKEN

Refresh Token

HTTP Only Cookie

Never send refresh token inside JSON.

---

# Authorization

Backend validates

Customer

Shop

Vendor

Delivery Partner

Admin

Frontend visibility is NOT security.

---

# Pagination

Every listing endpoint supports

?page=

&limit=

&search=

&sort=

&order=

Response

{
  "items": [],
  "pagination": {
      "page": 1,
      "limit": 20,
      "total": 120,
      "pages": 6,
      "hasNext": true,
      "hasPrevious": false
  }
}

---

# Filtering

Example

/products

?category=

?shop=

?priceMin=

?priceMax=

?rating=

?availability=

Filters should be composable.

---

# Sorting

sort

price

createdAt

rating

distance

order

asc

desc

---

# Search

Use

?q=

Example

/products?q=milk

Never invent custom parameters.

---

# Field Selection

Return only required fields.

Avoid huge payloads.

Use DTOs.

---

# File Upload

multipart/form-data

Validate

Mime

Extension

Size

Virus Scan Ready

Return

URL

Metadata

ID

---

# Maps

Only approved endpoints

GET /shops

GET /shops/:id

GET /shops/:id/location

GET /vendors/service-area

PATCH /shops/location

PATCH /shops/service-area

PATCH /delivery/status

PATCH /delivery/eta

No live GPS endpoint.

No continuous tracking endpoint.

---

# Delivery Flow APIs

Customer

Create Order

↓

Shop Accepts

↓

Assign Delivery

↓

Delivery Accepts

↓

Update ETA

↓

Picked Up

↓

Delivered

↓

OTP Verification

↓

Completed

---

# Notifications

REST API

WebSocket

Push Notification Ready

Notification endpoints

GET /notifications

PATCH /notifications/:id/read

---

# Rate Limiting

Authentication

Strict

OTP

Very Strict

Search

Moderate

Product List

Moderate

Public

Relaxed

---

# Idempotency

Required for

Payment (Future)

Order Retry

Webhook Processing

OTP Verification

Never create duplicate orders.

---

# Swagger

Every endpoint

Must contain

Summary

Description

Authentication

Parameters

Request Example

Response Example

Error Example

Tags

---

# API Documentation

Every endpoint documents

Purpose

Roles

Validation

Business Rules

Edge Cases

---

# Breaking Changes

Forbidden

Changing request structure

Changing response structure

Changing URL

Changing authentication

Without version increment.

---

# API Testing

Every endpoint

Happy Path

Validation

Unauthorized

Forbidden

Conflict

Edge Cases

Load Test

---

# Security

Validate all inputs

Escape outputs where necessary

RBAC

Rate Limiting

Helmet

Audit Logs

Never leak internal implementation.

---

# Caching

Allowed

Categories

Products

Settings

Hero Slides

Not Allowed

Orders

Checkout

OTP

Authentication

---

# Logging

Every mutation logs

User

IP

Action

Entity

Timestamp

Result

---

# Definition of Done

Every API is complete only if

✓ DTO Created

✓ Validation Added

✓ Controller Added

✓ Service Added

✓ Repository Added

✓ Swagger Updated

✓ Tests Written

✓ Error Handling Complete

✓ Logging Added

✓ Authorization Verified

✓ Frontend Integrated

---

# VegaMart Approved Endpoints

Authentication

Customers

Shops

Street Vendors

Delivery Partners

Categories

Products

Cart

Checkout

Orders

Notifications

Addresses

Coupons

Membership

Reports

Admin

Support

Search

Uploads

Settings

No APIs outside approved client requirements.

---

# Golden Rule

The API should always feel

Predictable

Consistent

Minimal

Well Documented

Secure

Stable

Every endpoint should be understandable without reading the backend implementation.