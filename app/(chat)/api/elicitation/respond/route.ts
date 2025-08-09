import { elicitationManager, type ElicitationResponse } from '@/lib/elicitation-manager';
import { z } from 'zod';

const responseSchema = z.object({
  elicitationToken: z.string(),
  action: z.enum(['accept', 'decline', 'cancel']),
  data: z.any().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { elicitationToken, action, data } = responseSchema.parse(body);

    const response: ElicitationResponse = {
      elicitationToken,
      action,
      data,
    };

    // Handle the response through the elicitation manager
    elicitationManager.handleResponse(response);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error handling elicitation response:', error);
    return Response.json(
      { error: 'Failed to handle elicitation response' },
      { status: 500 }
    );
  }
}