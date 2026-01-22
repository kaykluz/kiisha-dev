import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Building2,
  ChevronDown,
  Search,
  Shield,
  LogIn,
  LogOut,
  AlertTriangle,
  Clock,
  Eye,
  Edit,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Organization {
  id: number;
  name: string;
  code: string;
  slug?: string | null;
  status: "active" | "suspended" | "archived";
}

interface OrganizationSwitcherProps {
  className?: string;
  variant?: "sidebar" | "header";
}

export function OrganizationSwitcher({ className, variant = "sidebar" }: OrganizationSwitcherProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showElevationDialog, setShowElevationDialog] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [elevationReason, setElevationReason] = useState("");
  const [elevationDuration, setElevationDuration] = useState(1);
  const [elevationPermissions, setElevationPermissions] = useState({
    canRead: true,
    canWrite: false,
    canExport: false,
  });

  // Check if user is a superuser
  const isSuperuser = user?.isSuperuser || user?.role === "superuser_admin";

  // Get elevation status
  const { data: elevationStatus, refetch: refetchElevation } = trpc.superuser.getElevationStatus.useQuery(
    undefined,
    { enabled: isSuperuser }
  );

  // Get all organizations (for superusers)
  const { data: allOrgs } = trpc.superuser.listAllOrganizations.useQuery(
    undefined,
    { enabled: isSuperuser }
  );

  // Get user's organizations (for non-superusers)
  const { data: userOrgs } = trpc.auth.getOrganizations.useQuery(
    undefined,
    { enabled: !isSuperuser }
  );

  // Start elevation mutation
  const startElevation = trpc.superuser.startElevation.useMutation({
    onSuccess: () => {
      toast.success(`Elevated access to ${selectedOrg?.name}`);
      setShowElevationDialog(false);
      setElevationReason("");
      refetchElevation();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // End elevation mutation
  const endElevation = trpc.superuser.endElevation.useMutation({
    onSuccess: () => {
      toast.success("Elevation ended");
      refetchElevation();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Switch organization mutation (for non-superusers)
  const switchOrg = trpc.auth.selectOrg.useMutation({
    onSuccess: () => {
      toast.success("Organization switched");
      window.location.reload();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Filter organizations based on search
  const organizations = useMemo(() => {
    const orgs = isSuperuser ? (allOrgs || []) : (userOrgs || []);
    if (!searchQuery) return orgs;
    const query = searchQuery.toLowerCase();
    return orgs.filter(
      (org: Organization) =>
        org.name.toLowerCase().includes(query) ||
        org.code.toLowerCase().includes(query)
    );
  }, [isSuperuser, allOrgs, userOrgs, searchQuery]);

  // Get current organization name
  const currentOrgName = useMemo(() => {
    if (elevationStatus?.isElevated && elevationStatus.elevation?.targetOrganizationId) {
      const org = (allOrgs || []).find(
        (o: Organization) => o.id === elevationStatus.elevation?.targetOrganizationId
      );
      return org?.name || "Unknown Org";
    }
    if (user?.activeOrgId) {
      const orgs = isSuperuser ? (allOrgs || []) : (userOrgs || []);
      const org = orgs.find((o: Organization) => o.id === user.activeOrgId);
      return org?.name || "Select Organization";
    }
    return "Select Organization";
  }, [elevationStatus, allOrgs, userOrgs, user?.activeOrgId, isSuperuser]);

  // Handle organization selection
  const handleSelectOrg = (org: Organization) => {
    if (isSuperuser) {
      // Superusers need to start elevation
      setSelectedOrg(org);
      setShowElevationDialog(true);
    } else {
      // Regular users just switch
      switchOrg.mutate({ organizationId: org.id });
    }
  };

  // Handle elevation start
  const handleStartElevation = () => {
    if (!selectedOrg || !elevationReason || elevationReason.length < 10) {
      toast.error("Please provide a reason (at least 10 characters)");
      return;
    }

    startElevation.mutate({
      targetOrganizationId: selectedOrg.id,
      scope: "organization",
      reason: elevationReason,
      durationHours: elevationDuration,
      canRead: elevationPermissions.canRead,
      canWrite: elevationPermissions.canWrite,
      canExport: elevationPermissions.canExport,
    });
  };

  // Handle elevation end
  const handleEndElevation = () => {
    endElevation.mutate({});
  };

  if (!isSuperuser && (!userOrgs || userOrgs.length <= 1)) {
    // Don't show switcher if user only has one org
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-between gap-2",
              variant === "sidebar" && "px-3 py-2",
              variant === "header" && "h-9",
              className
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{currentOrgName}</span>
            </div>
            <div className="flex items-center gap-1">
              {elevationStatus?.isElevated && (
                <Badge variant="destructive" className="text-xs px-1.5">
                  <Shield className="h-3 w-3 mr-1" />
                  Elevated
                </Badge>
              )}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>{isSuperuser ? "All Organizations" : "Your Organizations"}</span>
            {isSuperuser && (
              <Badge variant="outline" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                Superuser
              </Badge>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Search */}
          <div className="px-2 pb-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search organizations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8"
              />
            </div>
          </div>

          {/* Elevation status banner */}
          {elevationStatus?.isElevated && (
            <div className="mx-2 mb-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Elevated Access Active</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {elevationStatus.elevation?.remainingMinutes} min remaining
              </div>
              <div className="mt-1 flex gap-1">
                {elevationStatus.elevation?.canRead && (
                  <Badge variant="outline" className="text-xs">
                    <Eye className="h-3 w-3 mr-1" />
                    Read
                  </Badge>
                )}
                {elevationStatus.elevation?.canWrite && (
                  <Badge variant="outline" className="text-xs">
                    <Edit className="h-3 w-3 mr-1" />
                    Write
                  </Badge>
                )}
                {elevationStatus.elevation?.canExport && (
                  <Badge variant="outline" className="text-xs">
                    <Download className="h-3 w-3 mr-1" />
                    Export
                  </Badge>
                )}
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="w-full mt-2"
                onClick={handleEndElevation}
                disabled={endElevation.isPending}
              >
                <LogOut className="h-4 w-4 mr-2" />
                End Elevation
              </Button>
            </div>
          )}

          {/* Organization list */}
          <ScrollArea className="max-h-64">
            {organizations.map((org: Organization) => {
              const isCurrentOrg =
                (elevationStatus?.isElevated &&
                  elevationStatus.elevation?.targetOrganizationId === org.id) ||
                (!elevationStatus?.isElevated && user?.activeOrgId === org.id);

              return (
                <DropdownMenuItem
                  key={org.id}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer",
                    isCurrentOrg && "bg-accent"
                  )}
                  onClick={() => handleSelectOrg(org)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{org.name}</span>
                      <Badge variant="outline" className="text-xs flex-shrink-0">
                        {org.code}
                      </Badge>
                    </div>
                    {org.slug && (
                      <div className="text-xs text-muted-foreground truncate">
                        {org.slug}.kiisha.io
                      </div>
                    )}
                  </div>
                  {org.status !== "active" && (
                    <Badge
                      variant={org.status === "suspended" ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {org.status}
                    </Badge>
                  )}
                  {isSuperuser && (
                    <LogIn className="h-4 w-4 text-muted-foreground" />
                  )}
                </DropdownMenuItem>
              );
            })}
            {organizations.length === 0 && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No organizations found
              </div>
            )}
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Elevation Dialog */}
      <Dialog open={showElevationDialog} onOpenChange={setShowElevationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-destructive" />
              Start Elevated Access
            </DialogTitle>
            <DialogDescription>
              You are about to access <strong>{selectedOrg?.name}</strong> with elevated
              privileges. This action will be logged for audit purposes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason for Access <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reason"
                placeholder="Describe why you need elevated access (min 10 characters)..."
                value={elevationReason}
                onChange={(e) => setElevationReason(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This reason will be logged and visible in the audit trail.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Duration</Label>
              <div className="flex gap-2">
                {[0.25, 0.5, 1, 2, 4, 8].map((hours) => (
                  <Button
                    key={hours}
                    variant={elevationDuration === hours ? "default" : "outline"}
                    size="sm"
                    onClick={() => setElevationDuration(hours)}
                  >
                    {hours < 1 ? `${hours * 60}m` : `${hours}h`}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="flex gap-2">
                <Button
                  variant={elevationPermissions.canRead ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    setElevationPermissions((p) => ({ ...p, canRead: !p.canRead }))
                  }
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Read
                </Button>
                <Button
                  variant={elevationPermissions.canWrite ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    setElevationPermissions((p) => ({ ...p, canWrite: !p.canWrite }))
                  }
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Write
                </Button>
                <Button
                  variant={elevationPermissions.canExport ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    setElevationPermissions((p) => ({ ...p, canExport: !p.canExport }))
                  }
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Select the minimum permissions needed for your task.
              </p>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium">Security Notice</p>
                  <p className="text-xs mt-1">
                    All actions during elevated access are logged. Elevation will
                    automatically expire after the selected duration.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowElevationDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleStartElevation}
              disabled={
                startElevation.isPending ||
                !elevationReason ||
                elevationReason.length < 10
              }
            >
              <Shield className="h-4 w-4 mr-2" />
              Start Elevation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default OrganizationSwitcher;
