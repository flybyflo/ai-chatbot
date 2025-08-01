'use client';

export function ModelSettings() {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <h4 className="font-medium text-foreground text-xs">Parameters</h4>
        <div className="space-y-1">
          <button
            type="button"
            className="w-full text-left p-1.5 hover:bg-background/50 rounded text-xs"
          >
            Temperature
          </button>
          <button
            type="button"
            className="w-full text-left p-1.5 hover:bg-background/50 rounded text-xs"
          >
            Max Tokens
          </button>
          <button
            type="button"
            className="w-full text-left p-1.5 hover:bg-background/50 rounded text-xs"
          >
            Top P
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <h4 className="font-medium text-foreground text-xs">System</h4>
        <div className="space-y-1">
          <button
            type="button"
            className="w-full text-left p-1.5 hover:bg-background/50 rounded text-xs"
          >
            System Prompt
          </button>
          <button
            type="button"
            className="w-full text-left p-1.5 hover:bg-background/50 rounded text-xs"
          >
            Response Format
          </button>
        </div>
      </div>
    </div>
  );
}