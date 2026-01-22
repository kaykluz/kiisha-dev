import { ReactNode, ComponentType } from 'react';
import { LucideProps } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  FileText,
  FolderOpen,
  CheckSquare,
  BarChart3,
  Upload,
  Search,
  Bell,
  Users,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

type EmptyStateType =
  | 'documents'
  | 'projects'
  | 'tasks'
  | 'reports'
  | 'search'
  | 'notifications'
  | 'users'
  | 'schedule'
  | 'alerts'
  | 'generic';

interface EmptyStateProps {
  type?: EmptyStateType;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  icon?: ReactNode | ComponentType<LucideProps>;
  action?: ReactNode;
}

const iconMap: Record<EmptyStateType, ReactNode> = {
  documents: <FileText className="w-12 h-12 stroke-1" />,
  projects: <FolderOpen className="w-12 h-12 stroke-1" />,
  tasks: <CheckSquare className="w-12 h-12 stroke-1" />,
  reports: <BarChart3 className="w-12 h-12 stroke-1" />,
  search: <Search className="w-12 h-12 stroke-1" />,
  notifications: <Bell className="w-12 h-12 stroke-1" />,
  users: <Users className="w-12 h-12 stroke-1" />,
  schedule: <Calendar className="w-12 h-12 stroke-1" />,
  alerts: <AlertTriangle className="w-12 h-12 stroke-1" />,
  generic: <FolderOpen className="w-12 h-12 stroke-1" />,
};

export function EmptyState({
  type = 'generic',
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  icon,
  action,
}: EmptyStateProps) {
  // Handle icon - it can be a ReactNode or a Lucide icon component
  let displayIcon: ReactNode;
  if (icon) {
    if (typeof icon === 'function') {
      const IconComponent = icon as ComponentType<LucideProps>;
      displayIcon = <IconComponent className="w-12 h-12 stroke-1" />;
    } else {
      displayIcon = icon;
    }
  } else {
    displayIcon = iconMap[type];
  }

  return (
    <div className="empty-state">
      <div className="empty-state-icon">{displayIcon}</div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {action}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="btn-primary">
          {actionLabel}
        </Button>
      )}
      {secondaryActionLabel && onSecondaryAction && (
        <button
          onClick={onSecondaryAction}
          className="mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {secondaryActionLabel} →
        </button>
      )}
    </div>
  );
}

// Pre-configured empty states for common scenarios
export function NoDocuments({ onUpload }: { onUpload?: () => void }) {
  return (
    <EmptyState
      type="documents"
      title="No documents yet"
      description="Upload your first document to start building your project data room."
      actionLabel="Upload document"
      onAction={onUpload}
    />
  );
}

export function NoProjects({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      type="projects"
      title="No projects yet"
      description="Create your first project to start tracking your renewable energy assets."
      actionLabel="Create project"
      onAction={onCreate}
    />
  );
}

export function NoTasks({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      type="tasks"
      title="No tasks yet"
      description="Create tasks to track RFIs, action items, and follow-ups for your projects."
      actionLabel="Create task"
      onAction={onCreate}
    />
  );
}

export function NoSearchResults({ query }: { query: string }) {
  return (
    <EmptyState
      type="search"
      title="No results found"
      description={`We couldn't find anything matching "${query}". Try adjusting your search terms.`}
    />
  );
}

export function NoNotifications() {
  return (
    <EmptyState
      type="notifications"
      title="All caught up"
      description="You have no new notifications. We'll let you know when something needs your attention."
    />
  );
}

export function NoAlerts() {
  return (
    <EmptyState
      type="alerts"
      title="No active alerts"
      description="All systems are operating normally. Alerts will appear here when issues are detected."
    />
  );
}

export function NoScheduleItems({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      type="schedule"
      title="No schedule items"
      description="Add milestones and deadlines to track your project timeline."
      actionLabel="Add milestone"
      onAction={onCreate}
    />
  );
}
