# Multi-stage build for landing page
FROM nginx:alpine

# Copy landing page files
COPY index.html /usr/share/nginx/html/

# Nginx configuration will be created inline

# Create custom nginx configuration for landing page
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # Gzip compression \
    gzip on; \
    gzip_vary on; \
    gzip_min_length 1024; \
    gzip_comp_level 6; \
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/atom+xml image/svg+xml; \
    \
    # Cache static files \
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
        access_log off; \
    } \
    \
    location / { \
        try_files $uri $uri/ /index.html; \
        \
        # Cache HTML files for a shorter time \
        location ~* \.html$ { \
            expires 1h; \
            add_header Cache-Control "public"; \
        } \
    } \
    \
    # Health check endpoint \
    location /health { \
        access_log off; \
        return 200 "healthy\n"; \
        add_header Content-Type text/plain; \
    } \
    \
    # Deny access to hidden files \
    location ~ /\. { \
        deny all; \
        access_log off; \
        log_not_found off; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
