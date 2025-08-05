import { progressManager } from '@/lib/progress-manager';

export const dynamic = 'force-dynamic';

export async function GET() {
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

      // Create progress update handler
      updateHandler = (toolProgressInfo: any) => {
        if (!isConnectionActive) return;

        try {
          let message: any;
          if (toolProgressInfo.isCleanup) {
            message = {
              type: 'cleanup',
              progressToken: toolProgressInfo.progressToken
            };
          } else {
            message = {
              type: 'progress',
              toolName: toolProgressInfo.toolName,
              serverName: toolProgressInfo.serverName,
              progressToken: toolProgressInfo.progressToken,
              currentProgress: toolProgressInfo.currentProgress
            };
          }
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
        } catch (error) {
          // Connection closed, clean up
          isConnectionActive = false;
          progressManager.removeUpdateHandler(updateHandler);
        }
      };

      // Add the handler
      progressManager.addUpdateHandler(updateHandler);

      // Send current active progress
      const activeProgress = progressManager.getAllActiveProgress();
      activeProgress.forEach(progress => {
        if (isConnectionActive) {
          updateHandler(progress);
        }
      });
    },
    cancel() {
      isConnectionActive = false;
      if (updateHandler) {
        progressManager.removeUpdateHandler(updateHandler);
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
}