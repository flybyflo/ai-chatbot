FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim

WORKDIR /app

# Copy minimal project files
COPY pyproject.toml README.md /app/
COPY main.py /app/

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

EXPOSE 8001 8010

ENTRYPOINT ["uv", "run", "start"]


