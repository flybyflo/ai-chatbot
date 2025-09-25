"use client";

import { format } from "date-fns";
import { FileText, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useSidebar } from "@/components/ui/sidebar";
import type { SearchResult } from "@/hooks/use-message-search";
import { cn } from "@/lib/utils";

interface SearchResultsProps {
  currentChatResults: SearchResult[];
  historyResults: SearchResult[];
  searchQuery: string;
  onResultClick?: () => void;
}

export function SearchResults({
  currentChatResults,
  historyResults,
  searchQuery,
  onResultClick,
}: SearchResultsProps) {
  const { setOpenMobile } = useSidebar();

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;

    const regex = new RegExp(
      `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi"
    );
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark
          className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-900"
          key={index}
        >
          {part}
        </mark>
      ) : (
        <span key={index}>{part}</span>
      )
    );
  };

  const handleClick = () => {
    setOpenMobile(false);
    onResultClick?.();
  };

  if (currentChatResults.length === 0 && historyResults.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        No messages found for "{searchQuery}"
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {currentChatResults.length > 0 && (
        <div>
          <div className="px-2 py-1 font-medium text-sidebar-foreground/50 text-xs">
            Current Chat ({currentChatResults.length})
          </div>
          <div className="space-y-1">
            {currentChatResults.map((result, index) => (
              <div
                className={cn(
                  "group flex cursor-pointer items-start gap-2 rounded-md p-2 text-sm hover:bg-sidebar-accent"
                )}
                key={`${result.messageId}-${index}`}
                onClick={handleClick}
              >
                <MessageCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-3 text-sidebar-foreground text-xs">
                    {highlightText(
                      result.messageContent.slice(0, 150) +
                        (result.messageContent.length > 150 ? "..." : ""),
                      searchQuery
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {historyResults.length > 0 && (
        <div>
          <div className="px-2 py-1 font-medium text-sidebar-foreground/50 text-xs">
            Chat History ({historyResults.length})
          </div>
          <div className="space-y-1">
            {historyResults.map((result) => (
              <Link
                className={cn(
                  "group block flex items-start gap-2 rounded-md p-2 text-sm hover:bg-sidebar-accent"
                )}
                href={`/chat/${result.chatId}`}
                key={result.chatId}
                onClick={handleClick}
              >
                <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-sidebar-foreground">
                    {highlightText(result.chatTitle, searchQuery)}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {format(result.createdAt, "MMM d, yyyy")}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
