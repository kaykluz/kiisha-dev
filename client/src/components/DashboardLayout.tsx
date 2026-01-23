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
import { LayoutDashboard, LogOut, PanelLeft, FileText, Briefcase, ClipboardList, Calendar, CheckSquare, Wrench, Settings, Layers, Users, MessageSquare, Send, Plug, User, Activity, LayoutGrid, Inbox, Shield, Building2, RefreshCw, FileCheck, ListChecks, Zap, ChevronDown, Search, Sun, Moon } from "lucide-react";
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
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

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
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold text-foreground tracking-tight">KIISHA</span>
          </div>
          
          <div className="flex flex-col items-center gap-3 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = "/login";
            }}
            size="lg"
            className="w-full"
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
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  };

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
          className="border-r border-sidebar-border bg-sidebar"
          disableTransition={isResizing}
        >
          {/* O11-style Header with Logo */}
          <SidebarHeader className="py-5 px-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-primary-foreground" />
              </div>
              {!isCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-sm text-foreground tracking-tight">KIISHA</span>
                  <span className="text-[11px] text-muted-foreground truncate">Energy Platform</span>
                </div>
              )}
            </div>
            {/* Workspace Switcher */}
            {!isCollapsed && (
              <div className="mt-4">
                <WorkspaceSwitcher />
              </div>
            )}
          </SidebarHeader>

          <SidebarContent className="py-4 px-3">
            {/* Navigation Section Label - O11 style */}
            {!isCollapsed && (
              <div className="px-3 mb-2">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                  Navigation
                </span>
              </div>
            )}
            
            {/* Main Navigation */}
            <SidebarMenu>
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-9 rounded-lg transition-colors"
                    >
                      <item.icon
                        className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                        strokeWidth={isActive ? 2 : 1.5}
                      />
                      <span className={`text-[13px] ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                        {item.label}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {/* Compliance Section */}
            {!isCollapsed && (
              <div className="px-3 mt-6 mb-2">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                  Compliance
                </span>
              </div>
            )}
            <SidebarMenu>
              {complianceMenuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-9 rounded-lg transition-colors"
                    >
                      <item.icon
                        className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                        strokeWidth={isActive ? 2 : 1.5}
                      />
                      <span className={`text-[13px] ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>
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
                {!isCollapsed && (
                  <div className="px-3 mt-6 mb-2">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                      Admin
                    </span>
                  </div>
                )}
                <SidebarMenu>
                  {adminMenuItems.map(item => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className="h-9 rounded-lg transition-colors"
                        >
                          <item.icon
                            className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                            strokeWidth={isActive ? 2 : 1.5}
                          />
                          <span className={`text-[13px] ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>
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

          {/* O11-style Footer */}
          <SidebarFooter className="p-3 border-t border-sidebar-border">
            {/* Support & Toggle Row */}
            {!isCollapsed && (
              <div className="flex items-center gap-2 mb-3 px-1">
                <button
                  onClick={toggleTheme}
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-sidebar-accent transition-colors"
                  aria-label="Toggle theme"
                >
                  {isDark ? (
                    <Sun className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Moon className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                <button
                  onClick={toggleSidebar}
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-sidebar-accent transition-colors"
                  aria-label="Toggle sidebar"
                >
                  <PanelLeft className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            )}
            
            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-sidebar-accent transition-colors focus:outline-none">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium truncate text-foreground">
                          {user?.name || "-"}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {user?.email || "-"}
                        </p>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    </>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                side="top"
                className="w-56"
              >
                <div className="px-3 py-2.5 border-b border-border">
                  <p className="text-sm font-medium text-foreground">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <div className="py-1">
                  <DropdownMenuItem
                    onClick={() => setLocation('/profile')}
                    className="cursor-pointer"
                  >
                    <User className="mr-3 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setLocation('/settings')}
                    className="cursor-pointer"
                  >
                    <Settings className="mr-3 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                </div>
                <DropdownMenuSeparator />
                <div className="py-1">
                  <DropdownMenuItem
                    onClick={logout}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-3 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        
        {/* Resize Handle */}
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="bg-background">
        {/* Top Bar - O11 style */}
        <div className="flex border-b border-border h-14 items-center justify-between bg-background px-6 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            {isMobile && (
              <SidebarTrigger className="h-8 w-8 rounded-lg" />
            )}
            {/* Search - O11 style */}
            <button className="flex items-center gap-2 h-9 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-muted-foreground text-sm min-w-[200px]">
              <Search className="h-4 w-4" />
              <span>Search...</span>
              <kbd className="ml-auto text-[10px] font-medium bg-background px-1.5 py-0.5 rounded border border-border">⌘K</kbd>
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-sm text-foreground font-medium">{user?.name}</span>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                {user?.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
        
        <main className="flex-1">{children}</main>
      </SidebarInset>
    </>
  );
}
