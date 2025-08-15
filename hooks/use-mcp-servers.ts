import { useState, useEffect, useCallback, } from 'react';

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface MCPServer {
  id: string;
  name: string;
  url: string;
  authToken?: string;
  description?: string;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MCPServerWithStatus extends MCPServer {
  status?: 'connected' | 'disabled' | 'error' | 'loading' | 'auth_required';
  tools?: MCPTool[];
  lastChecked?: Date;
  error?: string;
}

// Global cache to persist data across component mounts
let globalServersCache: MCPServerWithStatus[] | null = null;
let globalCacheTimestamp: number | null = null;
let globalLastFetchTimestamp: number | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for UI cache
const FETCH_THROTTLE = 10000; // 10 seconds minimum between fetches

export function useMCPServers() {
  const [servers, setServers] = useState<MCPServerWithStatus[]>(() => {
    // Always return cached data if available, regardless of TTL
    if (globalServersCache !== null) {
      return globalServersCache;
    }
    return [];
  });
  
  const [isInitialLoading, setIsInitialLoading] = useState(() => {
    // Only show initial loading if we have no cached data at all
    return globalServersCache === null;
  });
  
  const [error, setError] = useState<string | null>(null);
  const [loadingTools, setLoadingTools] = useState<Set<string>>(new Set());

  // Update global cache when servers change
  const updateGlobalCache = useCallback((newServers: MCPServerWithStatus[]) => {
    globalServersCache = newServers;
    globalCacheTimestamp = Date.now();
    setServers(newServers);
  }, []);

  // Fetch tools for a specific server
  const fetchServerTools = useCallback(async (serverId: string) => {
    setLoadingTools(prev => new Set(prev).add(serverId));
    
    try {
      const response = await fetch(`/api/mcp-servers/${serverId}/tools`);
      if (!response.ok) {
        throw new Error('Failed to fetch tools');
      }
      
      const data = await response.json();
      
      const updateServers = (prevServers: MCPServerWithStatus[]) => {
        return prevServers.map(server => {
          if (server.id === serverId) {
            const newStatus = data.status as 'connected' | 'disabled' | 'error' | 'auth_required';
            
            return {
              ...server,
              status: newStatus as MCPServerWithStatus['status'],
              tools: data.tools || [],
              lastChecked: data.lastChecked ? new Date(data.lastChecked) : undefined,
              error: data.error
            };
          }
          return server;
        });
      };
      
      setServers(updateServers);
      if (globalServersCache) {
        globalServersCache = updateServers(globalServersCache);
      }
      
      return data;
    } catch (err) {
      console.error(`Error fetching tools for server ${serverId}:`, err);
      
      const updateServers = (prevServers: MCPServerWithStatus[]) => {
        return prevServers.map(server => {
          if (server.id === serverId) {
            return {
              ...server,
              status: 'error' as const,
              error: err instanceof Error ? err.message : 'Failed to fetch tools'
            };
          }
          return server;
        });
      };
      
      setServers(updateServers);
      if (globalServersCache) {
        globalServersCache = updateServers(globalServersCache);
      }
      
      throw err;
    } finally {
      setLoadingTools(prev => {
        const newSet = new Set(prev);
        newSet.delete(serverId);
        return newSet;
      });
    }
  }, []);

  // Fetch saved MCP servers from database
  const fetchMCPServers = useCallback(async (force = false) => {
    // If we have cached data and not forcing, check if we should throttle fetches
    if (!force && globalServersCache !== null) {
      // Use cached data immediately
      setServers(globalServersCache);
      setIsInitialLoading(false);
      
      // Only fetch if enough time has passed since last fetch
      const now = Date.now();
      if (globalLastFetchTimestamp && (now - globalLastFetchTimestamp < FETCH_THROTTLE)) {
        return;
      }
      
      // Set optimistic loading status for enabled servers
      const optimisticServers = globalServersCache.map(server => ({
        ...server,
        status: server.isEnabled ? 'loading' as const : server.status
      }));
      setServers(optimisticServers);
      updateGlobalCache(optimisticServers);
      
      // Fetch tools in background to update status
      globalServersCache.forEach(server => {
        if (server.isEnabled) {
          fetchServerTools(server.id).catch(() => {
            // Error already handled in fetchServerTools
          });
        }
      });
      
      globalLastFetchTimestamp = now;
      return;
    }
    
    try {
      if (isInitialLoading) {
        setError(null);
      }
      
      const response = await fetch('/api/mcp-servers');
      if (!response.ok) {
        throw new Error(`Failed to fetch MCP servers: ${response.statusText}`);
      }
      
      const data = await response.json();
      const serversWithStatus: MCPServerWithStatus[] = (data.servers || []).map((server: MCPServer) => ({
        ...server,
        status: server.isEnabled ? 'loading' : 'disabled',
        tools: [],
        createdAt: new Date(server.createdAt),
        updatedAt: new Date(server.updatedAt)
      }));
      
      updateGlobalCache(serversWithStatus);
      globalLastFetchTimestamp = Date.now();
      
      // Fetch tools for enabled servers in background
      serversWithStatus.forEach(server => {
        if (server.isEnabled) {
          fetchServerTools(server.id).catch(() => {
            // Error already handled in fetchServerTools
          });
        }
      });
    } catch (err) {
      console.error('Error fetching MCP servers:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch MCP servers');
      updateGlobalCache([]);
    } finally {
      setIsInitialLoading(false);
    }
  }, [isInitialLoading, fetchServerTools, updateGlobalCache]);

  // Initial load with cache check
  useEffect(() => {
    fetchMCPServers();
  }, [fetchMCPServers]);

  // Refresh server status
  const refreshServerStatus = useCallback((serverId: string) => {
    const updateServers = (prevServers: MCPServerWithStatus[]) => {
      const server = prevServers.find(s => s.id === serverId);
      if (server?.isEnabled) {
        fetchServerTools(serverId).catch(() => {
          // Error already handled in fetchServerTools
        });
        return prevServers.map(s => 
          s.id === serverId ? { ...s, status: 'loading' as const } : s
        );
      }
      return prevServers;
    };
    
    setServers(updateServers);
    if (globalServersCache) {
      globalServersCache = updateServers(globalServersCache);
    }
  }, [fetchServerTools]);

  // Invalidate cache and refetch
  const invalidateCache = useCallback(() => {
    globalServersCache = null;
    globalCacheTimestamp = null;
    globalLastFetchTimestamp = null;
    fetchMCPServers(true);
  }, [fetchMCPServers]);

  // Force refresh with cache clear
  const forceRefresh = useCallback(() => {
    globalLastFetchTimestamp = null;
    fetchMCPServers(true);
  }, [fetchMCPServers]);

  // Get a specific server by ID
  const getServerById = useCallback((id: string) => {
    return servers.find(server => server.id === id) || 
           globalServersCache?.find(server => server.id === id) || 
           null;
  }, [servers]);

  return {
    servers,
    isInitialLoading,
    error,
    loadingTools,
    fetchServerTools,
    refreshServerStatus,
    refetch: invalidateCache,
    forceRefresh,
    getServerById
  };
}