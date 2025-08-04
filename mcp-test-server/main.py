from fastmcp import FastMCP
from fastmcp.server.auth.verifiers import JWTVerifier, RSAKeyPair
from fastmcp import Context
import asyncio
import time

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
def hello(name: str) -> str:
    return f"Hello, {name}!"

@mcp.tool
async def ask(question: str, ctx: Context) -> str:
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
def echo(message: str) -> str:
    """Echo back the message"""
    return f"Echo: {message}"

@mcp.tool
async def long_task(task_name: str = "Processing", steps: int = 5, ctx: Context = None) -> str:
    """Demonstrate progress reporting with a long-running task"""
    
    if not ctx:
        return "Error: Context not available"
    
    # Report initial progress
    await ctx.report_progress(progress=0, total=steps)
    
    for i in range(steps):
        # Simulate work with sleep
        await asyncio.sleep(1)
        
        # Report progress
        current_step = i + 1
        
        await ctx.report_progress(
            progress=current_step, 
            total=steps
        )
    
    return f"✅ {task_name} completed successfully! Processed {steps} steps."

@mcp.tool
async def download_simulation(file_size_mb: int = 10, ctx: Context = None) -> str:
    """Simulate a file download with progress updates"""
    
    if not ctx:
        return "Error: Context not available"
    
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
async def batch_process(items: int = 20, ctx: Context = None) -> str:
    """Simulate batch processing with indeterminate progress"""
    
    if not ctx:
        return "Error: Context not available"
    
    await ctx.report_progress(progress=0)
    
    for i in range(items):
        # Variable processing time
        delay = 0.2 + (i % 3) * 0.1  # 0.2-0.4 seconds
        await asyncio.sleep(delay)
        
        processed = i + 1
        
        # For batch processing, we can show items processed
        await ctx.report_progress(progress=processed)
    
    return f"🔄 Batch processing complete! Processed {items} items successfully."

def main():
    mcp.run(transport="http", host="0.0.0.0", port=8000)

if __name__ == "__main__":
    main()