# VegaMart – Master Feature Requirement List (Version 1.1)

## 1. Website Overview

* VegaMart Introduction
* Vision & Mission
* Business Model
* Target Users
* Unique Selling Proposition (USP)
* Revenue Model Overview

---

# 2. Customer Website

## Authentication

* Email Login (SMTP OTP using Gmail App Password)
* Social Login
* Guest Login

---

## Home Page

* Banner Slider
* Search Bar
* Categories
* Live Vendor Section
* Trending Products
* Offers & Deals

### Shop Discovery

* Shop Location on Map
* View Shop on Map
* Navigate to Shop (Self Pickup)
* Shop Distance *(Only if it can be shown without paid third-party map APIs)*

---

## Search

* Filter & Sort

---

## Product Details

* Product Images
* Product Video
* Product Description
* Price
* Discount
* Available Stock
* Reviews & Ratings
* Add to Cart
* Buy Now

---

## Cart

* Quantity Update
* Coupon Apply
* Delivery Charges
* Order Summary

---

## Checkout

### Delivery Options

* Self Pickup
* Shop Delivery
* Vendor Delivery
* VegaMart Delivery Partner

### Checkout Features

* Delivery Method Selection
* Delivery Address Selection
* Delivery Address Management
* Estimated Delivery Time (ETA)
* Delivery Charges
* Payment Method
* Order Notes
* Order Confirmation
* OTP Delivery Confirmation

---

## Orders

* Order History
* Repeat Order
* Cancel Order
* Return / Refund Request

---

## Customer Profile

* Saved Addresses
* Wishlist
* Notifications
* Customer Support

---

# 3. Shop Owner Dashboard

## Shop Setup

* Shop Registration
* KYC Verification
* Shop Verification
* Membership Plans

### Location Management

* Shop Location Management
* Update Shop Location
* Service Area Management

---

## Product Management

* Product Management
* Product Categories
* Stock Management
* Bulk Product Upload

---

## Order Management

* Orders
* Pickup Orders
* Shop Delivery Orders
* VegaMart Delivery Orders

---

## Business Management

* Customer List
* Sales Dashboard
* Daily Reports
* Weekly Reports
* Monthly Reports
* Profit Analysis
* GST Settings
* Invoice Generation
* Staff Management
* Coupons
* Offers & Discounts
* Shop Analytics
* Shop Ratings & Reviews

---

# 4. Live / Street Vendor Dashboard (Roaming Vendors)

## Registration

* Vendor Registration
* KYC Verification
* Online / Offline Status

### Daily Route Planning

* Before starting the day, vendor selects/describes today's selling area in descriptive form.

---

## Operations

* Product List
* Customer Call
* Pause / Resume Service
* Vendor Delivery Option

---

## Earnings

* Earnings Dashboard
* Reports

---

# 5. Delivery Partner Dashboard

## Registration

* KYC Verification
* Online / Offline

---

## Order Management

* Accept / Reject Orders
* Navigation to Pickup Location
* Navigation to Customer Address
* Delivery Status Updates

  * Order Accepted
  * Picked Up
  * Out for Delivery
  * Delivered
* ETA Update (Delivery partner specifies estimated arrival time after accepting the order.)
* OTP Delivery Verification

  * Platform generates a random OTP.
  * Customer shares the OTP with the delivery partner upon delivery.
  * Delivery is completed only after OTP verification.

---

## Performance

* Earnings Dashboard
* Total Deliveries Completed
* Ratings
* Attendance

---

# 6. Admin Panel

## User Management

* Customer Management
* Shop Management
* Live / Street Vendor Management
* Delivery Partner Management

---

## Order Management

* Order Management

---

## Membership & Revenue

* Membership Management (Vendors)
* Commission Management
* Advertisement Management
* Coupon Management
* Revenue Dashboard

---

## Category & Location

* Category Management
* Shop Location Management
* Service Area Configuration

---

## Analytics & Reports

* Reports

---

## System

* Notifications
* Customer Support Tickets
* Role & Permission Management
* Security Logs

---

# 7. Business Categories

* Grocery
* Fruits
* Vegetables
* Dairy
* Bakery
* Meat
* Fish
* Eggs
* Water
* Gas Cylinder
* Pharmacy
* Stationery
* Hardware
* Electrical
* Mobile Accessories
* Pet Food
* Restaurant
* Tiffin Service
* Sweet Shop
* Flower Shop
* Gift Shop
* Cosmetics
* Fashion
* Home Needs
* Kitchen Items
* Local Services

---

# 8. Revenue Sources

* Shop Membership Plans
* Delivery Charges
* Premium Shop Listing
* Featured Shop Promotion
* Sponsored Products
* Digital Advertisements
* Festival Campaigns
* Business Analytics
* Digital Catalogue Services

---

## Notes & Clarifications

* Shops remain visible on the map, as requested by the client.
* Customers can navigate to shops for Self Pickup.
* Delivery partners use navigation only for pickup and customer delivery.
* Customers do **not** receive continuous live GPS tracking of the delivery partner.
* The delivery partner manually updates delivery status and ETA.
* Shop distance should only be displayed if it can be calculated without incurring third-party map service costs.
* Live/Street vendors specify their intended operating area at the start of the day rather than continuously sharing GPS location.

This requirement set is now internally consistent and reflects the client's latest feedback while avoiding unnecessary real-time location tracking complexity.
