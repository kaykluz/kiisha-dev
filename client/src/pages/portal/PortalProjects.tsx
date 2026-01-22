/**
 * Customer Portal Projects Page
 * 
 * Shows customer's solar projects and their details.
 */

import { useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import PortalLayout from './PortalLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { 
  FolderOpen, 
  Search, 
  MapPin,
  Sun,
  Zap,
  Calendar,
  ArrowRight,
  CheckCircle,
  Clock,
  AlertCircle,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';

export default function PortalProjects() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Get customer projects
  const { data: projectsData, isLoading } = trpc.customerPortal.listMyProjects.useQuery({
    limit: 50,
    offset: 0,
  });
  
  const projects = projectsData?.projects || [];
  
  // Filter projects by search term
  const filteredProjects = projects.filter(project => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      project.name?.toLowerCase().includes(search) ||
      project.location?.toLowerCase().includes(search) ||
      project.systemType?.toLowerCase().includes(search)
    );
  });
  
  // Calculate summary stats
  const totalCapacity = projects.reduce((sum, p) => sum + (p.capacity || 0), 0);
  const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'operational').length;
  
  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'operational':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" /> Operational</Badge>;
      case 'construction':
      case 'in_progress':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Clock className="w-3 h-3 mr-1" /> In Progress</Badge>;
      case 'maintenance':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><AlertCircle className="w-3 h-3 mr-1" /> Maintenance</Badge>;
      case 'offline':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Offline</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <PortalLayout activeTab="projects">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">My Projects</h1>
            <p className="text-slate-400 mt-1">View and monitor your solar installations</p>
          </div>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-500/20 rounded-lg">
                  <FolderOpen className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Total Projects</p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-white">{projects.length}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/20 rounded-lg">
                  <Activity className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Active Projects</p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-white">{activeProjects}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-500/20 rounded-lg">
                  <Zap className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Total Capacity</p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-24 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-white">
                      {totalCapacity >= 1000 
                        ? `${(totalCapacity / 1000).toFixed(1)} MW` 
                        : `${totalCapacity.toFixed(0)} kW`}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search by project name, location, or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>
        
        {/* Projects Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="bg-slate-800/50 border-slate-700">
                <CardContent className="pt-6">
                  <Skeleton className="h-6 w-3/4 mb-4" />
                  <Skeleton className="h-4 w-1/2 mb-2" />
                  <Skeleton className="h-4 w-2/3 mb-4" />
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="py-12">
              <div className="text-center">
                <FolderOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-300 mb-2">No projects found</h3>
                <p className="text-slate-500">
                  {searchTerm ? 'Try adjusting your search terms' : 'Your projects will appear here once assigned'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProjects.map((project) => (
              <Card 
                key={project.id} 
                className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors cursor-pointer"
                onClick={() => setLocation(`/portal/projects/${project.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-white text-lg">{project.name}</CardTitle>
                      <CardDescription className="text-slate-400 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" />
                        {project.location || 'Location not specified'}
                      </CardDescription>
                    </div>
                    {getStatusBadge(project.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Project Details */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Sun className="w-4 h-4" />
                        <span>{project.systemType || 'Solar PV'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Zap className="w-4 h-4" />
                        <span>
                          {project.capacity 
                            ? project.capacity >= 1000 
                              ? `${(project.capacity / 1000).toFixed(1)} MW` 
                              : `${project.capacity} kW`
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Performance indicator if available */}
                    {project.performanceRatio && (
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-slate-400">Performance Ratio</span>
                          <span className="text-white font-medium">{project.performanceRatio}%</span>
                        </div>
                        <Progress 
                          value={project.performanceRatio} 
                          className="h-2 bg-slate-700"
                        />
                      </div>
                    )}
                    
                    {/* Commission date */}
                    {project.commissionDate && (
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Calendar className="w-4 h-4" />
                        <span>Commissioned: {format(new Date(project.commissionDate), 'MMM d, yyyy')}</span>
                      </div>
                    )}
                    
                    {/* View Details Button */}
                    <Button 
                      variant="ghost" 
                      className="w-full text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                    >
                      View Details
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
