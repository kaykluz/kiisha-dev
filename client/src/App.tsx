import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Documents from "./pages/Documents";
import Workspace from "./pages/Workspace";
import AssetDetails from "./pages/AssetDetails";
import Schedule from "./pages/Schedule";
import Schedules from "./pages/Schedules";
import DocumentCategorization from "./pages/DocumentCategorization";
import DocumentExtraction from "./pages/DocumentExtraction";
import ClosingChecklist from "./pages/ClosingChecklist";
import Login from "./pages/Login";
import Operations from "./pages/Operations";
import OmPortal from "./pages/OmPortal";
import ArtifactHub from "./pages/ArtifactHub";
import FinancialModels from "./pages/FinancialModels";
import PortfolioComparison from "./pages/PortfolioComparison";
import CategoryManagement from "./pages/CategoryManagement";
import Profile from "./pages/Profile";
import AdminIngest from "./pages/AdminIngest";
import SettingsIntegrations from "./pages/SettingsIntegrations";
import AdminIdentity from "./pages/AdminIdentity";
import ConversationHistory from "./pages/ConversationHistory";
import WhatsAppTemplates from "./pages/WhatsAppTemplates";
import Settings from "./pages/Settings";
import JobDashboard from "./pages/JobDashboard";
import ViewManagement from "./pages/admin/ViewManagement";
import RolloutManagement from "./pages/admin/RolloutManagement";
import OrgSetup from "./pages/admin/OrgSetup";
import ObligationSettings from "./pages/admin/ObligationSettings";
import RequestAnalytics from "./pages/admin/RequestAnalytics";
import EvidenceReview from "./pages/admin/EvidenceReview";
import MfaSetup from "./pages/settings/MfaSetup";
import SessionManagement from "./pages/settings/SessionManagement";
import EmailTemplates from "./pages/settings/EmailTemplates";
import RequestReminders from "./pages/settings/RequestReminders";
import AssetImport from "./pages/admin/AssetImport";
import AIConfig from "./pages/admin/AIConfig";
import OAuthConfig from "./pages/admin/OAuthConfig";
import AuthPolicyConfig from "./pages/admin/AuthPolicyConfig";
import InverterConfig from "./pages/admin/InverterConfig";
import CustomerManagement from "./pages/admin/CustomerManagement";
import Observability from "./pages/admin/Observability";
import RecurringInvoices from "./pages/admin/RecurringInvoices";
import ScheduledJobs from "./pages/admin/ScheduledJobs";
import InvoiceBranding from "./pages/admin/InvoiceBranding";
import CompanyHub from "./pages/CompanyHub";
import CompanyProfile from "./pages/CompanyProfile";
import CompanyNew from "./pages/CompanyNew";
import TemplateDetail from "./pages/TemplateDetail";
import TemplateNew from "./pages/TemplateNew";
import DiligenceTemplates from "./pages/admin/DiligenceTemplates";
import RequirementItems from "./pages/admin/RequirementItems";
import RenewalWorkflow from "./pages/RenewalWorkflow";
import TemplateResponseWorkspace from "./pages/TemplateResponseWorkspace";
import SuperuserAdmin from "./pages/SuperuserAdmin";
import OrganizationSettings from "./pages/OrganizationSettings";
import ViewSharing from "./pages/ViewSharing";
import InviteAccept from "./pages/InviteAccept";
import SecuritySettings from "./pages/SecuritySettings";
import WhatsAppSettings from "./pages/WhatsAppSettings";
import CustomViews from "./pages/CustomViews";
import ResponsesList from "./pages/ResponsesList";
import DataRoom from "./pages/DataRoom";
import ComplianceDashboard from "./pages/ComplianceDashboard";
import PortalLogin from "./pages/portal/PortalLogin";
import PortalDashboard from "./pages/portal/PortalDashboard";
import PortalInvoices, { PortalInvoiceDetail } from "./pages/portal/PortalInvoices";
import PortalLayout from "./pages/portal/PortalLayout";
import PortalForgotPassword from "./pages/portal/PortalForgotPassword";
import PortalResetPassword from "./pages/portal/PortalResetPassword";
import PortalWorkOrders from "./pages/portal/PortalWorkOrders";
import PortalWorkOrderDetail from "./pages/portal/PortalWorkOrderDetail";
import PortalNewWorkOrder from "./pages/portal/PortalNewWorkOrder";
import PortalProduction from "./pages/portal/PortalProduction";
import PortalPayments from "./pages/portal/PortalPayments";
import PortalProjects from "./pages/portal/PortalProjects";
import PortalDocuments from "./pages/portal/PortalDocuments";
import PortalProjectDetail from "./pages/portal/PortalProjectDetail";
import PortalDocumentUpload from "./pages/portal/PortalDocumentUpload";
import PortalSettings from "./pages/portal/PortalSettings";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import MultiAuthLogin from "./pages/auth/Login";
import OAuthCallback from "./pages/auth/OAuthCallback";
import VerifyEmail from "./pages/auth/VerifyEmail";
import LinkedAccounts from "./pages/settings/LinkedAccounts";
import RequestsDashboard from "./pages/RequestsDashboard";
import RequestDetail from "./pages/RequestDetail";
import ResponseWorkspace from "./pages/ResponseWorkspace";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import { JobNotifications } from "./components/JobNotifications";
import { GlobalAIChat } from "./components/GlobalAIChat";
import { AdminGuard } from "./components/AdminGuard";
import { AuthProvider } from "./contexts/AuthProvider";
import SelectWorkspace, { PendingAccess } from "./pages/SelectWorkspace";

// Wrapper component for admin-only routes
function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <AdminGuard>
      <Component />
    </AdminGuard>
  );
}

function Router() {
  return (
    <Switch>
      {/* Root redirect */}
      <Route path="/">{() => <Redirect to="/dashboard" />}</Route>
      <Route path="/login" component={MultiAuthLogin} />
      <Route path="/data-room/:token" component={DataRoom} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/auth/login" component={MultiAuthLogin} />
      <Route path="/auth/callback/:provider" component={OAuthCallback} />
      <Route path="/auth/verify-email" component={VerifyEmail} />
      <Route path="/invite/:token" component={InviteAccept} />
      <Route path="/select-workspace" component={SelectWorkspace} />
      <Route path="/pending-access" component={PendingAccess} />
      <Route path="/app">{() => <Redirect to="/dashboard" />}</Route>
      <Route path="/dashboard" component={Dashboard} />
      
      {/* User routes (authenticated) */}
      <Route path="/documents" component={Documents} />
      <Route path="/workspace" component={Workspace} />
      <Route path="/details" component={AssetDetails} />
      <Route path="/schedule" component={Schedule} />
      <Route path="/schedules" component={Schedules} />
      <Route path="/categorize" component={DocumentCategorization} />
      <Route path="/checklist" component={ClosingChecklist} />
      <Route path="/extraction/:id" component={DocumentExtraction} />
      <Route path="/operations" component={Operations} />
      <Route path="/om-portal" component={OmPortal} />
      <Route path="/artifacts" component={ArtifactHub} />
      <Route path="/financial-models" component={FinancialModels} />
      <Route path="/portfolio-comparison" component={PortfolioComparison} />
      <Route path="/settings/categories" component={CategoryManagement} />
      <Route path="/profile" component={Profile} />
      <Route path="/requests" component={RequestsDashboard} />
      <Route path="/requests/:id" component={RequestDetail} />
      <Route path="/requests/:id/respond" component={ResponseWorkspace} />
      
      {/* Admin-only routes - protected by AdminGuard */}
      <Route path="/admin/ingest">
        {() => <AdminRoute component={AdminIngest} />}
      </Route>
      <Route path="/admin/identity">
        {() => <AdminRoute component={AdminIdentity} />}
      </Route>
      <Route path="/admin/conversations">
        {() => <AdminRoute component={ConversationHistory} />}
      </Route>
      <Route path="/admin/whatsapp-templates">
        {() => <AdminRoute component={WhatsAppTemplates} />}
      </Route>
      <Route path="/admin/jobs">
        {() => <AdminRoute component={JobDashboard} />}
      </Route>
      <Route path="/admin/views">
        {() => <AdminRoute component={ViewManagement} />}
      </Route>
      <Route path="/admin/rollouts">
        {() => <AdminRoute component={RolloutManagement} />}
      </Route>
      <Route path="/admin/org-setup">
        {() => <AdminRoute component={OrgSetup} />}
      </Route>
          <Route path="/admin/obligations">
        {() => <AdminRoute component={ObligationSettings} />}
      </Route>
      <Route path="/admin/request-analytics">
        {() => <AdminRoute component={RequestAnalytics} />}
      </Route>
      <Route path="/admin/evidence-review">
        {() => <AdminRoute component={EvidenceReview} />}
      </Route>
      <Route path="/admin/asset-import">
        {() => <AdminRoute component={AssetImport} />}
      </Route>
      <Route path="/admin/ai-config">
        {() => <AdminRoute component={AIConfig} />}
      </Route>
      <Route path="/admin/oauth-config">
        {() => <AdminRoute component={OAuthConfig} />}
      </Route>
      <Route path="/admin/auth-policy">
        {() => <AdminRoute component={AuthPolicyConfig} />}
      </Route>
      <Route path="/admin/inverter-config">
        {() => <AdminRoute component={InverterConfig} />}
      </Route>
      <Route path="/admin/customers">
        {() => <AdminRoute component={CustomerManagement} />}
      </Route>
      <Route path="/admin/observability">
        {() => <AdminRoute component={Observability} />}
      </Route>
      <Route path="/admin/recurring-invoices">
        {() => <AdminRoute component={RecurringInvoices} />}
      </Route>
      <Route path="/admin/scheduled-jobs">
        {() => <AdminRoute component={ScheduledJobs} />}
      </Route>
      <Route path="/admin/invoice-branding">
        {() => <AdminRoute component={InvoiceBranding} />}
      </Route>
      
      {/* Company Hub Routes */}
      <Route path="/company-hub">
        {() => <CompanyHub />}
      </Route>
      <Route path="/company/new">
        {() => <CompanyNew />}
      </Route>
      <Route path="/company/:id">
        {() => <CompanyProfile />}
      </Route>
      
      {/* Template Routes */}
      <Route path="/diligence/templates/new">
        {() => <TemplateNew />}
      </Route>
      <Route path="/diligence/templates/:id">
        {() => <TemplateDetail />}
      </Route>
      <Route path="/diligence/response/:id">
        {() => <TemplateResponseWorkspace />}
      </Route>
      <Route path="/diligence/responses">
        {() => <ResponsesList />}
      </Route>
      <Route path="/diligence/analytics">
        {() => <ComplianceDashboard />}
      </Route>
      
      {/* Diligence Admin Routes */}
      <Route path="/admin/diligence-templates">
        {() => <AdminRoute component={DiligenceTemplates} />}
      </Route>
      <Route path="/admin/requirement-items">
        {() => <AdminRoute component={RequirementItems} />}
      </Route>
      <Route path="/admin/superuser">
        {() => <AdminRoute component={SuperuserAdmin} />}
      </Route>
      <Route path="/admin/organization-settings">
        {() => <AdminRoute component={OrganizationSettings} />}
      </Route>
      <Route path="/admin/view-sharing">
        {() => <AdminRoute component={ViewSharing} />}
      </Route>
      <Route path="/diligence/templates">
        {() => <DiligenceTemplates />}
      </Route>
      <Route path="/diligence/requirements">
        {() => <RequirementItems />}
      </Route>
      <Route path="/renewals">
        {() => <RenewalWorkflow />}
      </Route>
      <Route path="/diligence/renewals">
        {() => <RenewalWorkflow />}
      </Route>
      
      {/* Customer Portal Routes */}
      <Route path="/portal/login">
        {() => <PortalLogin />}
      </Route>
      <Route path="/portal/forgot-password">
        {() => <PortalForgotPassword />}
      </Route>
      <Route path="/portal/reset-password">
        {() => <PortalResetPassword />}
      </Route>
      <Route path="/portal/dashboard">
        {() => <PortalDashboard />}
      </Route>
      <Route path="/portal/invoices/:id">
        {() => <PortalInvoiceDetail />}
      </Route>
      <Route path="/portal/invoices">
        {() => <PortalInvoices />}
      </Route>
      <Route path="/portal/work-orders/new">
        {() => <PortalNewWorkOrder />}
      </Route>
      <Route path="/portal/work-orders/:id">
        {() => <PortalWorkOrderDetail />}
      </Route>
      <Route path="/portal/work-orders">
        {() => <PortalWorkOrders />}
      </Route>
      <Route path="/portal/production">
        {() => <PortalProduction />}
      </Route>
      <Route path="/portal/payments">
        {() => <PortalPayments />}
      </Route>
      <Route path="/portal/projects">
        {() => <PortalProjects />}
      </Route>
      <Route path="/portal/projects/:id">
        {() => <PortalProjectDetail />}
      </Route>
      <Route path="/portal/documents">
        {() => <PortalDocuments />}
      </Route>
      <Route path="/portal/documents/upload">
        {() => <PortalDocumentUpload />}
      </Route>
      <Route path="/portal/settings">
        {() => <PortalSettings />}
      </Route>
      <Route path="/settings">
        {() => <AdminRoute component={Settings} />}
      </Route>
      <Route path="/settings/integrations">
        {() => <AdminRoute component={SettingsIntegrations} />}
      </Route>
      <Route path="/settings/security/mfa" component={MfaSetup} />
      <Route path="/settings/security/sessions" component={SessionManagement} />
      <Route path="/settings/email-templates">
        {() => <AdminRoute component={EmailTemplates} />}
      </Route>
      <Route path="/settings/request-reminders">
        {() => <AdminRoute component={RequestReminders} />}
      </Route>
      <Route path="/settings/linked-accounts" component={LinkedAccounts} />
      <Route path="/settings/security" component={SecuritySettings} />
      <Route path="/settings/whatsapp" component={WhatsAppSettings} />
      <Route path="/views" component={CustomViews} />
      <Route path="/views/builder" component={CustomViews} />
      <Route path="/views/builder/:viewId" component={CustomViews} />
      
      {/* 404 fallback */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <WebSocketProvider>
          <TooltipProvider>
            <AuthProvider>
              <Toaster />
              <JobNotifications />
              <Router />
              <GlobalAIChat />
            </AuthProvider>
          </TooltipProvider>
        </WebSocketProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
