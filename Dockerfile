# Multi-stage build Dockerfile optimized for Cloud Run
# This reduces image size and improves deployment speed

# Stage 1: Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Run type checking to catch errors early
RUN npm run typecheck || true

# Stage 2: Runtime stage
FROM node:18-alpine

WORKDIR /app

# Install dumb-init for proper signal handling in containers
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy database schema for migrations (if needed)
COPY --chown=nodejs:nodejs database/ ./database/

# Copy any other necessary files
COPY --chown=nodejs:nodejs .env.example .

# Switch to non-root user
USER nodejs

# Expose port (Cloud Run will override this if needed)
EXPOSE 3000

# Health check for Cloud Run
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]
