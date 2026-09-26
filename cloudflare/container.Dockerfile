FROM docker.io/searxng/base:searxng-builder AS builder

WORKDIR /usr/local/searxng

COPY requirements.txt requirements-server.txt ./

ENV UV_LINK_MODE="copy" \
    UV_NO_MANAGED_PYTHON="true"

RUN --mount=type=cache,id=uv,target=/root/.cache/uv set -eux -o pipefail; \
    uv venv; \
    uv pip install --requirements ./requirements.txt --requirements ./requirements-server.txt; \
    uv cache prune --ci; \
    find ./.venv/lib/ -type f \( -name "*.so" -o -name "*.so.*" \) \
      -exec strip --strip-unneeded {} + || true; \
    find ./.venv/lib/ -type d -name "__pycache__" -exec rm -rf {} +; \
    find ./.venv/lib/ -type f -name "*.pyc" -delete

COPY searx/ ./searx/

RUN set -eux -o pipefail; \
    python -m compileall -q -f -j 0 --invalidation-mode=unchecked-hash ./searx/; \
    find ./searx/static/ -type f \
      \( -name "*.html" -o -name "*.css" -o -name "*.js" -o -name "*.svg" \) \
      -exec gzip -9 -k {} + \
      -exec brotli -9 -k {} +

FROM docker.io/searxng/base:searxng AS runtime

WORKDIR /usr/local/searxng

COPY --chown=977:977 --from=builder /usr/local/searxng/.venv/ ./.venv/
COPY --chown=977:977 --from=builder /usr/local/searxng/searx/ ./searx/
COPY --chown=977:977 container/ ./
COPY --chown=977:977 cloudflare/container/provider_probe.py ./provider_probe.py
COPY --chown=977:977 cloudflare/container/settings.yml /etc/searxng/settings.yml
COPY --chown=977:977 cloudflare/container/limiter.toml /etc/searxng/limiter.toml

ENV __SEARXNG_VERSION="cloudflare" \
    __SEARXNG_SETTINGS_PATH="/etc/searxng/settings.yml" \
    PROVIDER_PROBE_REVISION="09f188fa8" \
    GRANIAN_PROCESS_NAME="searxng" \
    GRANIAN_INTERFACE="wsgi" \
    GRANIAN_HOST="::" \
    GRANIAN_PORT="8080" \
    GRANIAN_WEBSOCKETS="false" \
    GRANIAN_BLOCKING_THREADS="4" \
    GRANIAN_WORKERS_KILL_TIMEOUT="30s" \
    GRANIAN_BLOCKING_THREADS_IDLE_TIMEOUT="5m"

EXPOSE 8080

ENTRYPOINT ["/usr/local/searxng/entrypoint.sh"]
