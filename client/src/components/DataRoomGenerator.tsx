import { useState } from 'react';
import { 
  FolderOpen, FileText, Plus, Link2, Copy, ExternalLink,
  CheckCircle, Loader2, Settings, Users, Calendar, Shield,
  Building2, Cpu, DollarSign, Briefcase, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface DataRoom {
  id: number;
  name: string;
  description?: string | null;
  accessType: string;
  accessToken?: string | null;
  status: string | null;
  expiresAt?: Date | null;
  createdAt: Date;
  viewCount?: number | null;
  downloadCount?: number | null;
}

interface DataRoomGeneratorProps {
  projectId?: number;
  vatrAssetId?: number;
  onCreated?: (dataRoom: DataRoom) => void;
}

const CATEGORIES = [
  { key: 'corporate', label: 'Corporate', icon: Building2, description: 'Company formation, org charts, ownership' },
  { key: 'technical', label: 'Technical', icon: Cpu, description: 'System specs, performance data, equipment' },
  { key: 'financial', label: 'Financial', icon: DollarSign, description: 'Financials, projections, contracts' },
  { key: 'legal', label: 'Legal', icon: Shield, description: 'Permits, licenses, agreements' },
  { key: 'commercial', label: 'Commercial', icon: Briefcase, description: 'PPAs, offtake, revenue' },
  { key: 'operational', label: 'Operational', icon: Activity, description: 'O&M, monitoring, reports' },
];

export function DataRoomGenerator({ projectId, vatrAssetId, onCreated }: DataRoomGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [accessType, setAccessType] = useState<'private' | 'link_only' | 'public'>('link_only');
  const [expiresIn, setExpiresIn] = useState<string>('30');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    CATEGORIES.map(c => c.key)
  );
  
  const createMutation = trpc.dataRooms.create.useMutation({
    onSuccess: (data) => {
      toast.success('Data room created successfully');
      setOpen(false);
      // Reset form
      setName('');
      setDescription('');
      setSelectedCategories(CATEGORIES.map(c => c.key));
    },
    onError: () => {
      toast.error('Failed to create data room');
    },
  });
  
  const generateFromVatrMutation = trpc.dataRooms.generateFromVatr.useMutation({
    onSuccess: (data) => {
      toast.success('Data room generated from VATR');
      setOpen(false);
    },
    onError: () => {
      toast.error('Failed to generate data room');
    },
  });
  
  const handleCreate = () => {
    const expiresAt = expiresIn !== 'never' 
      ? new Date(Date.now() + parseInt(expiresIn) * 24 * 60 * 60 * 1000).toISOString()
      : undefined;
    
    if (vatrAssetId) {
      generateFromVatrMutation.mutate({
        vatrAssetId,
        name,
        includeCategories: selectedCategories as any[],
      });
    } else {
      createMutation.mutate({
        projectId,
        name,
        description,
        accessType,
        expiresAt,
      });
    }
  };
  
  const toggleCategory = (key: string) => {
    setSelectedCategories(prev => 
      prev.includes(key) 
        ? prev.filter(c => c !== key)
        : [...prev, key]
    );
  };
  
  const isLoading = createMutation.isPending || generateFromVatrMutation.isPending;
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FolderOpen className="h-4 w-4" />
          Generate Data Room
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-accent" />
            Create Data Room
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Data Room Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q1 2026 Due Diligence Package"
            />
          </div>
          
          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the data room contents..."
              rows={2}
            />
          </div>
          
          {/* Access Type */}
          <div className="space-y-2">
            <Label>Access Type</Label>
            <Select value={accessType} onValueChange={(v: any) => setAccessType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <span>Private - Invited users only</span>
                  </div>
                </SelectItem>
                <SelectItem value="link_only">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    <span>Link Only - Anyone with link</span>
                  </div>
                </SelectItem>
                <SelectItem value="public">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>Public - Visible to all</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Expiration */}
          <div className="space-y-2">
            <Label>Link Expiration</Label>
            <Select value={expiresIn} onValueChange={setExpiresIn}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="365">1 year</SelectItem>
                <SelectItem value="never">Never expires</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Category Selection */}
          <div className="space-y-2">
            <Label>Include Categories</Label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(category => {
                const Icon = category.icon;
                const isSelected = selectedCategories.includes(category.key);
                return (
                  <button
                    key={category.key}
                    type="button"
                    className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                      isSelected 
                        ? 'border-accent bg-accent/10' 
                        : 'border-border hover:border-accent/50'
                    }`}
                    onClick={() => toggleCategory(category.key)}
                  >
                    <Checkbox checked={isSelected} />
                    <Icon className={`h-4 w-4 ${isSelected ? 'text-accent' : 'text-muted-foreground'}`} />
                    <span className="text-sm font-medium">{category.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name || isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FolderOpen className="h-4 w-4 mr-2" />
            )}
            Create Data Room
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Data Room Card for listing
interface DataRoomCardProps {
  dataRoom: DataRoom;
  onView?: () => void;
  onCopyLink?: () => void;
}

export function DataRoomCard({ dataRoom, onView, onCopyLink }: DataRoomCardProps) {
  const baseUrl = window.location.origin;
  const shareLink = `${baseUrl}/data-room/${dataRoom.accessToken}`;
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success('Link copied to clipboard');
    onCopyLink?.();
  };
  
  return (
    <div className="p-4 rounded-lg bg-card border border-border">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/10">
            <FolderOpen className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h4 className="font-medium text-foreground">{dataRoom.name}</h4>
            {dataRoom.description && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {dataRoom.description}
              </p>
            )}
          </div>
        </div>
        
        <Badge variant="outline" className="capitalize">
          {dataRoom.accessType?.replace('_', ' ')}
        </Badge>
      </div>
      
      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          Created {format(new Date(dataRoom.createdAt), 'MMM d, yyyy')}
        </span>
        {dataRoom.expiresAt && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Expires {format(new Date(dataRoom.expiresAt), 'MMM d, yyyy')}
          </span>
        )}
        {dataRoom.viewCount !== undefined && dataRoom.viewCount !== null && (
          <span>{dataRoom.viewCount} views</span>
        )}
      </div>
      
      <div className="flex items-center gap-2 mt-4">
        <Button variant="outline" size="sm" className="gap-1" onClick={handleCopyLink}>
          <Copy className="h-3 w-3" />
          Copy Link
        </Button>
        <Button variant="outline" size="sm" className="gap-1" onClick={onView}>
          <ExternalLink className="h-3 w-3" />
          View
        </Button>
      </div>
    </div>
  );
}
