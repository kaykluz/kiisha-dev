import { useState } from 'react';
import { 
  Building, User, MapPin, FileText, Link2, Plus, Search,
  CheckCircle, AlertCircle, ChevronRight, X, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface EntityMention {
  id: number;
  entityId?: number;
  fileId: number;
  mentionText: string;
  mentionType: string;
  sourcePage?: number;
  contextSnippet?: string;
  confidenceScore?: string;
  resolutionStatus: string;
}

interface Entity {
  id: number;
  entityType: string;
  canonicalName: string;
  attributes?: Record<string, unknown> | null;
}

interface EntityResolutionPanelProps {
  mention: EntityMention;
  onResolved?: () => void;
  onClose?: () => void;
}

const ENTITY_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  site: MapPin,
  company: Building,
  person: User,
  equipment: FileText,
  contract: FileText,
  permit: FileText,
};

const ENTITY_TYPES = [
  { value: 'site', label: 'Site' },
  { value: 'company', label: 'Company' },
  { value: 'person', label: 'Person' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'contract', label: 'Contract' },
  { value: 'permit', label: 'Permit' },
];

export function EntityResolutionPanel({ mention, onResolved, onClose }: EntityResolutionPanelProps) {
  const [searchTerm, setSearchTerm] = useState(mention.mentionText);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newEntityType, setNewEntityType] = useState<string>('company');
  const [newEntityName, setNewEntityName] = useState(mention.mentionText);
  
  const searchQuery = trpc.entities.search.useQuery(
    { searchTerm, organizationId: 1 },
    { enabled: searchTerm.length > 1 }
  );
  
  const resolveMutation = trpc.entities.resolveMention.useMutation({
    onSuccess: () => {
      toast.success('Entity linked successfully');
      onResolved?.();
    },
    onError: () => {
      toast.error('Failed to link entity');
    },
  });
  
  const createMutation = trpc.entities.create.useMutation({
    onSuccess: () => {
      toast.success('Entity created and linked');
      onResolved?.();
    },
    onError: () => {
      toast.error('Failed to create entity');
    },
  });
  
  const handleResolve = () => {
    if (selectedEntity) {
      resolveMutation.mutate({
        mentionId: mention.id,
        entityId: selectedEntity.id,
      });
    }
  };
  
  const handleCreateNew = () => {
    createMutation.mutate({
      entityType: newEntityType as any,
      canonicalName: newEntityName,
      organizationId: 1,
    });
  };
  
  return (
    <div className="w-96 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Resolve Entity</h3>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Link this mention to an existing entity or create a new one
        </p>
      </div>
      
      {/* Mention Info */}
      <div className="p-4 border-b border-border bg-accent/5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-accent/10">
            <AlertCircle className="h-5 w-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">"{mention.mentionText}"</p>
            <p className="text-xs text-muted-foreground mt-1">
              Found on page {mention.sourcePage || '?'} • {mention.mentionType}
            </p>
            {mention.contextSnippet && (
              <p className="text-xs text-muted-foreground mt-2 italic line-clamp-2">
                "...{mention.contextSnippet}..."
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search existing entities..."
            className="pl-9"
          />
        </div>
      </div>
      
      {/* Results */}
      <ScrollArea className="h-48">
        <div className="p-2">
          {searchQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : searchQuery.data && searchQuery.data.length > 0 ? (
            <div className="space-y-1">
              {searchQuery.data.map((entity: Entity) => {
                const Icon = ENTITY_TYPE_ICONS[entity.entityType] || FileText;
                const isSelected = selectedEntity?.id === entity.id;
                return (
                  <button
                    key={entity.id}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                      isSelected 
                        ? 'bg-accent/20 border border-accent' 
                        : 'hover:bg-muted border border-transparent'
                    }`}
                    onClick={() => setSelectedEntity(entity)}
                  >
                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-accent/20' : 'bg-muted'}`}>
                      <Icon className={`h-4 w-4 ${isSelected ? 'text-accent' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{entity.canonicalName}</p>
                      <p className="text-xs text-muted-foreground capitalize">{entity.entityType}</p>
                    </div>
                    {isSelected && (
                      <CheckCircle className="h-5 w-5 text-accent" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No matching entities found</p>
              <Button 
                variant="link" 
                className="mt-2"
                onClick={() => setShowCreateNew(true)}
              >
                Create new entity
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
      
      {/* Create New Section */}
      {showCreateNew && (
        <div className="p-4 border-t border-border bg-muted/20">
          <h4 className="text-sm font-medium text-foreground mb-3">Create New Entity</h4>
          <div className="space-y-3">
            <Select value={newEntityType} onValueChange={setNewEntityType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={newEntityName}
              onChange={(e) => setNewEntityName(e.target.value)}
              placeholder="Entity name"
            />
            <Button 
              className="w-full" 
              onClick={handleCreateNew}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create & Link
            </Button>
          </div>
        </div>
      )}
      
      {/* Footer */}
      <div className="p-4 border-t border-border flex items-center justify-between">
        {!showCreateNew && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowCreateNew(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Create New
          </Button>
        )}
        {showCreateNew && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowCreateNew(false)}
          >
            Cancel
          </Button>
        )}
        <Button 
          size="sm"
          disabled={!selectedEntity || resolveMutation.isPending}
          onClick={handleResolve}
        >
          {resolveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4 mr-2" />
          )}
          Link to Entity
        </Button>
      </div>
    </div>
  );
}

// Compact version for inline use
export function EntityBadge({ entity }: { entity: Entity }) {
  const Icon = ENTITY_TYPE_ICONS[entity.entityType] || FileText;
  
  return (
    <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-muted">
      <Icon className="h-3 w-3" />
      {entity.canonicalName}
    </Badge>
  );
}

// Source traceability display
interface SourceTraceProps {
  documentName: string;
  page?: number;
  snippet?: string;
  onClick?: () => void;
}

export function SourceTrace({ documentName, page, snippet, onClick }: SourceTraceProps) {
  return (
    <button
      className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
      onClick={onClick}
    >
      <FileText className="h-3 w-3" />
      <span>
        {documentName}
        {page && `, Page ${page}`}
      </span>
      <ChevronRight className="h-3 w-3" />
    </button>
  );
}
