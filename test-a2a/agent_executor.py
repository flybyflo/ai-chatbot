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

        # Stream agent responses
        async for partial in self.agent.stream(query, task.context_id):
            is_done = partial.get("is_task_complete", False)
            require_input = partial.get("require_user_input", False)
            text_content = partial.get("content", "")
            is_streaming = partial.get("is_streaming_chunk", False)
            is_final = partial.get("is_final", False)

            # Send status updates
            if is_streaming and text_content:
                # Send streaming text chunks
                await event_queue.enqueue_event(
                    new_agent_text_message(
                        text_content,
                        task.context_id,
                        task.id,
                    )
                )
            elif is_done or is_final:
                # Task completed
                await event_queue.enqueue_event(
                    TaskStatusUpdateEvent(
                        status=TaskStatus(
                            state=TaskState.completed,
                            message=new_agent_text_message(
                                text_content if is_final else "Task completed successfully.",
                                task.context_id,
                                task.id,
                            ),
                        ),
                        final=True,
                        context_id=task.context_id,
                        task_id=task.id,
                    )
                )
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
