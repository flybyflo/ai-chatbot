"use client";

import type { DataUIPart } from "ai";
import type React from "react";
import { createContext, useContext, useMemo, useState } from "react";
import type { CustomUIDataTypes } from "@/lib/types";
import type { MCPToolRegistry } from "@/lib/ai/mcp/types";

type DataStreamContextValue = {
  dataStream: DataUIPart<CustomUIDataTypes>[];
  setDataStream: React.Dispatch<
    React.SetStateAction<DataUIPart<CustomUIDataTypes>[]>
  >;
  mcpRegistry?: MCPToolRegistry;
};

const DataStreamContext = createContext<DataStreamContextValue | null>(null);

export function DataStreamProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dataStream, setDataStream] = useState<DataUIPart<CustomUIDataTypes>[]>(
    []
  );

  // Extract MCP registry from data stream
  const mcpRegistry = useMemo(() => {
    const mcpData = dataStream.find(part => part.type === "data-mcp-registry");
    return mcpData?.data as MCPToolRegistry | undefined;
  }, [dataStream]);

  const value = useMemo(() => ({
    dataStream,
    setDataStream,
    mcpRegistry
  }), [dataStream, mcpRegistry]);

  return (
    <DataStreamContext.Provider value={value}>
      {children}
    </DataStreamContext.Provider>
  );
}

export function useDataStream() {
  const context = useContext(DataStreamContext);
  if (!context) {
    throw new Error("useDataStream must be used within a DataStreamProvider");
  }
  return context;
}
