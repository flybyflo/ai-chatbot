# MCP Test Server (Minimal)

A minimal MCP server for development and testing with authentication, sampling, elicitation, and progress. This server intentionally exposes only four tools:

- `add(a: float, b: float)` – normal tool
- `ask(question: str)` – sampling tool
- `ask_confirmation(action: str)` – elicitation tool
- `download_simulation(file_size_mb: int)` – progress tool

## Run

```bash
python main.py
```

The server prints a test JWT you can use to authenticate.

## Tools

- add: returns the sum of two numbers
- ask: uses client-side sampling to answer a question
- ask_confirmation: requests a boolean confirmation from the user
- download_simulation: reports progress while simulating a download

## Notes

- Sampling and elicitation are initiated via the `Context` passed to tools.
- Only these four tools are exposed; previous demo tools were removed for clarity.
