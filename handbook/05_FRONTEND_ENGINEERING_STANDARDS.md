# 05_FRONTEND_ENGINEERING_STANDARDS.md

Version: 1.0

Status:
Mandatory

Applies To

Entire Frontend

TanStack Start

React 19

TypeScript

React Query

Tailwind CSS v4

Radix UI

Leaflet

OpenStreetMap

---

# Philosophy

The frontend exists to solve business problems.

Not to showcase animations.

Not to maximize visual effects.

The frontend must always prioritize

✓ Usability

✓ Accessibility

✓ Performance

✓ Maintainability

✓ Consistency

✓ Mobile First

Every screen should feel simple.

Every interaction should feel predictable.

---

# Frontend Architecture

Application

↓

Router

↓

Page

↓

Feature

↓

Components

↓

Hooks

↓

API

↓

Backend

Business logic should never exist inside UI components.

---

# Folder Structure

Target Structure

src/

features/

customer/

shop/

vendor/

delivery/

admin/

shared/

components/

ui/

layout/

hooks/

services/

schemas/

types/

lib/

router/

styles/

---

# Feature Structure

Every business feature should contain

feature/

components/

hooks/

api/

schemas/

types/

constants/

utils/

pages/

Example

features/order/

components/

OrderCard.tsx

OrderTimeline.tsx

OrderStatus.tsx

hooks/

useOrders.ts

useOrder.ts

api/

order.api.ts

schemas/

order.schema.ts

types/

order.types.ts

pages/

OrdersPage.tsx

---

# Pages

A page should

Load data

Call feature components

Handle route params

Handle metadata

Nothing more.

Never place business logic inside pages.

---

# Components

Each component should have only one responsibility.

Maximum Component Size

300 lines

If exceeded

Split component.

---

# UI Components

Reusable components belong only in

components/ui/

Examples

Button

Input

Card

Modal

Dialog

Badge

Table

Tooltip

Drawer

Tabs

Avatar

These components must never contain business logic.

---

# Business Components

Business-specific components belong inside features.

Example

OrderCard

VendorCard

ShopCard

CheckoutSummary

DeliveryTimeline

These must never be placed in

components/ui/

---

# State Management

Use only

React Query

for server state.

Use

React Hook Form

for forms.

Use

Context

only for

Authentication

Theme

Global Settings

Avoid unnecessary Context Providers.

Never store server data in Context.

---

# API Layer

Components never call fetch().

Components never call axios().

Components call

React Query

↓

Feature API

↓

Backend

Example

ProductCard

↓

useProducts()

↓

product.api.ts

↓

Backend

---

# React Query Rules

Every query must have

Query Key

Retry Strategy

Error Handling

Loading State

Empty State

Success State

Invalidation Strategy

Never manually refetch unless required.

---

# Loading States

Every screen must support

Loading

Error

Empty

Success

Offline

Skeletons should be used instead of spinners whenever possible.

---

# Error Handling

Every page

Must have

Error Boundary

Friendly Message

Retry Button

Never expose backend errors directly.

---

# Forms

Every form must use

React Hook Form

+

Zod

Validation occurs

Client Side

↓

Server Side

Never duplicate validation logic.

---

# Routing

Use

TanStack Router

Route File Naming

customers/

vendors/

orders/

products/

checkout/

profile/

Never place business logic in routes.

---

# Authentication

Authentication Context stores

Current User

Access Token

Refresh Status

Permissions

Nothing else.

---

# Authorization

UI visibility

Must respect

Role

Customer

Shop Owner

Street Vendor

Delivery Partner

Administrator

Never rely only on frontend authorization.

Backend remains source of truth.

---

# Styling

Tailwind CSS v4

Only.

Avoid inline styles.

Avoid CSS duplication.

Create reusable utility classes.

---

# Responsive Design

Design

Mobile First

Support

Mobile

Tablet

Desktop

Large Desktop

Every page must be tested on

320px

375px

768px

1024px

1440px

---

# Accessibility

Every page should satisfy

Keyboard Navigation

ARIA Labels

Semantic HTML

Focus Management

Color Contrast

Screen Reader Friendly

---

# Icons

Use only

Lucide React

Never mix icon libraries.

---

# Notifications

Use

Sonner

Only.

Never use alert().

---

# Animations

Allowed

Framer Motion

Purpose

Page transitions

Drawer

Modal

Loading

Feedback

Never animate for decoration.

Animation should improve UX.

---

# Images

Lazy Load

Responsive

Optimized

Placeholder while loading

Never load original large images.

---

# Maps

Approved Library

Leaflet

OpenStreetMap

Allowed Features

Shop Marker

Shop Details

Shop Discovery

Pickup Navigation

Delivery Navigation

Service Area Display

Not Allowed

Google Maps

Paid APIs

Continuous Tracking

Live GPS Broadcast

Moving Delivery Marker

Background Location Streaming

---

# Customer UI

Approved Features

Homepage

Categories

Products

Search

Wishlist

Cart

Checkout

Orders

Profile

Notifications

Support

Shop Map

Nothing else.

---

# Shop Dashboard

Approved Features

Registration

KYC

Membership

Products

Inventory

Orders

Reports

Coupons

Location

Service Area

---

# Street Vendor Dashboard

Approved Features

Registration

Today's Selling Area

Products

Orders

Online

Offline

Pause

Resume

Reports

Earnings

---

# Delivery Dashboard

Approved Features

Accept Order

Reject Order

ETA

Navigation

OTP Verification

Delivery Status

Attendance

Ratings

Earnings

Delivery Count

---

# Admin Dashboard

Approved Features

Customers

Shops

Street Vendors

Delivery Partners

Membership

Categories

Coupons

Advertisements

Reports

Revenue

Support

Permissions

---

# Component Naming

PascalCase

Examples

ProductCard

CheckoutSummary

VendorMap

DeliveryTimeline

---

# Hooks

Hooks begin with

use

Example

useOrders

useCheckout

useVendor

useProducts

Never create hooks for one-time logic.

---

# Types

Every feature owns its own types.

Avoid one massive

types.ts

Example

features/order/types/

order.ts

order-status.ts

order-item.ts

---

# Constants

Every feature owns

constants.ts

Never hardcode

Routes

Statuses

Colors

Permissions

Role Names

---

# API Client

One centralized API layer.

Never duplicate endpoints.

Example

product.api.ts

Contains

List Products

Get Product

Create Product

Update Product

Delete Product

Nothing else.

---

# Performance

Use

React.memo

only when profiling justifies it.

Use

Lazy Loading

Code Splitting

Route Splitting

Image Optimization

Virtual Lists

Debounced Search

Avoid unnecessary re-renders.

---

# Offline Support

Support

PWA

Network Detection

Offline Page

Cached Assets

Do not cache sensitive API responses.

---

# Testing

Every feature should have

Component Tests

Hook Tests

Integration Tests

Critical User Journey Tests

---

# Documentation

Every new feature updates

API Contract

UI Documentation

Route Documentation

Component Documentation

---

# Code Review Checklist

Before merging verify

✓ No duplicated components

✓ No duplicated hooks

✓ No duplicated API calls

✓ Responsive

✓ Accessible

✓ Mobile First

✓ Loading State

✓ Error State

✓ Empty State

✓ Offline State

✓ TypeScript passes

✓ ESLint passes

✓ No unused imports

✓ No dead components

✓ Approved client requirement only

If any check fails

The implementation is rejected.

---

# Definition of Done

A frontend feature is complete only if

✓ Backend Integrated

✓ API Stable

✓ Validation Working

✓ Responsive

✓ Accessible

✓ Loading State

✓ Error State

✓ Empty State

✓ Tested

✓ Documented

✓ Production Ready

Otherwise

The feature is NOT complete.

---

# Golden Rule

Every frontend change should make the application

Cleaner

Faster

More Consistent

More Accessible

More Maintainable

than it was before.

The UI should always prioritize clarity over visual complexity.