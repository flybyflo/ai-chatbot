'use client';

export function GeneralSettings() {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <h4 className="font-medium text-foreground text-xs">Interface</h4>
        <div className="space-y-1">
          <button
            type="button"
            className="w-full text-left p-1.5 hover:bg-background/50 rounded text-xs"
          >
            Theme
          </button>
          <button
            type="button"
            className="w-full text-left p-1.5 hover:bg-background/50 rounded text-xs"
          >
            Font Size
          </button>
          <button
            type="button"
            className="w-full text-left p-1.5 hover:bg-background/50 rounded text-xs"
          >
            Auto-scroll
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <h4 className="font-medium text-foreground text-xs">Privacy</h4>
        <div className="space-y-1">
          <button
            type="button"
            className="w-full text-left p-1.5 hover:bg-background/50 rounded text-xs"
          >
            Data Collection
          </button>
          <button
            type="button"
            className="w-full text-left p-1.5 hover:bg-background/50 rounded text-xs"
          >
            Chat History
          </button>
        </div>
      </div>
    </div>
  );
}