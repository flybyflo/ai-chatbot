/**
 * Shared CSS classes for consistent styling across components
 */

export const triggerClass =
  "flex h-8 items-center gap-2 rounded-md border border-transparent bg-transparent px-2.5 text-foreground transition-colors duration-150 " +
  "hover:bg-foreground/10 hover:border-border/50 " + // outline on hover
  "data-[state=open]:bg-foreground/10 data-[state=open]:border-border/60 " + // outline when open
  "focus:outline-none focus-visible:ring-0";
