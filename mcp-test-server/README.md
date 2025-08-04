# MCP Test Server

A test server for Model Context Protocol (MCP) development and testing, with sampling support.

## Available Servers

### 1. `main.py` - Basic authenticated server
- Basic MCP server with JWT authentication
- Single `hello` tool

### 2. `main-enhanced.py` - Enhanced server with sampling
- Basic math and utility tools
- **NEW**: AI-powered sampling tools:
  - `smart_math_helper`: Solve math problems with AI explanations
  - `generate_random_story`: Create random stories using AI

### 3. `simple-sampling.py` - Simple sampling examples
- `ask_ai`: Ask any question to AI
- `translate_text`: Translate text to another language  
- `explain_concept`: Explain concepts for specific audiences

### 4. `main-with-sampling.py` - Advanced sampling server
- Comprehensive sampling examples:
  - `analyze_data`: AI-powered data analysis
  - `creative_story`: Generate creative stories
  - `summarize_text`: Intelligent text summarization
  - `code_review`: Code review and suggestions
  - `multi_step_analysis`: Complex multi-step analysis

## Sampling Feature

The sampling feature allows MCP servers to request LLM completions from clients. This enables:

- AI-powered tools without the server needing direct LLM access
- Client-controlled model selection and permissions
- Human-in-the-loop approval for AI requests

### How Sampling Works

1. Server tool makes a sampling request using `mcp.sample()`
2. Client receives the request and shows approval UI
3. User approves/denies the request (with optional prompt editing)
4. If approved, client processes with its AI model
5. Response is returned to the server tool

### Example Sampling Tool

```python
@mcp.tool
async def ask_ai(question: str) -> str:
    messages = [SamplingMessage(role="user", content=question)]
    params = SamplingParams(
        systemPrompt="You are a helpful assistant.",
        maxTokens=150,
        temperature=0.7
    )
    response = await mcp.sample(messages, params)
    return response
```

## Running the Servers

```bash
# Basic server
python main.py

# Enhanced server with sampling
python main-enhanced.py

# Simple sampling examples
python simple-sampling.py

# Advanced sampling server
python main-with-sampling.py
```

## Testing Sampling

1. Start one of the sampling-enabled servers
2. Configure your MCP client to connect to the server
3. Use a sampling tool (e.g., `ask_ai`, `smart_math_helper`)
4. Approve the sampling request in your client UI
5. See the AI-generated response returned by the tool