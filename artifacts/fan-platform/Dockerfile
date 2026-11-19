# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
# Install pnpm
RUN npm install -g pnpm
# Copy monorepo essentials
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY artifacts/fan-platform/package.json ./artifacts/fan-platform/
# Copy all
COPY . .
# Install and build
RUN pnpm install --frozen-lockfile
RUN pnpm --filter fan-platform build

# Stage 2: Serve
FROM nginx:alpine
# Copy built static files
COPY --from=builder /app/artifacts/fan-platform/dist /usr/share/nginx/html
# Copy Nginx config
COPY --from=builder /app/artifacts/fan-platform/nginx.conf /etc/nginx/conf.d/default.conf
# Expose port (placeholder, runtime replacement)
EXPOSE 80
# Use envsubst to set the PORT at runtime
CMD /bin/sh -c "envsubst '\$PORT' < /etc/nginx/conf.d/default.conf > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
