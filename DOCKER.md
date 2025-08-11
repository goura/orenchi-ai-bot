# Dockerization Guide

This project can be run in a Docker container for easy deployment and isolation.

## Prerequisites

- Docker installed on your system
- A `.env` file with your Discord bot token and other required environment variables

## Building the Docker Image

To build the Docker image, run:

```bash
bun run docker:build
```

Or directly with Docker:

```bash
docker build -t orenchi-ai-bot .
```

## Running the Container

To run the container, you'll need to provide the required environment variables. The easiest way is to use a `.env` file:

```bash
bun run docker:run
```

Or directly with Docker:

```bash
docker run -it --rm --env-file .env -v orenchi-ai-data:/usr/src/app orenchi-ai-bot
```

## Environment Variables

The following environment variables are required:

- `DISCORD_BOT_TOKEN`: Your Discord bot token
- `DISCORD_CLIENT_ID`: Your Discord application client ID
- `DISCORD_GUILD_ID`: The Discord server (guild) ID where the bot will operate
- `OPENROUTER_API_KEY`: Your OpenRouter API key for AI services

These should be provided via a `.env` file or environment variables.

## Volumes

The bot uses SQLite for data persistence. To maintain data across container restarts, a volume is used:

- `/usr/src/app`: The working directory where the database file (`personalities.db`) is stored

When using docker-compose, a named volume `orenchi-ai-data` is automatically created and managed.

## Using Docker Compose

For easier management, you can use Docker Compose:

1. Create a `.env` file with your environment variables
2. Run the bot with Docker Compose:

```bash
bun run docker:compose:up
```

Or directly with Docker Compose:

```bash
docker-compose up -d
```

To stop the bot:

```bash
bun run docker:compose:down
```

Or directly with Docker Compose:

```bash
docker-compose down
```

## Environment Variables

The following environment variables are required:

- `DISCORD_BOT_TOKEN`: Your Discord bot token
- `DISCORD_CLIENT_ID`: Your Discord application client ID
- `DISCORD_GUILD_ID`: The Discord server (guild) ID where the bot will operate
- `OPENROUTER_API_KEY`: Your OpenRouter API key for AI services

## Kubernetes Deployment

To deploy this bot on Kubernetes, you would:

1. Push the Docker image to a container registry
2. Create a Kubernetes deployment manifest
3. Create a Kubernetes secret for the environment variables
4. Apply the manifests to your cluster

Example Kubernetes deployment manifest:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orenchi-ai-bot
spec:
  replicas: 1
  selector:
    matchLabels:
      app: orenchi-ai-bot
  template:
    metadata:
      labels:
        app: orenchi-ai-bot
    spec:
      containers:
      - name: orenchi-ai-bot
        image: your-registry/orenchi-ai-bot:latest
        envFrom:
        - secretRef:
            name: orenchi-ai-secrets
        volumeMounts:
        - name: orenchi-ai-data
          mountPath: /usr/src/app
      volumes:
      - name: orenchi-ai-data
        persistentVolumeClaim:
          claimName: orenchi-ai-pvc
---
apiVersion: v1
kind: Secret
metadata:
  name: orenchi-ai-secrets
type: Opaque
data:
  DISCORD_BOT_TOKEN: <base64-encoded-token>
  DISCORD_CLIENT_ID: <base64-encoded-client-id>
  DISCORD_GUILD_ID: <base64-encoded-guild-id>
  OPENROUTER_API_KEY: <base64-encoded-api-key>
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: orenchi-ai-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi