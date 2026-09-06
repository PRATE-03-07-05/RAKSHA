FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r /app/requirements.txt || pip install --no-cache-dir -r requirements.txt

COPY . .

# Normalize line endings (repo is edited on Windows) and make the startup
# script executable. `sh entrypoint.sh` is used so the shebang is irrelevant.
RUN sed -i 's/\r$//' entrypoint.sh && chmod +x entrypoint.sh

EXPOSE 8000

CMD ["sh", "entrypoint.sh"]
