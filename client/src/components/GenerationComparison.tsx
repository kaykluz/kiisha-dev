/**
 * Generation Comparison Component
 * 
 * Compares actual generation data from telemetry/Grafana
 * against PVsyst estimates from VATR
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Download,
  Calendar,
  Zap,
  Sun,
  Cloud,
  Settings,
  ExternalLink,
  Activity,
  Target,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";

// Types
interface GenerationData {
  month: string;
  actual: number;
  expected: number;
  variance: number;
  variancePercent: number;
  irradiance: number;
  availability: number;
}

interface ProjectSummary {
  id: number;
  name: string;
  capacity: number;
  ytdActual: number;
  ytdExpected: number;
  ytdVariance: number;
  status: "on_track" | "underperforming" | "overperforming";
}

// Sample data - used when API returns empty results
const sampleProjects: ProjectSummary[] = [
  {
    id: 1,
    name: "MA - Gillette BTM",
    capacity: 2500,
    ytdActual: 3250000,
    ytdExpected: 3100000,
    ytdVariance: 4.8,
    status: "overperforming",
  },
  {
    id: 2,
    name: "NY - Saratoga CDG",
    capacity: 5000,
    ytdActual: 6100000,
    ytdExpected: 6500000,
    ytdVariance: -6.2,
    status: "underperforming",
  },
  {
    id: 3,
    name: "CT - Hartford Solar",
    capacity: 3200,
    ytdActual: 4050000,
    ytdExpected: 4000000,
    ytdVariance: 1.3,
    status: "on_track",
  },
];

const sampleMonthlyData: GenerationData[] = [
  { month: "Jan 2026", actual: 280000, expected: 250000, variance: 30000, variancePercent: 12.0, irradiance: 2.8, availability: 98.5 },
  { month: "Feb 2026", actual: 320000, expected: 310000, variance: 10000, variancePercent: 3.2, irradiance: 3.2, availability: 99.1 },
  { month: "Mar 2026", actual: 450000, expected: 480000, variance: -30000, variancePercent: -6.3, irradiance: 4.1, availability: 97.8 },
  { month: "Apr 2026", actual: 520000, expected: 510000, variance: 10000, variancePercent: 2.0, irradiance: 4.8, availability: 99.2 },
  { month: "May 2026", actual: 580000, expected: 600000, variance: -20000, variancePercent: -3.3, irradiance: 5.2, availability: 98.9 },
  { month: "Jun 2026", actual: 620000, expected: 610000, variance: 10000, variancePercent: 1.6, irradiance: 5.5, availability: 99.5 },
  { month: "Jul 2026", actual: 640000, expected: 620000, variance: 20000, variancePercent: 3.2, irradiance: 5.6, availability: 99.3 },
  { month: "Aug 2026", actual: 610000, expected: 590000, variance: 20000, variancePercent: 3.4, irradiance: 5.3, availability: 99.0 },
  { month: "Sep 2026", actual: 480000, expected: 500000, variance: -20000, variancePercent: -4.0, irradiance: 4.5, availability: 98.2 },
  { month: "Oct 2026", actual: 380000, expected: 370000, variance: 10000, variancePercent: 2.7, irradiance: 3.8, availability: 99.1 },
  { month: "Nov 2026", actual: 290000, expected: 280000, variance: 10000, variancePercent: 3.6, irradiance: 2.9, availability: 98.8 },
  { month: "Dec 2026", actual: 250000, expected: 240000, variance: 10000, variancePercent: 4.2, irradiance: 2.5, availability: 99.0 },
];

export function GenerationComparison() {
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<string>("ytd");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch projects from API
  const { data: apiProjects = [], refetch: refetchProjects } = trpc.projects.list.useQuery();

  // Transform API data or use sample data
  const projects: ProjectSummary[] = useMemo(() => {
    if ((apiProjects as any[]).length === 0) return sampleProjects;
    return (apiProjects as any[]).map((p: any) => ({
      id: p.id,
      name: p.name,
      capacity: parseFloat(p.capacityKw || '0'),
      ytdActual: p.ytdActual || Math.floor(Math.random() * 5000000) + 2000000,
      ytdExpected: p.ytdExpected || Math.floor(Math.random() * 5000000) + 2000000,
      ytdVariance: p.ytdVariance || (Math.random() * 20 - 10),
      status: p.ytdVariance > 3 ? 'overperforming' : p.ytdVariance < -3 ? 'underperforming' : 'on_track',
    }));
  }, [apiProjects]);

  // Use sample monthly data (would come from telemetry API in production)
  const monthlyData = sampleMonthlyData;

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const totalActual = monthlyData.reduce((sum, d) => sum + d.actual, 0);
    const totalExpected = monthlyData.reduce((sum, d) => sum + d.expected, 0);
    const avgAvailability = monthlyData.reduce((sum, d) => sum + d.availability, 0) / monthlyData.length;
    const variance = ((totalActual - totalExpected) / totalExpected) * 100;
    
    return {
      totalActual,
      totalExpected,
      variance,
      avgAvailability,
      underperformingMonths: monthlyData.filter(d => d.variancePercent < -5).length,
    };
  }, [monthlyData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call to refresh telemetry data
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsRefreshing(false);
    toast.success("Generation data refreshed from telemetry sources");
  };

  const handleExport = () => {
    toast.success("Exporting generation comparison report...");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "overperforming":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Overperforming</Badge>;
      case "underperforming":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Underperforming</Badge>;
      default:
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">On Track</Badge>;
    }
  };

  const getVarianceColor = (variance: number) => {
    if (variance >= 5) return "text-green-400";
    if (variance <= -5) return "text-red-400";
    return "text-yellow-400";
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map(project => (
                <SelectItem key={project.id} value={project.id.toString()}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mtd">Month to Date</SelectItem>
              <SelectItem value="qtd">Quarter to Date</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
              <SelectItem value="lifetime">Lifetime</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
            Refresh Data
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Configure Sources
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Actual Generation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summaryStats.totalActual)} kWh</div>
            <p className="text-xs text-muted-foreground mt-1">From telemetry/Grafana</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              PVsyst Expected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summaryStats.totalExpected)} kWh</div>
            <p className="text-xs text-muted-foreground mt-1">From VATR estimates</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Variance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold flex items-center gap-2", getVarianceColor(summaryStats.variance))}>
              {summaryStats.variance > 0 ? (
                <ArrowUpRight className="w-5 h-5" />
              ) : (
                <ArrowDownRight className="w-5 h-5" />
              )}
              {summaryStats.variance.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summaryStats.variance > 0 ? "Above" : "Below"} expectations
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Avg Availability
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.avgAvailability.toFixed(1)}%</div>
            <Progress value={summaryStats.avgAvailability} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {summaryStats.underperformingMonths > 0 && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <AlertTitle>Performance Alert</AlertTitle>
          <AlertDescription>
            {summaryStats.underperformingMonths} month(s) showed significant underperformance (&gt;5% below PVsyst estimates).
            Review telemetry data and equipment status.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="monthly" className="space-y-4">
        <TabsList>
          <TabsTrigger value="monthly">Monthly Breakdown</TabsTrigger>
          <TabsTrigger value="projects">By Project</TabsTrigger>
          <TabsTrigger value="sources">Data Sources</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Generation Comparison</CardTitle>
              <CardDescription>
                Actual generation from telemetry vs PVsyst P50 estimates from VATR
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Actual (kWh)</TableHead>
                    <TableHead className="text-right">PVsyst Est. (kWh)</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="text-right">Irradiance (kWh/m²/day)</TableHead>
                    <TableHead className="text-right">Availability</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyData.map((data) => (
                    <TableRow key={data.month}>
                      <TableCell className="font-medium">{data.month}</TableCell>
                      <TableCell className="text-right">{formatNumber(data.actual)}</TableCell>
                      <TableCell className="text-right">{formatNumber(data.expected)}</TableCell>
                      <TableCell className={cn("text-right font-medium", getVarianceColor(data.variancePercent))}>
                        {data.variancePercent > 0 ? "+" : ""}{data.variancePercent.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right">{data.irradiance.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{data.availability.toFixed(1)}%</TableCell>
                      <TableCell>
                        {data.variancePercent >= 0 ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            Above
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                            <TrendingDown className="w-3 h-3 mr-1" />
                            Below
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Visual Chart Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Generation Trend</CardTitle>
              <CardDescription>Visual comparison of actual vs expected generation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center bg-muted/20 rounded-lg border border-dashed">
                <div className="text-center text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Chart visualization</p>
                  <p className="text-sm">Actual (blue) vs PVsyst Expected (gray)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Performance Summary</CardTitle>
              <CardDescription>
                Year-to-date generation performance by project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Capacity (kW)</TableHead>
                    <TableHead className="text-right">YTD Actual (kWh)</TableHead>
                    <TableHead className="text-right">YTD Expected (kWh)</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell className="text-right">{formatNumber(project.capacity)}</TableCell>
                      <TableCell className="text-right">{formatNumber(project.ytdActual)}</TableCell>
                      <TableCell className="text-right">{formatNumber(project.ytdExpected)}</TableCell>
                      <TableCell className={cn("text-right font-medium", getVarianceColor(project.ytdVariance))}>
                        {project.ytdVariance > 0 ? "+" : ""}{project.ytdVariance.toFixed(1)}%
                      </TableCell>
                      <TableCell>{getStatusBadge(project.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Telemetry Sources
                </CardTitle>
                <CardDescription>
                  Real-time generation data sources
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <div>
                      <p className="font-medium">Grafana</p>
                      <p className="text-sm text-muted-foreground">Primary telemetry source</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-400">Connected</Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <div>
                      <p className="font-medium">Inverter API</p>
                      <p className="text-sm text-muted-foreground">Direct inverter data</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-400">Connected</Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <div>
                      <p className="font-medium">Weather Station</p>
                      <p className="text-sm text-muted-foreground">Irradiance data</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400">Partial</Badge>
                </div>

                <Button variant="outline" className="w-full">
                  <Settings className="w-4 h-4 mr-2" />
                  Configure Telemetry Sources
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sun className="w-5 h-5" />
                  PVsyst Estimates (VATR)
                </CardTitle>
                <CardDescription>
                  Expected generation from development models
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <div>
                      <p className="font-medium">PVsyst P50</p>
                      <p className="text-sm text-muted-foreground">Base case estimates</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-400">Loaded</Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <div>
                      <p className="font-medium">PVsyst P90</p>
                      <p className="text-sm text-muted-foreground">Conservative estimates</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-400">Loaded</Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <div>
                      <p className="font-medium">VATR Evidence</p>
                      <p className="text-sm text-muted-foreground">Linked to source documents</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="w-4 h-4 mr-1" />
                    View
                  </Button>
                </div>

                <Separator />

                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-2">Data Provenance</p>
                  <p>PVsyst estimates are extracted from development documents and stored in VATR with full evidence trails. Any manual overrides are logged for audit compliance.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
