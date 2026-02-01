import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  FileText,
  FolderOpen,
  CheckSquare,
  Upload,
  Plus,
  BarChart3,
  Settings,
  Home,
  FileStack,
  Briefcase,
  ClipboardCheck,
  Calendar,
  Activity,
  Users,
  Building2,
  Zap,
} from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
  CommandFooter,
} from '@/components/ui/command';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [, setLocation] = useLocation();

  const handleSelect = useCallback((action: () => void) => {
    action();
    onClose();
  }, [onClose]);

  return (
    <CommandDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <CommandInput placeholder="Search commands, pages, projects..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => handleSelect(() => setLocation('/categorize'))}>
            <Upload className="text-muted-foreground" />
            <span>Upload document</span>
            <CommandShortcut>⌘U</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => setLocation('/workspace'))}>
            <Plus className="text-muted-foreground" />
            <span>Create task</span>
            <CommandShortcut>⌘T</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => setLocation('/operations'))}>
            <BarChart3 className="text-muted-foreground" />
            <span>Generate report</span>
            <CommandShortcut>⌘R</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Recent">
          <CommandItem onSelect={() => handleSelect(() => setLocation('/'))}>
            <FolderOpen className="text-primary" />
            <div className="flex flex-col">
              <span>Lagos Industrial Park</span>
              <span className="text-[11px] text-muted-foreground">Solar PV • 2.5 MW</span>
            </div>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => setLocation('/documents'))}>
            <FileText className="text-blue-500" />
            <div className="flex flex-col">
              <span>PPA Amendment v3.pdf</span>
              <span className="text-[11px] text-muted-foreground">Uploaded 2 days ago</span>
            </div>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => setLocation('/workspace'))}>
            <CheckSquare className="text-amber-500" />
            <div className="flex flex-col">
              <span>RFI #127: Land deed signature</span>
              <span className="text-[11px] text-muted-foreground">Open • High priority</span>
            </div>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => handleSelect(() => setLocation('/'))}>
            <Home className="text-muted-foreground" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => setLocation('/documents'))}>
            <FileStack className="text-muted-foreground" />
            <span>Documents</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => setLocation('/workspace'))}>
            <Briefcase className="text-muted-foreground" />
            <span>Workspace</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => setLocation('/details'))}>
            <Building2 className="text-muted-foreground" />
            <span>Asset Details</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => setLocation('/checklist'))}>
            <ClipboardCheck className="text-muted-foreground" />
            <span>Closing Checklist</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => setLocation('/schedule'))}>
            <Calendar className="text-muted-foreground" />
            <span>Schedule</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => setLocation('/operations'))}>
            <Activity className="text-muted-foreground" />
            <span>Operations</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => setLocation('/diligence'))}>
            <Zap className="text-muted-foreground" />
            <span>Due Diligence</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Settings">
          <CommandItem onSelect={() => handleSelect(() => setLocation('/settings'))}>
            <Settings className="text-muted-foreground" />
            <span>Settings</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => setLocation('/settings/team'))}>
            <Users className="text-muted-foreground" />
            <span>Team Members</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
      <CommandFooter>
        <span className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↑↓</kbd>
          <span>navigate</span>
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↵</kbd>
          <span>select</span>
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">esc</kbd>
          <span>close</span>
        </span>
      </CommandFooter>
    </CommandDialog>
  );
}

// Hook to manage command palette state
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
}
