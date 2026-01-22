import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  Building2, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  FileText, 
  Upload,
  Search,
  Plus,
  ChevronRight,
  RefreshCw,
  Calendar,
  Shield,
  TrendingUp
} from "lucide-react";

export default function CompanyHub() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  
  // Get user's active organization
  const orgId = user?.activeOrgId || 1;
  
  // Fetch company profiles
  const { data: companies, isLoading: loadingCompanies, refetch: refetchCompanies } = 
    trpc.diligence.listCompanyProfiles.useQuery({ 
      organizationId: orgId,
      status: "active"
    });
  
  // Fetch expiring items across all companies
  const { data: expiringItems, isLoading: loadingExpiring } = 
    trpc.diligence.listExpiryRecords.useQuery({
      organizationId: orgId,
      dueSoonDays: 60
    });
  
  // Fetch templates for quick access
  const { data: templates } = trpc.diligence.listTemplates.useQuery({
    organizationId: orgId,
    status: "active",
    includeGlobal: true
  });
  
  // Seed data mutation (admin only)
  const seedDataMutation = trpc.diligence.runSeedData.useMutation({
    onSuccess: (result) => {
      toast.success(`Seeded ${result.requirementItems} items, ${result.templates} templates, ${result.mappings} mappings`);
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  // Filter companies by search
  const filteredCompanies = companies?.filter(c => 
    c.legalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.tradingName?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Group expiring items by status
  const overdueItems = expiringItems?.filter(e => e.status === "overdue") || [];
  const dueSoonItems = expiringItems?.filter(e => e.status === "due_soon" || e.status === "due_now") || [];
  
  // Calculate overall stats
  const totalCompanies = companies?.length || 0;
  const totalExpiring = expiringItems?.length || 0;
  const totalOverdue = overdueItems.length;
  
  if (loadingCompanies) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Company Hub
          </h1>
          <p className="text-muted-foreground">
            Manage company profiles, diligence packs, and compliance tracking
          </p>
        </div>
        <div className="flex items-center gap-3">
          {user?.role === "admin" && (
            <Button 
              variant="outline" 
              onClick={() => seedDataMutation.mutate()}
              disabled={seedDataMutation.isPending}
            >
              {seedDataMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Shield className="h-4 w-4 mr-2" />
              )}
              Seed Templates
            </Button>
          )}
          <Link href="/company/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Company
            </Button>
          </Link>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Companies</p>
                <p className="text-3xl font-bold">{totalCompanies}</p>
              </div>
              <Building2 className="h-10 w-10 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Expiring Soon</p>
                <p className="text-3xl font-bold text-amber-500">{dueSoonItems.length}</p>
              </div>
              <Clock className="h-10 w-10 text-amber-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-3xl font-bold text-red-500">{totalOverdue}</p>
              </div>
              <AlertTriangle className="h-10 w-10 text-red-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Templates</p>
                <p className="text-3xl font-bold">{templates?.length || 0}</p>
              </div>
              <FileText className="h-10 w-10 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="renewals">Renewals Due</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Renewals Due Soon */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" />
                  Renewals Due Soon
                </CardTitle>
                <CardDescription>Items expiring in the next 60 days</CardDescription>
              </CardHeader>
              <CardContent>
                {dueSoonItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>No items expiring soon</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dueSoonItems.slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">{item.requirement?.title}</p>
                          <p className="text-sm text-muted-foreground">
                            Expires: {item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : "N/A"}
                          </p>
                        </div>
                        <Badge variant={item.status === "due_now" ? "destructive" : "outline"}>
                          {item.status === "due_now" ? "Due Now" : "Due Soon"}
                        </Badge>
                      </div>
                    ))}
                    {dueSoonItems.length > 5 && (
                      <Button variant="ghost" className="w-full" onClick={() => setActiveTab("renewals")}>
                        View all {dueSoonItems.length} items
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Overdue Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Overdue Items
                </CardTitle>
                <CardDescription>Items past their expiry date</CardDescription>
              </CardHeader>
              <CardContent>
                {overdueItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>No overdue items</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {overdueItems.slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                        <div>
                          <p className="font-medium">{item.requirement?.title}</p>
                          <p className="text-sm text-muted-foreground">
                            Expired: {item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : "N/A"}
                          </p>
                        </div>
                        <Button size="sm" variant="outline">
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Renewal
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Link href="/company/new">
                  <Button variant="outline" className="w-full h-24 flex-col">
                    <Plus className="h-6 w-6 mb-2" />
                    Add Company
                  </Button>
                </Link>
                <Link href="/diligence/templates">
                  <Button variant="outline" className="w-full h-24 flex-col">
                    <FileText className="h-6 w-6 mb-2" />
                    Browse Templates
                  </Button>
                </Link>
                <Button variant="outline" className="w-full h-24 flex-col" onClick={() => setActiveTab("renewals")}>
                  <Calendar className="h-6 w-6 mb-2" />
                  View Renewals
                </Button>
                <Link href="/diligence/requirements">
                  <Button variant="outline" className="w-full h-24 flex-col">
                    <Shield className="h-6 w-6 mb-2" />
                    Requirement Catalog
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Companies Tab */}
        <TabsContent value="companies" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={() => refetchCompanies()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          
          {filteredCompanies?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-medium mb-2">No companies found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? "Try a different search term" : "Add your first company to get started"}
                </p>
                <Link href="/company/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Company
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCompanies?.map((company) => (
                <Link key={company.id} href={`/company/${company.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{company.legalName}</CardTitle>
                          {company.tradingName && (
                            <CardDescription>Trading as: {company.tradingName}</CardDescription>
                          )}
                        </div>
                        <Badge variant={company.status === "active" ? "default" : "secondary"}>
                          {company.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {company.registrationNumber && (
                          <p className="text-sm text-muted-foreground">
                            Reg: {company.registrationNumber}
                          </p>
                        )}
                        {company.industry && (
                          <p className="text-sm text-muted-foreground">
                            Industry: {company.industry}
                          </p>
                        )}
                        <div className="pt-2">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Readiness</span>
                            <span className="font-medium">--</span>
                          </div>
                          <Progress value={0} className="h-2" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
        
        {/* Renewals Tab */}
        <TabsContent value="renewals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Expiring Items</CardTitle>
              <CardDescription>Items requiring renewal or attention</CardDescription>
            </CardHeader>
            <CardContent>
              {expiringItems?.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">All caught up!</h3>
                  <p className="text-muted-foreground">No items requiring renewal at this time</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {expiringItems?.map((item) => (
                    <div 
                      key={item.id} 
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        item.status === "overdue" 
                          ? "bg-red-500/10 border-red-500/20" 
                          : item.status === "due_now"
                          ? "bg-amber-500/10 border-amber-500/20"
                          : "bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${
                          item.status === "overdue" ? "bg-red-500/20" : "bg-amber-500/20"
                        }`}>
                          {item.status === "overdue" ? (
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                          ) : (
                            <Clock className="h-5 w-5 text-amber-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{item.requirement?.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.requirement?.category?.replace(/_/g, " ")} • 
                            {item.expiresAt 
                              ? ` Expires: ${new Date(item.expiresAt).toLocaleDateString()}`
                              : " No expiry date"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          item.status === "overdue" ? "destructive" : 
                          item.status === "due_now" ? "destructive" : "outline"
                        }>
                          {item.status?.replace(/_/g, " ")}
                        </Badge>
                        <Button size="sm">
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Renewal
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates?.map((template) => (
              <Card key={template.id} className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <CardDescription>{template.description}</CardDescription>
                    </div>
                    <Badge variant={template.isGlobalDefault ? "default" : "secondary"}>
                      {template.isGlobalDefault ? "Global" : "Custom"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{template.category}</Badge>
                    <Link href={`/diligence/templates/${template.id}`}>
                      <Button size="sm" variant="ghost">
                        View Details
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </AppLayout>
  );
}
