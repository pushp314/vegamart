# 04_BACKEND_ENGINEERING_STANDARDS.md

Version: 1.0

Status:
Mandatory

Applies To

Entire Backend

Express

Prisma

TypeScript

Redis

Swagger

---

# Philosophy

The backend exists to solve business problems.

Not to demonstrate design patterns.

Always choose

Simple

Readable

Maintainable

over

Complex

Generic

Over-engineered

---

# Backend Layers

The backend shall contain only these layers.

Routes

↓

Controllers

↓

Validators

↓

Services

↓

Repositories

↓

Prisma

No shortcuts.

---

# Folder Responsibilities

config/

Environment

Logger

Swagger

Redis

Storage

Database Configuration

---

middlewares/

Authentication

Authorization

Validation

Rate Limiting

Security

Error Handling

Request ID

Versioning

No Business Logic

---

controllers/

Receive HTTP Request

↓

Validate Request

↓

Call Service

↓

Return Response

Nothing else.

Maximum Size

200 Lines

---

services/

Contains Business Logic.

Examples

Create Order

Cancel Order

Assign Delivery

Generate OTP

Calculate Charges

Generate Reports

No Express Objects.

No req.

No res.

No next.

Maximum

500 Lines

Split into use cases if larger.

---

repositories/

Contains Database Access Only.

Allowed

Prisma Queries

Transactions (only when coordinated by Service)

Relations

Pagination

Not Allowed

Business Rules

Validation

Authentication

Authorization

---

validators/

Every endpoint

Must have

One Zod Schema.

Never validate manually.

Never duplicate schemas.

---

utils/

Pure Functions Only.

Examples

Slug

Pagination

Date

Crypto

Password

Serialization

Never import Express.

Never import Prisma.

---

# API Response Standard

Every API returns

Success

{
    success: true,
    message: "",
    data: {}
}

Failure

{
    success: false,
    message: "",
    errors: [],
    code: ""
}

Never expose stack traces.

Never expose SQL errors.

Never expose Prisma internals.

---

# Error Handling

Only ApiError.

Example

BadRequestError

UnauthorizedError

ForbiddenError

NotFoundError

ConflictError

ValidationError

InternalServerError

Never

throw new Error()

---

# Validation

Every endpoint

Must have

Input Validation

Business Validation

Authorization Validation

Database Validation

Example

POST /orders

Validate

JWT

Product Exists

Stock Exists

Vendor Active

Delivery Available

Coupon Valid

Address Exists

Only then proceed.

---

# Authentication

Supported

Email OTP

JWT

Refresh Token

Role Based Access

Future Ready

Google OAuth

Not Enabled

Wallet Login

Phone Login

Magic Links

Until approved.

---

# Authorization

Roles

Customer

Shop Owner

Street Vendor

Delivery Partner

Administrator

Never hardcode roles.

Always use enum.

---

# Transactions

Transactions belong

Only

Inside Services.

Example

Create Order

↓

Reserve Stock

↓

Create Order

↓

Generate OTP

↓

Assign Delivery

↓

Commit

Repository never coordinates multiple repositories.

---

# Repository Pattern

One Repository

One Aggregate

Examples

OrderRepository

ProductRepository

VendorRepository

CustomerRepository

CategoryRepository

WishlistRepository

Never

MegaRepository

DatabaseHelper

CommonRepository

---

# Prisma Rules

Never

findMany()

without pagination.

Always

Select required fields.

Never

Select *

Always

Index searchable columns.

Always

Use enums.

Never

Duplicate enums.

---

# Pagination Standard

Every listing endpoint supports

page

limit

search

sort

order

filters

Returns

items

pagination

total

pages

currentPage

hasNext

hasPrevious

---

# Logging

Every mutation

Must create log.

Create

Update

Delete

Assign

Approve

Reject

Deliver

Cancel

Refund

Login

Logout

OTP

Password Reset

KYC

Never log

Passwords

OTP

JWT

Secrets

---

# Redis

Allowed

OTP

Sessions

Rate Limiting

Frequently Read Data

Not Allowed

Business Source Of Truth

Database remains primary.

---

# Background Jobs

Only

Cleanup

Notifications

OTP Expiration

Scheduled Reports

Never

Business Critical Logic

Cron failure must never corrupt database.

---

# File Upload

Allowed

Images

Documents

KYC Files

Invoices

Validate

Mime

Extension

Size

Virus Scan Ready

Store metadata in database.

Never trust filename.

---

# Email

Use

Template Based Emails

Never

Hardcoded HTML

Supported

OTP

Welcome

Password Reset

Order Updates

KYC Status

Membership

---

# Maps

Only

Leaflet

OpenStreetMap

Store

Latitude

Longitude

Service Area

Allowed

Shop Location

Delivery Navigation

Pickup Navigation

Not Allowed

Continuous Tracking

Live Streaming

Google APIs

Paid APIs

---

# API Versioning

/api/v1/

Future

/api/v2/

Never break existing endpoints.

Deprecate gradually.

---

# Security

Helmet

Rate Limiting

CORS

RBAC

Zod

JWT

Refresh Token

Audit Logs

Password Hashing

Request Validation

Never trust client input.

---

# Swagger

Every endpoint

Must contain

Summary

Description

Authentication

Parameters

Body

Responses

Examples

Swagger updates are mandatory.

---

# Unit Testing

Every Service

Must test

Happy Path

Failure

Edge Cases

Validation

Authorization

Transactions

---

# Integration Testing

Every Route

Must test

200

400

401

403

404

409

500

---

# Performance

Avoid N+1 Queries

Batch Reads

Redis Cache

Indexes

Cursor Pagination

Bulk Inserts

Bulk Updates

Select Required Fields

---

# Documentation

Every feature updates

Swagger

README

Architecture

Migration Notes

Database Notes

---

# Code Review Checklist

Before merging verify

✓ No duplicate logic

✓ No dead code

✓ No console.log

✓ No TODO

✓ No FIXME

✓ TypeScript passes

✓ ESLint passes

✓ Tests pass

✓ Swagger updated

✓ Documentation updated

✓ Business requirements satisfied

If any check fails

The implementation is rejected.

---

# Golden Rule

Every commit should make the backend

Cleaner

Smaller

Faster

Safer

than it was before.