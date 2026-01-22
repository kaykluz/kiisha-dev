import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showOverlay?: boolean;
  footer?: ReactNode;
}

const sizeClasses = {
  sm: 'w-[400px]',
  md: 'w-[560px]',
  lg: 'w-[720px]',
  xl: 'w-[900px]',
};

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
  showOverlay = true,
  footer,
}: DrawerProps) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      {showOverlay && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer panel */}
      <div
        className={cn(
          'fixed right-0 top-0 h-full z-50 flex flex-col',
          'bg-[var(--color-bg-surface)] border-l border-[var(--color-border-subtle)]',
          'shadow-xl',
          sizeClasses[size],
          'animate-in slide-in-from-right duration-200'
        )}
      >
        {/* Header */}
        {(title || subtitle) && (
          <div className="drawer-header">
            <div className="flex-1 min-w-0">
              {title && <h2 className="drawer-title">{title}</h2>}
              {subtitle && <p className="drawer-subtitle">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-[var(--color-bg-surface-hover)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="drawer-content">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="mt-auto px-6 py-4 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}

// Drawer section component for organizing content
interface DrawerSectionProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function DrawerSection({ title, children, className }: DrawerSectionProps) {
  return (
    <div className={cn('py-4', className)}>
      {title && (
        <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)] mb-3">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

// Drawer footer for actions
interface DrawerFooterProps {
  children: ReactNode;
  className?: string;
}

export function DrawerFooter({ children, className }: DrawerFooterProps) {
  return (
    <div
      className={cn(
        'mt-auto px-6 py-4 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]',
        'flex items-center gap-3 justify-end',
        className
      )}
    >
      {children}
    </div>
  );
}

// Field display component for drawer content
interface DrawerFieldProps {
  label: string;
  value: ReactNode;
  className?: string;
}

export function DrawerField({ label, value, className }: DrawerFieldProps) {
  return (
    <div className={cn('py-2', className)}>
      <dt className="text-xs text-[var(--color-text-tertiary)] mb-1">{label}</dt>
      <dd className="text-sm text-[var(--color-text-primary)]">{value || '—'}</dd>
    </div>
  );
}

// Two-column field layout
export function DrawerFieldGrid({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-x-6">{children}</dl>;
}
