"use client";

import { Search, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({
  onSearch,
  placeholder = "Search messages...",
  className = "",
}: SearchBarProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  const handleClear = () => {
    setQuery("");
    onSearch("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    // Debounced search - search as user types
    onSearch(newQuery);
  };

  return (
    <form className={`relative ${className}`} onSubmit={handleSubmit}>
      <div className="relative">
        <Search className="-translate-y-1/2 absolute top-1/2 h-4 w-4 text-muted-foreground" />
        <input
          className="h-9 w-full border-0 bg-transparent px-0 pr-2 pl-6 text-sm outline-none placeholder:text-muted-foreground"
          onChange={handleInputChange}
          placeholder={placeholder}
          type="text"
          value={query}
        />
        {query && (
          <Button
            className="-translate-y-1/2 absolute top-1/2 right-1 h-6 w-6 p-0 hover:bg-muted"
            onClick={handleClear}
            size="sm"
            type="button"
            variant="ghost"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </form>
  );
}
