/**
 * Customer Portal Documents Page
 * 
 * Shows customer's documents like contracts, reports, and certificates.
 */

import { useState } from 'react';
import { usePortalReadOnly } from './PortalLayout';
import { trpc } from '@/lib/trpc';
import PortalLayout from './PortalLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Files, 
  Search, 
  Download, 
  Eye,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  Calendar,
  FolderOpen,
  Filter,
  Upload
} from 'lucide-react';
import { Link } from 'wouter';
import { format } from 'date-fns';

export default function PortalDocuments() {
  const { isReadOnly } = usePortalReadOnly();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  // Get customer documents
  const { data: documentsData, isLoading } = trpc.customerPortal.listMyDocuments.useQuery({
    limit: 100,
    offset: 0,
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
  });
  
  const documents = documentsData?.documents || [];
  
  // Filter documents by search term
  const filteredDocuments = documents.filter(doc => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      doc.name?.toLowerCase().includes(search) ||
      doc.category?.toLowerCase().includes(search) ||
      doc.description?.toLowerCase().includes(search)
    );
  });
  
  // Group documents by category
  const categories = [...new Set(documents.map(d => d.category).filter(Boolean))];
  
  // Calculate summary stats
  const totalDocuments = documents.length;
  const recentDocuments = documents.filter(d => {
    const docDate = new Date(d.createdAt);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return docDate >= thirtyDaysAgo;
  }).length;
  
  const getFileIcon = (filename: string, mimeType?: string) => {
    const ext = filename?.split('.').pop()?.toLowerCase();
    if (mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return <FileImage className="w-5 h-5 text-purple-400" />;
    }
    if (['xls', 'xlsx', 'csv'].includes(ext || '') || mimeType?.includes('spreadsheet')) {
      return <FileSpreadsheet className="w-5 h-5 text-green-400" />;
    }
    if (['pdf'].includes(ext || '') || mimeType === 'application/pdf') {
      return <FileText className="w-5 h-5 text-red-400" />;
    }
    if (['doc', 'docx'].includes(ext || '') || mimeType?.includes('word')) {
      return <FileText className="w-5 h-5 text-blue-400" />;
    }
    return <File className="w-5 h-5 text-slate-400" />;
  };
  
  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      'contract': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'invoice': 'bg-green-500/20 text-green-400 border-green-500/30',
      'report': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'certificate': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'warranty': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'manual': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    };
    return (
      <Badge className={colors[category?.toLowerCase()] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}>
        {category}
      </Badge>
    );
  };
  
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <PortalLayout activeTab="documents">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Documents</h1>
            <p className="text-slate-400 mt-1">Access your contracts, reports, and certificates</p>
          </div>
          {!isReadOnly && (
            <Link href="/portal/documents/upload">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            </Link>
          )}
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/20 rounded-lg">
                  <Files className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Total Documents</p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-white">{totalDocuments}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/20 rounded-lg">
                  <Calendar className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Recent (30 days)</p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-white">{recentDocuments}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/20 rounded-lg">
                  <FolderOpen className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Categories</p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-white">{categories.length}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-slate-800/50 border-slate-700 text-white">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat || ''}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Documents List */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Documents</CardTitle>
            <CardDescription className="text-slate-400">
              {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <Skeleton className="w-10 h-10 rounded-lg" />
                      <div>
                        <Skeleton className="h-5 w-48 mb-2" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                ))}
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-12">
                <Files className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-300 mb-2">No documents found</h3>
                <p className="text-slate-500">
                  {searchTerm || categoryFilter !== 'all' 
                    ? 'Try adjusting your search or filter' 
                    : 'Your documents will appear here'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDocuments.map((doc) => (
                  <div 
                    key={doc.id} 
                    className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg hover:bg-slate-900/70 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-slate-800 rounded-lg">
                        {getFileIcon(doc.name, doc.mimeType)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white">{doc.name}</p>
                          {doc.category && getCategoryBadge(doc.category)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-400 mt-1">
                          <span>{format(new Date(doc.createdAt), 'MMM d, yyyy')}</span>
                          <span>•</span>
                          <span>{formatFileSize(doc.size)}</span>
                          {doc.projectName && (
                            <>
                              <span>•</span>
                              <span>{doc.projectName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.previewUrl && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-slate-400 hover:text-white"
                          onClick={() => window.open(doc.previewUrl, '_blank')}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      {doc.downloadUrl && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-slate-400 hover:text-white"
                          onClick={() => window.open(doc.downloadUrl, '_blank')}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
