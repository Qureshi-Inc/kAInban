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

# Production stage
FROM nginx:alpine

# Copy built app to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 8064

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8064/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]