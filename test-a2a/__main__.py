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
@click.option("--port", default=9999, type=int, help="Port to bind the server to")
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

    uvicorn.run(server.build(), host=host, port=port)


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
    general_assistance_skill = AgentSkill(
        id="general_assistance",
        name="General AI Assistance",
        description=(
            "Provides general AI assistance for various tasks including "
            "answering questions, providing explanations, helping with "
            "problem-solving, and engaging in conversations."
        ),
        tags=["general", "assistance", "ai", "chat", "help"],
        examples=[
            "Can you help me understand quantum computing?",
            "What are some good practices for writing clean code?",
            "Explain the difference between REST and GraphQL",
            "Help me brainstorm ideas for a mobile app",
        ],
    )

    # Build agent card
    agent_card = AgentCard(
        name="Test AI Assistant",
        description=(
            "A simple AI assistant agent powered by Google's Gemini model. "
            "Provides general assistance with various tasks including answering questions, "
            "explanations, and problem-solving."
        ),
        url=f"http://{host}:{port}/",
        version="1.0.0",
        default_input_modes=["text"],
        default_output_modes=["text"],
        capabilities=capabilities,
        skills=[general_assistance_skill],
    )

    return agent_card


if __name__ == "__main__":
    main()
