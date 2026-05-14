Local LLM API — Qwen3.6-35B-A3B
=================================

Base URL (local network):  http://192.168.1.177:8000/v1
API Key:                   kOwXx0pso6YjoVcq9X-NKOYQEpMUhobarQlRFQyQQfw
Model name:                qwen3-35b
Protocol:                  OpenAI-compatible REST API


Endpoints
---------
GET  /v1/models                  List available models
POST /v1/chat/completions        Chat inference


Example (Python, openai SDK)
-----------------------------
from openai import OpenAI

client = OpenAI(
    base_url="http://192.168.1.177:8000/v1",
    api_key="kOwXx0pso6YjoVcq9X-NKOYQEpMUhobarQlRFQyQQfw",
)

response = client.chat.completions.create(
    model="qwen3-35b",
    messages=[{"role": "user", "content": "Hello! /no_think"}],
)
print(response.choices[0].message.content)


Example (curl)
--------------
curl http://192.168.1.177:8000/v1/chat/completions \
  -H "Authorization: Bearer kOwXx0pso6YjoVcq9X-NKOYQEpMUhobarQlRFQyQQfw" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-35b",
    "messages": [{"role": "user", "content": "Hello! /no_think"}]
  }'


Notes
-----
- The model runs in "thinking" mode by default (shows reasoning steps).
  Append /no_think to your message to disable it.
- Context window: 8192 tokens
- Available on local network only. For remote access, a port forward or
  tunnel to 192.168.1.177:8000 is required.
- The service runs as a systemd unit (qwen.service) and starts on boot.
