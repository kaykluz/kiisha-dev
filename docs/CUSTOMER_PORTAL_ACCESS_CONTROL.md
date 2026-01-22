# Customer Portal Access Control Documentation

## Overview

The KIISHA Customer Portal provides a separate authentication and access system for customers (end-users of solar installations) to view their invoices, track payments, and monitor their energy assets. This document explains the access control architecture and data isolation mechanisms.

## Authentication Architecture

### Separate User Tables

The system maintains two distinct user tables:

1. **`users` table** - Internal operations team (admins, editors, reviewers)
   - Authenticated via Manus OAuth, Google, GitHub, Microsoft, or email/password
   - Has access to the full admin dashboard and all internal features
   - Role-based access: `admin`, `user`

2. **`customerUsers` table** - Customer portal users
   - Authenticated via email/password only (separate from internal auth)
   - Has access only to the customer portal (`/portal/*` routes)
   - Role-based access: `owner`, `admin`, `viewer`

### Token-Based Authentication

Customer portal uses a separate JWT token stored in `localStorage` under `customer_token`:

```typescript
// Customer login generates a separate token
const token = jwt.sign(
  { 
    type: "customer",  // Distinguishes from internal users
    userId: user.id, 
    customerId: user.customerId,
    email: user.email,
    role: user.role,
  },
  JWT_SECRET,
  { expiresIn: "7d" }
);
```

## Data Isolation

### Customer-to-Data Relationships

```
Customer (customers table)
├── CustomerUsers (customerUsers table) - Portal login accounts
├── CustomerProjects (customerProjects table) - Linked assets
├── Invoices (invoices table) - Billing records
└── Payments (payments table) - Payment history
```

### Access Control Rules

| Data Type | Internal Users | Customer Users |
|-----------|---------------|----------------|
| All Customers | ✅ Full access | ❌ No access |
| Own Customer Record | ✅ Full access | ✅ Read only |
| Other Customer Records | ✅ Full access | ❌ No access |
| Own Invoices | ✅ Full access | ✅ Read + Pay |
| Other Invoices | ✅ Full access | ❌ No access |
| Own Projects | ✅ Full access | ✅ Based on accessLevel |
| All Projects | ✅ Full access | ❌ No access |
| Admin Features | ✅ Based on role | ❌ No access |

### Project Access Levels

Customers can have different access levels to their linked projects:

- **`full`** - View all project details, documents, and telemetry
- **`limited`** - View basic project info and summary metrics
- **`reports_only`** - View only generated reports

## Route Protection

### Internal Routes (Protected by AdminGuard)

All admin routes are wrapped with `AdminGuard` component:

```typescript
<Route path="/admin/customers">
  {() => <AdminRoute component={CustomerManagement} />}
</Route>
```

### Customer Portal Routes

Portal routes check for `customer_token` in localStorage:

```typescript
useEffect(() => {
  const token = localStorage.getItem('customer_token');
  if (!token) {
    setLocation('/portal/login');
  }
}, []);
```

## API Endpoint Security

### Customer-Facing Endpoints

These endpoints filter data by `customerId` from the JWT token:

- `customerPortal.getMyInvoices` - Returns only invoices for the authenticated customer
- `customerPortal.getInvoiceDetails` - Verifies invoice belongs to customer before returning
- `customerPortal.markInvoiceViewed` - Updates only customer's own invoices

### Admin-Only Endpoints

These endpoints require internal user authentication:

- `customerPortal.listCustomers` - Lists all customers (admin only)
- `customerPortal.createCustomer` - Creates new customers (admin only)
- `customerPortal.createInvoice` - Creates invoices (admin only)
- `customerPortal.recordPayment` - Records manual payments (admin only)

## Security Considerations

### What Customers CAN See

1. Their own customer profile information
2. Invoices addressed to their customer account
3. Payment history for their invoices
4. Projects linked to their customer account (based on access level)
5. Energy production data for their linked projects
6. Notifications related to their account

### What Customers CANNOT See

1. Other customers' data
2. Internal comments or notes
3. Admin configuration pages
4. AI configuration or credentials
5. OAuth provider settings
6. Other organizations' data
7. Internal user accounts
8. Audit logs or system telemetry

## Testing the Portal

### Test Credentials

A test customer account is available for testing:

- **Email:** test@customer.com
- **Password:** TestCustomer123!
- **Portal URL:** /portal/login

### Verification Steps

1. Log in to the customer portal with test credentials
2. Verify you can only see the test customer's invoices
3. Verify admin navigation items are not visible
4. Verify direct navigation to `/admin/*` routes redirects to login
5. Verify API calls return only customer-scoped data

## Future Enhancements

1. **Multi-factor authentication** for customer portal
2. **IP allowlisting** for customer accounts
3. **Session management** with device tracking
4. **Audit logging** for customer actions
5. **Document sharing** with customer-specific permissions
