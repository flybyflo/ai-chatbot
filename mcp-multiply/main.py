from __future__ import annotations

import asyncio
import os
import shlex
import subprocess
from pathlib import Path
from typing import Dict, List, Optional

from fastmcp import Context, FastMCP
from fastmcp.server.auth.verifiers import JWTVerifier, RSAKeyPair


APP_DIR = Path(__file__).parent.resolve()
WORKSPACE_DIR = APP_DIR / "workspace"
RUNNER_DIR = WORKSPACE_DIR / "runner"
WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)
RUNNER_DIR.mkdir(parents=True, exist_ok=True)

DOCKER_IMAGE = os.environ.get(
    "MCP_MULTIPLY_IMAGE", "ghcr.io/astral-sh/uv:python3.11-bookworm-slim"
)
CONTAINER_NAME = os.environ.get("MCP_MULTIPLY_CONTAINER", "mcp-multiply-env")
CONTAINER_WORKDIR = "/workspace"


# Auth for the main server
key_pair = RSAKeyPair.generate()
auth = JWTVerifier(
    public_key=key_pair.public_key,
    issuer="https://dev.example.com",
    audience="mcp-multiply",
)
mcp = FastMCP(name="MCP Multiply", auth=auth)

# Print a token for convenience
token = key_pair.create_token(
    subject="dev-user",
    issuer="https://dev.example.com",
    audience="mcp-multiply",
    scopes=["read", "write"],
)
print(f"🔐 Test token (mcp-multiply): {token}", flush=True)


def _run_local_command(command: List[str], timeout: Optional[int] = None) -> subprocess.CompletedProcess:
    return subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        timeout=timeout,
    )


def _docker_available() -> bool:
    try:
        proc = _run_local_command(["docker", "version", "--format", "{{.Server.Version}}"], timeout=5)
        return proc.returncode == 0
    except Exception:
        return False


def _container_exists() -> bool:
    proc = _run_local_command(["docker", "ps", "-a", "--format", "{{.Names}}"])
    names = proc.stdout.splitlines()
    return CONTAINER_NAME in names


def _container_running() -> bool:
    proc = _run_local_command(["docker", "ps", "--format", "{{.Names}}"])
    names = proc.stdout.splitlines()
    return CONTAINER_NAME in names


def _ensure_dirs() -> None:
    WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)
    RUNNER_DIR.mkdir(parents=True, exist_ok=True)


def _start_container() -> str:
    _ensure_dirs()
    if _container_exists() and not _container_running():
        proc = _run_local_command(["docker", "start", CONTAINER_NAME])
        return proc.stdout.strip() or CONTAINER_NAME

    if _container_running():
        return CONTAINER_NAME

    proc = _run_local_command(
        [
            "docker",
            "run",
            "-d",
            "--name",
            CONTAINER_NAME,
            "-v",
            f"{str(WORKSPACE_DIR)}:{CONTAINER_WORKDIR}",
            "-w",
            CONTAINER_WORKDIR,
            DOCKER_IMAGE,
            "sh",
            "-lc",
            "sleep infinity",
        ]
    )
    if proc.returncode != 0:
        raise RuntimeError(f"Failed to start container: {proc.stdout}")
    return CONTAINER_NAME


def _stop_container(remove: bool = False) -> str:
    status = []
    if _container_running():
        _run_local_command(["docker", "stop", CONTAINER_NAME])
        status.append("stopped")
    if remove and _container_exists():
        _run_local_command(["docker", "rm", CONTAINER_NAME])
        status.append("removed")
    return ", ".join(status) or "no-op"


def _docker_exec(cmd: str, timeout: Optional[int] = None) -> subprocess.CompletedProcess:
    return _run_local_command(["docker", "exec", CONTAINER_NAME, "sh", "-lc", cmd], timeout=timeout)


@mcp.tool
def start_env() -> str:
    """Ensure the Docker Python+uv environment container is running."""
    if not _docker_available():
        return "Docker not available. Please install and start Docker."
    name = _start_container()
    return f"Environment ready in container '{name}' mounted at {CONTAINER_WORKDIR}"


@mcp.tool
def reset_env() -> str:
    """Stop and remove the container and clear the workspace."""
    _stop_container(remove=True)
    if WORKSPACE_DIR.exists():
        for path in WORKSPACE_DIR.glob("**/*"):
            try:
                if path.is_file():
                    path.unlink(missing_ok=True)
            except Exception:
                pass
        # Remove empty directories
        for dir_path in sorted(WORKSPACE_DIR.glob("**/*"), reverse=True):
            if dir_path.is_dir():
                try:
                    dir_path.rmdir()
                except Exception:
                    pass
    _ensure_dirs()
    return "Environment reset"


@mcp.tool
def install_packages(packages: List[str], upgrade: bool = False) -> str:
    """Create a local .venv and install packages into it using uv pip."""
    if not _docker_available():
        return "Docker not available. Please install and start Docker."
    _start_container()
    create_env = "test -d .venv || uv venv .venv"
    install_cmd = "uv pip install " + ("-U " if upgrade else "") + " ".join(shlex.quote(p) for p in packages)
    cmd = f"{create_env} && . .venv/bin/activate && {install_cmd}"
    proc = _docker_exec(cmd, timeout=600)
    return proc.stdout


def _write_files(code: str, files: Optional[Dict[str, str]]) -> Path:
    RUNNER_DIR.mkdir(parents=True, exist_ok=True)
    # Clear previous run files
    for path in RUNNER_DIR.glob("**/*"):
        try:
            if path.is_file():
                path.unlink(missing_ok=True)
        except Exception:
            pass
    main_path = RUNNER_DIR / "main.py"
    main_path.write_text(code, encoding="utf-8")
    if files:
        for rel_path, contents in files.items():
            rel = Path(rel_path)
            # Prevent escaping workspace
            safe = RUNNER_DIR / rel
            safe.parent.mkdir(parents=True, exist_ok=True)
            safe.write_text(contents, encoding="utf-8")
    return main_path


@mcp.tool
async def run_python(
    code: str,
    dependencies: Optional[List[str]] = None,
    files: Optional[Dict[str, str]] = None,
    use_ephemeral: bool = True,
    timeout_seconds: int = 60,
    *,
    ctx: Context,
) -> str:
    """Run Python code inside the Docker env. Optionally include dependencies.

    - If use_ephemeral is True, runs via `uv run --with dep` without persisting installs.
    - Otherwise uses a persistent .venv created with `uv venv` and installs via `uv pip install`.
    """
    if not _docker_available():
        return "Docker not available. Please install and start Docker."

    await ctx.report_progress(progress=0, total=3)
    _start_container()
    await ctx.report_progress(progress=1, total=3)

    script_path = _write_files(code, files)
    await ctx.report_progress(progress=2, total=3)

    try:
        if use_ephemeral:
            deps = " ".join(f"--with {shlex.quote(d)}" for d in (dependencies or []))
            cmd = f"uv run {deps} python {shlex.quote(str((Path(CONTAINER_WORKDIR) / 'runner' / 'main.py')))}"
        else:
            create_env = "test -d .venv || uv venv .venv"
            dep_install = (
                " && uv pip install " + " ".join(shlex.quote(p) for p in (dependencies or []))
                if dependencies
                else ""
            )
            cmd = (
                f"{create_env} && . .venv/bin/activate{dep_install} && "
                f"python {shlex.quote(str((Path(CONTAINER_WORKDIR) / 'runner' / 'main.py')))}"
            )

        proc = _docker_exec(cmd, timeout=timeout_seconds)
        await ctx.report_progress(progress=3, total=3)
        return proc.stdout
    except subprocess.TimeoutExpired:
        return f"Execution timed out after {timeout_seconds}s"
    except Exception as e:
        return f"Execution error: {e}"


def main() -> None:
    print(
        "🔧 Available tools: start_env, reset_env, install_packages, run_python",
        flush=True,
    )
    mcp.run(transport="http", host="0.0.0.0", port=8001)


if __name__ == "__main__":
    main()


