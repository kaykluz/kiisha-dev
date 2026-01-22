/**
 * Portal Production Monitoring Page
 * 
 * Displays energy production data with interactive charts.
 */

import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Activity, TrendingUp, Zap, Calendar, RefreshCw,
  ArrowUp, ArrowDown, Minus, BarChart3
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatValue(value: number, unit: string) {
  if (unit === '%') return `${value.toFixed(1)}%`;
  if (unit === 'kWh') return `${value.toLocaleString()} kWh`;
  return value.toString();
}

function getTrendIcon(trend: number) {
  if (trend > 0) return <ArrowUp className="h-4 w-4 text-green-500" />;
  if (trend < 0) return <ArrowDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export default function PortalProduction() {
  const [, navigate] = useLocation();
  const [period, setPeriod] = useState<'hour' | 'day' | 'week' | 'month'>('day');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  
  // Get token from localStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!token) {
      navigate('/portal/login');
    }
  }, [token, navigate]);
  
  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    switch (dateRange) {
      case '7d': start.setDate(end.getDate() - 7); break;
      case '30d': start.setDate(end.getDate() - 30); break;
      case '90d': start.setDate(end.getDate() - 90); break;
    }
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, [dateRange]);
  
  // Fetch production data
  const { data: productionData, isLoading: dataLoading, refetch: refetchData } = trpc.customerPortal.getProductionData.useQuery(
    { 
      token: token || '',
      period,
      startDate,
      endDate,
    },
    { enabled: !!token }
  );
  
  // Fetch production summary
  const { data: summaryData, isLoading: summaryLoading } = trpc.customerPortal.getProductionSummary.useQuery(
    { token: token || '' },
    { enabled: !!token }
  );
  
  // Fetch available metrics
  const { data: metricsData } = trpc.customerPortal.getAvailableMetrics.useQuery(
    { token: token || '' },
    { enabled: !!token }
  );
  
  // Process chart data
  const chartData = useMemo(() => {
    if (!productionData?.dataPoints) return null;
    
    // Group by timestamp
    const groupedByTime: Record<string, Record<string, number>> = {};
    
    for (const point of productionData.dataPoints) {
      const time = formatDate(point.timestamp);
      if (!groupedByTime[time]) {
        groupedByTime[time] = {};
      }
      groupedByTime[time][point.metricType] = point.value;
    }
    
    const labels = Object.keys(groupedByTime);
    
    return {
      labels,
      datasets: [
        {
          label: 'Energy Production (kWh)',
          data: labels.map(l => groupedByTime[l]?.energy_production || 0),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
          yAxisID: 'y',
        },
        {
          label: 'Performance Ratio (%)',
          data: labels.map(l => groupedByTime[l]?.performance_ratio || 0),
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: false,
          tension: 0.4,
          yAxisID: 'y1',
        },
      ],
    };
  }, [productionData]);
  
  // Bar chart for availability
  const availabilityChartData = useMemo(() => {
    if (!productionData?.dataPoints) return null;
    
    const groupedByTime: Record<string, number> = {};
    
    for (const point of productionData.dataPoints) {
      if (point.metricType === 'availability') {
        const time = formatDate(point.timestamp);
        groupedByTime[time] = point.value;
      }
    }
    
    const labels = Object.keys(groupedByTime);
    
    return {
      labels,
      datasets: [
        {
          label: 'Availability (%)',
          data: labels.map(l => groupedByTime[l] || 0),
          backgroundColor: labels.map(l => {
            const val = groupedByTime[l] || 0;
            if (val >= 98) return 'rgba(16, 185, 129, 0.8)';
            if (val >= 95) return 'rgba(234, 179, 8, 0.8)';
            return 'rgba(239, 68, 68, 0.8)';
          }),
          borderRadius: 4,
        },
      ],
    };
  }, [productionData]);
  
  if (!token) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Production Monitoring</h1>
                <p className="text-muted-foreground">Track your energy production and system performance</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => refetchData()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>
      
      <div className="container py-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          {summaryLoading ? (
            <>
              {[1, 2, 3, 4].map(i => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            <>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Production</p>
                      <p className="text-2xl font-bold">
                        {summaryData?.totalProduction?.toLocaleString() || 0} kWh
                      </p>
                    </div>
                    <Zap className="h-8 w-8 text-yellow-500" />
                  </div>
                  <div className="flex items-center mt-2 text-sm">
                    {getTrendIcon(5)}
                    <span className="text-green-500 ml-1">+5%</span>
                    <span className="text-muted-foreground ml-1">vs last month</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Performance Ratio</p>
                      <p className="text-2xl font-bold">
                        {summaryData?.averagePerformance?.toFixed(1) || 0}%
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-blue-500" />
                  </div>
                  <div className="flex items-center mt-2 text-sm">
                    {getTrendIcon(2)}
                    <span className="text-green-500 ml-1">+2%</span>
                    <span className="text-muted-foreground ml-1">vs last month</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Peak Output</p>
                      <p className="text-2xl font-bold">
                        {summaryData?.peakOutput?.toLocaleString() || 0} kW
                      </p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-purple-500" />
                  </div>
                  <div className="flex items-center mt-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-1" />
                    This month
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Availability</p>
                      <p className="text-2xl font-bold">
                        {summaryData?.availability?.toFixed(1) || 0}%
                      </p>
                    </div>
                    <Activity className="h-8 w-8 text-green-500" />
                  </div>
                  <div className="flex items-center mt-2 text-sm">
                    {getTrendIcon(0)}
                    <span className="text-muted-foreground ml-1">Stable</span>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Granularity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hour">Hourly</SelectItem>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Production & Performance Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Energy Production & Performance</CardTitle>
              <CardDescription>
                Daily energy output and performance ratio over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dataLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : chartData ? (
                <div className="h-[300px]">
                  <Line
                    data={chartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      interaction: {
                        mode: 'index',
                        intersect: false,
                      },
                      scales: {
                        y: {
                          type: 'linear',
                          display: true,
                          position: 'left',
                          title: {
                            display: true,
                            text: 'Energy (kWh)',
                          },
                        },
                        y1: {
                          type: 'linear',
                          display: true,
                          position: 'right',
                          min: 0,
                          max: 100,
                          title: {
                            display: true,
                            text: 'Performance (%)',
                          },
                          grid: {
                            drawOnChartArea: false,
                          },
                        },
                      },
                      plugins: {
                        legend: {
                          position: 'top',
                        },
                      },
                    }}
                  />
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Availability Chart */}
          <Card>
            <CardHeader>
              <CardTitle>System Availability</CardTitle>
              <CardDescription>
                Daily uptime percentage
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dataLoading ? (
                <Skeleton className="h-[250px] w-full" />
              ) : availabilityChartData ? (
                <div className="h-[250px]">
                  <Bar
                    data={availabilityChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          min: 90,
                          max: 100,
                          title: {
                            display: true,
                            text: 'Availability (%)',
                          },
                        },
                      },
                      plugins: {
                        legend: {
                          display: false,
                        },
                      },
                    }}
                  />
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Metrics Info */}
          <Card>
            <CardHeader>
              <CardTitle>Available Metrics</CardTitle>
              <CardDescription>
                Metrics tracked for your projects
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metricsData?.metrics?.map((metric: any) => (
                  <div key={metric.type} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{metric.label}</p>
                      <p className="text-sm text-muted-foreground">Unit: {metric.unit}</p>
                    </div>
                    <div className="text-right">
                      {metric.type === 'energy_production' && (
                        <Zap className="h-5 w-5 text-yellow-500" />
                      )}
                      {metric.type === 'performance_ratio' && (
                        <TrendingUp className="h-5 w-5 text-blue-500" />
                      )}
                      {metric.type === 'availability' && (
                        <Activity className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                  </div>
                )) || (
                  <p className="text-muted-foreground">Loading metrics...</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
