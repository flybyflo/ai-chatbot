'use client';

export function AdvancedOptions() {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <h4 className="font-medium text-foreground text-xs">Developer</h4>
        <div className="space-y-1">
          <button
            type="button"
            className="w-full text-left p-1.5 hover:bg-background/50 rounded text-xs"
          >
            API Keys
          </button>
          <button
            type="button"
            className="w-full text-left p-1.5 hover:bg-background/50 rounded text-xs"
          >
            Debug Mode
          </button>
          <button
            type="button"
            className="w-full text-left p-1.5 hover:bg-background/50 rounded text-xs"
          >
            Export Data
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <h4 className="font-medium text-foreground text-xs">Experimental</h4>
        <div className="space-y-1">
          <button
            type="button"
            className="w-full text-left p-1.5 hover:bg-background/50 rounded text-xs"
          >
            Beta Features
          </button>
          <button
            type="button"
            className="w-full text-left p-1.5 hover:bg-background/50 rounded text-xs"
          >
            Labs
          </button>
        </div>
      </div>
    </div>
  );
}