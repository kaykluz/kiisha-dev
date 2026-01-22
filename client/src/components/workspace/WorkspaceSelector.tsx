/**
 * Phase 33: Workspace Selector Component
 * 
 * Shown after login when user has multiple org memberships.
 * Features:
 * - List all org memberships with role badges
 * - "Set as default" option
 * - Clean, focused UI for workspace selection
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, Check, Shield, Loader2 } from "lucide-react";

interface WorkspaceSelectorProps {
  onSelect: (orgId: number) => void;
  title?: string;
  description?: string;
}

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

export function WorkspaceSelector({ 
  onSelect, 
  title = "Select Workspace",
  description = "Choose which workspace you'd like to work in"
}: WorkspaceSelectorProps) {
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [setAsDefault, setSetAsDefault] = useState(false);
  
  const { data: memberships, isLoading } = trpc.workspace.listMemberships.useQuery();
  const setActiveMutation = trpc.workspace.setActive.useMutation();
  const setDefaultsMutation = trpc.workspace.setDefaults.useMutation();
  
  const handleSelect = async () => {
    if (!selectedOrgId) return;
    
    try {
      // Set active workspace
      await setActiveMutation.mutateAsync({
        organizationId: selectedOrgId,
        switchMethod: "login_selection",
      });
      
      // Set as default if checked
      if (setAsDefault) {
        await setDefaultsMutation.mutateAsync({
          defaultOrgId: selectedOrgId,
        });
      }
      
      onSelect(selectedOrgId);
    } catch (error) {
      console.error("Failed to select workspace:", error);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (!memberships || memberships.length === 0) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle>No Workspaces Available</CardTitle>
          <CardDescription>
            You don't have access to any workspaces yet. Please contact your administrator.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      
      <div className="space-y-3">
        {memberships.map((membership) => (
          <Card
            key={membership.organizationId}
            className={`cursor-pointer transition-all ${
              selectedOrgId === membership.organizationId
                ? "ring-2 ring-primary border-primary"
                : "hover:border-muted-foreground/30"
            }`}
            onClick={() => setSelectedOrgId(membership.organizationId)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    selectedOrgId === membership.organizationId
                      ? "bg-primary/10"
                      : "bg-muted"
                  }`}>
                    <Building2 className={`h-5 w-5 ${
                      selectedOrgId === membership.organizationId
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`} />
                  </div>
                  <div>
                    <p className="font-medium">{membership.organizationName}</p>
                    <p className="text-sm text-muted-foreground">
                      {membership.organizationSlug}.kiisha.io
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={roleColors[membership.role] || ""}
                  >
                    {roleLabels[membership.role] || membership.role}
                  </Badge>
                  {selectedOrgId === membership.organizationId && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {selectedOrgId && (
        <div className="flex items-center gap-2 px-1">
          <Checkbox
            id="setDefault"
            checked={setAsDefault}
            onCheckedChange={(checked) => setSetAsDefault(checked === true)}
          />
          <label 
            htmlFor="setDefault" 
            className="text-sm text-muted-foreground cursor-pointer"
          >
            Set as my default workspace
          </label>
        </div>
      )}
      
      <Button
        className="w-full"
        size="lg"
        disabled={!selectedOrgId || setActiveMutation.isPending}
        onClick={handleSelect}
      >
        {setActiveMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Switching...
          </>
        ) : (
          <>
            <Shield className="mr-2 h-4 w-4" />
            Continue to Workspace
          </>
        )}
      </Button>
      
      <p className="text-xs text-center text-muted-foreground">
        You can switch workspaces anytime from the sidebar
      </p>
    </div>
  );
}

export default WorkspaceSelector;
