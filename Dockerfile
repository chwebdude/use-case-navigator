# Stage 1: Build frontend
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build

# Stage 2: Runtime
FROM alpine:3.20

# Install required packages
RUN apk add --no-cache \
    ca-certificates \
    curl \
    unzip

# PocketBase version
ARG POCKETBASE_VERSION=0.23.4

# Download and install PocketBase
RUN curl -L "https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_amd64.zip" -o /tmp/pocketbase.zip \
    && unzip /tmp/pocketbase.zip -d /usr/local/bin/ \
    && rm /tmp/pocketbase.zip \
    && chmod +x /usr/local/bin/pocketbase

WORKDIR /app

# Copy migrations
COPY pocketbase/pb_migrations/ ./pb_migrations/

# Copy built frontend to serve as static files
COPY --from=frontend-builder /app/frontend/dist ./pb_public/

# Create data directory
RUN mkdir -p /app/pb_data

# Expose PocketBase port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

# Set environment variables
ENV PB_ENCRYPTION_KEY=""

# Run PocketBase (serve on 0.0.0.0 to allow external access)
CMD ["pocketbase", "serve", "--http=0.0.0.0:8080"]
