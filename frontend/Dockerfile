FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom Nginx proxy configuration
RUN echo 'server {' \
    '  listen 80;' \
    '  location / {' \
    '    root /usr/share/nginx/html;' \
    '    index index.html index.htm;' \
    '    try_files $uri $uri/ /index.html;' \
    '  }' \
    '  location /api/ {' \
    '    proxy_pass http://backend:4000/api/;' \
    '  }' \
    '  location /ws/ {' \
    '    proxy_pass http://backend:4000/ws/;' \
    '    proxy_http_version 1.1;' \
    '    proxy_set_header Upgrade $http_upgrade;' \
    '    proxy_set_header Connection "Upgrade";' \
    '  }' \
    '}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
