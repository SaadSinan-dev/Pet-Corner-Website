FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_ADMIN_API_BASE_URL=/api/v1
ARG VITE_ADMIN_SITE_URL
ARG VITE_STOREFRONT_URL
ENV VITE_ADMIN_API_BASE_URL=$VITE_ADMIN_API_BASE_URL VITE_ADMIN_SITE_URL=$VITE_ADMIN_SITE_URL VITE_STOREFRONT_URL=$VITE_STOREFRONT_URL
RUN npm run build
FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
