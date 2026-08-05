# 06_DATABASE_ENGINEERING_STANDARDS.md

Version: 1.0

Status:
Mandatory

Applies To

PostgreSQL

Prisma ORM

Redis

Entire Backend

---

# Philosophy

The database is the single source of truth.

Everything else is derived.

Database design must prioritize

✓ Data Integrity

✓ Consistency

✓ Performance

✓ Scalability

✓ Simplicity

Never optimize for convenience.

Always optimize for correctness.

---

# Database Design Principles

Every table must represent

One Business Entity.

Examples

User

Shop

Vendor

Product

Category

Cart

Order

Delivery

Membership

Coupon

Notification

Never create tables for temporary business logic.

---

# Primary Keys

Every table uses

UUID

Example

id String @id @default(uuid())

Never use auto increment IDs.

---

# Timestamps

Every table must contain

createdAt

updatedAt

Optional

deletedAt

Never manually update timestamps.

Use Prisma defaults.

---

# Soft Delete

Soft Delete is mandatory for

Users

Shops

Products

Categories

Coupons

Memberships

Addresses

Use

deletedAt DateTime?

Never permanently delete business data.

Hard delete only

OTP

Sessions

Refresh Tokens

Logs (after retention period)

---

# Naming Convention

Model

PascalCase

Table

Plural

Fields

camelCase

Enums

PascalCase

Relations

Singular

Example

User

Product

Order

DeliveryPartner

---

# Foreign Keys

Every foreign key

Must define

onDelete

onUpdate

Never rely on database defaults.

Example

Restrict

Cascade

SetNull

Choose explicitly.

---

# Relationships

Prefer explicit relations.

Example

User

↓

Orders

↓

OrderItems

↓

Product

Never store duplicated information.

---

# Many-to-Many

Use join tables.

Never use arrays for relationships.

Example

ProductCategory

ShopMembership

RolePermission

---

# Enumerations

Use enums for

Order Status

Delivery Status

Payment Status

Role

Membership Plan

Vendor Status

Never store status as string.

---

# Monetary Values

Never use float.

Always

Decimal

Example

Decimal(10,2)

---

# Address

Never store complete address in one field.

Separate

House Number

Street

Area

City

State

Postal Code

Latitude

Longitude

Landmark

---

# Coordinates

Store

latitude Decimal

longitude Decimal

Never store map URLs.

---

# Shop Location

Each Shop stores

Latitude

Longitude

Service Radius

Operating Area

Approved

Leaflet

OpenStreetMap

No Google specific fields.

---

# Vendor Daily Area

Street Vendors

Do NOT continuously broadcast location.

Store

Date

Area Description

Approximate Center

Optional Polygon

Status

---

# Orders

Order

↓

Order Items

↓

Delivery

↓

OTP Verification

↓

Status History

Never overwrite status.

Maintain history.

---

# Order Status History

Separate table

OrderStatusHistory

Contains

Order

Status

Changed By

Timestamp

Reason

This provides auditing.

---

# Delivery Status

Maintain history.

Examples

Accepted

Preparing

Ready

Picked Up

Out For Delivery

Delivered

Cancelled

Never overwrite.

Append.

---

# OTP

OTP table

Stores

Hashed OTP

Expiry

Attempts

Verified

Never store plain OTP.

---

# Sessions

Separate table.

Supports

Refresh Tokens

Device

Browser

IP

Last Activity

Revocation

---

# Membership

Separate

Membership

MembershipPlan

MembershipHistory

Never overwrite plans.

---

# Coupons

Coupon

↓

CouponUsage

↓

CouponRule

Never duplicate logic.

---

# Notifications

Separate

Notification

NotificationRead

Supports

Push

Email

System

---

# Audit Logs

Mandatory.

Log

User

Action

Entity

Old Value

New Value

Timestamp

IP

Device

Never log passwords.

Never log OTP.

Never log JWT.

---

# File Upload

Separate

File

Stores

Original Name

Stored Name

Mime

Size

URL

Owner

Uploaded By

Created At

---

# Indexing Rules

Every

Searchable

Filterable

Sortable

Foreign Key

Status

CreatedAt

must be indexed.

Example

email

phone

shopId

vendorId

orderId

status

categoryId

---

# Composite Indexes

Use where necessary.

Example

shopId + status

vendorId + status

categoryId + createdAt

---

# Pagination

Never use

OFFSET

for very large datasets.

Prefer

Cursor Pagination

where applicable.

---

# Transactions

Only Service Layer

starts transactions.

Repository

never coordinates transactions.

Example

Create Order

Reserve Inventory

Create Order Items

Generate OTP

Assign Delivery

Commit

Rollback on failure.

---

# Migrations

Rules

One migration

One feature.

Never mix unrelated changes.

Migration names

Must describe intent.

Good

add_order_status_history

Bad

update_database

---

# Seeding

Separate

Development Seed

Demo Seed

Production Seed

Never insert production test data.

---

# Constraints

Mandatory

Unique Email

Unique Phone (if applicable)

Unique Shop Slug

Unique Membership

Unique Coupon Code

Foreign Keys

Check Constraints

---

# Search

Use

ILIKE

Full Text Search

Indexes

Never perform full table scans unnecessarily.

---

# Performance Rules

Always

Select required fields.

Never

select *

Always paginate.

Avoid N+1.

Batch writes.

Batch reads.

---

# Prisma Rules

Always use

select

include

transactions

Never

findMany()

without limit.

Never

include

deep nested relations unnecessarily.

---

# Database Versioning

Every schema change

Requires

Migration

Documentation

Tests

Never modify schema without migration.

---

# Backup Strategy

Daily Backup

Point In Time Recovery

Migration Rollback

Disaster Recovery Plan

---

# Acceptance Checklist

Before merging verify

✓ No duplicate tables

✓ No duplicate relations

✓ No duplicate enums

✓ Proper indexes

✓ Proper constraints

✓ Transactions reviewed

✓ Migration created

✓ Seed updated

✓ Documentation updated

✓ Tests updated

✓ Prisma Generate passes

✓ Migration passes

---

# Definition of Done

Database work is complete only if

✓ Schema Updated

✓ Migration Created

✓ Seed Updated

✓ Repository Updated

✓ Tests Updated

✓ Documentation Updated

✓ No Data Loss

✓ Performance Reviewed

✓ Rollback Safe

---

# Golden Rule

The database should become

More Consistent

More Predictable

More Performant

after every migration.

Never introduce schema complexity that is not required by the approved client requirements.