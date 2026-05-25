# Multi-stage build for production
FROM node:20-alpine as builder

# Set working directory
WORKDIR /app

# Native build deps for better-sqlite3 (musl/Alpine has no prebuilt binaries).
# Only needed at install time; final image is nginx:alpine below.
RUN apk add --no-cache \
    python3 \
    py3-setuptools \
    make \
    g++ \
    gcc \
    libc-dev \
    sqlite-dev

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev dependencies needed for build)
# Use npm install for better compatibility (works without exact package-lock.json)
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage - use the unprivileged variant of nginx so the worker
# does not run as root inside the container. Drop-in compatible with the
# config we ship; default user is `nginx` (uid 101) and the image is
# pre-chowned for that user.
FROM nginxinc/nginx-unprivileged:alpine-slim

# Copy built app to nginx html dir (chown so unprivileged user can read)
COPY --chown=nginx:nginx --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY --chown=nginx:nginx nginx.conf /etc/nginx/conf.d/default.conf

# Expose port (matches `listen 8064;` in nginx.conf)
EXPOSE 8064

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O - http://localhost:8064/health || exit 1

# Start nginx (image already sets USER nginx)
CMD ["nginx", "-g", "daemon off;"]