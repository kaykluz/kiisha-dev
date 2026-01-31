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
} from "lucide-react";
import { cn } from "@/lib/utils";

// Mock data for search results
const mockDocuments = [
  { id: 1, name: "PPA Agreement - MA Gillette", project: "MA - Gillette BTM", type: "contract", status: "verified" },
  { id: 2, name: "Interconnection Agreement", project: "TX - Austin Solar", type: "permit", status: "pending" },
  { id: 3, name: "Site Lease Agreement", project: "CA - Fresno Community", type: "contract", status: "verified" },
  { id: 4, name: "Environmental Impact Assessment", project: "NY - Buffalo Wind", type: "report", status: "missing" },
];

const mockProjects = [
  { id: 1, name: "MA - Gillette BTM", location: "Massachusetts", capacity: "12.5 MW", stage: "Development" },
  { id: 2, name: "TX - Austin Solar Farm", location: "Texas", capacity: "25 MW", stage: "Construction" },
  { id: 3, name: "CA - Fresno Community Solar", location: "California", capacity: "8 MW", stage: "Operations" },
];

const mockWorkspaceItems = [
  { id: 1, title: "Missing interconnection study", project: "MA - Gillette BTM", type: "RFI", status: "Open" },
  { id: 2, title: "Update site control documentation", project: "TX - Austin Solar", type: "Task", status: "In Progress" },
  { id: 3, title: "Permit expiration warning", project: "CA - Fresno Community", type: "Risk", status: "Open" },
];

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
  const [recentSearches, setRecentSearches] = useState<string[]>([
    "PPA Agreement",
    "MA - Gillette",
    "interconnection",
  ]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Search function
  const performSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const lowerQuery = searchQuery.toLowerCase();
    const searchResults: SearchResult[] = [];

    // Search documents
    mockDocuments
      .filter(
        (doc) =>
          doc.name.toLowerCase().includes(lowerQuery) ||
          doc.project.toLowerCase().includes(lowerQuery)
      )
      .forEach((doc) => {
        searchResults.push({
          id: doc.id,
          type: "document",
          title: doc.name,
          subtitle: doc.project,
          status: doc.status,
          url: "/documents",
        });
      });

    // Search projects
    mockProjects
      .filter(
        (proj) =>
          proj.name.toLowerCase().includes(lowerQuery) ||
          proj.location.toLowerCase().includes(lowerQuery)
      )
      .forEach((proj) => {
        searchResults.push({
          id: proj.id + 100,
          type: "project",
          title: proj.name,
          subtitle: `${proj.location} • ${proj.capacity}`,
          status: proj.stage,
          url: "/",
        });
      });

    // Search workspace items
    mockWorkspaceItems
      .filter(
        (item) =>
          item.title.toLowerCase().includes(lowerQuery) ||
          item.project.toLowerCase().includes(lowerQuery)
      )
      .forEach((item) => {
        searchResults.push({
          id: item.id + 200,
          type: "workspace",
          title: item.title,
          subtitle: `${item.type} • ${item.project}`,
          status: item.status,
          url: "/workspace",
        });
      });

    setResults(searchResults);
    setSelectedIndex(0);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 150);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

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
                                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                                      {result.title}
                                    </p>
                                    <p className="text-xs text-[var(--color-text-tertiary)] truncate">
                                      {result.subtitle}
                                    </p>
                                  </div>
                                  {result.status && (
                                    <div
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: getStatusColor(result.status) }}
                                    />
                                  )}
                                  <ArrowRight className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <Search className="w-10 h-10 text-[var(--color-text-tertiary)] mx-auto mb-3" />
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        No results found for "{query}"
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                        Try a different search term
                      </p>
                    </div>
                  )
                ) : (
                  <div className="py-4">
                    {/* Recent Searches */}
                    {recentSearches.length > 0 && (
                      <div className="mb-4">
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

                    {/* Quick Actions */}
                    <div>
                      <div className="px-4 py-1.5 text-xs font-medium text-[var(--color-text-tertiary)] uppercase">
                        Quick Actions
                      </div>
                      <button
                        onClick={() => {
                          setLocation("/documents");
                          setIsOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-[var(--color-bg-surface-hover)] transition-colors"
                      >
                        <FileText className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                        <span className="text-sm text-[var(--color-text-secondary)]">
                          Browse all documents
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          setLocation("/workspace");
                          setIsOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-[var(--color-bg-surface-hover)] transition-colors"
                      >
                        <ClipboardList className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                        <span className="text-sm text-[var(--color-text-secondary)]">
                          View workspace items
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </ScrollArea>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-hover)]">
                <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">↑</kbd>
                      <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">↓</kbd>
                      to navigate
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">↵</kbd>
                      to select
                    </span>
                  </div>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">esc</kbd>
                    to close
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
