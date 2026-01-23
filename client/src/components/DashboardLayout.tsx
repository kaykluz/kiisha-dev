import { useAuth } from "@/contexts/AuthProvider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, PanelLeft, FileText, Briefcase, ClipboardList, Calendar, CheckSquare, Wrench, Settings, Layers, Users, MessageSquare, Send, Plug, User, Activity, LayoutGrid, Inbox, Shield, Building2, RefreshCw, FileCheck, ListChecks, Zap, ChevronRight } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { WorkspaceSwitcher } from "./workspace/WorkspaceSwitcher";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: FileText, label: "Documents", path: "/documents" },
  { icon: Briefcase, label: "Workspace", path: "/workspace" },
  { icon: Layers, label: "Artifact Hub", path: "/artifacts" },
  { icon: ClipboardList, label: "Details", path: "/details" },
  { icon: Calendar, label: "Schedule", path: "/schedule" },
  { icon: CheckSquare, label: "Checklist", path: "/checklist" },
  { icon: Wrench, label: "O&M Portal", path: "/om-portal" },
  { icon: Settings, label: "Operations", path: "/operations" },
  { icon: Inbox, label: "Requests", path: "/requests" },
];

const complianceMenuItems = [
  { icon: Building2, label: "Company Hub", path: "/company-hub" },
  { icon: RefreshCw, label: "Renewals", path: "/renewals" },
];

const adminMenuItems = [
  { icon: Settings, label: "Settings Hub", path: "/settings" },
  { icon: Users, label: "Customer Management", path: "/admin/customers" },
  { icon: Activity, label: "Job Dashboard", path: "/admin/jobs" },
  { icon: LayoutGrid, label: "View Management", path: "/admin/views" },
  { icon: Send, label: "Rollout Management", path: "/admin/rollouts" },
  { icon: Users, label: "Identity Management", path: "/admin/identity" },
  { icon: MessageSquare, label: "Conversations", path: "/admin/conversations" },
  { icon: Send, label: "WhatsApp Templates", path: "/admin/whatsapp-templates" },
  { icon: Plug, label: "Integrations", path: "/settings/integrations" },
  { icon: Shield, label: "AI Configuration", path: "/admin/ai-config" },
  { icon: Shield, label: "OAuth Settings", path: "/admin/oauth-config" },
  { icon: Shield, label: "Auth Policies", path: "/admin/auth-policy" },
  { icon: Plug, label: "Inverter Config", path: "/admin/inverter-config" },
  { icon: FileCheck, label: "Diligence Templates", path: "/admin/diligence-templates" },
  { icon: ListChecks, label: "Requirement Items", path: "/admin/requirement-items" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--color-bg-base)]">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-brand-primary)] flex items-center justify-center shadow-lg shadow-[var(--color-brand-primary)]/20">
              <Zap className="w-6 h-6 text-[var(--color-bg-base)]" />
            </div>
            <span className="text-2xl font-bold text-[var(--color-text-primary)]">KIISHA</span>
          </div>
          
          <div className="flex flex-col items-center gap-4 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              Sign in to continue
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)] max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = "/login";
            }}
            size="lg"
            className="w-full h-12 bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-hover)] text-white rounded-xl shadow-lg shadow-[var(--color-brand-primary)]/20 hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r border-[var(--color-border-subtle)] bg-[var(--color-sidebar)]"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-auto py-4 border-b border-[var(--color-border-subtle)]">
            <div className="flex flex-col gap-4 px-3 transition-all w-full">
              {/* Logo and Toggle Row */}
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSidebar}
                  className="h-9 w-9 flex items-center justify-center hover:bg-[var(--color-bg-surface-hover)] rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] shrink-0"
                  aria-label="Toggle navigation"
                >
                  <PanelLeft className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                </button>
                {!isCollapsed && (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-brand-primary)] flex items-center justify-center">
                      <Zap className="w-4 h-4 text-[var(--color-bg-base)]" />
                    </div>
                    <span className="font-bold text-lg tracking-tight text-[var(--color-text-primary)]">
                      KIISHA
                    </span>
                  </div>
                )}
              </div>
              {/* Workspace Switcher */}
              {!isCollapsed && (
                <div>
                  <WorkspaceSwitcher />
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 py-2 scrollbar-thin">
            {/* Main Navigation */}
            <SidebarMenu className="px-3 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-10 transition-all duration-150"
                    >
                      <item.icon
                        className={`h-4 w-4 transition-colors ${isActive ? "text-[var(--color-brand-primary)]" : "text-[var(--color-text-tertiary)]"}`}
                      />
                      <span className={isActive ? "text-[var(--color-text-primary)] font-medium" : "text-[var(--color-text-secondary)]"}>
                        {item.label}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {/* Compliance Section */}
            <div className="px-4 py-3 mt-4">
              <span className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-widest">
                Compliance
              </span>
            </div>
            <SidebarMenu className="px-3 py-1">
              {complianceMenuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-10 transition-all duration-150"
                    >
                      <item.icon
                        className={`h-4 w-4 transition-colors ${isActive ? "text-[var(--color-brand-primary)]" : "text-[var(--color-text-tertiary)]"}`}
                      />
                      <span className={isActive ? "text-[var(--color-text-primary)] font-medium" : "text-[var(--color-text-secondary)]"}>
                        {item.label}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {/* Admin Section - Only visible to admins */}
            {user?.role === 'admin' && (
              <>
                <div className="px-4 py-3 mt-4">
                  <span className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-widest">
                    Admin
                  </span>
                </div>
                <SidebarMenu className="px-3 py-1">
                  {adminMenuItems.map(item => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className="h-10 transition-all duration-150"
                        >
                          <item.icon
                            className={`h-4 w-4 transition-colors ${isActive ? "text-[var(--color-brand-primary)]" : "text-[var(--color-text-tertiary)]"}`}
                          />
                          <span className={isActive ? "text-[var(--color-text-primary)] font-medium" : "text-[var(--color-text-secondary)]"}>
                            {item.label}
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </>
            )}
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-[var(--color-border-subtle)]">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-[var(--color-bg-surface-hover)] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)]">
                  <Avatar className="h-9 w-9 border border-[var(--color-border-subtle)] shrink-0">
                    <AvatarFallback className="text-xs font-semibold bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden text-left">
                    <p className="text-sm font-medium truncate leading-none text-[var(--color-text-primary)]">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)] truncate mt-1">
                      {user?.email || "-"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[var(--color-text-tertiary)] group-data-[collapsible=icon]:hidden" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-56 bg-[var(--color-bg-surface-elevated)] border-[var(--color-border-subtle)] rounded-xl shadow-xl"
              >
                <div className="px-3 py-2 border-b border-[var(--color-border-subtle)]">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{user?.name}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">{user?.email}</p>
                </div>
                <div className="py-1">
                  <DropdownMenuItem
                    onClick={() => setLocation('/profile')}
                    className="cursor-pointer rounded-lg mx-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)]"
                  >
                    <User className="mr-3 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setLocation('/settings')}
                    className="cursor-pointer rounded-lg mx-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)]"
                  >
                    <Settings className="mr-3 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                </div>
                <DropdownMenuSeparator className="bg-[var(--color-border-subtle)]" />
                <div className="py-1">
                  <DropdownMenuItem
                    onClick={logout}
                    className="cursor-pointer rounded-lg mx-1 text-[var(--color-semantic-error)] hover:bg-[var(--color-semantic-error-muted)] focus:text-[var(--color-semantic-error)]"
                  >
                    <LogOut className="mr-3 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-[var(--color-brand-primary)]/30 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="bg-[var(--color-bg-base)]">
        {isMobile && (
          <div className="flex border-b border-[var(--color-border-subtle)] h-14 items-center justify-between bg-[var(--color-bg-base)]/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]" />
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[var(--color-brand-primary)] flex items-center justify-center">
                  <Zap className="w-3 h-3 text-[var(--color-bg-base)]" />
                </div>
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {activeMenuItem?.label ?? "Menu"}
                </span>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1">{children}</main>
      </SidebarInset>
    </>
  );
}
