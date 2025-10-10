"""Agent Executor for the Test A2A Agent."""

import logging

from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.events.event_queue import EventQueue
from a2a.types import TaskState, TaskStatus, TaskStatusUpdateEvent
from a2a.utils import new_agent_text_message, new_task
from agent import TestAgent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TestAgentExecutor(AgentExecutor):
    """Executor for the Test A2A Agent."""

    def __init__(self):
        """Initialize the executor with the test agent."""
        self.agent = TestAgent()

    async def execute(
        self,
        context: RequestContext,
        event_queue: EventQueue,
    ) -> None:
        """Execute the agent with streaming support.

        Args:
            context: Request context with user input
            event_queue: Queue for sending events
        """
        query = context.get_user_input()
        task = context.current_task

        # Create task if it doesn't exist
        if not task:
            task = new_task(context.message)
            await event_queue.enqueue_event(task)

        #  Collect full response
        full_response = ""

        # Stream agent responses - consume ALL events
        async for partial in self.agent.stream(query, task.context_id):
            is_done = partial.get("is_task_complete", False)
            require_input = partial.get("require_user_input", False)
            text_content = partial.get("content", "")
            is_streaming = partial.get("is_streaming_chunk", False)
            is_final = partial.get("is_final", False)

            logger.info(f"Partial: is_final={is_final}, is_streaming={is_streaming}, content_len={len(text_content)}")

            # Accumulate streaming chunks
            if is_streaming and text_content:
                full_response += text_content
            elif is_final:
                # This is the last event - save it
                full_response = text_content if text_content else full_response
                logger.info(f"Got final event, full response length: {len(full_response)}")
            elif require_input:
                # Waiting for user input
                await event_queue.enqueue_event(
                    TaskStatusUpdateEvent(
                        status=TaskStatus(
                            state=TaskState.input_required,
                            message=new_agent_text_message(
                                text_content,
                                task.context_id,
                                task.id,
                            ),
                        ),
                        final=False,
                        context_id=task.context_id,
                        task_id=task.id,
                    )
                )
            else:
                # Working state
                await event_queue.enqueue_event(
                    TaskStatusUpdateEvent(
                        status=TaskStatus(
                            state=TaskState.working,
                            message=new_agent_text_message(
                                text_content,
                                task.context_id,
                                task.id,
                            ),
                        ),
                        final=False,
                        context_id=task.context_id,
                        task_id=task.id,
                    )
                )

        # After consuming all events, send ONLY the final status (no separate message)
        # Include the response text in the final status message
        logger.info(f"Loop complete. Sending final status with response. Response length: {len(full_response)}")

        # Send final completion status with the full response in the message
        await event_queue.enqueue_event(
            TaskStatusUpdateEvent(
                status=TaskStatus(
                    state=TaskState.completed,
                    message=new_agent_text_message(
                        full_response if full_response else "Task completed successfully.",
                        task.context_id,
                        task.id,
                    ),
                ),
                final=True,
                context_id=task.context_id,
                task_id=task.id,
            )
        )
        logger.info("Final status with response enqueued (final=True)")

    async def cancel(
        self, context: RequestContext, event_queue: EventQueue
    ) -> None:
        """Cancel the current task.

        Args:
            context: Request context
            event_queue: Event queue

        Raises:
            Exception: Cancel is not supported
        """
        raise Exception("Cancel operation is not supported")
