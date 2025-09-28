import asyncio
from fastmcp import FastMCP, Context

mcp = FastMCP("My MCP Server")

@mcp.tool
def greet(name: str) -> str:
    return f"Hello, {name}!"

@mcp.tool
def add(a: int, b: int) -> int:
    return a + b

@mcp.tool
def subtract(a: int, b: int) -> int:
    return a - b

@mcp.tool
async def progress_test(ctx: Context) -> str:
    """A simple progress test that sleeps for 2 seconds and reports progress"""

    # Report initial progress
    await ctx.report_progress(progress=0, total=100)

    # Sleep for 1 second
    await asyncio.sleep(1)

    # Report halfway progress
    await ctx.report_progress(progress=50, total=100)

    # Sleep for another second
    await asyncio.sleep(1)

    # Report completion
    await ctx.report_progress(progress=100, total=100)

    return "Progress test completed successfully!"

@mcp.tool
def git_diff() -> str:
    """Returns a demo git diff output as a string."""

    demo_diff = """
diff --git a/package.json b/package.json
index 2f3a4c8..8b1e5d2 100644
--- a/package.json
+++ b/package.json
@@ -1,6 +1,6 @@
 {
   "name": "my-project",
-  "version": "1.0.0",
+  "version": "1.1.0",
   "description": "An awesome project",
   "main": "dist/index.js",
   "scripts": {
@@ -10,7 +10,8 @@
   },
   "dependencies": {
     "react": "^18.2.0",
-    "typescript": "^5.0.0"
+    "typescript": "^5.0.0",
+    "lodash": "^4.17.21"
   },
   "devDependencies": {
     "@types/react": "^18.2.0"
"""

    return f"{demo_diff}\n\nTip: Use the filecompare tool to visualize these changes with a side-by-side comparison!"

if __name__ == "__main__":
    mcp.run()

# fastmcp run main.py:mcp --transport http --port 8000