import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  FileText,
  FolderKanban,
  ClipboardList,
  Clock,
  ArrowRight,
  X,
  Command,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

interface SearchResult {
  id: number;
  type: "document" | "project" | "workspace";
  title: string;
  subtitle: string;
  status?: string;
  url: string;
}

export function GlobalSearch() {
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const saved = localStorage.getItem('recent-searches');
    return saved ? JSON.parse(saved) : [];
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch data from API
  const { data: documents = [] } = trpc.documents.list.useQuery({ projectId: undefined });
  const { data: projects = [] } = trpc.projects.list.useQuery();
  const { data: rfis = [] } = trpc.rfis.list.useQuery({ projectId: undefined });

  // Search function
  const performSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const lowerQuery = searchQuery.toLowerCase();
    const searchResults: SearchResult[] = [];

    // Search documents
    (documents as any[])
      .filter(
        (doc: any) =>
          doc.name?.toLowerCase().includes(lowerQuery) ||
          doc.projectName?.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 5)
      .forEach((doc: any) => {
        searchResults.push({
          id: doc.id,
          type: "document",
          title: doc.name,
          subtitle: doc.projectName || 'No project',
          status: doc.status,
          url: "/documents",
        });
      });

    // Search projects
    (projects as any[])
      .filter(
        (proj: any) =>
          proj.name?.toLowerCase().includes(lowerQuery) ||
          proj.location?.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 5)
      .forEach((proj: any) => {
        searchResults.push({
          id: proj.id + 100000,
          type: "project",
          title: proj.name,
          subtitle: `${proj.location || 'Unknown'} • ${proj.capacity || 'N/A'}`,
          status: proj.stage,
          url: "/dashboard",
        });
      });

    // Search workspace items (RFIs)
    (rfis as any[])
      .filter(
        (item: any) =>
          item.title?.toLowerCase().includes(lowerQuery) ||
          item.projectName?.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 5)
      .forEach((item: any) => {
        searchResults.push({
          id: item.id + 200000,
          type: "workspace",
          title: item.title,
          subtitle: `RFI • ${item.projectName || 'No project'}`,
          status: item.status,
          url: "/workspace",
        });
      });

    setResults(searchResults);
    setSelectedIndex(0);
  }, [documents, projects, rfis]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 150);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // Save recent searches to localStorage
  useEffect(() => {
    localStorage.setItem('recent-searches', JSON.stringify(recentSearches));
  }, [recentSearches]);

  // Keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to open
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      // Escape to close
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  const handleSelect = (result: SearchResult) => {
    // Add to recent searches
    if (!recentSearches.includes(query) && query.trim()) {
      setRecentSearches((prev) => [query, ...prev.slice(0, 4)]);
    }
    setLocation(result.url);
    setIsOpen(false);
    setQuery("");
  };

  const handleRecentSearch = (search: string) => {
    setQuery(search);
    inputRef.current?.focus();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "document":
        return <FileText className="w-4 h-4" />;
      case "project":
        return <FolderKanban className="w-4 h-4" />;
      case "workspace":
        return <ClipboardList className="w-4 h-4" />;
      default:
        return <Search className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "verified":
      case "operations":
      case "resolved":
        return "var(--color-semantic-success)";
      case "pending":
      case "in progress":
      case "development":
      case "construction":
        return "var(--color-semantic-warning)";
      case "missing":
      case "open":
        return "var(--color-semantic-error)";
      default:
        return "var(--color-text-tertiary)";
    }
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      {/* Search Trigger */}
      <button
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-surface-hover)] transition-colors w-64"
      >
        <Search className="w-4 h-4 text-[var(--color-text-tertiary)]" />
        <span className="text-sm text-[var(--color-text-tertiary)] flex-1 text-left">
          Search...
        </span>
        <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[var(--color-bg-surface-hover)] text-xs text-[var(--color-text-tertiary)]">
          <Command className="w-3 h-3" />K
        </kbd>
      </button>

      {/* Search Modal */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/50 z-40" />

          {/* Search Panel */}
          <div className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-xl z-50">
            <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-2xl overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-subtle)]">
                <Search className="w-5 h-5 text-[var(--color-text-tertiary)]" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search documents, projects, workspace items..."
                  className="border-0 shadow-none focus-visible:ring-0 px-0 text-base"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Results */}
              <ScrollArea className="max-h-96">
                {query ? (
                  results.length > 0 ? (
                    <div className="py-2">
                      {/* Group by type */}
                      {["document", "project", "workspace"].map((type) => {
                        const typeResults = results.filter((r) => r.type === type);
                        if (typeResults.length === 0) return null;

                        return (
                          <div key={type} className="mb-2">
                            <div className="px-4 py-1.5 text-xs font-medium text-[var(--color-text-tertiary)] uppercase">
                              {type === "workspace" ? "Workspace Items" : `${type}s`}
                            </div>
                            {typeResults.map((result, idx) => {
                              const globalIdx = results.indexOf(result);
                              return (
                                <button
                                  key={result.id}
                                  onClick={() => handleSelect(result)}
                                  className={cn(
                                    "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                                    globalIdx === selectedIndex
                                      ? "bg-[var(--color-bg-surface-hover)]"
                                      : "hover:bg-[var(--color-bg-surface-hover)]"
                                  )}
                                >
                                  <div className="text-[var(--color-text-tertiary)]">
                                    {getTypeIcon(result.type)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                                      {result.title}
                                    </div>
                                    <div className="text-xs text-[var(--color-text-tertiary)] truncate">
                                      {result.subtitle}
                                    </div>
                                  </div>
                                  {result.status && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs shrink-0"
                                      style={{ color: getStatusColor(result.status) }}
                                    >
                                      {result.status}
                                    </Badge>
                                  )}
                                  <ArrowRight className="w-4 h-4 text-[var(--color-text-tertiary)] shrink-0" />
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-[var(--color-text-tertiary)]">
                      <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No results found for "{query}"</p>
                    </div>
                  )
                ) : (
                  <div className="py-4">
                    {recentSearches.length > 0 && (
                      <div>
                        <div className="px-4 py-1.5 text-xs font-medium text-[var(--color-text-tertiary)] uppercase flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          Recent Searches
                        </div>
                        {recentSearches.map((search, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleRecentSearch(search)}
                            className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-[var(--color-bg-surface-hover)] transition-colors"
                          >
                            <Clock className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                            <span className="text-sm text-[var(--color-text-secondary)]">
                              {search}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {recentSearches.length === 0 && (
                      <div className="py-8 text-center text-[var(--color-text-tertiary)]">
                        <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Start typing to search</p>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-surface-hover)]">↑</kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-surface-hover)]">↓</kbd>
                    to navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-surface-hover)]">↵</kbd>
                    to select
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-surface-hover)]">esc</kbd>
                  to close
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
