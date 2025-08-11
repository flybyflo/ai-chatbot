# MCP Test Server (Minimal)

A minimal MCP server for development and testing with authentication, sampling, elicitation, and progress. This server intentionally exposes only four tools:

- `add(a: float, b: float)` – normal tool
- `ask(question: str)` – sampling tool
- `ask_confirmation()` – elicitation tool that sequentially exercises all supported response types
- `download_simulation(file_size_mb: int)` – progress tool

## Run

```bash
python main.py
```

The server prints a test JWT you can use to authenticate.

## Tools

- add: returns the sum of two numbers
- ask: uses client-side sampling to answer a question
- ask_confirmation: sequentially triggers all elicitation modes (no parameters)
  - boolean: yes/no (`response_type=bool`)
  - none: approval only (`response_type=None`)
  - string: single text (`response_type=str`)
  - integer: whole number (`response_type=int`)
  - number: float/number (`response_type=float`)
  - enum: constrained option list (`response_type=["low","medium","high"]`)
  - object: structured fields via dataclass (`TaskDetails`)
  - multi: multi-turn flow (title → duration → urgent?)
- download_simulation: reports progress while simulating a download

## Notes

- Sampling and elicitation are initiated via the `Context` passed to tools.
- Only these four tools are exposed; previous demo tools were removed for clarity.
