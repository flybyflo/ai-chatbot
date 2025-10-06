"""Simple Test A2A Agent using Azure OpenAI."""

import asyncio
import logging
import os
from collections.abc import AsyncIterable
from typing import Any

from dotenv import load_dotenv
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import AzureChatOpenAI

load_dotenv()
# Also load from parent directory's .env.local
load_dotenv("../.env.local")

logger = logging.getLogger(__name__)


class TestAgent:
    """A simple test agent that responds to user queries."""

    def __init__(self):
        """Initialize the test agent with Azure OpenAI."""
        # Get Azure OpenAI credentials from environment
        azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        azure_api_key = os.getenv("AZURE_API_KEY")
        azure_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5-mini")

        # Fallback: construct endpoint from resource name if not set
        if not azure_endpoint:
            resource_name = os.getenv("AZURE_RESOURCE_NAME")
            if resource_name:
                azure_endpoint = f"https://{resource_name}.openai.azure.com"

        if not azure_api_key or not azure_endpoint:
            raise ValueError(
                "Azure OpenAI configuration is required. "
                "Set AZURE_API_KEY and AZURE_OPENAI_ENDPOINT (or AZURE_RESOURCE_NAME) "
                "in your .env file or ../.env.local"
            )

        self.llm = AzureChatOpenAI(
            azure_endpoint=azure_endpoint,
            api_key=azure_api_key,
            azure_deployment=azure_deployment,
            api_version="2025-04-01-preview",
            temperature=1.0,  # GPT-5-mini only supports default temperature (1.0)
            streaming=True,
        )

        self.system_prompt = SystemMessage(
            content=(
                "You are a helpful AI assistant. "
                "Provide clear, concise, and accurate responses to user queries. "
                "When you complete a task, explicitly state that you're done."
            )
        )

        # Store conversation history per session
        self.conversations: dict[str, list] = {}

    async def invoke(self, user_input: str, session_id: str) -> dict[str, Any]:
        """Handle synchronous tasks.

        Args:
            user_input: User input message
            session_id: Unique identifier for the session

        Returns:
            dict: Response with content, completion status, and input requirement
        """
        # Get or create conversation history
        if session_id not in self.conversations:
            self.conversations[session_id] = [self.system_prompt]

        messages = self.conversations[session_id] + [HumanMessage(content=user_input)]

        # Simulate longer task processing time
        logger.info("Starting 5-second delay to simulate longer task...")
        await asyncio.sleep(5.0)
        logger.info("Delay completed, starting LLM call...")

        # Get response
        response = await self.llm.ainvoke(messages)

        # Update conversation history
        self.conversations[session_id].append(HumanMessage(content=user_input))
        self.conversations[session_id].append(response)

        # Determine if task is complete
        is_complete = self._is_task_complete(response.content)

        return {
            "content": response.content,
            "is_task_complete": is_complete,
            "require_user_input": not is_complete,
        }

    async def stream(
        self, user_input: str, session_id: str
    ) -> AsyncIterable[dict[str, Any]]:
        """Handle streaming tasks.

        Args:
            user_input: User input message
            session_id: Unique identifier for the session

        Yields:
            dict: Streaming response chunks
        """
        # Get or create conversation history
        if session_id not in self.conversations:
            self.conversations[session_id] = [self.system_prompt]

        messages = self.conversations[session_id] + [HumanMessage(content=user_input)]

        # Yield initial status
        yield {
            "content": "Processing your request...",
            "is_task_complete": False,
            "require_user_input": False,
        }

        # Simulate longer task processing time
        logger.info("Starting 5-second delay to simulate longer task...")
        await asyncio.sleep(5.0)
        logger.info("Delay completed, starting LLM streaming...")

        # Stream the response
        full_response = ""
        async for chunk in self.llm.astream(messages):
            if isinstance(chunk, AIMessage) and chunk.content:
                full_response += chunk.content
                yield {
                    "content": chunk.content,
                    "is_task_complete": False,
                    "require_user_input": False,
                    "is_streaming_chunk": True,
                }

        # Update conversation history
        self.conversations[session_id].append(HumanMessage(content=user_input))
        self.conversations[session_id].append(AIMessage(content=full_response))

        # Final response is always considered complete
        # The task is done when we've received the full LLM response
        is_complete = True  # Always complete after streaming finishes

        # Yield final status
        yield {
            "content": full_response,
            "is_task_complete": is_complete,
            "require_user_input": False,  # No more input needed
            "is_final": True,
        }

    def _is_task_complete(self, response: str) -> bool:
        """Determine if the task is complete based on the response.

        Args:
            response: The agent's response text

        Returns:
            bool: True if task appears complete
        """
        # Simple heuristic: check for completion indicators
        completion_indicators = [
            "done",
            "completed",
            "finished",
            "that's all",
            "hope this helps",
            "let me know if",
        ]

        response_lower = response.lower()
        return any(indicator in response_lower for indicator in completion_indicators)

    def clear_conversation(self, session_id: str) -> None:
        """Clear conversation history for a session.

        Args:
            session_id: Session to clear
        """
        if session_id in self.conversations:
            del self.conversations[session_id]
