from fastmcp import FastMCP, Context
# from fastmcp.server.auth.verifiers import JWTVerifier, RSAKeyPair
import asyncio
from dataclasses import dataclass
from typing import Literal

# Generate a new key pair
# key_pair = RSAKeyPair.generate()

# Configure the auth verifier with the public key
# auth = JWTVerifier(
#     public_key=key_pair.public_key,
#     issuer="https://dev.example.com",
#     audience="my-dev-server"
# )

mcp = FastMCP(name="Development Server")
# mcp = FastMCP(name="Development Server", auth=auth)

# Generate a token for testing
# token = key_pair.create_token(
#     subject="dev-user",
#     issuer="https://dev.example.com",
#     audience="my-dev-server",
#     scopes=["read", "write"]
# )

# print(f"🔐 Test token: {token}", flush=True)

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
async def ask_confirmation(*, ctx: Context) -> str:
    """Run all elicitation types sequentially to exercise the client UI.

    Covers: none, boolean, string, integer, number, enum, object, and a multi-turn flow.
    Returns a compact summary of outcomes for verification.
    """

    @dataclass
    class TaskDetails:
        title: str
        description: str
        priority: Literal["low", "medium", "high"]
        due_date: str

    outcomes: list[str] = []

    try:
        # 1) No response (approval only)
        none_res = await ctx.elicit(
            message="Approve this action? (no data expected)",
            response_type=None,
        )
        outcomes.append(f"none:{none_res.action}")

        # 2) Boolean confirmation
        bool_res = await ctx.elicit(
            message="Confirm proceed?",
            response_type=bool,
        )
        outcomes.append(
            f"boolean:{'accepted=' + str(bool_res.data) if bool_res.action == 'accept' else bool_res.action}"
        )

        # 3) String input
        str_res = await ctx.elicit(
            message="Enter a note:",
            response_type=str,
        )
        outcomes.append(
            f"string:{'accepted=' + str(str_res.data) if str_res.action == 'accept' else str_res.action}"
        )

        # 4) Integer input
        int_res = await ctx.elicit(
            message="Enter a retry count (integer):",
            response_type=int,
        )
        outcomes.append(
            f"integer:{'accepted=' + str(int_res.data) if int_res.action == 'accept' else int_res.action}"
        )

        # 5) Number input
        num_res = await ctx.elicit(
            message="Enter a numeric threshold:",
            response_type=float,
        )
        outcomes.append(
            f"number:{'accepted=' + str(num_res.data) if num_res.action == 'accept' else num_res.action}"
        )

        # 6) Enum (constrained options)
        enum_res = await ctx.elicit(
            message="Select a priority:",
            response_type=["low", "medium", "high"],
        )
        outcomes.append(
            f"enum:{'accepted=' + str(enum_res.data) if enum_res.action == 'accept' else enum_res.action}"
        )

        # 7) Object (structured)
        obj_res = await ctx.elicit(
            message="Provide task details (title, description, priority, due_date):",
            response_type=TaskDetails,
        )
        if obj_res.action == "accept":
            td = obj_res.data
            outcomes.append(
                f"object:accepted=title:{td.title}|priority:{td.priority}|due:{td.due_date}"
            )
        else:
            outcomes.append(f"object:{obj_res.action}")

        # 8) Multi-turn flow
        title_res = await ctx.elicit(
            message="[multi] What's the meeting title?",
            response_type=str,
        )
        if title_res.action == "accept":
            duration_res = await ctx.elicit(
                message="[multi] Duration in minutes?",
                response_type=int,
            )
            if duration_res.action == "accept":
                urgent_res = await ctx.elicit(
                    message="[multi] Is this urgent?",
                    response_type=Literal["yes", "no"],
                )
                if urgent_res.action == "accept":
                    urgent = urgent_res.data == "yes"
                    outcomes.append(
                        f"multi:accepted=title:{title_res.data}|duration:{duration_res.data}|urgent:{urgent}"
                    )
                else:
                    outcomes.append(f"multi:urgent:{urgent_res.action}")
            else:
                outcomes.append(f"multi:duration:{duration_res.action}")
        else:
            outcomes.append(f"multi:title:{title_res.action}")

        return " | ".join(outcomes)
    except Exception as e:
        return f"Elicitation error: {str(e)}"

def main():
    # Debug: List all registered tools
    print("🔧 Available tools: add, ask, ask_confirmation, download_simulation", flush=True)
    print("🔧 Total: 4 tools", flush=True)
    
    mcp.run(transport="http", host="0.0.0.0", port=8000)

if __name__ == "__main__":
    main()
