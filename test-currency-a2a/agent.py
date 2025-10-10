"""Simple Test A2A Agent using Azure OpenAI."""

import asyncio
import logging
import os
from collections.abc import AsyncIterable
from decimal import Decimal
from typing import Any

from dotenv import load_dotenv
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import AzureChatOpenAI

from currency_converter import CurrencyConverter, parse_conversion_query
from web_summarizer import LinkReader, find_url, chunk_text

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
        
        # Initialize currency converter and link reader
        self.converter = CurrencyConverter()
        self.link_reader = LinkReader()

    async def _llm_summary(self, llm: AzureChatOpenAI, text: str) -> str:
        """Generate a concise summary using the LLM."""
        sys = SystemMessage(content="You are a precise summarizer. Write a concise TL;DR, key bullets, and 1–2 short quotes. No fluff.")
        human = HumanMessage(content=f"Summarize the following text:\n\n{text}\n\nReturn:\n- TL;DR (≤2 sentences)\n- 5–8 bullet points of key facts\n- 1–2 short quotes")
        resp = await llm.ainvoke([sys, human])
        return resp.content

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

        # 1) Fast path: deterministic currency conversion
        parsed = parse_conversion_query(user_input)
        if parsed:
            amount, from_ccy, to_ccy, date = parsed

            yield {"content": f"Validating currencies {from_ccy} → {to_ccy}...", "is_task_complete": False, "require_user_input": False}
            
            # Validate currencies
            try:
                supported_currencies = await self.converter.supported()
                if from_ccy not in supported_currencies:
                    yield {"content": f"Currency {from_ccy} is not supported. Available currencies include: {', '.join(sorted(list(supported_currencies))[:10])}...", "is_task_complete": False, "require_user_input": False}
                    return
                if to_ccy not in supported_currencies:
                    yield {"content": f"Currency {to_ccy} is not supported. Available currencies include: {', '.join(sorted(list(supported_currencies))[:10])}...", "is_task_complete": False, "require_user_input": False}
                    return
            except Exception as e:
                yield {"content": f"Failed to validate currencies: {e}. Falling back to chat...", "is_task_complete": False, "require_user_input": False}
                # Continue to LLM fallback

            yield {"content": f"Fetching rate from Frankfurter ({'latest' if not date else date})...", "is_task_complete": False, "require_user_input": False}
            try:
                result = await self.converter.convert(Decimal(amount), from_ccy, to_ccy, date)
                msg = (
                    f"{amount} {from_ccy} = {result.amount} {to_ccy} "
                    f"(rate {result.rate} on {result.date or 'latest'})"
                )
                # stream the final human-friendly line; executor will still send a single final status
                yield {"content": msg, "is_task_complete": False, "require_user_input": False}
                
                # Update conversation history
                self.conversations[session_id].append(HumanMessage(content=user_input))
                self.conversations[session_id].append(AIMessage(content=msg))
                
                # Yield final completion status
                yield {
                    "content": msg,
                    "is_task_complete": True,
                    "require_user_input": False,
                    "is_final": True,
                }
                return  # skip LLM path
            except Exception as e:
                yield {"content": f"Conversion failed: {e}. Falling back to chat…", "is_task_complete": False, "require_user_input": False}
                # continue to LLM fallback

        # 2) Link Reader & TL;DR
        url = find_url(user_input)
        if url:
            yield {"content": f"Fetching and extracting article from {url}…", "is_task_complete": False, "require_user_input": False}
            try:
                page = await self.link_reader.fetch_and_extract(url)
            except Exception as e:
                yield {"content": f"Could not fetch/extract the page: {e}", "is_task_complete": False, "require_user_input": False}
                return

            if not page.text or page.word_count < 50:
                yield {"content": "I couldn't find substantial article text to summarize.", "is_task_complete": False, "require_user_input": False}
                return

            # chunk & summarize (map step)
            chunks = chunk_text(page.text, max_chars=6000)
            yield {"content": f"Extracted ~{page.word_count} words; summarizing {len(chunks)} chunk(s)…", "is_task_complete": False, "require_user_input": False}

            llm = self.llm  # your configured AzureChatOpenAI
            partial_summaries: list[str] = []
            for i, c in enumerate(chunks, start=1):
                yield {"content": f"Summarizing chunk {i}/{len(chunks)}…", "is_task_complete": False, "require_user_input": False}
                s = await self._llm_summary(llm, c)
                partial_summaries.append(s)

            # reduce step: summarize the summaries
            reduce_input = "\n\n---\n\n".join(partial_summaries)
            final_summary = await self._llm_summary(llm, reduce_input)

            title_line = f"**{page.title}**\n" if page.title else ""
            out = f"{title_line}{final_summary}\n\nSource: {page.url}"
            yield {"content": out, "is_task_complete": False, "require_user_input": False}
            
            # Update conversation history
            self.conversations[session_id].append(HumanMessage(content=user_input))
            self.conversations[session_id].append(AIMessage(content=out))
            
            # Yield final completion status
            yield {
                "content": out,
                "is_task_complete": True,
                "require_user_input": False,
                "is_final": True,
            }
            return

        # 3) Fallback: your existing LLM behavior
        messages = self.conversations[session_id] + [HumanMessage(content=user_input)]

        # Yield initial status
        yield {
            "content": "How can I help?",
            "is_task_complete": False,
            "require_user_input": False,
        }

        # Brief delay for user experience
        await asyncio.sleep(0.1)

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
