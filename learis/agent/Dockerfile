FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV LEARIS_HOST="0.0.0.0"
ENV PORT=8787

# Standard library only: nothing to install.

COPY . .

# The SQLite file lives here; mount a volume to keep it
RUN mkdir -p /app/data

EXPOSE 8787

CMD ["python", "api.py"]

