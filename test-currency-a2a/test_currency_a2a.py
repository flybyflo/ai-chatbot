#!/usr/bin/env python3
"""Test script for currency conversion via A2A server."""

import asyncio
import logging
from uuid import uuid4

import httpx
from a2a.client import A2ACardResolver, A2AClient
from a2a.types import SendStreamingMessageRequest, MessageSendParams

async def test_currency_conversion_a2a():
    """Test currency conversion via A2A server."""
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)

    base_url = 'http://localhost:9997'
    session_id = str(uuid4())

    async with httpx.AsyncClient() as httpx_client:
        # Initialize A2ACardResolver
        resolver = A2ACardResolver(
            httpx_client=httpx_client,
            base_url=base_url,
        )

        try:
            # Fetch agent card
            logger.info(f"Fetching agent card from: {base_url}/.well-known/agent-card.json")
            agent_card = await resolver.get_agent_card()
            logger.info(f"Agent: {agent_card.name}")
            logger.info(f"Skills: {[skill.name for skill in agent_card.skills]}")

            # Initialize A2A client
            client = A2AClient(
                httpx_client=httpx_client,
                agent_card=agent_card,
            )

            # Test currency conversion
            test_message = "convert 100 USD to EUR"
            logger.info(f"\nTesting currency conversion: '{test_message}'")

            # Send streaming message
            send_message_payload = {
                'message': {
                    'role': 'user',
                    'parts': [
                        {'kind': 'text', 'text': test_message}
                    ],
                    'messageId': uuid4().hex,
                },
            }
            request = SendStreamingMessageRequest(
                id=str(uuid4()),
                params=MessageSendParams(**send_message_payload)
            )

            logger.info("Streaming response:")
            stream_response = client.send_message_streaming(request)
            async for chunk in stream_response:
                if hasattr(chunk, 'content') and chunk.content:
                    print(f"  {chunk.content}", end='', flush=True)
            print()  # New line after streaming

        except Exception as e:
            logger.error(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_currency_conversion_a2a())
