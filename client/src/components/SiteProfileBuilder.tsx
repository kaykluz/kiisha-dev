import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  MapPin,
  Zap,
  Battery,
  Building2,
  FileText,
  Calendar,
  DollarSign,
  Shield,
  Plus,
  ChevronRight,
  Info,
  ExternalLink,
} from "lucide-react";

// Profile section definition
interface ProfileSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  fields: ProfileField[];
}

interface ProfileField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  required: boolean;
  options?: string[];
  unit?: string;
  description?: string;
}

// Define the profile structure for a site
const siteProfileSections: ProfileSection[] = [
  {
    id: 'location',
    title: 'Location & Geography',
    icon: <MapPin className="h-4 w-4" />,
    description: 'Physical location and geographic details',
    fields: [
      { key: 'address', label: 'Street Address', type: 'text', required: true },
      { key: 'city', label: 'City', type: 'text', required: true },
      { key: 'stateProvince', label: 'State/Province', type: 'text', required: true },
      { key: 'country', label: 'Country', type: 'text', required: true },
      { key: 'latitude', label: 'Latitude', type: 'number', required: false, unit: '°' },
      { key: 'longitude', label: 'Longitude', type: 'number', required: false, unit: '°' },
      { key: 'timezone', label: 'Timezone', type: 'text', required: false },
    ],
  },
  {
    id: 'technical',
    title: 'Technical Specifications',
    icon: <Zap className="h-4 w-4" />,
    description: 'Capacity and technical configuration',
    fields: [
      { key: 'siteType', label: 'Site Type', type: 'select', required: true, options: ['ground_mount', 'rooftop', 'carport', 'floating', 'minigrid'] },
      { key: 'gridConnection', label: 'Grid Connection', type: 'select', required: true, options: ['grid_tied', 'off_grid', 'hybrid'] },
      { key: 'capacityKw', label: 'Capacity (kW)', type: 'number', required: true, unit: 'kW' },
      { key: 'capacityKwh', label: 'Storage Capacity (kWh)', type: 'number', required: false, unit: 'kWh' },
    ],
  },
  {
    id: 'land',
    title: 'Land & Property',
    icon: <Building2 className="h-4 w-4" />,
    description: 'Land ownership and property details',
    fields: [
      { key: 'landType', label: 'Land Type', type: 'select', required: true, options: ['owned', 'leased', 'easement'] },
      { key: 'landArea', label: 'Land Area', type: 'number', required: false, unit: 'acres' },
      { key: 'landOwner', label: 'Land Owner', type: 'text', required: false },
      { key: 'leaseExpiry', label: 'Lease Expiry Date', type: 'date', required: false },
    ],
  },
  {
    id: 'operational',
    title: 'Operational Details',
    icon: <Calendar className="h-4 w-4" />,
    description: 'Commissioning and operational status',
    fields: [
      { key: 'codDate', label: 'Commercial Operation Date', type: 'date', required: true },
      { key: 'operationalStatus', label: 'Operational Status', type: 'select', required: true, options: ['online', 'offline', 'maintenance', 'commissioning'] },
      { key: 'oAndMProvider', label: 'O&M Provider', type: 'text', required: false },
      { key: 'monitoringSystem', label: 'Monitoring System', type: 'text', required: false },
    ],
  },
  {
    id: 'financial',
    title: 'Financial Information',
    icon: <DollarSign className="h-4 w-4" />,
    description: 'Investment and financial details',
    fields: [
      { key: 'totalInvestment', label: 'Total Investment', type: 'number', required: false, unit: 'USD' },
      { key: 'tariffRate', label: 'Tariff Rate', type: 'number', required: false, unit: 'USD/kWh' },
      { key: 'ppaCounterparty', label: 'PPA Counterparty', type: 'text', required: false },
      { key: 'ppaExpiry', label: 'PPA Expiry Date', type: 'date', required: false },
    ],
  },
  {
    id: 'compliance',
    title: 'Compliance & Permits',
    icon: <Shield className="h-4 w-4" />,
    description: 'Regulatory compliance and permits',
    fields: [
      { key: 'environmentalPermit', label: 'Environmental Permit', type: 'text', required: false },
      { key: 'gridConnectionAgreement', label: 'Grid Connection Agreement', type: 'text', required: false },
      { key: 'operatingLicense', label: 'Operating License', type: 'text', required: false },
      { key: 'insurancePolicy', label: 'Insurance Policy', type: 'text', required: false },
    ],
  },
];

// Calculate completeness for a site
function calculateCompleteness(site: any, sections: ProfileSection[]): {
  overall: number;
  bySection: Record<string, { completed: number; total: number; percentage: number }>;
} {
  const bySection: Record<string, { completed: number; total: number; percentage: number }> = {};
  let totalRequired = 0;
  let totalCompleted = 0;

  sections.forEach(section => {
    let sectionCompleted = 0;
    let sectionTotal = 0;

    section.fields.forEach(field => {
      if (field.required) {
        sectionTotal++;
        totalRequired++;
        if (site[field.key] !== null && site[field.key] !== undefined && site[field.key] !== '') {
          sectionCompleted++;
          totalCompleted++;
        }
      }
    });

    bySection[section.id] = {
      completed: sectionCompleted,
      total: sectionTotal,
      percentage: sectionTotal > 0 ? Math.round((sectionCompleted / sectionTotal) * 100) : 100,
    };
  });

  return {
    overall: totalRequired > 0 ? Math.round((totalCompleted / totalRequired) * 100) : 100,
    bySection,
  };
}

// Status indicator component
function StatusIndicator({ percentage }: { percentage: number }) {
  if (percentage === 100) {
    return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  } else if (percentage >= 50) {
    return <Circle className="h-4 w-4 text-yellow-500" />;
  } else {
    return <AlertTriangle className="h-4 w-4 text-red-500" />;
  }
}

// Site Profile Card
export function SiteProfileCard({ site }: { site: any }) {
  const completeness = calculateCompleteness(site, siteProfileSections);
  
  return (
    <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-medium">{site.name}</h3>
            <p className="text-sm text-muted-foreground">{site.siteCode || 'No code'}</p>
          </div>
          <Badge 
            variant="outline" 
            className={
              completeness.overall >= 80 
                ? "bg-green-500/20 text-green-400 border-green-500/30"
                : completeness.overall >= 50
                ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                : "bg-red-500/20 text-red-400 border-red-500/30"
            }
          >
            {completeness.overall}% Complete
          </Badge>
        </div>
        
        <Progress value={completeness.overall} className="h-2 mb-3" />
        
        <div className="grid grid-cols-3 gap-2 text-xs">
          {Object.entries(completeness.bySection).slice(0, 3).map(([sectionId, data]) => {
            const section = siteProfileSections.find(s => s.id === sectionId);
            return (
              <div key={sectionId} className="flex items-center gap-1">
                <StatusIndicator percentage={data.percentage} />
                <span className="text-muted-foreground truncate">{section?.title.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Site Profile Builder Dialog
export function SiteProfileBuilder({ site, onUpdate }: { site: any; onUpdate?: () => void }) {
  const [activeSection, setActiveSection] = useState(siteProfileSections[0].id);
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    siteProfileSections.forEach(section => {
      section.fields.forEach(field => {
        initial[field.key] = site[field.key] || '';
      });
    });
    return initial;
  });
  
  const updateSite = trpc.sites.update.useMutation({
    onSuccess: () => {
      toast.success("Site profile updated");
      onUpdate?.();
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });
  
  const completeness = calculateCompleteness(formData, siteProfileSections);
  
  const handleFieldChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };
  
  const handleSave = () => {
    updateSite.mutate({
      id: site.id,
      ...formData,
    });
  };
  
  const currentSection = siteProfileSections.find(s => s.id === activeSection);
  
  return (
    <div className="flex h-[600px]">
      {/* Sidebar */}
      <div className="w-64 border-r pr-4">
        <div className="mb-4">
          <div className="text-sm text-muted-foreground mb-1">Overall Completeness</div>
          <div className="flex items-center gap-2">
            <Progress value={completeness.overall} className="flex-1 h-2" />
            <span className="text-sm font-medium">{completeness.overall}%</span>
          </div>
        </div>
        
        <ScrollArea className="h-[500px]">
          <div className="space-y-1">
            {siteProfileSections.map(section => {
              const sectionData = completeness.bySection[section.id];
              const isActive = activeSection === section.id;
              
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                    isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {section.icon}
                    <span className="text-sm">{section.title}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">
                      {sectionData.completed}/{sectionData.total}
                    </span>
                    <StatusIndicator percentage={sectionData.percentage} />
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
      
      {/* Content */}
      <div className="flex-1 pl-6">
        {currentSection && (
          <>
            <div className="mb-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                {currentSection.icon}
                {currentSection.title}
              </h3>
              <p className="text-sm text-muted-foreground">{currentSection.description}</p>
            </div>
            
            <ScrollArea className="h-[480px] pr-4">
              <div className="space-y-4">
                {currentSection.fields.map(field => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key} className="flex items-center gap-1">
                      {field.label}
                      {field.required && <span className="text-red-500">*</span>}
                      {field.unit && <span className="text-muted-foreground">({field.unit})</span>}
                    </Label>
                    
                    {field.type === 'select' ? (
                      <Select
                        value={formData[field.key] || ''}
                        onValueChange={(value) => handleFieldChange(field.key, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options?.map(option => (
                            <SelectItem key={option} value={option}>
                              {option.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.type === 'textarea' ? (
                      <Textarea
                        id={field.key}
                        value={formData[field.key] || ''}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                      />
                    ) : (
                      <Input
                        id={field.key}
                        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                        value={formData[field.key] || ''}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                      />
                    )}
                    
                    {field.description && (
                      <p className="text-xs text-muted-foreground">{field.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="mt-4 flex justify-end">
              <Button onClick={handleSave} disabled={updateSite.isPending}>
                {updateSite.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Sites Overview with Profile Completeness
export function SitesProfileOverview() {
  const { data: sites, isLoading, refetch } = trpc.sites.list.useQuery({});
  const [selectedSite, setSelectedSite] = useState<any>(null);
  
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-2 w-full mb-2" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  // Calculate portfolio-wide completeness
  const portfolioCompleteness = sites && sites.length > 0
    ? Math.round(sites.reduce((sum: number, site: any) => {
        const c = calculateCompleteness(site, siteProfileSections);
        return sum + c.overall;
      }, 0) / sites.length)
    : 0;
  
  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Portfolio Profile Completeness</CardTitle>
          <CardDescription>
            Average data completeness across all sites
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={portfolioCompleteness} className="flex-1 h-3" />
            <span className="text-2xl font-bold">{portfolioCompleteness}%</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>{sites?.filter((s: any) => calculateCompleteness(s, siteProfileSections).overall >= 80).length || 0} Complete</span>
            </div>
            <div className="flex items-center gap-2">
              <Circle className="h-4 w-4 text-yellow-500" />
              <span>{sites?.filter((s: any) => {
                const c = calculateCompleteness(s, siteProfileSections).overall;
                return c >= 50 && c < 80;
              }).length || 0} In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span>{sites?.filter((s: any) => calculateCompleteness(s, siteProfileSections).overall < 50).length || 0} Needs Attention</span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Sites Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sites?.map((site: any) => (
          <div key={site.id} onClick={() => setSelectedSite(site)}>
            <SiteProfileCard site={site} />
          </div>
        ))}
        
        {(!sites || sites.length === 0) && (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No sites found</h3>
              <p className="text-muted-foreground">
                Create your first site to start building profiles
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Site Profile Builder Dialog */}
      <Dialog open={!!selectedSite} onOpenChange={() => setSelectedSite(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Site Profile: {selectedSite?.name}</DialogTitle>
            <DialogDescription>
              Complete all required fields to improve your site's data profile
            </DialogDescription>
          </DialogHeader>
          {selectedSite && (
            <SiteProfileBuilder 
              site={selectedSite} 
              onUpdate={() => {
                refetch();
                setSelectedSite(null);
              }} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SitesProfileOverview;
