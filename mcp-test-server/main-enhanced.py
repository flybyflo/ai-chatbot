from fastmcp import FastMCP
import random
import math
from datetime import datetime

mcp = FastMCP("Demo 🚀")

@mcp.tool
def add(a: int, b: int) -> int:
    """Add two numbers"""
    return a + b

@mcp.tool
def multiply(a: int, b: int) -> int:
    """Multiply two numbers"""
    return a * b

@mcp.tool
def random_number(min_val: int = 1, max_val: int = 100) -> int:
    """Generate a random number between min_val and max_val"""
    return random.randint(min_val, max_val)

@mcp.tool
def current_time() -> str:
    """Get the current date and time"""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

@mcp.tool
def calculate_circle_area(radius: float) -> float:
    """Calculate the area of a circle given its radius"""
    return math.pi * radius * radius

@mcp.tool
def to_uppercase(text: str) -> str:
    """Convert text to uppercase"""
    return text.upper()

if __name__ == "__main__":
    mcp.run()