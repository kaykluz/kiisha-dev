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
  documents: <FileText className="w-12 h-12 stroke-[1.5]" />,
  projects: <FolderOpen className="w-12 h-12 stroke-[1.5]" />,
  tasks: <CheckSquare className="w-12 h-12 stroke-[1.5]" />,
  reports: <BarChart3 className="w-12 h-12 stroke-[1.5]" />,
  search: <Search className="w-12 h-12 stroke-[1.5]" />,
  notifications: <Bell className="w-12 h-12 stroke-[1.5]" />,
  users: <Users className="w-12 h-12 stroke-[1.5]" />,
  schedule: <Calendar className="w-12 h-12 stroke-[1.5]" />,
  alerts: <AlertTriangle className="w-12 h-12 stroke-[1.5]" />,
  generic: <FolderOpen className="w-12 h-12 stroke-[1.5]" />,
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
      displayIcon = <IconComponent className="w-12 h-12 stroke-[1.5]" />;
    } else {
      displayIcon = icon;
    }
  } else {
    displayIcon = iconMap[type];
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] flex items-center justify-center mb-6 text-[var(--color-text-tertiary)]">
        {displayIcon}
      </div>
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--color-text-secondary)] max-w-sm mb-6 leading-relaxed">{description}</p>
      {action}
      {actionLabel && onAction && (
        <Button 
          onClick={onAction} 
          className="bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-hover)] text-[var(--color-bg-base)] rounded-xl h-10 px-5"
        >
          {actionLabel}
        </Button>
      )}
      {secondaryActionLabel && onSecondaryAction && (
        <button
          onClick={onSecondaryAction}
          className="mt-4 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors duration-150"
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
