import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Sun, Battery, Zap, TrendingUp, TrendingDown, Calendar } from "lucide-react";

interface EnergyProductionChartProps {
  assetId?: number;
  projectId?: number;
  customerId?: number;
  height?: number;
}

export function EnergyProductionChart({ 
  assetId, 
  projectId, 
  customerId,
  height = 300 
}: EnergyProductionChartProps) {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "1y">("30d");
  const [aggregation, setAggregation] = useState<"hourly" | "daily" | "weekly" | "monthly">("daily");

  // Note: This component uses generated sample data for demonstration
  // In production, this would fetch from operations.getDerivedMetrics API
  // when telemetry data is available for the asset
  const chartData = useMemo(() => {
    const now = new Date();
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : timeRange === "90d" ? 90 : 365;
    const data = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Generate realistic solar production data (kWh)
      const baseProduction = 45 + Math.random() * 20; // 45-65 kWh base
      const seasonalFactor = 1 + 0.3 * Math.sin((date.getMonth() / 12) * 2 * Math.PI); // Seasonal variation
      const weatherFactor = 0.7 + Math.random() * 0.3; // Weather variation
      const production = baseProduction * seasonalFactor * weatherFactor;
      
      // Expected production (slightly higher)
      const expected = baseProduction * seasonalFactor * 1.1;
      
      data.push({
        date: date.toISOString().split("T")[0],
        production: Math.round(production * 10) / 10,
        expected: Math.round(expected * 10) / 10,
        consumption: Math.round((production * 0.6 + Math.random() * 10) * 10) / 10,
        gridExport: Math.round((production * 0.3 + Math.random() * 5) * 10) / 10,
      });
    }
    
    return data;
  }, [timeRange]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const totalProduction = chartData.reduce((sum, d) => sum + d.production, 0);
    const totalExpected = chartData.reduce((sum, d) => sum + d.expected, 0);
    const totalConsumption = chartData.reduce((sum, d) => sum + d.consumption, 0);
    const totalExport = chartData.reduce((sum, d) => sum + d.gridExport, 0);
    const avgDaily = totalProduction / chartData.length;
    const performanceRatio = (totalProduction / totalExpected) * 100;
    
    return {
      totalProduction: Math.round(totalProduction),
      totalExpected: Math.round(totalExpected),
      totalConsumption: Math.round(totalConsumption),
      totalExport: Math.round(totalExport),
      avgDaily: Math.round(avgDaily * 10) / 10,
      performanceRatio: Math.round(performanceRatio),
      selfConsumption: Math.round((totalConsumption / totalProduction) * 100),
    };
  }, [chartData]);

  // Find max value for chart scaling
  const maxValue = Math.max(...chartData.map(d => Math.max(d.production, d.expected)));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5 text-yellow-500" />
              Energy Production
            </CardTitle>
            <CardDescription>
              Historical energy generation and consumption data
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-yellow-500/10 rounded-lg p-3">
            <div className="flex items-center gap-2 text-yellow-600 mb-1">
              <Sun className="h-4 w-4" />
              <span className="text-xs font-medium">Total Production</span>
            </div>
            <div className="text-2xl font-bold">{stats.totalProduction.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">kWh</div>
          </div>
          <div className="bg-blue-500/10 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Zap className="h-4 w-4" />
              <span className="text-xs font-medium">Self Consumption</span>
            </div>
            <div className="text-2xl font-bold">{stats.selfConsumption}%</div>
            <div className="text-xs text-muted-foreground">{stats.totalConsumption.toLocaleString()} kWh</div>
          </div>
          <div className="bg-green-500/10 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Grid Export</span>
            </div>
            <div className="text-2xl font-bold">{stats.totalExport.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">kWh</div>
          </div>
          <div className="bg-purple-500/10 rounded-lg p-3">
            <div className="flex items-center gap-2 text-purple-600 mb-1">
              <Battery className="h-4 w-4" />
              <span className="text-xs font-medium">Performance</span>
            </div>
            <div className="text-2xl font-bold flex items-center gap-1">
              {stats.performanceRatio}%
              {stats.performanceRatio >= 95 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
            <div className="text-xs text-muted-foreground">vs expected</div>
          </div>
        </div>

        {/* Chart */}
        <div className="relative" style={{ height }}>
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-muted-foreground">
            <span>{maxValue.toFixed(0)}</span>
            <span>{(maxValue * 0.75).toFixed(0)}</span>
            <span>{(maxValue * 0.5).toFixed(0)}</span>
            <span>{(maxValue * 0.25).toFixed(0)}</span>
            <span>0</span>
          </div>
          
          {/* Chart area */}
          <div className="ml-14 h-full flex items-end gap-[2px] pb-8">
            {chartData.map((d, i) => {
              const productionHeight = (d.production / maxValue) * 100;
              const expectedHeight = (d.expected / maxValue) * 100;
              
              return (
                <div 
                  key={d.date} 
                  className="flex-1 relative group"
                  style={{ minWidth: timeRange === "1y" ? "2px" : "8px" }}
                >
                  {/* Expected line marker */}
                  <div 
                    className="absolute w-full border-t-2 border-dashed border-gray-400/50"
                    style={{ bottom: `${expectedHeight}%` }}
                  />
                  
                  {/* Production bar */}
                  <div 
                    className="w-full bg-gradient-to-t from-yellow-500 to-yellow-400 rounded-t transition-all hover:from-yellow-600 hover:to-yellow-500"
                    style={{ height: `${productionHeight}%` }}
                  />
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                    <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg p-2 text-xs whitespace-nowrap">
                      <div className="font-medium mb-1">{new Date(d.date).toLocaleDateString()}</div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-yellow-500 rounded" />
                        <span>Production: {d.production} kWh</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-gray-400 rounded" />
                        <span>Expected: {d.expected} kWh</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* X-axis labels */}
          <div className="ml-14 flex justify-between text-xs text-muted-foreground">
            <span>{new Date(chartData[0]?.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            <span>{new Date(chartData[Math.floor(chartData.length / 2)]?.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            <span>{new Date(chartData[chartData.length - 1]?.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded" />
            <span>Actual Production</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 border-t-2 border-dashed border-gray-400" />
            <span>Expected</span>
          </div>
        </div>

        {/* Daily Average */}
        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-center">
          <span className="text-sm text-muted-foreground">Average Daily Production: </span>
          <span className="font-semibold">{stats.avgDaily} kWh/day</span>
        </div>
      </CardContent>
    </Card>
  );
}
