# Test A2A Agent

A simple A2A (Agent-to-Agent) test agent powered by Azure OpenAI (GPT-5-mini).

## Features

- ✅ Streaming responses
- ✅ Conversation history per session
- ✅ Task state management
- ✅ Proper A2A protocol implementation
- ✅ Uses your existing Azure OpenAI configuration

## Setup

1. **Install dependencies** (using uv):
   ```bash
   cd test-a2a
   uv sync
   ```

2. **Configuration**:
   The agent automatically uses your Azure OpenAI configuration from `../.env.local`.
   No additional setup needed!

3. **Run the agent**:
   ```bash
   pnpm a2a:server
   ```

   Or directly:
   ```bash
   cd test-a2a
   uv run python __main__.py
   ```

   With custom host/port:
   ```bash
   uv run python __main__.py --host 0.0.0.0 --port 10000
   ```

## Testing with Your Chatbot

1. **Start the test agent**: `pnpm a2a:server` (in the root directory)

2. **In your chatbot**, go to Settings → A2A Servers

3. **Add a new server**:
   - Click "Add Server"
   - **Agent Card URL**: `http://localhost:9999/`
   - The agent card will be automatically fetched

4. **Verify the agent**:
   - Go to Settings → A2A Agents to see the agent capabilities
   - You should see "Test AI Assistant" with streaming support

5. **Start chatting!**
   - The AI will automatically use the agent when appropriate
   - Watch the chat header for active agent status
   - See task progress inline in messages

## UI Integration

Now that you have the full A2A UI, you can:

- ✅ **Chat Header**: See "🤖 1 Agent Active" indicator
- ✅ **Inline Progress**: Task cards appear below agent responses
- ✅ **Agent Registry** (`/settings/a2a-agents`): Browse agent capabilities
- ✅ **Task Dashboard** (`/settings/a2a-tasks`): Monitor all tasks
- ✅ **Event Log** (`/settings/a2a-events`): Debug A2A interactions

## Agent Card

The agent exposes the following information:

- **Name**: Test AI Assistant
- **Model**: Azure OpenAI GPT-5-mini
- **Capabilities**: Streaming support
- **Skills**: General AI Assistance
- **Input/Output Modes**: Text only

## Architecture

```
┌─────────────────────┐
│   __main__.py       │  Server setup & agent card
│   (Uvicorn + A2A)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ agent_executor.py   │  Bridges A2A events to agent
│ (TestAgentExecutor) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    agent.py         │  Core agent logic
│    (TestAgent)      │  Uses Azure OpenAI via LangChain
└─────────────────────┘
```

## Example Interactions

**Simple Q&A:**
```
User: What is quantum computing?
Agent: [Provides detailed explanation using GPT-5-mini]
Status: ✅ Completed
```

**Multi-turn conversation:**
```
User: Can you help me understand neural networks?
Agent: [Explains neural networks]
Status: 🔄 Input Required

User: What about deep learning?
Agent: [Explains deep learning in context]
Status: ✅ Completed
```

## Troubleshooting

**Agent not showing up in chatbot:**
- Ensure the agent is running: `pnpm a2a:server`
- Check the server logs for errors
- Verify the agent card URL is `http://localhost:9999/`

**Azure OpenAI configuration issues:**
- Check that `AZURE_API_KEY` and `AZURE_RESOURCE_NAME` are set in `../.env.local`
- Verify the deployment name (defaults to `gpt-5-mini`)

**Server won't start:**
- Run `uv sync` to ensure dependencies are installed
- Check port 9999 is not already in use: `lsof -i :9999`
