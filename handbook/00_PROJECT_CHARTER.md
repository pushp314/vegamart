# VegaMart AI Development Handbook

Version: 1.0

Status: Approved

Project Type:
Hyperlocal Multi-Vendor Marketplace Platform

Repository:
Backend
- Express
- TypeScript
- Prisma
- PostgreSQL
- Redis

Frontend
- TanStack Start
- React 19
- React Query
- Tailwind CSS v4
- Radix UI
- Leaflet (OpenStreetMap)

---

# 1. Project Vision

VegaMart is a hyperlocal marketplace connecting customers, shops, roaming street vendors, delivery partners and administrators into one ecosystem.

The objective is NOT to become another Blinkit.

The objective is to digitize local commerce while remaining simple enough for small businesses.

The software must prioritize

• Simplicity
• Reliability
• Maintainability
• Scalability
• Security

over feature quantity.

Every feature should directly solve a real business problem.

If a feature does not contribute to business value, it should not exist.

---

# 2. Product Philosophy

The repository must never become a collection of experimental code.

Every module must satisfy all of the following:

✓ Required by client
✓ Production ready
✓ Tested
✓ Maintainable
✓ Documented

Everything else should be removed.

---

# 3. Source of Truth

The following priority must always be followed.

Priority 1

Approved Requirement Document

Priority 2

Client Feedback

Priority 3

Database Consistency

Priority 4

Existing Working Implementation

Priority 5

AI Suggestions

If existing implementation conflicts with approved requirements,

the approved requirements always win.

---

# 4. Project Goal

The goal is NOT to build the biggest marketplace.

The goal is to build a production-ready MVP.

The MVP must solve:

Customer

Shop

Street Vendor

Delivery Partner

Administrator

Only.

---

# 5. Explicitly Out of Scope

Unless the client approves them.

Do NOT implement

❌ AI Recommendations

❌ Machine Learning

❌ Live GPS Tracking

❌ Continuous Vendor Broadcasting

❌ Cryptocurrency

❌ Blockchain

❌ Referral Trees

❌ Loyalty Engine

❌ Dynamic Pricing

❌ Inventory Forecasting

❌ Gamification

❌ Social Feed

❌ Chat System

❌ Wallet

❌ Razorpay Integration (until approved)

❌ Analytics Dashboards beyond requirements

❌ Experimental Features

---

# 6. Technology Stack

Backend

Express

TypeScript

Prisma

PostgreSQL

Redis

JWT

Zod

WebSocket

Nodemailer

Swagger

AWS S3

Frontend

TanStack Start

React 19

React Query

Tailwind CSS

Leaflet

OpenStreetMap

React Hook Form

Radix UI

---

# 7. Architecture Principles

The repository shall follow

Feature Driven Design

Repository Pattern

Service Layer

DTO Pattern

SOLID

Clean Code

DRY

KISS

YAGNI

No unnecessary abstraction.

No duplicate business logic.

---

# 8. Engineering Principles

Never rewrite working code.

Always refactor instead.

Reuse existing modules whenever possible.

Delete obsolete implementations.

Never leave commented dead code.

Never create duplicate APIs.

Never duplicate validators.

Never duplicate repositories.

Never duplicate services.

---

# 9. Quality Standard

Every pull request must satisfy

✓ TypeScript Build

✓ ESLint

✓ Tests

✓ Swagger Updated

✓ Prisma Updated

✓ Documentation Updated

✓ No Duplicate Logic

✓ No Dead Code

---

# 10. Definition of Done

A feature is complete only if

Business Logic Finished

API Finished

Validation Finished

Authorization Finished

Error Handling Finished

Logging Finished

Testing Finished

Swagger Finished

Frontend Integrated

Responsive

Accessible

Production Ready

Otherwise

The feature is NOT complete.

---

# 11. AI Rules

Every AI session shall

Audit first

Think before coding

Refactor before implementing

Reuse before creating

Delete before duplicating

Never assume.

Always verify.

---

# 12. Repository Success Metric

The project is successful when

The entire repository

Builds without warnings

Builds without TypeScript errors

Passes all tests

Contains no duplicate implementations

Contains no experimental code

Implements only approved client requirements

Can be deployed to production immediately.