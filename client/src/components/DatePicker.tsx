import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { cn, formatDate, formatDateForInput } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  value: Date | string | number | null | undefined;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  disabled = false,
  className,
  clearable = true,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  
  // Convert value to Date object
  const dateValue = React.useMemo(() => {
    if (!value) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  }, [value]);

  const handleSelect = (date: Date | undefined) => {
    onChange(date || null);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !dateValue && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateValue ? format(dateValue, "PPP") : <span>{placeholder}</span>}
          {clearable && dateValue && (
            <X
              className="ml-auto h-4 w-4 opacity-50 hover:opacity-100"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// Inline date picker that shows current value and allows editing
interface InlineDatePickerProps {
  value: Date | string | number | null | undefined;
  onChange: (date: Date | null) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function InlineDatePicker({
  value,
  onChange,
  label,
  disabled = false,
  className,
}: InlineDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  
  // Convert value to Date object
  const dateValue = React.useMemo(() => {
    if (!value) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  }, [value]);

  const handleSelect = (date: Date | undefined) => {
    onChange(date || null);
    setOpen(false);
    setIsEditing(false);
  };

  if (disabled) {
    return (
      <span className={cn("text-sm text-[var(--color-text-secondary)]", className)}>
        {formatDate(value)}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]",
            "hover:text-[var(--color-text-primary)] transition-colors",
            "border-b border-dashed border-transparent hover:border-[var(--color-border-default)]",
            className
          )}
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          {dateValue ? format(dateValue, "PPP") : "Set date"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleSelect}
          initialFocus
        />
        {dateValue && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-[var(--color-error)]"
              onClick={() => handleSelect(undefined)}
            >
              Clear date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
