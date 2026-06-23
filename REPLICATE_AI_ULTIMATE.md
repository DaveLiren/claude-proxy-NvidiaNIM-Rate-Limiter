# AI Replication Guide: Claude Code → NVIDIA NIM Proxy (v2.1)

> **Context**: This guide allows an AI to replicate a high-performance proxy for Claude Code using NVIDIA NIM.
> **Key Features**: Anthropic-to-OpenAI translation, Multi-model fallback, Token Bucket Rate Limiting (RPM & TPM), and Flash Model Mapping.

---

## 1. Project Architecture

- **Input**: Anthropic Messages API (port 9082)
- **Middleware**: Node.js Proxy (`proxy.js`)
- **Output**: NVIDIA NIM API (`integrate.api.nvidia.com`)

## 2. Core Components to Implement

### A. Rate Limiter (RPM & TPM)
Implement a `MultiRateLimiter` class using the Token Bucket algorithm. 
- **RPM**: Requests Per Minute (default 40).
- **TPM**: Tokens Per Minute (default 150,000).
- **Functionality**: Estimate tokens before request (chars/4 + max_tokens), block if over limit, and release/adjust based on actual `usage.total_tokens` from response.

### B. Model Mapping (Flash Priority)
Map Claude models to the fastest available NIM models to enable "vibecoding".
- `claude-3-5-sonnet` → `deepseek-ai/deepseek-v4-flash`
- `claude-3-5-haiku` → `meta/llama-3.1-8b-instruct`
- `claude-3-opus` → `deepseek-ai/deepseek-v4-pro`
- **Fallback Logic**: If primary fails (429, 5xx, or 410), rotate through a priority list (e.g., `coding` list: deepseek-v4-flash, llama-3.1-70b-instruct, qwen3-coder-48b).

### C. Protocol Translation
- **Anthropic → OpenAI**: Convert `system` and `messages` array. Map `tools` to `functions`.
- **OpenAI → Anthropic**: Map `choices[0].message` back to Anthropic format. Support `reasoning_content` (concatenated to response) and `tool_calls`.
- **Streaming**: Convert OpenAI SSE chunks into Anthropic SSE events (`message_start`, `content_block_delta`, etc.).

## 3. Recommended Environment Configuration (Windows)

- **Proxy Port**: 9082
- **Persistence**: Install as a Windows Scheduled Task using a PowerShell script (`install-service.ps1`) to run `node proxy.js` on logon.

## 4. Replication Steps for AI
1. Initialize `package.json` with `"type": "module"`.
2. Implement `proxy.js` with the logic above. No external dependencies are strictly needed (use native `http` and `https`).
3. Create `start-proxy.ps1` for manual startup.
4. Setup environment variables: `NVIDIA_API_KEY`, `NVIDIA_BASE_URL`, `PROXY_PORT`, `RATE_LIMIT_RPM`, `RATE_LIMIT_TPM`.

## 5. Verification
- Test with `curl` to `http://localhost:9082/v1/messages`.
- Check if `claude-3-5-sonnet` correctly routes to a Flash model in metadata.
