# MCP Multiply (Docker-backed Python Runner)

An MCP server that manages a persistent Docker environment (Python + uv) to run arbitrary Python code with declared dependencies at request time.

- Server runs on HTTP port 8001
- A container is created (default image: `ghcr.io/astral-sh/uv:python3.11-bookworm-slim`) and kept running
- Code is executed inside the container in `/workspace`, with ephemeral or persistent dependency installs

## Tools

- `start_env()` – ensure the Docker environment is running and mounted
- `reset_env()` – stop and remove the container and clear the workspace
- `install_packages(packages: list[str], upgrade: bool = False)` – create/activate a persistent `.venv` and install packages using `uv pip`
- `run_python(code: str, dependencies?: list[str], files?: dict[str,str], use_ephemeral: bool = True, timeout_seconds: int = 60)` – run Python code inside the container; when `use_ephemeral` is true, uses `uv run --with ...` for ephemeral deps, otherwise uses the persistent `.venv`

## Usage

```bash
python main.py
```

Typical flow:

1. Call `start_env`
2. Optionally `install_packages(["numpy", "pandas"])`
3. Call `run_python` with your code and optional `dependencies=["requests==2.*"]`

## Notes

- Tools are implemented using the FastMCP `@tool` decorator; see docs: [Tools](https://gofastmcp.com/servers/tools)
- Progress updates are emitted by `run_python` during setup and execution when possible
- Ensure Docker is installed and running locally
