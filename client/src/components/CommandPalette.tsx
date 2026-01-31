import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import {
  Search,
  FileText,
  FolderOpen,
  CheckSquare,
  Upload,
  Plus,
  BarChart3,
  Settings,
  X,
  ArrowRight,
} from 'lucide-react';

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  category: 'recent' | 'actions' | 'navigation';
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();

  // Define all commands
  const commands: CommandItem[] = [
    // Recent items
    {
      id: 'recent-1',
      title: 'Lagos Industrial Park',
      description: 'Solar PV • 2.5 MW',
      icon: <FolderOpen className="w-4 h-4" />,
      category: 'recent',
      action: () => { setLocation('/'); onClose(); },
    },
    {
      id: 'recent-2',
      title: 'PPA Amendment v3.pdf',
      description: 'Uploaded 2 days ago',
      icon: <FileText className="w-4 h-4" />,
      category: 'recent',
      action: () => { setLocation('/documents'); onClose(); },
    },
    {
      id: 'recent-3',
      title: 'RFI #127: Land deed signature',
      description: 'Open • High priority',
      icon: <CheckSquare className="w-4 h-4" />,
      category: 'recent',
      action: () => { setLocation('/workspace'); onClose(); },
    },
    // Actions
    {
      id: 'action-upload',
      title: 'Upload document',
      icon: <Upload className="w-4 h-4" />,
      shortcut: '⌘U',
      category: 'actions',
      action: () => { setLocation('/categorize'); onClose(); },
    },
    {
      id: 'action-task',
      title: 'Create task',
      icon: <Plus className="w-4 h-4" />,
      shortcut: '⌘T',
      category: 'actions',
      action: () => { setLocation('/workspace'); onClose(); },
    },
    {
      id: 'action-report',
      title: 'Generate report',
      icon: <BarChart3 className="w-4 h-4" />,
      shortcut: '⌘R',
      category: 'actions',
      action: () => { setLocation('/operations'); onClose(); },
    },
    // Navigation
    {
      id: 'nav-dashboard',
      title: 'Go to Dashboard',
      icon: <ArrowRight className="w-4 h-4" />,
      category: 'navigation',
      action: () => { setLocation('/'); onClose(); },
    },
    {
      id: 'nav-documents',
      title: 'Go to Documents',
      icon: <ArrowRight className="w-4 h-4" />,
      category: 'navigation',
      action: () => { setLocation('/documents'); onClose(); },
    },
    {
      id: 'nav-workspace',
      title: 'Go to Workspace',
      icon: <ArrowRight className="w-4 h-4" />,
      category: 'navigation',
      action: () => { setLocation('/workspace'); onClose(); },
    },
    {
      id: 'nav-details',
      title: 'Go to Asset Details',
      icon: <ArrowRight className="w-4 h-4" />,
      category: 'navigation',
      action: () => { setLocation('/details'); onClose(); },
    },
    {
      id: 'nav-schedule',
      title: 'Go to Schedule',
      icon: <ArrowRight className="w-4 h-4" />,
      category: 'navigation',
      action: () => { setLocation('/schedule'); onClose(); },
    },
    {
      id: 'nav-checklist',
      title: 'Go to Closing Checklist',
      icon: <ArrowRight className="w-4 h-4" />,
      category: 'navigation',
      action: () => { setLocation('/checklist'); onClose(); },
    },
    {
      id: 'nav-operations',
      title: 'Go to Operations',
      icon: <ArrowRight className="w-4 h-4" />,
      category: 'navigation',
      action: () => { setLocation('/operations'); onClose(); },
    },
    {
      id: 'nav-settings',
      title: 'Go to Settings',
      icon: <Settings className="w-4 h-4" />,
      category: 'navigation',
      action: () => { onClose(); },
    },
  ];

  // Filter commands based on query
  const filteredCommands = query
    ? commands.filter(
        (cmd) =>
          cmd.title.toLowerCase().includes(query.toLowerCase()) ||
          cmd.description?.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  // Group commands by category
  const groupedCommands = {
    recent: filteredCommands.filter((c) => c.category === 'recent'),
    actions: filteredCommands.filter((c) => c.category === 'actions'),
    navigation: filteredCommands.filter((c) => c.category === 'navigation'),
  };

  const flatCommands = [
    ...groupedCommands.recent,
    ...groupedCommands.actions,
    ...groupedCommands.navigation,
  ];

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < flatCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : flatCommands.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (flatCommands[selectedIndex]) {
            flatCommands[selectedIndex].action();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [isOpen, flatCommands, selectedIndex, onClose]
  );

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Add keyboard listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const renderSection = (
    title: string,
    items: CommandItem[],
    startIndex: number
  ) => {
    if (items.length === 0) return null;

    return (
      <div key={title}>
        <div className="command-palette-section">{title}</div>
        {items.map((item, idx) => {
          const globalIndex = startIndex + idx;
          return (
            <div
              key={item.id}
              className={`command-palette-item ${
                globalIndex === selectedIndex ? 'command-palette-item-active' : ''
              }`}
              onClick={item.action}
              onMouseEnter={() => setSelectedIndex(globalIndex)}
            >
              <span className="text-muted-foreground">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {item.title}
                </div>
                {item.description && (
                  <div className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </div>
                )}
              </div>
              {item.shortcut && (
                <span className="command-palette-shortcut">{item.shortcut}</span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  let currentIndex = 0;

  return (
    <div className="command-palette">
      <div className="command-palette-backdrop" onClick={onClose} />
      <div className="command-palette-content">
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Search for anything..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-secondary text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto py-2">
          {flatCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              No results found for "{query}"
            </div>
          ) : (
            <>
              {renderSection('Recent', groupedCommands.recent, currentIndex)}
              {(currentIndex += groupedCommands.recent.length, null)}
              {renderSection('Actions', groupedCommands.actions, currentIndex)}
              {(currentIndex += groupedCommands.actions.length, null)}
              {renderSection('Navigation', groupedCommands.navigation, currentIndex)}
            </>
          )}
        </div>
        <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground flex items-center gap-4">
          <span>
            <kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs">↑↓</kbd> to navigate
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs">↵</kbd> to select
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-secondary rounded text-xs">esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
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
