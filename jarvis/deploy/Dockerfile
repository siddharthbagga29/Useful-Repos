# Public Jarvis. Build from the jarvis/ directory:
#   docker build -f deploy/Dockerfile -t jarvis-public .
#   docker run -p 8080:8080 --env-file .env -v jarvis-data:/data jarvis-public
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    JARVIS_HOST=0.0.0.0 \
    JARVIS_PORT=8080 \
    JARVIS_CONTACTS_DB=/data/contacts.sqlite3

RUN useradd --create-home --uid 10001 jarvis && mkdir /data && chown jarvis /data

WORKDIR /app
COPY pyproject.toml README.md ./
COPY src ./src
COPY knowledge ./knowledge
RUN pip install .

USER jarvis
EXPOSE 8080
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/healthz', timeout=2).status == 200 else 1)"

CMD ["jarvis-public"]
