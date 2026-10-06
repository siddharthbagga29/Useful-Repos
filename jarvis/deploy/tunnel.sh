#!/usr/bin/env bash
# Expose the local public Jarvis (jarvis-public on :8080) to the internet through Cloudflare Tunnel.
# Free. The quick tunnel needs no account; its URL changes on every start.
#
#   brew install cloudflared ollama
#   ollama pull llama3.1:8b
#   JARVIS_LLM_BACKEND=ollama JARVIS_ALLOWED_ORIGINS=https://siddharthbagga29.github.io \
#     JARVIS_TRUST_PROXY_HEADERS=true jarvis-public &
#   jarvis/deploy/tunnel.sh
#
# For a permanent hostname, create a named tunnel once (needs a free Cloudflare account and a
# domain on Cloudflare): cloudflared tunnel login; cloudflared tunnel create jarvis;
# cloudflared tunnel route dns jarvis jarvis.<your-domain>; cloudflared tunnel run jarvis
set -euo pipefail
PORT=${JARVIS_PORT:-8080}
command -v cloudflared >/dev/null || { echo "Install cloudflared first: brew install cloudflared"; exit 1; }
curl -fsS "http://127.0.0.1:${PORT}/healthz" >/dev/null || { echo "jarvis-public isn't answering on :${PORT}"; exit 1; }
exec cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:${PORT}"
