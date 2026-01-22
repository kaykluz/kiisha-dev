import { useState } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  FileText, 
  Upload,
  ArrowLeft,
  Users,
  Landmark,
  MapPin,
  Mail,
  Phone,
  Globe,
  Calendar,
  Shield,
  RefreshCw,
  Edit,
  MoreVertical
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function CompanyProfile() {
  const params = useParams<{ id: string }>();
  const companyId = parseInt(params.id || "0");
  const [activeTab, setActiveTab] = useState("overview");
  
  // Fetch company profile with related data
  const { data: company, isLoading, refetch } = trpc.diligence.getCompanyProfile.useQuery(
    { id: companyId },
    { enabled: companyId > 0 }
  );
  
  // Calculate readiness mutation
  const calculateReadinessMutation = trpc.diligence.calculateReadiness.useMutation({
    onSuccess: () => {
      toast.success("Readiness score updated");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (!company) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
        <h3 className="text-lg font-medium mb-2">Company not found</h3>
        <Link href="/company-hub">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Company Hub
          </Button>
        </Link>
      </div>
    );
  }
  
  const readinessScore = company.readiness?.overallScore 
    ? parseFloat(company.readiness.overallScore) 
    : 0;
  
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/company-hub">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{company.legalName}</h1>
              <Badge variant={company.status === "active" ? "default" : "secondary"}>
                {company.status}
              </Badge>
            </div>
            {company.tradingName && (
              <p className="text-muted-foreground">Trading as: {company.tradingName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={() => calculateReadinessMutation.mutate({
              entityType: "company_profile",
              entityId: companyId,
              organizationId: company.organizationId
            })}
            disabled={calculateReadinessMutation.isPending}
          >
            {calculateReadinessMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Recalculate Readiness
          </Button>
          <Link href={`/company/${companyId}/edit`}>
            <Button>
              <Edit className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Export Profile</DropdownMenuItem>
              <DropdownMenuItem>Generate Report</DropdownMenuItem>
              <DropdownMenuItem className="text-red-500">Archive Company</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Readiness Score Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Readiness</span>
                <span className="text-2xl font-bold">{readinessScore.toFixed(0)}%</span>
              </div>
              <Progress value={readinessScore} className="h-3" />
              <p className="text-sm text-muted-foreground mt-2">
                {company.readiness?.calculatedAt 
                  ? `Last calculated: ${new Date(company.readiness.calculatedAt).toLocaleString()}`
                  : "Not yet calculated"}
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-full">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{company.readiness?.validExpirable || 0}</p>
                <p className="text-sm text-muted-foreground">Valid Items</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-full">
                <Clock className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{company.readiness?.dueSoonCount || 0}</p>
                <p className="text-sm text-muted-foreground">Due Soon</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Expiring Items Alert */}
      {company.expiringItems && company.expiringItems.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Items Requiring Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {company.expiringItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
                  <div>
                    <p className="font-medium">{item.requirement?.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.expiresAt 
                        ? `Expires: ${new Date(item.expiresAt).toLocaleDateString()}`
                        : "No expiry date"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={item.status === "overdue" ? "destructive" : "outline"}>
                      {item.status?.replace(/_/g, " ")}
                    </Badge>
                    <Button size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="shareholders">Shareholders</TabsTrigger>
          <TabsTrigger value="directors">Directors</TabsTrigger>
          <TabsTrigger value="banking">Banking</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Company Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Company Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Registration Number</p>
                    <p className="font-medium">{company.registrationNumber || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tax ID</p>
                    <p className="font-medium">{company.taxId || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">VAT Number</p>
                    <p className="font-medium">{company.vatNumber || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Company Type</p>
                    <p className="font-medium">{company.companyType || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Incorporation Date</p>
                    <p className="font-medium">
                      {company.incorporationDate 
                        ? new Date(company.incorporationDate).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Incorporation Country</p>
                    <p className="font-medium">{company.incorporationCountry || "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {company.primaryEmail && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${company.primaryEmail}`} className="text-primary hover:underline">
                      {company.primaryEmail}
                    </a>
                  </div>
                )}
                {company.primaryPhone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${company.primaryPhone}`} className="hover:underline">
                      {company.primaryPhone}
                    </a>
                  </div>
                )}
                {company.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      {company.website}
                    </a>
                  </div>
                )}
                
                <Separator />
                
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Industry</p>
                  <p className="font-medium">{company.industry || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Sector</p>
                  <p className="font-medium">{company.sector || "—"}</p>
                </div>
                {company.employeeCount && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Employees</p>
                    <p className="font-medium">{company.employeeCount.toLocaleString()}</p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Registered Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Registered Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p>{company.registeredAddress || "—"}</p>
                  <p>
                    {[company.registeredCity, company.registeredState, company.registeredPostalCode]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </p>
                  <p>{company.registeredCountry || "—"}</p>
                </div>
              </CardContent>
            </Card>
            
            {/* Operating Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Operating Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p>{company.operatingAddress || "—"}</p>
                  <p>
                    {[company.operatingCity, company.operatingState, company.operatingPostalCode]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </p>
                  <p>{company.operatingCountry || "—"}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Shareholders Tab */}
        <TabsContent value="shareholders" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Shareholders
                </CardTitle>
                <Button size="sm">
                  <Users className="h-4 w-4 mr-2" />
                  Add Shareholder
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {company.shareholders?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No shareholders recorded</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {company.shareholders?.map((shareholder) => (
                    <div key={shareholder.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-muted rounded-full">
                          <Users className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {shareholder.shareholderType === "individual" 
                              ? shareholder.individualName 
                              : shareholder.companyName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {shareholder.shareholderType} • {shareholder.shareClass || "Ordinary"} shares
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{shareholder.ownershipPercentage}%</p>
                        <p className="text-sm text-muted-foreground">
                          {shareholder.numberOfShares?.toLocaleString()} shares
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Directors Tab */}
        <TabsContent value="directors" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Directors & Officers
                </CardTitle>
                <Button size="sm">
                  <Users className="h-4 w-4 mr-2" />
                  Add Director
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {company.directors?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No directors recorded</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {company.directors?.map((director) => (
                    <div key={director.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-muted rounded-full">
                          <Users className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">{director.fullName}</p>
                          <p className="text-sm text-muted-foreground">
                            {director.position} • {director.directorType?.replace(/_/g, " ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {director.email && (
                          <a href={`mailto:${director.email}`} className="text-sm text-primary hover:underline">
                            {director.email}
                          </a>
                        )}
                        <Badge variant={director.isActive ? "default" : "secondary"}>
                          {director.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Banking Tab */}
        <TabsContent value="banking" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Landmark className="h-5 w-5" />
                  Bank Accounts
                </CardTitle>
                <Button size="sm">
                  <Landmark className="h-4 w-4 mr-2" />
                  Add Bank Account
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {company.bankAccounts?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Landmark className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No bank accounts recorded</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {company.bankAccounts?.map((account) => (
                    <div key={account.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Landmark className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{account.bankName}</p>
                            <p className="text-sm text-muted-foreground">{account.bankBranch}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {account.isPrimary && (
                            <Badge>Primary</Badge>
                          )}
                          <Badge variant="outline">{account.currency}</Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Account Name</p>
                          <p className="font-medium">{account.accountName}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Account Number</p>
                          <p className="font-medium">****{account.accountNumber.slice(-4)}</p>
                        </div>
                        {account.swiftCode && (
                          <div>
                            <p className="text-muted-foreground">SWIFT Code</p>
                            <p className="font-medium">{account.swiftCode}</p>
                          </div>
                        )}
                        {account.routingNumber && (
                          <div>
                            <p className="text-muted-foreground">Routing Number</p>
                            <p className="font-medium">{account.routingNumber}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Documents & Evidence
                </CardTitle>
                <Button size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Document management coming soon</p>
                <p className="text-sm">Upload and track all company documents here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </AppLayout>
  );
}
