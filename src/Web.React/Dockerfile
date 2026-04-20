# syntax=docker/dockerfile:1.7

# ---- Build stage ---------------------------------------------------------
# Build context for this Dockerfile is src/Web.React (see CI workflow).
FROM node:24-alpine AS build
WORKDIR /app

# .npmrc holds legacy-peer-deps=true, needed for openapi-typescript on TS 6.
COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .

# Vite reads VITE_API_URL only for the dev proxy. The production bundle uses
# relative `/api/*` URLs, which the nginx runtime layer proxies to the API.
RUN npm run build

# ---- Runtime stage -------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Replace the default site with our SPA + /api proxy config.
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
