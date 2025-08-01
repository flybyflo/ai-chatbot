from fastmcp import FastMCP
from fastmcp.server.auth.verifiers import JWTVerifier, RSAKeyPair

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

import sys
print(f"🔐 Test token: {token}", flush=True)  
sys.stderr.write(f"🔐 Test token: {token}\n")
sys.stderr.flush()

@mcp.tool
def hello(name: str) -> str:
    return f"Hello, {name}!"

def main():
    mcp.run(transport="http", host="0.0.0.0", port=8000)

if __name__ == "__main__":
    main()