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
import { LayoutDashboard, LogOut, PanelLeft, FileText, Briefcase, ClipboardList, Calendar, CheckSquare, Wrench, Settings, Layers, Users, MessageSquare, Send, Plug, User, Activity, LayoutGrid, Inbox, Shield, Building2, RefreshCw, FileCheck, ListChecks, Zap, ChevronDown, Search, Sun, Moon, ChevronRight } from "lucide-react";
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
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 320;

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
        <div className="flex flex-col items-center gap-6 p-8 max-w-sm w-full">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground">KIISHA</span>
          </div>
          
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-xl font-medium text-foreground">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground">
              Authentication required to access this dashboard.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = "/login";
            }}
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
          className="border-r border-border bg-sidebar"
          disableTransition={isResizing}
        >
          {/* O11-style Header */}
          <SidebarHeader className="py-4 px-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-primary flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-primary-foreground" />
              </div>
              {!isCollapsed && (
                <span className="font-semibold text-sm text-foreground">KIISHA</span>
              )}
            </div>
            {/* Workspace Switcher */}
            {!isCollapsed && (
              <div className="mt-3">
                <WorkspaceSwitcher />
              </div>
            )}
          </SidebarHeader>

          <SidebarContent className="py-3 px-2">
            {/* Search Button - O11 style */}
            {!isCollapsed && (
              <button className="flex items-center gap-2 w-full h-8 px-3 mb-3 bg-muted/40 hover:bg-muted/60 transition-colors text-muted-foreground text-xs">
                <Search className="h-3.5 w-3.5" />
                <span>Search...</span>
                <kbd className="ml-auto text-[10px] font-medium text-muted-foreground">⌘K</kbd>
              </button>
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
                      className="h-8 transition-colors"
                    >
                      <item.icon
                        className={`h-4 w-4 shrink-0 ${isActive ? "text-foreground" : "text-muted-foreground"}`}
                        strokeWidth={1.5}
                      />
                      <span className={`text-[13px] ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                        {item.label}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {/* Compliance Section */}
            {!isCollapsed && (
              <div className="px-3 mt-5 mb-1.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
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
                      className="h-8 transition-colors"
                    >
                      <item.icon
                        className={`h-4 w-4 shrink-0 ${isActive ? "text-foreground" : "text-muted-foreground"}`}
                        strokeWidth={1.5}
                      />
                      <span className={`text-[13px] ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                        {item.label}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {/* Admin Section */}
            {(user?.role === 'admin' || user?.role === 'superuser_admin' || user?.isSuperuser) && (
              <>
                {!isCollapsed && (
                  <div className="px-3 mt-5 mb-1.5">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
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
                          className="h-8 transition-colors"
                        >
                          <item.icon
                            className={`h-4 w-4 shrink-0 ${isActive ? "text-foreground" : "text-muted-foreground"}`}
                            strokeWidth={1.5}
                          />
                          <span className={`text-[13px] ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
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

          {/* Footer */}
          <SidebarFooter className="p-2 border-t border-border">
            {/* Theme & Collapse Row */}
            {!isCollapsed && (
              <div className="flex items-center gap-1 mb-2 px-1">
                <button
                  onClick={toggleTheme}
                  className="h-7 w-7 flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground"
                  aria-label="Toggle theme"
                >
                  {isDark ? (
                    <Sun className="h-3.5 w-3.5" />
                  ) : (
                    <Moon className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  onClick={toggleSidebar}
                  className="h-7 w-7 flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground"
                  aria-label="Toggle sidebar"
                >
                  <PanelLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            
            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 w-full p-2 hover:bg-muted transition-colors focus:outline-none">
                  <Avatar className="h-7 w-7 shrink-0 rounded">
                    <AvatarFallback className="text-[10px] font-medium bg-muted text-muted-foreground rounded">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-xs font-medium truncate text-foreground">
                          {user?.name || "-"}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {user?.email || "-"}
                        </p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                side="right"
                className="w-52"
              >
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-sm font-medium text-foreground">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <div className="py-1">
                  <DropdownMenuItem
                    onClick={() => setLocation('/profile')}
                    className="cursor-pointer text-sm"
                  >
                    <User className="mr-2 h-3.5 w-3.5" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setLocation('/settings')}
                    className="cursor-pointer text-sm"
                  >
                    <Settings className="mr-2 h-3.5 w-3.5" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                </div>
                <DropdownMenuSeparator />
                <div className="py-1">
                  <DropdownMenuItem
                    onClick={logout}
                    className="cursor-pointer text-sm text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-3.5 w-3.5" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        
        {/* Resize Handle */}
        <div
          className={`absolute top-0 right-0 w-px h-full cursor-col-resize hover:bg-primary/50 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="bg-background">
        {/* Top Bar - O11 style minimal */}
        <div className="flex border-b border-border h-12 items-center justify-between bg-background px-5 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            {isMobile && (
              <SidebarTrigger className="h-7 w-7" />
            )}
            {/* Breadcrumb / Page Title */}
            <span className="text-sm text-muted-foreground">
              {activeMenuItem?.label || 'Dashboard'}
            </span>
          </div>
          
          {/* Right side - Search & User */}
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 h-8 px-3 border border-border hover:bg-muted transition-colors text-muted-foreground text-xs">
              <Search className="h-3.5 w-3.5" />
              <span>Search...</span>
              <kbd className="ml-2 text-[10px] font-medium">⌘K</kbd>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{user?.name}</span>
              <Avatar className="h-7 w-7 rounded">
                <AvatarFallback className="text-[10px] font-medium bg-muted text-muted-foreground rounded">
                  {user?.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
        
        <main className="flex-1">{children}</main>
      </SidebarInset>
    </>
  );
}
