from fastmcp import FastMCP, Context
from fastmcp.server.auth.verifiers import JWTVerifier, RSAKeyPair
import asyncio

# Generate a new key pair
key_pair = RSAKeyPair.generate()

# Configure the auth verifier with the public key
auth = JWTVerifier(
    public_key=key_pair.public_key,
    issuer="https://dev.example.com",
    audience="my-dev-server"
)

mcp = FastMCP(name="Development Server", auth=auth)

# Generate a token for testing
token = key_pair.create_token(
    subject="dev-user",
    issuer="https://dev.example.com",
    audience="my-dev-server",
    scopes=["read", "write"]
)

print(f"🔐 Test token: {token}", flush=True)

@mcp.tool
def add(a: float, b: float) -> float:
    """Return the sum of two numbers."""
    return a + b

@mcp.tool
async def ask(question: str, *, ctx: Context) -> str:
    """Ask AI a question using sampling"""
    try:
        response = await ctx.sample(
            question,
            system_prompt="You are a helpful assistant. Provide clear and concise answers.",
            temperature=0.7,
            max_tokens=150
        )
        return response.text
    except Exception as e:
        return f"Sampling error: {str(e)}"

@mcp.tool
async def download_simulation(file_size_mb: int = 10, *, ctx: Context) -> str:
    """Simulate a file download with progress updates"""
    
    
    # Simulate download in chunks
    chunk_size = 1  # MB per chunk
    chunks = file_size_mb
    
    await ctx.report_progress(progress=0, total=file_size_mb)
    
    for i in range(chunks):
        # Simulate download time per chunk
        await asyncio.sleep(0.5)
        
        downloaded = (i + 1) * chunk_size
        
        await ctx.report_progress(
            progress=downloaded,
            total=file_size_mb
        )
    
    return f"📁 Download complete! {file_size_mb}MB file downloaded successfully."

@mcp.tool
async def ask_confirmation(action: str, *, ctx: Context) -> str:
    """Ask for user confirmation using elicitation."""
    try:
        result = await ctx.elicit(
            message=f"Do you want to proceed with: {action}?",
            response_type=bool,
        )

        if result.action == "accept":
            return (
                f"✅ Proceeding with: {action}"
                if result.data
                else f"❌ Not proceeding with: {action}"
            )
        elif result.action == "decline":
            return "❌ User declined to answer"
        else:
            return "🚫 User cancelled the confirmation"
    except Exception as e:
        return f"Elicitation error: {str(e)}"

def main():
    # Debug: List all registered tools
    print("🔧 Available tools: add, ask, ask_confirmation, download_simulation", flush=True)
    print("🔧 Total: 4 tools", flush=True)
    
    mcp.run(transport="http", host="0.0.0.0", port=8000)

if __name__ == "__main__":
    main()