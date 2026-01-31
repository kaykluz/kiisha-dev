# KIISHA Platform - Comprehensive Technical Analysis

**Analysis Date:** January 2026  
**Version:** 1.0  
**Analyst:** Technical Architecture Review Team

---

## Executive Summary

KIISHA is a sophisticated **multi-tenant SaaS platform** designed for **renewable energy asset management**, specifically focused on solar energy operations, maintenance, and compliance tracking. The platform provides comprehensive tools for managing solar installations, tracking due diligence requirements, monitoring energy production, handling invoicing, and facilitating stakeholder communication.

**Key Characteristics:**
- **Industry Focus:** Renewable Energy (Solar) Operations & Maintenance
- **Architecture:** Full-stack TypeScript application with React frontend and Node.js backend
- **Security Model:** Enterprise-grade multi-tenant isolation with RBAC
- **AI Integration:** Conversational AI agents with strict safety policies
- **Deployment:** Cloud-native with Railway/Docker support

---

## 1. System Architecture & Design Patterns

### 1.1 Overall Architecture

**Architecture Type:** Monolithic Full-Stack Application with Modular Design

**Technology Stack:**
- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Node.js + Express + tRPC
- **Database:** MySQL with Drizzle ORM
- **State Management:** React Query (TanStack Query)
- **UI Framework:** Radix UI + Tailwind CSS
- **Authentication:** Custom session-based auth + OAuth (Manus, Google, GitHub, Microsoft)
- **Real-time:** WebSocket for notifications
- **Storage:** AWS S3 / Cloudflare R2 / Supabase
- **Monitoring:** Grafana integration

### 1.2 Design Patterns

1. **tRPC for Type-Safe API Communication**
   - End-to-end type safety between client and server
   - Automatic type inference
   - No REST boilerplate

2. **Repository Pattern**
   - Database access abstracted through `db.ts` module
   - Centralized query logic

3. **Middleware Chain Pattern**
   - Authentication guards
   - Session hardening
   - Tenant routing
   - Rate limiting

4. **Service Layer Pattern**
   - Business logic separated into services
   - Reusable across routers

5. **Provider Pattern**
   - Pluggable adapters for email, storage, LLM, notifications
   - Factory pattern for provider instantiation

6. **Context Pattern**
   - React contexts for auth, theme, feature flags, WebSocket
   - Request context for tRPC procedures

---

## 2. Main Components and Modules

### 2.1 Server-Side Components

#### Core Infrastructure (`server/_core/`)
- **trpc.ts**: tRPC configuration, middleware, procedure definitions
- **context.ts**: Request context creation, session validation
- **env.ts**: Environment variable management
- **llm.ts**: LLM integration abstraction
- **oauth.ts**: OAuth provider integration
- **notification.ts**: Notification system
- **map.ts**: Geospatial utilities
- **imageGeneration.ts**: AI image generation
- **voiceTranscription.ts**: Voice-to-text processing

#### Routers (`server/routers/`)
Key API routers include:
- **auth.ts**: Authentication (login, signup, password reset)
- **authSession.ts**: Session management, workspace selection
- **workspace.ts**: Multi-tenant workspace management
- **diligence.ts**: Due diligence templates, requirements, renewals
- **customerPortal.ts**: Customer-facing portal API
- **views.ts**: View overlay system for data filtering
- **aiChat.ts**: Conversational AI interface
- **billing.ts**: Invoice and payment management
- **templates.ts**: Document template management
- **obligations.ts**: Compliance obligation tracking
- **grafana.ts**: Monitoring dashboard integration
- **superuser.ts**: Platform administration

#### Services (`server/services/`)
Core business logic services:
- **tenantIsolation.ts**: Multi-tenant data isolation enforcement
- **securityPolicy.ts**: Organization security policy enforcement
- **permissions.ts**: RBAC permission checking
- **sessionManager.ts**: Database-backed session management
- **conversationalAgent.ts**: AI agent orchestration
- **dataAccessControl.ts**: Fine-grained access control
- **auditLog.ts**: Audit trail logging
- **jobQueue.ts**: Background job processing
- **emailService.ts**: Email delivery
- **storageHardening.ts**: Secure file storage
- **viewSharing.ts**: Cross-organization view sharing

#### Middleware (`server/middleware/`)
- **authGuards.ts**: Route-level authentication enforcement
- **sessionHardening.ts**: Session security (CSRF, rotation)
- **tenantRouting.ts**: Tenant-aware request routing
- **workspaceGuards.ts**: Workspace access validation
- **rateLimit.ts**: API rate limiting

#### AI System (`server/ai/`)
- **gateway.ts**: AI request routing and orchestration
- **policies.ts**: AI safety policies and constraints
- **adapter.ts**: Multi-provider LLM adapter
- **budget.ts**: Token usage tracking
- **confirmation.ts**: Human-in-the-loop confirmations
- **telemetry.ts**: AI usage monitoring
- **tooling/**: AI function calling tools (assets, documents, RFIs)
- **providers/**: LLM provider implementations (OpenAI, Anthropic, Gemini, DeepSeek)

### 2.2 Client-Side Components

#### Core Structure (`client/src/`)
- **App.tsx**: Main application component, routing
- **main.tsx**: Application entry point
- **index.css**: Global styles

#### Contexts (`client/src/contexts/`)
- **AuthProvider.tsx**: Authentication state management
- **ThemeContext.tsx**: Dark/light mode
- **FeatureFlagContext.tsx**: Feature toggle system
- **PortalContext.tsx**: Customer portal state
- **WebSocketContext.tsx**: Real-time notifications

#### Pages (`client/src/pages/`)
Major page components:
- **Dashboard.tsx**: Main operations dashboard
- **AssetDetails.tsx**: Individual asset management
- **ComplianceDashboard.tsx**: Compliance tracking
- **DocumentExtraction.tsx**: AI-powered document processing
- **FinancialModels.tsx**: Financial modeling interface
- **CustomViews.tsx**: View builder interface
- **RequestsDashboard.tsx**: RFI management
- **DataRoom.tsx**: Virtual data room
- **Operations.tsx**: O&M operations center

Customer Portal pages:
- **portal/PortalDashboard.tsx**: Customer dashboard
- **portal/PortalInvoices.tsx**: Invoice viewing
- **portal/PortalProduction.tsx**: Energy production monitoring
- **portal/PortalWorkOrders.tsx**: Work order tracking

Admin pages:
- **admin/CustomerManagement.tsx**: Customer administration
- **admin/AIConfig.tsx**: AI configuration
- **admin/ViewManagement.tsx**: View administration
- **admin/Observability.tsx**: System monitoring

#### UI Components (`client/src/components/`)
Extensive component library including:
- **AppLayout.tsx**: Main application layout
- **DashboardLayout.tsx**: Dashboard container
- **GlobalAIChat.tsx**: AI chat interface
- **Map.tsx**: Interactive asset map
- **AssetClassificationCharts.tsx**: Data visualization
- **DocumentPreview.tsx**: Document viewer
- **ViewBuilder.tsx**: Visual query builder
- **OnboardingWizard.tsx**: User onboarding flow
- **ui/**: Radix UI component wrappers

### 2.3 Database Schema (`drizzle/`)

**Key Tables:**
- **users**: Internal operations users
- **customerUsers**: Customer portal users (separate auth)
- **organizations**: Tenant organizations
- **organizationMembers**: User-organization relationships
- **workspaces**: Sub-organization workspaces
- **projects**: Solar installation projects
- **assets**: Physical assets (inverters, panels, batteries)
- **vatrAssets**: View-Aware Topology Records (VATR) for assets
- **viewScopes**: View overlay definitions
- **viewItemInclusions/Exclusions**: View filtering rules
- **viewFieldOverrides**: Field-level overrides in views
- **diligenceTemplates**: Due diligence templates
- **requirementItems**: Compliance requirements
- **expiryRecords**: Expiry tracking
- **invoices**: Billing invoices
- **payments**: Payment records
- **documents**: Document metadata
- **aiConversations**: AI chat history
- **auditLogs**: Audit trail

---

## 3. Security Features and Safety Constraints

### 3.1 Multi-Tenant Isolation (CRITICAL)

**Hard Rules (Non-Negotiable):**
1. **Organizations cannot see other organizations' data - EVER** (unless explicitly shared via Views)
2. **Every data fetch MUST include an organization boundary constraint**
3. **AI is subject to the EXACT same authorization checks as the user**
4. **No cross-org retrieval**: AI must not reference, infer, or return anything outside scope
5. **No training/learning across orgs**: Customer data never used to train shared models

**Implementation:**
- `tenantIsolation.ts` service enforces org boundaries
- Database queries always filtered by `organizationId`
- Middleware validates tenant context on every request
- AI tools inherit user's organization scope

### 3.2 Authentication & Authorization

**Authentication Methods:**
- Email/password with bcrypt hashing
- OAuth providers: Manus, Google, GitHub, Microsoft
- Two-factor authentication (TOTP)
- Email verification
- Password reset flow

**Session Management:**
- Database-backed sessions (not JWT)
- HttpOnly, Secure, SameSite cookies
- Session rotation on privilege escalation
- Automatic session expiration
- CSRF token validation

**Authorization (RBAC):**
- System roles: `admin`, `user`, `superuser_admin`
- Project roles: `admin`, `editor`, `reviewer`
- Permission checks at router level
- Field-level access control via RBAC

### 3.3 Customer Portal Isolation

**Separate Authentication:**
- Distinct `customerUsers` table
- Separate login flow and session management
- No access to internal admin features
- Scoped to specific projects/customers

**Data Scoping:**
- Customers can only see their own data
- Project-level access control
- Invoice and payment visibility limited to customer
- Production data filtered by customer scope

### 3.4 AI Safety Policies

**Policy Enforcement:**
- AI requests subject to same RBAC as user
- Organization boundary enforcement
- Sensitive data redaction
- Human-in-the-loop for critical actions
- Token budget limits
- Audit logging of all AI interactions

**Prohibited Actions:**
- Cross-organization data access
- Unauthorized data modification
- Bypassing authentication
- Accessing sensitive fields without permission

### 3.5 Additional Security Measures

- **Rate Limiting**: API request throttling
- **Input Validation**: Zod schema validation on all inputs
- **SQL Injection Prevention**: Parameterized queries via Drizzle ORM
- **XSS Protection**: React's built-in escaping
- **Storage Hardening**: Secure file upload validation
- **Audit Logging**: Comprehensive audit trail
- **Session Hardening**: IP validation, suspicious login detection
- **MFA Enforcement**: Organization-level 2FA policies

---

## 4. Data Flow and Processing Logic

### 4.1 Request Flow

1. **Client Request**: React component triggers tRPC mutation/query
2. **Middleware Chain**: Auth guards, session hardening, tenant routing, rate limiting
3. **Context Creation**: Session validation, user loading
4. **Router Procedure**: Input validation, authorization, business logic, database queries
5. **Response**: Data serialization, type-safe response to client

### 4.2 AI Request Flow

1. **User Initiates AI Request**: Via GlobalAIChat or AI-enabled feature
2. **AI Gateway Processing**: Route to provider, apply safety policies, check budget
3. **Tool Execution**: AI requests tool execution with user's permissions
4. **Response Generation**: LLM generates response, sensitive data redacted
5. **Human Confirmation**: Critical actions require user approval

### 4.3 Document Processing Flow

1. **Upload**: File validated and stored, metadata saved
2. **AI Extraction**: OCR, entity recognition, data extraction
3. **Review & Approval**: User reviews and corrects extracted data
4. **Categorization**: Document categorized and linked to entities

### 4.4 View System (VATR)

**View-Aware Topology Records:**
- Assets/projects have base records
- Views overlay filters and field overrides
- View resolution: inclusion/exclusion check, field overrides, RBAC filtering

**View Sharing:**
- Views can be shared across organizations
- Explicit permission grants
- Shared data read-only by default

---

## 5. API Structure and Endpoints

### 5.1 tRPC Router Organization

**Main Routers:**
- `auth`: Authentication operations
- `authSession`: Session and workspace management
- `workspace`: Workspace CRUD
- `diligence`: Due diligence and compliance
- `customerPortal`: Customer-facing API
- `views`: View overlay system
- `aiChat`: AI conversational interface
- `billing`: Invoicing and payments
- `templates`: Document templates
- `obligations`: Obligation tracking
- `grafana`: Monitoring integration
- `admin`: Administrative functions
- `superuser`: Platform administration

### 5.2 Key API Patterns

**Query Procedures** (read operations):
- List operations with pagination
- Detail views with related data
- Filtered queries with Zod schemas

**Mutation Procedures** (write operations):
- Create, update, delete operations
- Input validation via Zod
- Transaction support for complex operations

**Procedure Types:**
- `publicProcedure`: No authentication required
- `protectedProcedure`: Requires authenticated user
- `adminProcedure`: Requires admin role

---

## 6. Key Features and Functionality

### 6.1 Core Features

1. **Asset Management**
   - Solar installation tracking
   - Equipment inventory (inverters, panels, batteries)
   - Geospatial mapping
   - Performance monitoring

2. **Due Diligence & Compliance**
   - Template-based diligence workflows
   - Requirement tracking
   - Expiry management
   - Renewal workflows
   - Audit trails

3. **Document Management**
   - Universal upload zone
   - AI-powered extraction
   - Document categorization
   - Version control
   - PDF preview

4. **Customer Portal**
   - Separate authentication
   - Invoice viewing and payment
   - Energy production monitoring
   - Work order tracking
   - Document access

5. **AI-Powered Features**
   - Conversational AI assistant
   - Document extraction
   - Auto-categorization
   - Predictive maintenance
   - Natural language queries

6. **View System (VATR)**
   - Custom data views
   - Cross-organization sharing
   - Field-level overrides
   - Dynamic filtering

7. **Financial Management**
   - Invoice generation
   - Payment tracking
   - Recurring invoices
   - Financial modeling

8. **Operations & Maintenance**
   - Work order management
   - Maintenance scheduling
   - Performance alerts
   - Variance tracking

9. **Monitoring & Observability**
   - Grafana integration
   - Real-time dashboards
   - Alert webhooks
   - Performance metrics

10. **Multi-Channel Communication**
    - Email notifications
    - WhatsApp integration
    - SMS alerts
    - In-app notifications

### 6.2 Advanced Features

- **A/B Testing**: Feature rollout management
- **Feature Flags**: Dynamic feature toggling
- **Calendar Integration**: Meeting scheduling
- **Voice Notes**: Voice-to-text processing
- **Bulk Operations**: Batch uploads and updates
- **Data Rooms**: Virtual data room generation
- **Portfolio Comparison**: Multi-project analytics
- **Predictive Maintenance**: AI-driven maintenance scheduling

---

## 7. Technology Stack and Dependencies

### 7.1 Frontend Dependencies

**Core:**
- React 18.3.1
- TypeScript 5.x
- Vite 6.0.11 (build tool)

**UI Framework:**
- Radix UI components (20+ components)
- Tailwind CSS 4.0.0
- Lucide React (icons)
- Recharts (data visualization)

**State Management:**
- TanStack Query (React Query) 5.67.1
- TanStack Router 2.15.0
- Zustand (lightweight state)

**Forms:**
- React Hook Form 7.54.2
- Zod 3.24.1 (validation)

**Utilities:**
- date-fns (date manipulation)
- clsx, tailwind-merge (class management)
- react-pdf-viewer (PDF viewing)

### 7.2 Backend Dependencies

**Core:**
- Node.js (runtime)
- Express 5.x (HTTP server)
- tRPC 11.0.0 (type-safe API)
- TypeScript 5.x

**Database:**
- Drizzle ORM 0.40.0
- MySQL 2 (database driver)

**Authentication:**
- bcryptjs (password hashing)
- jsonwebtoken (JWT)
- speakeasy (TOTP for 2FA)

**AI/LLM:**
- OpenAI SDK
- Anthropic SDK
- Google Generative AI SDK

**Storage:**
- AWS SDK (S3)
- Cloudflare R2 support
- Supabase support

**Email:**
- Postmark
- SendGrid
- Mailgun

**Utilities:**
- Zod (validation)
- SuperJSON (serialization)
- ws (WebSocket)

### 7.3 Development Tools

- Vitest (testing)
- ESBuild (bundling)
- Drizzle Kit (migrations)
- TSX (TypeScript execution)
- Prettier (formatting)

---

## 8. Deployment and Infrastructure

### 8.1 Deployment Targets

- **Railway**: Primary deployment platform
- **Docker**: Containerized deployment
- **Nixpacks**: Build system

### 8.2 Configuration

- Environment-based configuration via `env.ts`
- Railway-specific configuration in `railway.json`
- Nixpacks configuration in `nixpacks.toml`

### 8.3 Database Migrations

- Drizzle Kit for schema migrations
- Version-controlled migration files
- Automated migration on deployment

---

## 9. Testing and Quality Assurance

### 9.1 Test Coverage

- **561 passing tests** (as of latest audit)
- Unit tests for services and utilities
- Integration tests for routers
- Contract enforcement tests
- Security policy tests

### 9.2 Test Categories

- Authentication and authorization tests
- Multi-tenant isolation tests
- RBAC enforcement tests
- AI safety policy tests
- View system tests
- Customer portal tests
- Data access control tests

---

## 10. Documentation and Compliance

### 10.1 Internal Documentation

Extensive documentation in `docs/` directory:
- Feature specifications
- Security audits
- Implementation guides
- Compliance reports
- API contracts

### 10.2 Audit Reports

- RBAC Access Control Matrix
- Customer Portal Access Control
- Contract Enforcement Report
- VATR Views Contract Audit
- Feature Verification Matrix

---

## 11. Key Strengths

1. **Enterprise-Grade Security**: Comprehensive multi-tenant isolation with strict enforcement
2. **Type Safety**: End-to-end TypeScript with tRPC
3. **AI Integration**: Sophisticated AI system with safety policies
4. **Modularity**: Well-organized codebase with clear separation of concerns
5. **Scalability**: Multi-tenant architecture designed for growth
6. **Flexibility**: Pluggable providers for external services
7. **Compliance**: Built-in audit logging and compliance tracking
8. **User Experience**: Modern, responsive UI with real-time updates

---

## 12. Potential Integration Points

### 12.1 External System Integration

KIISHA provides several integration points:
- **API**: tRPC endpoints for programmatic access
- **Webhooks**: Event-driven notifications
- **OAuth**: Third-party authentication
- **Storage**: Multiple storage provider support
- **Email**: Multiple email provider support
- **Monitoring**: Grafana integration
- **IoT**: MQTT and Modbus connectors for equipment

### 12.2 Data Export/Import

- Bulk upload capabilities
- Excel extraction
- Financial model import
- Document batch processing
- API-based data access

---

## 13. Conclusion

KIISHA is a mature, production-ready platform specifically designed for renewable energy asset management. Its architecture demonstrates enterprise-grade security practices, particularly in multi-tenant isolation and access control. The platform's modular design, comprehensive feature set, and AI integration make it a sophisticated solution for solar operations and maintenance.

**Critical Security Constraints to Preserve:**
1. Multi-tenant isolation must never be bypassed
2. All data access must be organization-scoped
3. AI must inherit user permissions
4. Customer portal must remain isolated
5. RBAC must be enforced at all levels

Any integration with external systems must respect these security boundaries and maintain the same level of isolation and access control.

---

**End of Analysis**
