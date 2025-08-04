import { headers } from "next/headers";
import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { 
  getMCPServersByUserId, 
  createMCPServer, 
  updateMCPServer, 
  deleteMCPServer 
} from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

const createMCPServerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Valid URL is required'),
  authToken: z.string().optional(),
  description: z.string().optional(),
});

const updateMCPServerSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name is required').optional(),
  url: z.string().url('Valid URL is required').optional(),
  authToken: z.string().nullable().transform(val => val || undefined).optional(),
  description: z.string().nullable().transform(val => val || undefined).optional(),
  isEnabled: z.boolean().optional(),
});

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session?.user) {
      return new ChatSDKError('unauthorized:mcp_servers').toResponse();
    }

    const servers = await getMCPServersByUserId({ userId: session.user.id });
    
    return NextResponse.json({ servers });
  } catch (error) {
    console.error('Error fetching MCP servers:', error);
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError('internal:mcp_servers').toResponse();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session?.user) {
      return new ChatSDKError('unauthorized:mcp_servers').toResponse();
    }

    const json = await request.json();
    const validatedData = createMCPServerSchema.parse(json);

    const newServer = await createMCPServer({
      ...validatedData,
      userId: session.user.id,
    });

    return NextResponse.json({ server: newServer }, { status: 201 });
  } catch (error) {
    console.error('Error creating MCP server:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    
    return new ChatSDKError('internal:mcp_servers').toResponse();
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session?.user) {
      return new ChatSDKError('unauthorized:mcp_servers').toResponse();
    }

    const json = await request.json();
    const validatedData = updateMCPServerSchema.parse(json);

    const updatedServer = await updateMCPServer({
      ...validatedData,
      userId: session.user.id,
    });

    if (!updatedServer) {
      return new ChatSDKError('not_found:mcp_servers').toResponse();
    }

    return NextResponse.json({ server: updatedServer });
  } catch (error) {
    console.error('Error updating MCP server:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    
    return new ChatSDKError('internal:mcp_servers').toResponse();
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    
    if (!session?.user) {
      return new ChatSDKError('unauthorized:mcp_servers').toResponse();
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Server ID is required' },
        { status: 400 }
      );
    }

    const deletedServer = await deleteMCPServer({
      id,
      userId: session.user.id,
    });

    if (!deletedServer) {
      return new ChatSDKError('not_found:mcp_servers').toResponse();
    }

    return NextResponse.json({ server: deletedServer });
  } catch (error) {
    console.error('Error deleting MCP server:', error);
    
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    
    return new ChatSDKError('internal:mcp_servers').toResponse();
  }
}