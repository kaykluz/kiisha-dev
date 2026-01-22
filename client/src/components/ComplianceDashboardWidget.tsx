import { useState } from 'react';
import { 
  Shield, AlertTriangle, Clock, CheckCircle, Calendar,
  ChevronRight, FileText, Bell, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/lib/trpc';
import { format, differenceInDays, isPast } from 'date-fns';

interface ComplianceItem {
  id: number;
  itemType: string;
  itemName: string;
  dueDate?: string | Date | null;
  renewalDate?: string | Date | null;
  status: string | null;
  projectId?: number | null;
  notes?: string | null;
}

interface ComplianceAlert {
  id: number;
  alertType: string;
  triggeredAt: Date;
  status: string | null;
  complianceItemId: number;
}

interface ComplianceDashboardWidgetProps {
  organizationId?: number;
  onItemClick?: (item: ComplianceItem) => void;
  onAlertClick?: (alert: ComplianceAlert) => void;
}

const getStatusColor = (status: string | null) => {
  switch (status) {
    case 'active': return 'bg-success/20 text-success';
    case 'expiring_soon': return 'bg-warning/20 text-warning';
    case 'expired': return 'bg-destructive/20 text-destructive';
    case 'renewed': return 'bg-blue-500/20 text-blue-400';
    default: return 'bg-muted text-muted-foreground';
  }
};

const getAlertTypeIcon = (type: string) => {
  switch (type) {
    case 'expiring_soon': return Clock;
    case 'expired': return AlertTriangle;
    case 'missing_document': return FileText;
    case 'renewal_due': return Calendar;
    default: return Bell;
  }
};

const getDaysUntil = (date: string | Date | null | undefined) => {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  return differenceInDays(d, new Date());
};

export function ComplianceDashboardWidget({ 
  organizationId = 1, 
  onItemClick, 
  onAlertClick 
}: ComplianceDashboardWidgetProps) {
  const [activeTab, setActiveTab] = useState('upcoming');
  
  const expiringQuery = trpc.compliance.getExpiring.useQuery({ 
    organizationId, 
    daysAhead: 90 
  });
  
  const alertsQuery = trpc.compliance.getOpenAlerts.useQuery({ organizationId });
  
  const items = expiringQuery.data || [];
  const alerts = alertsQuery.data || [];
  
  // Group items by urgency
  const expired = items.filter(i => {
    const days = getDaysUntil(i.dueDate);
    return days !== null && days < 0;
  });
  
  const critical = items.filter(i => {
    const days = getDaysUntil(i.dueDate);
    return days !== null && days >= 0 && days <= 30;
  });
  
  const upcoming = items.filter(i => {
    const days = getDaysUntil(i.dueDate);
    return days !== null && days > 30 && days <= 90;
  });
  
  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-accent" />
            <h3 className="font-semibold text-foreground">Compliance Status</h3>
          </div>
          <div className="flex items-center gap-2">
            {expired.length > 0 && (
              <Badge className="bg-destructive/20 text-destructive">
                {expired.length} Expired
              </Badge>
            )}
            {critical.length > 0 && (
              <Badge className="bg-warning/20 text-warning">
                {critical.length} Critical
              </Badge>
            )}
          </div>
        </div>
      </div>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-px bg-border">
        <div className="p-3 bg-card text-center">
          <div className="text-2xl font-bold text-destructive">{expired.length}</div>
          <div className="text-xs text-muted-foreground">Expired</div>
        </div>
        <div className="p-3 bg-card text-center">
          <div className="text-2xl font-bold text-warning">{critical.length}</div>
          <div className="text-xs text-muted-foreground">30 Days</div>
        </div>
        <div className="p-3 bg-card text-center">
          <div className="text-2xl font-bold text-blue-400">{upcoming.length}</div>
          <div className="text-xs text-muted-foreground">60-90 Days</div>
        </div>
        <div className="p-3 bg-card text-center">
          <div className="text-2xl font-bold text-accent">{alerts.length}</div>
          <div className="text-xs text-muted-foreground">Alerts</div>
        </div>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="p-4">
        <TabsList className="w-full">
          <TabsTrigger value="upcoming" className="flex-1">Deadlines</TabsTrigger>
          <TabsTrigger value="alerts" className="flex-1">
            Alerts
            {alerts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-destructive/20 text-destructive">
                {alerts.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="upcoming" className="mt-4">
          <ScrollArea className="h-64">
            {items.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No upcoming deadlines</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Expired Items */}
                {expired.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-medium text-destructive uppercase tracking-wider mb-2">
                      Expired
                    </h4>
                    {expired.map(item => (
                      <ComplianceItemRow 
                        key={item.id} 
                        item={item} 
                        onClick={() => onItemClick?.(item)} 
                      />
                    ))}
                  </div>
                )}
                
                {/* Critical Items */}
                {critical.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-medium text-warning uppercase tracking-wider mb-2">
                      Next 30 Days
                    </h4>
                    {critical.map(item => (
                      <ComplianceItemRow 
                        key={item.id} 
                        item={item} 
                        onClick={() => onItemClick?.(item)} 
                      />
                    ))}
                  </div>
                )}
                
                {/* Upcoming Items */}
                {upcoming.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      60-90 Days
                    </h4>
                    {upcoming.map(item => (
                      <ComplianceItemRow 
                        key={item.id} 
                        item={item} 
                        onClick={() => onItemClick?.(item)} 
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="alerts" className="mt-4">
          <ScrollArea className="h-64">
            {alerts.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No open alerts</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert: ComplianceAlert) => (
                  <ComplianceAlertRow 
                    key={alert.id} 
                    alert={alert} 
                    onClick={() => onAlertClick?.(alert)} 
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ComplianceItemRow({ item, onClick }: { item: ComplianceItem; onClick?: () => void }) {
  const daysUntil = getDaysUntil(item.dueDate);
  const isExpired = daysUntil !== null && daysUntil < 0;
  const isCritical = daysUntil !== null && daysUntil >= 0 && daysUntil <= 30;
  
  return (
    <button
      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted text-left transition-colors"
      onClick={onClick}
    >
      <div className={`p-2 rounded-lg ${
        isExpired ? 'bg-destructive/10' : isCritical ? 'bg-warning/10' : 'bg-muted'
      }`}>
        {isExpired ? (
          <AlertTriangle className="h-4 w-4 text-destructive" />
        ) : isCritical ? (
          <Clock className="h-4 w-4 text-warning" />
        ) : (
          <Calendar className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{item.itemName}</p>
        <p className="text-xs text-muted-foreground capitalize">
          {item.itemType.replace('_', ' ')}
        </p>
      </div>
      
      <div className="text-right">
        <p className={`text-sm font-medium ${
          isExpired ? 'text-destructive' : isCritical ? 'text-warning' : 'text-foreground'
        }`}>
          {isExpired 
            ? `${Math.abs(daysUntil!)} days overdue`
            : daysUntil === 0 
              ? 'Due today'
              : `${daysUntil} days`
          }
        </p>
        {item.dueDate && (
          <p className="text-xs text-muted-foreground">
            {format(new Date(item.dueDate), 'MMM d, yyyy')}
          </p>
        )}
      </div>
      
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function ComplianceAlertRow({ alert, onClick }: { alert: ComplianceAlert; onClick?: () => void }) {
  const Icon = getAlertTypeIcon(alert.alertType);
  
  return (
    <button
      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted text-left transition-colors"
      onClick={onClick}
    >
      <div className="p-2 rounded-lg bg-destructive/10">
        <Icon className="h-4 w-4 text-destructive" />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground capitalize">
          {alert.alertType.replace('_', ' ')}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(alert.triggeredAt), 'MMM d, yyyy h:mm a')}
        </p>
      </div>
      
      <Badge className={getStatusColor(alert.status)}>
        {alert.status}
      </Badge>
      
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
