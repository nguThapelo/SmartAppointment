# SmartAppointment

SmartAppointment is an appointment and service management platform for three user groups: administrators, service providers, and clients.

## What the application does

- Manages accounts for clients and service providers
- Supports role-based access and role-based dashboards
- Allows clients to book services with providers
- Lets providers review and approve or decline bookings
- Tracks full booking lifecycle from booked to approved, paid, and completed
- Supports dynamic service categories and sub-services
- Supports dynamic reusable dropdown/reference values managed by admin
- Supports payment method setup and payment tracking
- Supports provider earnings and client spending summaries
- Supports feedback question management and response submission

## Roles and responsibilities

### Admin

- Full visibility across users, bookings, payments, and feedback
- CRUD for users
- CRUD for service categories and sub-services
- CRUD for reusable master data values used in forms and dropdowns
- CRUD for global feedback question sets and questions

### Provider

- Manages own pricing entries per service
- Reviews and decides booking requests
- Initiates payment for booked services
- Monitors payment status and earnings
- Manages provider-specific feedback questions

### Client

- Books appointments by category and sub-service
- Manages own payment methods
- Views spending summaries
- Submits feedback after completed services

## Data model summary

- User profiles and roles
- Service categories and sub-services
- Provider pricing records
- Appointments with lifecycle and payment fields
- Payment customers, payment methods, and payment transactions
- Feedback question sets, questions, responses, and response items
- Master data types and items for dynamic reusable form values

## Current business flow

1. Client selects service category and sub-service
2. Client creates booking request
3. Provider approves or declines
4. Provider initiates payment
5. Payment status is synchronized and booking moves to paid
6. Provider marks service as completed
7. Client submits feedback

## Notes

- Most forms and dashboards depend on active authentication.
- If requests return unauthorized, sign out and sign back in to refresh role claims and access token.
- Admin-only operations require an account with admin role metadata.
- Development mode allows self-signed certificates by default to reduce local TLS issues.
- To enforce strict TLS locally, set `ALLOW_SELF_SIGNED_TLS=false`.
