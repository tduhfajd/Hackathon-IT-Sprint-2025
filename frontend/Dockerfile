FROM node:18-alpine AS builder

ARG FRONTEND_DIR
ARG VITE_API_URL
ARG VITE_WS_URL

WORKDIR /app

# Copy package files
COPY ${FRONTEND_DIR}/package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm install

# Copy source
COPY ${FRONTEND_DIR}/ ./

# Build with env vars
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_WS_URL=${VITE_WS_URL}
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx-frontend.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

