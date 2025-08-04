'use client';

import { memo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface ProgressUpdate {
  progress?: number;
  total?: number;
  description?: string;
}

interface MCPToolResultProps {
  toolName: string;
  args: Record<string, any>;
  result?: any;
  state: 'call' | 'result';
  className?: string;
  serverName?: string;
  progress?: ProgressUpdate;
}

const MCPToolResult = memo(function MCPToolResult({
  toolName,
  args,
  result,
  state,
  className,
  serverName = 'unknown',
  progress,
}: MCPToolResultProps) {
  const [showResult, setShowResult] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Show result with a slight delay for better UX
  useEffect(() => {
    if (state === 'result') {
      const timer = setTimeout(() => setShowResult(true), 300);
      return () => clearTimeout(timer);
    }
  }, [state]);

  // Format parameters for display in heading
  const formatParameters = (args: Record<string, any>): string => {
    if (!args || Object.keys(args).length === 0) {
      return '()';
    }

    const paramStrings = Object.entries(args).map(([key, value]) => {
      if (typeof value === 'string') {
        return `${key}="${value}"`;
      } else if (typeof value === 'object') {
        return `${key}=${JSON.stringify(value)}`;
      } else {
        return `${key}=${value}`;
      }
    });

    return `(${paramStrings.join(', ')})`;
  };

  // Create the new heading format
  const headingText = `mcp::${serverName || 'unknown'}::${toolName}${formatParameters(args)}`;

  // Extract display result for inline preview
  const getDisplayResult = () => {
    if (typeof result === 'string') {
      return result.length > 50 ? `${result.substring(0, 50)}...` : result;
    }
    if (typeof result === 'object' && result !== null) {
      if (result.content && Array.isArray(result.content)) {
        const textContent = result.content
          .filter((item: any) => item.type === 'text')
          .map((item: any) => item.text)
          .join(' ');
        return textContent || 'No result';
      }
      if (result.structuredContent?.result !== undefined) {
        const structuredResult = result.structuredContent.result;
        return typeof structuredResult === 'string'
          ? structuredResult.substring(0, 50) +
              (structuredResult.length > 50 ? '...' : '')
          : String(structuredResult);
      }
      if (result.isError) {
        return `Error: ${result.content?.[0]?.text || 'Unknown error'}`;
      }
      // Try to extract any text content from the object
      const stringValue = String(result);
      if (stringValue !== '[object Object]') {
        return stringValue.length > 50
          ? `${stringValue.substring(0, 50)}...`
          : stringValue;
      }
      return 'Object result (click to expand)';
    }
    return result ? String(result) : 'No result';
  };

  // Check if result is an error
  const isError = result && typeof result === 'object' && result.isError;

  return (
    <motion.div
      className={cn(
        'rounded-lg border border-input bg-transparent my-2',
        'cursor-pointer hover:bg-muted/20 transition-colors',
        className,
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={() => state === 'result' && setIsExpanded(!isExpanded)}
    >
      {/* Compact Tool Call Header */}
      <div className="px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <code className="text-xs font-mono text-foreground bg-muted/40 px-2 py-1 rounded border border-input">
              {headingText}
            </code>
            {state === 'call' && !progress && (
              <motion.div
                className="size-3 border-2 border-current border-t-transparent rounded-full text-muted-foreground"
                animate={{ rotate: 360 }}
                transition={{
                  duration: 1,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: 'linear',
                }}
              />
            )}
            {state === 'call' && progress && (
              <div className="flex items-center gap-2">
                {progress.total !== undefined && progress.progress !== undefined && (
                  <>
                    <Progress 
                      value={(progress.progress / progress.total) * 100} 
                      className="h-2 w-20"
                    />
                    <span className="text-xs text-muted-foreground font-mono">
                      {Math.round((progress.progress / progress.total) * 100)}%
                    </span>
                  </>
                )}
                {progress.total === undefined && progress.progress !== undefined && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {progress.progress} items
                  </span>
                )}
              </div>
            )}
          </div>
          {state === 'result' && showResult && (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'text-xs font-mono truncate max-w-32',
                  isError
                    ? 'text-red-700 dark:text-red-400'
                    : 'text-green-700 dark:text-green-400',
                )}
              >
                {getDisplayResult()}
              </span>
              <motion.div
                className="text-muted-foreground"
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <svg
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </motion.div>
            </div>
          )}
        </div>
      </div>


      {/* Expanded Result Section - Only show when clicked and expanded */}
      <AnimatePresence>
        {state === 'result' && showResult && isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="border-t border-border/20"
          >
            <div className="px-3 py-2 space-y-3">
              {/* Raw Input Section */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="size-2 rounded-full bg-blue-500" />
                  <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                    Raw Input
                  </h4>
                </div>
                <motion.div
                  className="bg-muted/30 rounded-md p-3 border border-input"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                >
                  <pre className="text-xs overflow-x-auto text-foreground font-mono">
                    {JSON.stringify(args, null, 2)}
                  </pre>
                </motion.div>
              </div>

              {/* Raw Output Section */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={cn(
                      'size-2 rounded-full',
                      isError ? 'bg-red-500' : 'bg-green-500',
                    )}
                  />
                  <h4
                    className={cn(
                      'text-xs font-semibold',
                      isError
                        ? 'text-red-700 dark:text-red-400'
                        : 'text-green-700 dark:text-green-400',
                    )}
                  >
                    Raw Output
                  </h4>
                </div>
                <motion.div
                  className="bg-muted/30 rounded-md p-3 border border-input"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                >
                  <pre className="text-xs overflow-x-auto text-foreground font-mono">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export { MCPToolResult };
