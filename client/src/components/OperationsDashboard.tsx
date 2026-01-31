import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Sun,
  Battery,
  Zap,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ThermometerSun,
  Wind,
  Gauge,
  BarChart3,
  RefreshCw,
  Download,
  Calendar,
  MapPin,
} from "lucide-react";

// Generate mock time-series data
const generateTimeSeriesData = (hours: number, baseValue: number, variance: number) => {
  const data = [];
  const now = new Date();
  for (let i = hours; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    const value = baseValue + (Math.random() - 0.5) * variance * 2;
    data.push({
      time: time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      value: Math.max(0, value),
      timestamp: time,
    });
  }
  return data;
};

// Mock data for charts
const powerData = generateTimeSeriesData(24, 450, 150);
const batteryData = generateTimeSeriesData(24, 65, 20);
const gridData = generateTimeSeriesData(24, 100, 80);

const energyByDay = [
  { day: "Mon", solar: 2400, battery: 800, grid: 200 },
  { day: "Tue", solar: 2100, battery: 750, grid: 350 },
  { day: "Wed", solar: 2800, battery: 900, grid: 100 },
  { day: "Thu", solar: 2600, battery: 850, grid: 150 },
  { day: "Fri", solar: 2200, battery: 700, grid: 400 },
  { day: "Sat", solar: 1800, battery: 600, grid: 500 },
  { day: "Sun", solar: 2000, battery: 650, grid: 300 },
];

const deviceStatus = [
  { name: "Online", value: 45, color: "#22c55e" },
  { name: "Warning", value: 8, color: "#f59e0b" },
  { name: "Offline", value: 3, color: "#ef4444" },
  { name: "Maintenance", value: 2, color: "#6b7280" },
];

const sitePerformance = [
  { site: "MA - Gillette", pr: 0.85, availability: 0.98, energy: 12500 },
  { site: "TX - Austin", pr: 0.82, availability: 0.95, energy: 18200 },
  { site: "CA - Fresno", pr: 0.88, availability: 0.99, energy: 15800 },
  { site: "FL - Miami", pr: 0.79, availability: 0.92, energy: 14100 },
  { site: "AZ - Phoenix", pr: 0.91, availability: 0.97, energy: 22400 },
];

const recentAlerts = [
  { id: 1, site: "TX - Austin", device: "Inverter-03", message: "Low AC voltage detected", severity: "high", time: "10 min ago" },
  { id: 2, site: "FL - Miami", device: "Battery-01", message: "SOC below 20%", severity: "medium", time: "25 min ago" },
  { id: 3, site: "MA - Gillette", device: "Meter-01", message: "Communication restored", severity: "info", time: "1 hour ago" },
  { id: 4, site: "CA - Fresno", device: "Inverter-01", message: "High temperature warning", severity: "medium", time: "2 hours ago" },
];

export function OperationsDashboard() {
  const [timeRange, setTimeRange] = useState("24h");
  const [selectedSite, setSelectedSite] = useState("all");

  // Calculate summary metrics
  const totalPower = powerData[powerData.length - 1]?.value || 0;
  const avgBattery = batteryData.reduce((sum, d) => sum + d.value, 0) / batteryData.length;
  const totalEnergy = energyByDay.reduce((sum, d) => sum + d.solar + d.battery, 0);
  const avgPR = sitePerformance.reduce((sum, s) => sum + s.pr, 0) / sitePerformance.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Operations Dashboard</h2>
          <p className="text-muted-foreground">Real-time monitoring and performance analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedSite} onValueChange={setSelectedSite}>
            <SelectTrigger className="w-[200px]">
              <MapPin className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Select site" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {sitePerformance.map((site) => (
                <SelectItem key={site.site} value={site.site}>
                  {site.site}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              // Simulate refresh by triggering re-render
              setTimeRange(timeRange);
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              // Export telemetry data as CSV
              const csvContent = "Site,Performance Ratio,Availability,Energy (kWh)\n" + 
                sitePerformance.map(s => `${s.site},${(s.pr * 100).toFixed(1)}%,${(s.availability * 100).toFixed(1)}%,${s.energy}`).join("\n");
              const blob = new Blob([csvContent], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `operations-${selectedSite}-${timeRange}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Current Power</p>
                <p className="text-2xl font-bold">{totalPower.toFixed(0)} kW</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="w-3 h-3 text-success" />
                  <span className="text-xs text-success">+12.5%</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-primary/10">
                <Sun className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Battery SOC</p>
                <p className="text-2xl font-bold">{avgBattery.toFixed(0)}%</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingDown className="w-3 h-3 text-warning" />
                  <span className="text-xs text-warning">-5.2%</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10">
                <Battery className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Energy Today</p>
                <p className="text-2xl font-bold">{(totalEnergy / 1000).toFixed(1)} MWh</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="w-3 h-3 text-success" />
                  <span className="text-xs text-success">+8.3%</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-cyan-500/10">
                <Zap className="w-6 h-6 text-cyan-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg. PR</p>
                <p className="text-2xl font-bold">{(avgPR * 100).toFixed(1)}%</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="w-3 h-3 text-success" />
                  <span className="text-xs text-success">+2.1%</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Gauge className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active Alerts</p>
                <p className="text-2xl font-bold text-warning">4</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-muted-foreground">2 high priority</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-warning/10">
                <AlertTriangle className="w-6 h-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-3 gap-4">
        {/* Power Generation Chart */}
        <Card className="col-span-2 bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Power Generation</CardTitle>
            <CardDescription>Real-time power output across all sites</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={powerData}>
                  <defs>
                    <linearGradient id="powerGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#E87722" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#E87722" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="time" stroke="#666" fontSize={10} />
                  <YAxis stroke="#666" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1A1F36",
                      border: "1px solid #333",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#fff" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#E87722"
                    fill="url(#powerGradient)"
                    strokeWidth={2}
                    name="Power (kW)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Device Status */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Device Status</CardTitle>
            <CardDescription>Current status of all devices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deviceStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {deviceStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1A1F36",
                      border: "1px solid #333",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {deviceStatus.map((status) => (
                <div key={status.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: status.color }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {status.name}: {status.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Energy by Source */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Energy by Source (Weekly)</CardTitle>
            <CardDescription>Energy production breakdown by source</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={energyByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="day" stroke="#666" fontSize={10} />
                  <YAxis stroke="#666" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1A1F36",
                      border: "1px solid #333",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="solar" stackId="a" fill="#E87722" name="Solar" />
                  <Bar dataKey="battery" stackId="a" fill="#22c55e" name="Battery" />
                  <Bar dataKey="grid" stackId="a" fill="#6366f1" name="Grid" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Battery SOC */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Battery State of Charge</CardTitle>
            <CardDescription>Average SOC across all battery systems</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={batteryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="time" stroke="#666" fontSize={10} />
                  <YAxis stroke="#666" fontSize={10} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1A1F36",
                      border: "1px solid #333",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    name="SOC (%)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Site Performance & Alerts */}
      <div className="grid grid-cols-3 gap-4">
        {/* Site Performance Table */}
        <Card className="col-span-2 bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Site Performance</CardTitle>
            <CardDescription>Performance metrics by site</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Site</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">PR</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Availability</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Energy (kWh)</th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sitePerformance.map((site) => (
                    <tr key={site.site} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-2 px-3 text-sm font-medium">{site.site}</td>
                      <td className="py-2 px-3 text-sm text-right">
                        <span className={cn(
                          site.pr >= 0.85 ? "text-success" : site.pr >= 0.75 ? "text-warning" : "text-destructive"
                        )}>
                          {(site.pr * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2 px-3 text-sm text-right">
                        <span className={cn(
                          site.availability >= 0.95 ? "text-success" : site.availability >= 0.90 ? "text-warning" : "text-destructive"
                        )}>
                          {(site.availability * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2 px-3 text-sm text-right">{site.energy.toLocaleString()}</td>
                      <td className="py-2 px-3 text-center">
                        {site.availability >= 0.95 ? (
                          <Badge variant="outline" className="text-success border-success/30">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Healthy
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-warning border-warning/30">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Warning
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Alerts</CardTitle>
            <CardDescription>Latest system alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[250px]">
              <div className="space-y-3">
                {recentAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      "p-3 rounded-lg border",
                      alert.severity === "high"
                        ? "bg-destructive/5 border-destructive/30"
                        : alert.severity === "medium"
                        ? "bg-warning/5 border-warning/30"
                        : "bg-muted/30 border-border"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{alert.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {alert.site} • {alert.device}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          alert.severity === "high"
                            ? "text-destructive border-destructive/30"
                            : alert.severity === "medium"
                            ? "text-warning border-warning/30"
                            : "text-muted-foreground"
                        )}
                      >
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {alert.time}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default OperationsDashboard;
