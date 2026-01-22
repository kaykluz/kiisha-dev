/**
 * Phase 33: Workspace Switcher Component
 * 
 * Global component in app chrome for switching between workspaces.
 * Features:
 * - Displays current org name/slug
 * - Dropdown lists all memberships
 * - Role badge next to org name
 * - On select → calls workspace.setActive → invalidates all queries
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, ChevronDown, Check, Loader2, Settings } from "lucide-react";


const roleColors: Record<string, string> = {
  admin: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  editor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  reviewer: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  investor_viewer: "bg-green-500/20 text-green-400 border-green-500/30",
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  editor: "Editor",
  reviewer: "Reviewer",
  investor_viewer: "Investor",
};

interface WorkspaceSwitcherProps {
  compact?: boolean;
  onSwitch?: () => void;
}

export function WorkspaceSwitcher({ compact = false, onSwitch }: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  const utils = trpc.useUtils();
  
  const { data: activeWorkspace, isLoading: isLoadingActive } = trpc.workspace.getActive.useQuery();
  const { data: memberships, isLoading: isLoadingMemberships } = trpc.workspace.listMemberships.useQuery();
  const setActiveMutation = trpc.workspace.setActive.useMutation({
    onSuccess: async () => {
      // Invalidate all queries to refresh data for new workspace
      await utils.invalidate();
      // Workspace switched successfully
      onSwitch?.();
    },
    onError: (error) => {
      console.error("Failed to switch workspace:", error.message);
    },
  });
  
  const handleSwitch = async (orgId: number) => {
    if (orgId === activeWorkspace?.activeOrgId) {
      setIsOpen(false);
      return;
    }
    
    await setActiveMutation.mutateAsync({
      organizationId: orgId,
      switchMethod: "switcher",
    });
    setIsOpen(false);
  };
  
  const isLoading = isLoadingActive || isLoadingMemberships;
  const isSwitching = setActiveMutation.isPending;
  
  // Don't show if only one workspace
  if (!isLoading && memberships && memberships.length <= 1) {
    if (compact) {
      return null;
    }
    // Show current workspace without dropdown
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium truncate max-w-[140px]">
          {activeWorkspace?.activeOrgName || "No workspace"}
        </span>
        {activeWorkspace?.role && (
          <Badge 
            variant="outline" 
            className={`text-xs ${roleColors[activeWorkspace.role] || ""}`}
          >
            {roleLabels[activeWorkspace.role] || activeWorkspace.role}
          </Badge>
        )}
      </div>
    );
  }
  
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className={`justify-between ${compact ? "px-2" : "px-3"} h-9`}
          disabled={isLoading || isSwitching}
        >
          {isSwitching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {!compact && (
                  <span className="text-sm font-medium truncate max-w-[120px]">
                    {activeWorkspace?.activeOrgName || "Select workspace"}
                  </span>
                )}
              </div>
              <ChevronDown className="h-4 w-4 ml-2 text-muted-foreground" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Workspaces</span>
          {activeWorkspace?.role && (
            <Badge 
              variant="outline" 
              className={`text-xs ${roleColors[activeWorkspace.role] || ""}`}
            >
              {roleLabels[activeWorkspace.role] || activeWorkspace.role}
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {memberships?.map((membership) => (
          <DropdownMenuItem
            key={membership.organizationId}
            className="cursor-pointer"
            onClick={() => handleSwitch(membership.organizationId)}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm">{membership.organizationName}</span>
                  <span className="text-xs text-muted-foreground">
                    {membership.organizationSlug}.kiisha.io
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className={`text-xs ${roleColors[membership.role] || ""}`}
                >
                  {roleLabels[membership.role] || membership.role}
                </Badge>
                {membership.isActive && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </div>
            </div>
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer text-muted-foreground">
          <Settings className="h-4 w-4 mr-2" />
          Workspace Settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default WorkspaceSwitcher;
