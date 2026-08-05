# 08_SECURITY_ENGINEERING_STANDARDS.md

Version: 1.0

Status:
Mandatory

Applies To

Backend

Frontend

Infrastructure

Database

Storage

Deployment

Third-Party Integrations

---

# Security Philosophy

Security is a feature.

Every feature must be secure by default.

Never assume

The client is trusted.

The frontend is trusted.

The network is trusted.

The user is trusted.

Every request must be verified.

---

# Security Principles

Always follow

Least Privilege

Defense in Depth

Fail Secure

Secure by Default

Never Trust User Input

Zero Trust

---

# Authentication

Supported

✓ Email OTP

✓ JWT Access Token

✓ Refresh Token

Future Ready

Google OAuth

Not Enabled

Phone OTP

Wallet Login

Magic Links

---

# Password Policy

Minimum Length

8 Characters

Recommended

12+

Must Contain

Uppercase

Lowercase

Number

Special Character

Never store passwords in plaintext.

Always hash using bcrypt.

---

# OTP Security

OTP Length

6 Digits

Storage

Hashed Only

Expiry

5 Minutes

Maximum Attempts

5

After Maximum Attempts

OTP Invalidated

Never log OTP.

Never return OTP from API.

Never store plaintext OTP.

---

# JWT

Access Token

Short Lifetime

15 Minutes

Refresh Token

7 Days

Refresh Tokens

Stored in Database

Revocable

HTTP Only Cookie

Never expose Refresh Token to JavaScript.

---

# Session Management

Every Login Creates

Session Record

Stores

User

Device

Browser

IP Address

Login Time

Last Activity

Revoked Status

Users may revoke sessions.

Admins may revoke sessions.

---

# Authorization

Roles

Customer

Shop Owner

Street Vendor

Delivery Partner

Administrator

RBAC Mandatory

Never hardcode permissions.

Permissions belong to roles.

---

# Protected Routes

Authentication Required

Profile

Orders

Checkout

Wishlist

Vendor Dashboard

Shop Dashboard

Delivery Dashboard

Admin Panel

Public Routes

Categories

Products

Shops

Authentication

Health

---

# Admin Security

Admin APIs

Require

Authentication

Role Validation

Audit Logging

Rate Limiting

IP Logging

Never expose admin endpoints publicly.

---

# Input Validation

Every Request Validates

Headers

Params

Query

Body

Files

Using

Zod

Never manually validate.

---

# Output Validation

Never expose

Stack Trace

SQL Errors

Prisma Errors

Secrets

Internal IDs

Server Paths

Environment Variables

---

# Error Messages

Good

"Invalid credentials."

Bad

"Email exists but password incorrect."

Never reveal which field failed authentication.

---

# Rate Limiting

Authentication

5 Requests

per Minute

OTP

3 Requests

per 10 Minutes

Password Reset

3 Requests

per Hour

Public Search

100 Requests

per Minute

Admin APIs

Strict

---

# CORS

Whitelist Only

Development

Localhost

Production

Approved Domains

Never use

*

in production.

---

# HTTP Headers

Helmet Enabled

Content Security Policy

XSS Protection

Frame Protection

Referrer Policy

HSTS

Permissions Policy

---

# CSRF

Required

If Refresh Tokens use Cookies.

CSRF Token Required.

---

# File Upload Security

Validate

Mime Type

Extension

Size

Reject Executables

Reject Scripts

Rename Uploaded Files

Store Outside Public Root

Virus Scan Ready

Never trust original filename.

---

# AWS S3 / R2 Storage

Private Buckets

Signed URLs

Short Expiry

Never expose bucket credentials.

---

# Email Security

SMTP Credentials

Stored in Environment Variables

Never hardcode credentials.

Templates only.

Never build HTML inline.

---

# Database Security

Parameterized Queries

Prisma Only

No Raw SQL

Unless absolutely necessary.

Never concatenate SQL.

---

# Prisma Security

Never

findMany()

without pagination.

Never expose hidden fields.

Always select required fields.

---

# Redis Security

Store

OTP

Sessions

Rate Limits

Cache

Never

Passwords

JWT Secrets

Environment Variables

---

# Logging

Log

Login

Logout

Password Reset

OTP Generation

OTP Verification

Role Changes

Order Assignment

KYC Approval

Delivery Completion

Never Log

Password

OTP

JWT

Refresh Token

Secret Keys

SMTP Credentials

AWS Keys

---

# Audit Logs

Every Sensitive Action

Creates Audit Log

Fields

User

Role

Action

Entity

Old Value

New Value

Timestamp

IP

Device

Request ID

---

# Secrets Management

Secrets

Only

Environment Variables

Never commit

.env

Private Keys

API Keys

JWT Secrets

SMTP Passwords

AWS Keys

Redis Passwords

---

# Environment Variables

Validate on Startup.

Application must fail to start if required variables are missing.

---

# API Security

Every Protected Endpoint

Requires

JWT

RBAC

Validation

Audit Logging

Rate Limiting

---

# Order Security

Customer

Cannot modify delivered orders.

Delivery Partner

Cannot update another partner's order.

Vendor

Cannot edit another vendor's order.

Admin

Can override with audit log.

---

# OTP Delivery Verification

Flow

Delivery Partner

↓

Customer receives order

↓

Customer tells OTP

↓

Delivery Partner enters OTP

↓

Backend verifies

↓

Order Completed

Never allow manual completion without OTP unless overridden by Admin.

---

# KYC Security

Files

Encrypted Storage

Private Access

Admin Only

Audit Every View

Never expose KYC publicly.

---

# Maps

Allowed

Shop Location

Service Area

Pickup Navigation

Delivery Navigation

Not Allowed

Continuous GPS Tracking

Background Tracking

Live Broadcast

Google Maps APIs

---

# Frontend Security

Never Store

JWT in Local Storage

Prefer

HTTP Only Cookies

Sanitize User Input

Escape Dynamic HTML

Never use dangerouslySetInnerHTML without sanitization.

---

# XSS Protection

Escape User Content.

Sanitize Rich Text.

Validate URLs.

Reject JavaScript URLs.

---

# Dependency Security

Monthly

npm audit

Update Dependencies

Remove Unused Packages

Monitor Vulnerabilities

---

# Testing

Security Tests

Authentication

Authorization

OTP

Rate Limiting

RBAC

CSRF

XSS

SQL Injection

Broken Access Control

File Upload

---

# OWASP Top 10

Every Release Must Review

Broken Access Control

Cryptographic Failures

Injection

Insecure Design

Security Misconfiguration

Vulnerable Components

Authentication Failures

Software Integrity

Logging Failures

SSRF

---

# Incident Response

Log Incident

Notify Admin

Preserve Logs

Investigate

Patch

Document

Retest

---

# Deployment Security

HTTPS Only

Secure Cookies

HSTS Enabled

Environment Variables Verified

Production Logs Enabled

Debug Disabled

Swagger Protected

---

# Security Review Checklist

Before Merge Verify

✓ Authentication

✓ Authorization

✓ RBAC

✓ Validation

✓ Rate Limiting

✓ Audit Logs

✓ File Validation

✓ Secret Management

✓ HTTPS

✓ No Sensitive Logs

✓ No Hardcoded Secrets

✓ OWASP Review

---

# Definition of Done

A feature is secure only if

✓ Authenticated

✓ Authorized

✓ Validated

✓ Logged

✓ Tested

✓ Audited

✓ Rate Limited

✓ Documented

Otherwise

The feature is NOT production ready.

---

# Golden Rule

Never trust

The client

The frontend

User input

Headers

Cookies

Query parameters

Files

Everything must be verified on the backend before business logic executes.