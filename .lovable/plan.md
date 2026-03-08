

## Nexus AI — Phase 1: Core Data Layer

### Overview
Build the authentication system, user management, and Products/Customers CRUD for Nexus AI. Dark navy (#1a1a2e) theme with white cards. Hybrid backend: direct Supabase for simple reads, Edge Functions for complex operations.

### Color Scheme
- **Primary**: Dark navy `#1a1a2e`
- **Cards**: White with subtle shadows
- **Accents**: Blue highlights for actions, green for success, red for destructive

---

### 1. Database Schema (Supabase Migrations)

**Users table** — linked to Supabase Auth:
- `id`, `auth_id` (links to auth.users), `user_code` (A001/SA-001/MOD-001), `email`, `name`, `phone`, `role` (main_admin/sub_admin/moderator), `is_active`, `created_by`, `created_at`

**Products table** — with soft delete:
- `id`, `code` (auto: A0001→A0002), `name`, `price`, `stock`, `description`, `deleted_at`, `created_by`, `created_at`, `updated_at`

**Customers table** — with soft delete:
- `id`, `name`, `phone`, `address`, `deleted_at`, `created_by`, `created_at`, `updated_at`

**RLS policies** on all tables enforcing authenticated access. Security definer function for role checks.

---

### 2. Authentication Flow

**Public signup page** (for first/main admin):
- Full Name, Email, Phone (with +880 country code dropdown), Password (min 8, 1 upper, 1 number), Confirm Password, Terms checkbox
- Email verification → redirect to verify-email page
- After verification → auto-create user record with `main_admin` role (if first user) 

**Login page**:
- Email + Password, redirects to a placeholder dashboard on success

**Admin user creation** (post-login):
- Main admin can create sub_admins and moderators via a Users management page
- Auto-generates user codes (SA-001, MOD-001, etc.)

---

### 3. Edge Functions (Complex Operations)

- **create-user**: Validates role permissions, creates auth user + users record with auto-generated code
- **manage-product**: Create with auto-code generation, update, soft delete, restore
- **manage-customer**: Same CRUD pattern as products

---

### 4. Frontend Pages

**Login** (`/login`) — Email/password form, dark navy background, centered white card

**Signup** (`/signup`) — Full registration form per spec with validation, country code phone input

**Verify Email** (`/verify-email`) — Confirmation message with resend button (60s cooldown)

**Products** (`/products`) — Table with search, pagination, low-stock filter. Create/edit modal. Soft delete with restore option. Shows product code, name, price, stock.

**Customers** (`/customers`) — Table with phone/name search, pagination. Create/edit modal. Soft delete with restore. Phone lookup endpoint for future order form.

**Users** (`/users`) — Admin-only page to create sub_admins/moderators, toggle active/inactive status

**Layout** — Sidebar navigation with role-based menu items, top bar with user info

---

### 5. Auth Protection
- Route guards: unauthenticated users redirected to `/login`
- Role-based route access (users page = main_admin only)
- Active status check on every protected route

