import { elicitationManager } from '@/lib/elicitation-manager';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const encoder = new TextEncoder();
    
    // Create a simple event stream that's more robust
    let isConnectionActive = true;
    let updateHandler: any;

    const customReadable = new ReadableStream({
    start(controller) {
      // Send initial connection message
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({type:"connected"})}\n\n`));
      } catch (error) {
        isConnectionActive = false;
        return;
      }

      // Create elicitation update handler
      updateHandler = (elicitationInfo: any) => {
        if (!isConnectionActive) return;

        try {
          let message: any;
          if (elicitationInfo.type === 'elicitation_cleanup') {
            message = {
              type: 'cleanup',
              elicitationToken: elicitationInfo.elicitationToken
            };
          } else if (elicitationInfo.type === 'elicitation_request') {
            message = {
              type: 'elicitation',
              elicitationToken: elicitationInfo.elicitationToken,
              serverName: elicitationInfo.serverName,
              message: elicitationInfo.message,
              responseType: elicitationInfo.responseType,
              timestamp: elicitationInfo.timestamp
            };
          }
          
          if (message) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
          }
        } catch (error) {
          // Connection closed, clean up
          isConnectionActive = false;
          elicitationManager.removeUpdateHandler(updateHandler);
        }
      };

      // Add the handler
      elicitationManager.addUpdateHandler(updateHandler);

      // Send current pending elicitation requests
      const pendingRequests = elicitationManager.getPendingRequests();
      pendingRequests.forEach(request => {
        if (isConnectionActive) {
          updateHandler({
            type: 'elicitation_request',
            ...request.info
          });
        }
      });
    },
    cancel() {
      isConnectionActive = false;
      if (updateHandler) {
        elicitationManager.removeUpdateHandler(updateHandler);
      }
    }
  });

    return new Response(customReadable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });
  } catch (error) {
    console.error('Error in elicitation stream:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to initialize elicitation stream' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}