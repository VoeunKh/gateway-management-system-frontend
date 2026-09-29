# syntax=docker/dockerfile:1
# One Dockerfile, three targets:
#   dev   Vite dev server with hot reload (source is bind-mounted by compose.dev.yaml)
#   build production bundle; fails if lint, types, tests or the size budget fail
#   prod  nginx (non-root) serving the bundle and proxying /api to the backend

FROM node:22-alpine AS deps
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
# Behind a TLS-intercepting proxy, pass its CA as a build secret (make BUILD_CA=path/ca.crt);
# it is used for npm only and never stored in a layer.
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then \
      export NODE_EXTRA_CA_CERTS=/run/secrets/ca npm_config_cafile=/run/secrets/ca; \
    fi; \
    npm ci --no-audit --no-fund

FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

FROM deps AS build
COPY . .
RUN npm run lint && npm run typecheck && npm test && npm run build && npm run size \
 && rm -rf dist/.vite

FROM nginxinc/nginx-unprivileged:1.30-alpine AS prod
# Rendered into /etc/nginx/conf.d at start-up with API_UPSTREAM filled in.
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
ENV API_UPSTREAM=http://host.docker.internal:8080 \
    CLIENT_MAX_BODY_SIZE=512m
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
