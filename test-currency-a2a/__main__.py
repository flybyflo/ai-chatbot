"""Test A2A Agent Server."""

import logging

import click
import httpx
import uvicorn
from a2a.server.apps import A2AStarletteApplication
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.tasks import (
    BasePushNotificationSender,
    InMemoryPushNotificationConfigStore,
    InMemoryTaskStore,
)
from a2a.types import AgentCapabilities, AgentCard, AgentSkill
from agent_executor import TestAgentExecutor
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()


@click.command()
@click.option("--host", default="localhost", help="Host to bind the server to")
@click.option("--port", default=9998, type=int, help="Port to bind the server to")
def main(host: str, port: int) -> None:
    """Start the Test A2A Agent server.

    This server provides a simple AI assistant agent using Google's Gemini model.
    Configure your GOOGLE_API_KEY in a .env file before running.
    """
    logger.info(f"Starting Test A2A Agent server on {host}:{port}")

    # Initialize HTTP client and notification stores
    httpx_client = httpx.AsyncClient()
    push_config_store = InMemoryPushNotificationConfigStore()

    # Create request handler
    request_handler = DefaultRequestHandler(
        agent_executor=TestAgentExecutor(),
        task_store=InMemoryTaskStore(),
        push_config_store=push_config_store,
        push_sender=BasePushNotificationSender(httpx_client, push_config_store),
    )

    # Build and run server
    server = A2AStarletteApplication(
        agent_card=get_agent_card(host, port),
        http_handler=request_handler,
    )

    uvicorn.run(
        server.build(),
        host=host,
        port=port,
        timeout_keep_alive=120,  # Keep connections alive for 120 seconds
        timeout_graceful_shutdown=30,  # Allow 30 seconds for graceful shutdown
    )


def get_agent_card(host: str, port: int) -> AgentCard:
    """Create the Agent Card for the Test A2A Agent.

    Args:
        host: Server host
        port: Server port

    Returns:
        AgentCard: The agent card describing capabilities
    """
    capabilities = AgentCapabilities(streaming=True)

    # Define agent skills
    currency_skill = AgentSkill(
        id="currency_conversion",
        name="Currency conversion (ECB reference rates)",
        description=(
            "Convert amounts between ISO 4217 currencies using official daily "
            "reference rates with optional historical dates (YYYY-MM-DD)."
        ),
        tags=["fx", "currency", "money", "EUR", "USD", "ISO4217"],
        examples=[
            "convert 100 USD to EUR",
            "100 gbp to usd on 2024-12-31",
            "usd 250 in jpy",
        ],
    )

    link_reader_skill = AgentSkill(
        id="link_reader_tldr",
        name="Link Reader & TL;DR",
        description=(
            "Paste a URL and I'll fetch the page, extract the main article text, "
            "and return a concise TL;DR + key bullets. Works on long reads."
        ),
        tags=["summarize", "url", "tldr", "reading"],
        examples=[
            "summarize https://example.com/long-article",
            "read and tl;dr https://blog.sample.org/post/abc",
            "give me key points of https://…",
        ],
    )

    # Build agent card
    agent_card = AgentCard(
        name="Test AI Assistant",
        description=(
            "A practical AI assistant with specialized tools for currency conversion "
            "and web article summarization. Converts currencies using official ECB rates "
            "and provides TL;DR summaries of web articles with key points and quotes."
        ),
        url=f"http://{host}:{port}/",
        version="1.0.0",
        default_input_modes=["text"],
        default_output_modes=["text"],
        capabilities=capabilities,
        skills=[currency_skill, link_reader_skill],
    )

    return agent_card


if __name__ == "__main__":
    main()
