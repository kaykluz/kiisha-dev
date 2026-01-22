import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============ DATE UTILITIES ============

/**
 * Format a date value to a localized date string
 * Handles Date objects, ISO strings, and timestamps
 */
export function formatDate(date: Date | string | number | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return "Not set";
  
  const dateObj = date instanceof Date ? date : new Date(date);
  
  // Check for invalid date
  if (isNaN(dateObj.getTime())) return "Invalid date";
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  
  return dateObj.toLocaleDateString(undefined, options || defaultOptions);
}

/**
 * Format a date with time
 */
export function formatDateTime(date: Date | string | number | null | undefined): string {
  if (!date) return "Not set";
  
  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) return "Invalid date";
  
  return dateObj.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get relative time description (e.g., "2 days ago", "in 3 days")
 */
export function getRelativeTime(date: Date | string | number | null | undefined): string {
  if (!date) return "";
  
  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) return "";
  
  const now = new Date();
  const diffMs = dateObj.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 0) return `In ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}

/**
 * Check if a date is overdue (past today)
 */
export function isOverdue(date: Date | string | number | null | undefined): boolean {
  if (!date) return false;
  
  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return dateObj < today;
}

/**
 * Check if a date is approaching (within specified days)
 */
export function isApproaching(date: Date | string | number | null | undefined, withinDays: number = 7): boolean {
  if (!date) return false;
  
  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + withinDays);
  
  return dateObj >= today && dateObj <= futureDate;
}

/**
 * Get due date status for visual indicators
 */
export type DueDateStatus = 'overdue' | 'approaching' | 'normal' | 'none';

export function getDueDateStatus(date: Date | string | number | null | undefined, approachingDays: number = 7): DueDateStatus {
  if (!date) return 'none';
  
  if (isOverdue(date)) return 'overdue';
  if (isApproaching(date, approachingDays)) return 'approaching';
  return 'normal';
}

/**
 * Format date for input[type="date"] value (YYYY-MM-DD)
 */
export function formatDateForInput(date: Date | string | number | null | undefined): string {
  if (!date) return '';
  
  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) return '';
  
  return dateObj.toISOString().split('T')[0];
}

// ============ NUMBER UTILITIES ============

/**
 * Format a number as currency
 */
export function formatCurrency(value: number | null | undefined, currency: string = 'USD', compact: boolean = true): string {
  if (value === null || value === undefined) return '—';
  
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  };
  
  if (compact && Math.abs(value) >= 1000000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value);
  }
  
  return new Intl.NumberFormat('en-US', options).format(value);
}

/**
 * Format a decimal as percentage
 */
export function formatPercent(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined) return '—';
  
  // If value is already in percentage form (e.g., 14.2 instead of 0.142)
  const percentValue = value > 1 ? value : value * 100;
  
  return `${percentValue.toFixed(decimals)}%`;
}

/**
 * Format a large number with compact notation
 */
export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '—';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}


/**
 * Format a number with thousands separators
 */
export function formatNumber(value: number | null | undefined, decimals: number = 0): string {
  if (value === null || value === undefined) return '—';
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
