import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthProvider";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard,
  LayoutGrid,
  FileText,
  ClipboardList,
  Database,
  Calendar,
  ChevronDown,
  ChevronRight,
  Bell,
  Settings,
  LogOut,
  User,
  Zap,
  Sun,
  Battery,
  Wind,
  Building2,
  Activity,
  Search,
  ArrowLeft,
  CheckSquare,
  PanelLeftClose,
  PanelLeft,
  RefreshCw,
  FileCheck,
  ListChecks,
  Shield,
  FolderOpen,
  Plus,
  FileStack,
  Clock,
  CreditCard,
  Mail,
  Palette,
  Users,
  MessageSquare,
  Calculator,
  BarChart3,
  Plug,
  Briefcase,
  Send,
  GitBranch,
  Grid3X3,
  FileSignature,
  Columns3,
  ShieldCheck,
  Target,
} from "lucide-react";
import { mockProjects, mockPortfolio, mockAlerts } from "@shared/mockData";
import { CommandPalette, useCommandPalette } from "./CommandPalette";
import { SkeletonDashboard } from "./Skeleton";
import ThemeToggle from "./ThemeToggle";
import { GlobalSearch } from "./GlobalSearch";
import { RealtimeNotifications } from "./RealtimeNotifications";
import { toast } from "sonner";
import { useFeatureFlag } from "@/contexts/FeatureFlagContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Project context for filtering
interface ProjectContextType {
  selectedProjectId: number | null;
  setSelectedProjectId: (id: number | null) => void;
}

const ProjectContext = createContext<ProjectContextType>({
  selectedProjectId: null,
  setSelectedProjectId: () => {},
});

export const useProject = () => useContext(ProjectContext);

// Navigation tabs - text only, no icons
const navTabs = [
  { label: "Summary", path: "/dashboard" },
  { label: "Documents", path: "/documents" },
  { label: "Workspace", path: "/workspace" },
  { label: "Details", path: "/details" },
  { label: "Schedule", path: "/schedule" },
  { label: "Checklist", path: "/checklist" },
  { label: "Operations", path: "/operations" },
  { label: "Financial Models", path: "/financial-models" },
  { label: "Portfolio", path: "/portfolio-comparison" },
  { label: "Pipeline", path: "/pipeline" },
  { label: "Matrix", path: "/document-matrix" },
];

// Navigation item type with optional children
interface NavItem {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  children?: NavItem[];
}

// Sidebar navigation items with expandable children
const sidebarNav: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Documents", path: "/documents", icon: FileText },
  { label: "Workspace", path: "/workspace", icon: ClipboardList },
  { label: "Details", path: "/details", icon: Database },
  { label: "Schedule", path: "/schedule", icon: Calendar },
  { label: "Checklist", path: "/checklist", icon: CheckSquare },
  { label: "Operations", path: "/operations", icon: Activity },
  { label: "Financial Models", path: "/financial-models", icon: Calculator },
  { label: "Portfolio", path: "/portfolio-comparison", icon: BarChart3 },
  { label: "Pipeline", path: "/pipeline", icon: GitBranch },
  { label: "Doc Matrix", path: "/document-matrix", icon: Grid3X3 },
  { label: "Data Comparison", path: "/data-comparison", icon: Columns3 },
  { label: "Risk Register", path: "/risk-register", icon: Shield },
  { label: "Contracts", path: "/contracts", icon: FileSignature },
  { label: "Permits", path: "/permits", icon: FileCheck },
  { label: "Compliance", path: "/compliance-matrix", icon: ShieldCheck },
];

// Compliance navigation with children
const complianceNav: NavItem[] = [
  { 
    label: "Company Hub", 
    path: "/company-hub", 
    icon: Building2,
    children: [
      { label: "All Companies", path: "/company-hub", icon: Building2 },
      { label: "Add Company", path: "/company/new", icon: Plus },
    ]
  },
  { 
    label: "Diligence", 
    path: "/diligence/templates", 
    icon: FileCheck,
    children: [
      { label: "Templates", path: "/diligence/templates", icon: FileStack },
      { label: "Responses", path: "/diligence/responses", icon: Send },
      { label: "Analytics", path: "/diligence/analytics", icon: BarChart3 },
      { label: "Requirements", path: "/diligence/requirements", icon: ListChecks },
      { label: "Create Template", path: "/diligence/templates/new", icon: Plus },
    ]
  },
  { 
    label: "Renewals", 
    path: "/renewals", 
    icon: RefreshCw,
    children: [
      { label: "All Renewals", path: "/renewals", icon: RefreshCw },
      { label: "Expiring Soon", path: "/renewals?filter=due_soon", icon: Clock },
    ]
  },
];

// Settings navigation with children
const settingsNav: NavItem[] = [
  { 
    label: "Settings", 
    path: "/settings", 
    icon: Settings,
    children: [
      { label: "General", path: "/settings", icon: Settings },
      { label: "Profile", path: "/profile", icon: User },
      { label: "Security", path: "/settings/security", icon: Shield },
      { label: "WhatsApp", path: "/settings/whatsapp", icon: MessageSquare },
      { label: "Notifications", path: "/settings/notifications", icon: Bell },
    ]
  },
];

// Admin navigation with children
const adminNav: NavItem[] = [
  { 
    label: "Admin", 
    path: "/admin", 
    icon: Shield,
    children: [
      { label: "Identity Management", path: "/admin/identity", icon: Users },
      { label: "Conversations", path: "/admin/conversations", icon: MessageSquare },
      { label: "WhatsApp Templates", path: "/admin/whatsapp-templates", icon: MessageSquare },
      { label: "Integrations", path: "/settings/integrations", icon: Plug },
      { label: "Job Dashboard", path: "/admin/jobs", icon: Briefcase },
      { label: "Diligence Templates", path: "/admin/diligence-templates", icon: FileCheck },
      { label: "Requirement Items", path: "/admin/requirement-items", icon: ListChecks },
      { label: "Recurring Invoices", path: "/admin/recurring-invoices", icon: RefreshCw },
      { label: "Scheduled Jobs", path: "/admin/scheduled-jobs", icon: Clock },
      { label: "Invoice Branding", path: "/admin/invoice-branding", icon: Palette },
      { label: "Email Templates", path: "/settings/email-templates", icon: Mail },
      { label: "Superuser Admin", path: "/admin/superuser", icon: Shield },
      { label: "Organization Settings", path: "/admin/organization-settings", icon: Building2 },
      { label: "View Sharing", path: "/admin/view-sharing", icon: Send },
      { label: "Custom Views", path: "/views", icon: LayoutGrid },
    ]
  },
  {
    label: "Billing",
    path: "/admin/billing",
    icon: CreditCard,
    children: [
      { label: "Invoices", path: "/billing", icon: FileText },
      { label: "Recurring", path: "/admin/recurring-invoices", icon: RefreshCw },
      { label: "Settings", path: "/billing/settings", icon: Settings },
    ]
  },
];

// Technology icons
const techIcons: Record<string, typeof Sun> = {
  PV: Sun,
  BESS: Battery,
  "PV+BESS": Zap,
  Wind: Wind,
  Minigrid: Building2,
  "C&I": Building2,
};

interface AppLayoutProps {
  children: ReactNode;
}

// Expandable nav item component - O11-inspired clean design
function ExpandableNavItem({
  item,
  location,
  sidebarCollapsed,
  expandedItems,
  toggleExpanded
}: {
  item: NavItem;
  location: string;
  sidebarCollapsed: boolean;
  expandedItems: Set<string>;
  toggleExpanded: (path: string) => void;
}) {
  const Icon = item.icon;
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedItems.has(item.path);
  const isActive = location === item.path || (hasChildren && item.children?.some(c => location === c.path || location.startsWith(c.path + "/")));
  const isChildActive = hasChildren && item.children?.some(c => location === c.path || location.startsWith(c.path + "/"));

  if (sidebarCollapsed) {
    // In collapsed mode, show tooltip with children
    if (hasChildren) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-xl transition-all",
                isActive || isChildActive
                  ? "bg-[var(--color-bg-surface-hover)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-surface-hover)] hover:text-[var(--color-text-primary)]"
              )}
            >
              <Icon className="w-[18px] h-[18px]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-52 bg-[var(--color-bg-surface-elevated)] border-[var(--color-border-subtle)]">
            <div className="px-3 py-2 text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">
              {item.label}
            </div>
            {item.children?.map((child) => (
              <DropdownMenuItem key={child.path} asChild className="py-2">
                <Link href={child.path} className="flex items-center cursor-pointer">
                  <child.icon className="w-4 h-4 mr-2 text-[var(--color-text-tertiary)]" />
                  {child.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <Link href={item.path}>
        <button
          className={cn(
            "w-10 h-10 flex items-center justify-center rounded-xl transition-all",
            isActive
              ? "bg-[var(--color-bg-surface-hover)] text-[var(--color-text-primary)] ring-1 ring-[var(--color-brand-primary)]/30"
              : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-surface-hover)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <Icon className="w-[18px] h-[18px]" />
        </button>
      </Link>
    );
  }

  // Expanded sidebar mode
  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => toggleExpanded(item.path)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all",
            isActive || isChildActive
              ? "bg-[var(--color-bg-surface-hover)] text-[var(--color-text-primary)]"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] hover:text-[var(--color-text-primary)]"
          )}
        >
          <Icon className="w-[18px] h-[18px] flex-shrink-0" />
          <span className="flex-1 text-left font-medium">{item.label}</span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-[var(--color-text-tertiary)]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--color-text-tertiary)]" />
          )}
        </button>
        {isExpanded && (
          <div className="ml-6 mt-1 space-y-0.5 border-l border-[var(--color-border-subtle)] pl-3">
            {item.children?.map((child) => {
              const ChildIcon = child.icon;
              const isChildItemActive = location === child.path || location.startsWith(child.path + "/");
              return (
                <Link key={child.path} href={child.path}>
                  <button
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all",
                      isChildItemActive
                        ? "bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] font-medium"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] hover:text-[var(--color-text-primary)]"
                    )}
                  >
                    <ChildIcon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{child.label}</span>
                  </button>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link href={item.path}>
      <button
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all",
          isActive
            ? "bg-[var(--color-bg-surface-hover)] text-[var(--color-text-primary)] font-medium"
            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)] hover:text-[var(--color-text-primary)]"
        )}
      >
        <Icon className="w-[18px] h-[18px] flex-shrink-0" />
        <span>{item.label}</span>
      </button>
    </Link>
  );
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { user, loading, logout } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => {
    // Load from localStorage
    const saved = localStorage.getItem('sidebar-expanded');
    if (saved) {
      try {
        return new Set(JSON.parse(saved));
      } catch {
        return new Set();
      }
    }
    // Default: expand items that contain the current path
    const defaults = new Set<string>();
    [...complianceNav, ...settingsNav, ...adminNav].forEach(item => {
      if (item.children?.some(c => location.startsWith(c.path))) {
        defaults.add(item.path);
      }
    });
    return defaults;
  });
  const commandPalette = useCommandPalette();

  const unreadAlerts = mockAlerts.filter((a) => !a.isRead).length;

  // Save expanded state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-expanded', JSON.stringify([...expandedItems]));
  }, [expandedItems]);

  // Auto-expand parent when navigating to child
  useEffect(() => {
    [...complianceNav, ...settingsNav, ...adminNav].forEach(item => {
      if (item.children?.some(c => location === c.path || location.startsWith(c.path + "/"))) {
        setExpandedItems(prev => new Set([...prev, item.path]));
      }
    });
  }, [location]);

  const toggleExpanded = (path: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Get current page title
  const currentTab = navTabs.find((t) => t.path === location);
  const selectedProject = selectedProjectId
    ? mockProjects.find((p) => p.id === selectedProjectId)
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SkeletonDashboard />
      </div>
    );
  }

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  return (
    <ProjectContext.Provider value={{ selectedProjectId, setSelectedProjectId }}>
      <div className="h-screen bg-[var(--color-bg-base)] flex overflow-hidden">
        {/* Left Sidebar - O11-inspired design */}
        <aside
          className={cn(
            "h-screen flex-shrink-0 flex flex-col transition-all duration-300 ease-out overflow-hidden",
            "bg-[var(--color-bg-base)] border-r border-[var(--color-border-subtle)]",
            sidebarCollapsed ? "w-14" : "w-56"
          )}
        >
          {/* Logo */}
          <div className={cn(
            "h-14 flex items-center border-b border-[var(--color-border-subtle)]",
            sidebarCollapsed ? "justify-center px-2" : "justify-between px-3"
          )}>
            <Link href="/dashboard">
              <div className="flex items-center gap-2.5 cursor-pointer group">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:shadow-amber-500/30 transition-shadow">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                {!sidebarCollapsed && (
                  <span className="font-semibold text-[var(--color-text-primary)] tracking-tight">KIISHA</span>
                )}
              </div>
            </Link>
            {!sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-1.5 rounded-lg hover:bg-[var(--color-bg-surface-hover)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-all"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search trigger */}
          <div className={cn("py-3", sidebarCollapsed ? "px-2" : "px-3")}>
            <button
              onClick={commandPalette.open}
              className={cn(
                "flex items-center rounded-xl text-[var(--color-text-tertiary)] transition-all",
                sidebarCollapsed
                  ? "w-10 h-10 justify-center hover:bg-[var(--color-bg-surface-hover)]"
                  : "w-full gap-2 px-3 py-2.5 text-sm bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)]"
              )}
            >
              <Search className="w-4 h-4 flex-shrink-0" />
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 text-left">Search...</span>
                  <kbd className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--color-bg-surface-hover)] text-[var(--color-text-tertiary)]">⌘K</kbd>
                </>
              )}
            </button>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1">
            <nav className={cn("py-2", sidebarCollapsed ? "px-2" : "px-3")}>
              {/* Main Navigation */}
              <div className="space-y-0.5">
                {sidebarNav.map((item) => (
                  <ExpandableNavItem
                    key={item.path}
                    item={item}
                    location={location}
                    sidebarCollapsed={sidebarCollapsed}
                    expandedItems={expandedItems}
                    toggleExpanded={toggleExpanded}
                  />
                ))}
              </div>

              {/* Divider */}
              <div className="my-4 border-t border-[var(--color-border-subtle)]" />

              {/* Projects section */}
              {!sidebarCollapsed && (
                <div className="mb-2 px-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Projects
                  </span>
                </div>
              )}

              <div className="space-y-0.5">
                {/* All Projects */}
                <button
                  onClick={() => setSelectedProjectId(null)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    selectedProjectId === null
                      ? "bg-[var(--color-bg-surface-hover)] text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)]",
                    sidebarCollapsed && "justify-center px-2"
                  )}
                >
                  <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1 text-left">All Projects</span>
                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        {mockProjects.length}
                      </span>
                    </>
                  )}
                </button>

                {/* Individual Projects */}
                {mockProjects.slice(0, sidebarCollapsed ? 5 : 10).map((project) => {
                  const TechIcon = techIcons[project.technology] || Sun;
                  const isSelected = selectedProjectId === project.id;

                  return (
                    <button
                      key={project.id}
                      onClick={() => setSelectedProjectId(project.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                        isSelected
                          ? "bg-[var(--color-bg-surface-hover)] text-[var(--color-text-primary)]"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)]",
                        sidebarCollapsed && "justify-center px-2"
                      )}
                    >
                      <TechIcon className="w-4 h-4 flex-shrink-0 text-[var(--color-text-tertiary)]" />
                      {!sidebarCollapsed && (
                        <span className="flex-1 text-left truncate">{project.name}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Compliance section */}
              <>
                {/* Divider */}
                <div className="my-4 border-t border-[var(--color-border-subtle)]" />

                {/* Compliance label */}
                {!sidebarCollapsed && (
                  <div className="mb-2 px-3">
                    <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                      Compliance
                    </span>
                  </div>
                )}

                {/* Compliance navigation with expandable items */}
                <div className="space-y-1">
                  {complianceNav.map((item) => (
                    <ExpandableNavItem
                      key={item.path}
                      item={item}
                      location={location}
                      sidebarCollapsed={sidebarCollapsed}
                      expandedItems={expandedItems}
                      toggleExpanded={toggleExpanded}
                    />
                  ))}
                </div>
              </>

              {/* Settings section */}
              <>
                {/* Divider */}
                <div className="my-4 border-t border-[var(--color-border-subtle)]" />

                {/* Settings label */}
                {!sidebarCollapsed && (
                  <div className="mb-2 px-3">
                    <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                      Settings
                    </span>
                  </div>
                )}

                {/* Settings navigation */}
                <div className="space-y-1">
                  {settingsNav.map((item) => (
                    <ExpandableNavItem
                      key={item.path}
                      item={item}
                      location={location}
                      sidebarCollapsed={sidebarCollapsed}
                      expandedItems={expandedItems}
                      toggleExpanded={toggleExpanded}
                    />
                  ))}
                </div>

                {/* Admin-only navigation */}
                {user?.role === 'admin' && (
                  <div className="space-y-1 mt-2">
                    {adminNav.map((item) => (
                      <ExpandableNavItem
                        key={item.path}
                        item={item}
                        location={location}
                        sidebarCollapsed={sidebarCollapsed}
                        expandedItems={expandedItems}
                        toggleExpanded={toggleExpanded}
                      />
                    ))}
                  </div>
                )}
              </>
            </nav>
          </ScrollArea>

          {/* Theme toggle */}
          <div className={cn("pb-2", sidebarCollapsed ? "px-2" : "px-3")}>
            <ThemeToggle collapsed={sidebarCollapsed} />
          </div>

          {/* User section at bottom - O11-inspired clean design */}
          <div className={cn(
            "border-t border-[var(--color-border-subtle)]",
            sidebarCollapsed ? "p-2" : "p-3"
          )}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl hover:bg-[var(--color-bg-surface-hover)] transition-all",
                    sidebarCollapsed ? "justify-center p-2" : "px-2 py-2"
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center flex-shrink-0 ring-1 ring-[var(--color-brand-primary)]/30">
                    <span className="text-sm font-medium text-[var(--color-brand-primary)]">
                      {(user.name || "U").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  {!sidebarCollapsed && (
                    <>
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                          {user.name || "User"}
                        </div>
                        <div className="text-xs text-[var(--color-text-tertiary)]">{user.email?.split('@')[0] || 'user'}</div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                    </>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-52 bg-[var(--color-bg-surface-elevated)] border-[var(--color-border-subtle)]">
                <div className="px-3 py-2 border-b border-[var(--color-border-subtle)]">
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">{user.name || "User"}</div>
                  <div className="text-xs text-[var(--color-text-tertiary)]">{user.email}</div>
                </div>
                <DropdownMenuItem asChild className="py-2">
                  <Link href="/profile" className="flex items-center cursor-pointer">
                    <User className="w-4 h-4 mr-2 text-[var(--color-text-tertiary)]" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="py-2">
                  <Link href="/settings" className="flex items-center cursor-pointer">
                    <Settings className="w-4 h-4 mr-2 text-[var(--color-text-tertiary)]" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[var(--color-border-subtle)]" />
                <DropdownMenuItem onClick={() => logout()} className="py-2 text-[var(--color-semantic-error)]">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          {/* Top Header - O11-inspired clean header */}
          <header className="h-14 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] flex items-center px-6 shrink-0">
            {/* Back navigation + Page title */}
            <div className="flex items-center gap-3">
              {selectedProject ? (
                <>
                  <button
                    onClick={() => setSelectedProjectId(null)}
                    className="flex items-center gap-1.5 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Projects</span>
                  </button>
                  <span className="text-[var(--color-border-default)]">›</span>
                  <h1 className="text-base font-medium text-[var(--color-text-primary)]">
                    {selectedProject.name}
                  </h1>
                </>
              ) : (
                <>
                  <h1 className="text-base font-medium text-[var(--color-text-primary)]">
                    {mockPortfolio.name}
                  </h1>
                  {currentTab && (
                    <>
                      <span className="text-[var(--color-border-default)]">›</span>
                      <span className="text-sm text-[var(--color-text-secondary)]">
                        {currentTab.label}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Tab navigation - only show when project selected */}
            {selectedProject && (
              <nav className="tab-nav ml-8 h-full flex items-end">
                {navTabs.map((tab) => {
                  const isActive = location === tab.path;
                  return (
                    <Link key={tab.path} href={tab.path}>
                      <button
                        className={cn(
                          "tab-item px-4 pb-4",
                          isActive && "tab-item-active"
                        )}
                      >
                        {tab.label}
                      </button>
                    </Link>
                  );
                })}
              </nav>
            )}

            {/* Right side actions */}
            <div className="ml-auto flex items-center gap-3">
              {/* Global Search */}
              <GlobalSearch />

              {/* Real-time Notifications */}
              <RealtimeNotifications />

              {/* Project Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="btn-secondary h-9">
                    Actions
                    <ChevronDown className="w-4 h-4 ml-1.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem 
                    onClick={() => toast.info("Portfolio export is being configured for your organization")}
                    className="cursor-pointer"
                  >
                    Export Portfolio
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => toast.info("Report generation is being configured for your organization")}
                    className="cursor-pointer"
                  >
                    Generate Report
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    disabled 
                    className="opacity-50 cursor-not-allowed"
                    title="Contact your administrator to add new projects"
                  >
                    Add New Project
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    disabled 
                    className="opacity-50 cursor-not-allowed"
                    title="Portfolio settings are managed by administrators"
                  >
                    Portfolio Settings
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto min-h-0">{children}</main>
        </div>

        {/* Command Palette */}
        <CommandPalette isOpen={commandPalette.isOpen} onClose={commandPalette.close} />
      </div>
    </ProjectContext.Provider>
  );
}
