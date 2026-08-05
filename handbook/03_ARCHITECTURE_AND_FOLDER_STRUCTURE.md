# VegaMart Architecture & Folder Structure

Version: 1.0

Status:
Mandatory

This document defines the target architecture of VegaMart.

The repository should gradually converge toward this architecture through
continuous refactoring.

Never perform a massive rewrite.

Always migrate incrementally.

---

# Architecture Goals

The architecture must satisfy

✓ Maintainability

✓ Scalability

✓ Testability

✓ Simplicity

✓ Clear Separation of Concerns

✓ Feature Isolation

✓ Low Coupling

✓ High Cohesion

---

# High Level Architecture

                Client
                   │
                   ▼
          React + TanStack
                   │
              React Query
                   │
                   ▼
             REST API Layer
                   │
            Express Router
                   │
                   ▼
             Controller Layer
                   │
                   ▼
              Service Layer
                   │
                   ▼
            Repository Layer
                   │
                   ▼
                 Prisma
                   │
                   ▼
             PostgreSQL

Redis

↓

Caching

↓

Sessions

↓

OTP

External Services

↓

SMTP

AWS S3

Leaflet (OSM)

---

# Backend Layer Responsibilities

Request

↓

Routes

↓

Controllers

↓

Services

↓

Repositories

↓

Database

Never skip layers unless explicitly justified.

---

# Controller Rules

Controllers

Responsible For

• Receiving request

• Calling validator

• Calling service

• Returning response

Controllers Must NOT

Contain business logic

Contain Prisma queries

Contain calculations

Contain authorization logic

Maximum Length

200 Lines

---

# Service Rules

Services implement

Business Rules

Examples

Create Order

Assign Delivery

Generate OTP

Calculate Commission

Validate Checkout

Services must NOT

Return Express Response

Read req.body

Use res.json

Use req.params

Maximum

500 Lines

Split into Use Cases if larger.

---

# Repository Rules

Repositories communicate only with Prisma.

Repositories must never

Contain business rules

Contain HTTP logic

Contain Express logic

Contain validation

One repository

One aggregate root.

Examples

ProductRepository

OrderRepository

VendorRepository

CustomerRepository

---

# Validator Rules

Every endpoint

Must have

One Zod schema.

Validation is never performed inside controllers.

Validation is never duplicated.

---

# Route Rules

Routes only

Define endpoints.

Nothing else.

No middleware logic.

No business logic.

No validation.

---

# Shared Modules

Shared modules should contain only reusable code.

Allowed

Config

Constants

Logger

Database

Storage

Utils

Types

Middlewares

Not Allowed

Business Rules

---

# Folder Structure

Target Backend

src/

config/

database/

middlewares/

shared/

constants/

errors/

logger/

types/

utils/

modules/

auth/

customer/

product/

category/

cart/

checkout/

order/

vendor/

shop/

delivery/

notification/

coupon/

admin/

support/

storage/

prisma/

---

# Feature Module Structure

Every module should follow

module/

controller.ts

routes.ts

service.ts

repository.ts

validator.ts

dto.ts

mapper.ts

types.ts

index.ts

test/

This keeps every feature self-contained.

---

# Current Repository Migration

Current folders

controllers/

services/

repositories/

validators/

routes/

should gradually migrate into

modules/

Do NOT perform this migration in one commit.

Move only when touching a feature.

---

Example

Current

controllers/product.controller.ts

services/product.service.ts

repositories/product.repository.ts

validators/product.validator.ts

routes/product.routes.ts

↓

Future

modules/product/

controller.ts

service.ts

repository.ts

validator.ts

routes.ts

index.ts

---

# Frontend Architecture

Current

components/

hooks/

routes/

context/

lib/

Future

features/

customer/

shop/

vendor/

delivery/

admin/

shared/

components/

hooks/

layouts/

services/

types/

schemas/

---

# Feature Example

features/

orders/

components/

hooks/

api/

types/

schemas/

pages/

OrdersPage.tsx

OrderCard.tsx

OrderStatus.tsx

OrderTimeline.tsx

OrderAPI.ts

OrderSchema.ts

OrderTypes.ts

---

# Shared Components

Shared UI belongs in

components/ui/

Examples

Button

Input

Modal

Card

Badge

Table

Drawer

Tabs

Tooltip

Never duplicate UI components.

---

# Business Components

Business-specific components stay inside features.

Example

features/order/

OrderCard

OrderHistory

OrderTimeline

NOT

components/

---

# API Layer

Frontend should never call fetch directly.

Always

React Query

↓

API Client

↓

Backend

Example

ProductAPI

OrderAPI

VendorAPI

CustomerAPI

---

# State Management

Use

React Query

for

Server State

Use

React Hook Form

for Forms

Use

Context

Only for

Authentication

Theme

Global Settings

Avoid unnecessary global state.

---

# Maps

Approved

Leaflet

OpenStreetMap

Allowed Features

Shop Marker

Shop Discovery

Self Pickup Navigation

Delivery Navigation

Service Area

Not Allowed

Continuous GPS

Live Driver Tracking

Google Maps

Paid APIs

Background Tracking

---

# Naming Convention

Files

kebab-case

Components

PascalCase

Variables

camelCase

Enums

PascalCase

Interfaces

PascalCase

DTO

Suffix DTO

Repositories

Suffix Repository

Services

Suffix Service

Validators

Suffix Validator

Controllers

Suffix Controller

---

# Import Rules

Shared

↓

Modules

↓

Features

↓

Pages

Never reverse dependency.

Shared must never import features.

---

# Error Handling

Centralized only.

Never duplicate

try/catch

logic.

Use

ApiError

Global Error Handler

---

# Logging

Every mutation

Create

Update

Delete

Approve

Reject

Assign

Deliver

Cancel

must be logged.

---

# Database

One Repository

One Aggregate

Transactions handled only in Service Layer.

Repositories never coordinate transactions.

---

# Acceptance Criteria

Architecture is considered healthy when

✓ Every feature is isolated

✓ No duplicate services

✓ No duplicate repositories

✓ No duplicate validators

✓ No circular dependencies

✓ Clear ownership

✓ Low coupling

✓ High cohesion

✓ Easy onboarding

✓ Predictable folder structure

This architecture is the long-term target for VegaMart.