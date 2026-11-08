# syntax=docker/dockerfile:1
ARG NODE_VERSION=24
ARG NGINX_VERSION=1.31-alpine

# ---------- Builder ----------
FROM node:${NODE_VERSION}-slim AS builder
WORKDIR /build

RUN corepack enable && corepack prepare pnpm@10.34.7 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# ---------- Runtime ----------
FROM nginx:${NGINX_VERSION} AS runtime

RUN rm -rf /usr/share/nginx/html/* \
 && rm /etc/nginx/conf.d/default.conf

# The frontend is also the gateway to the backend and the docs (nginx.conf.template).
# The nginx image fills in the ${...} placeholders from these on start (envsubst on
# /etc/nginx/templates); nginx's own $variables are left alone.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
# real_ip settings from TRUSTED_PROXIES, written before the templates are rendered.
COPY --chmod=755 docker-entrypoint.d/15-real-ip.sh /docker-entrypoint.d/15-real-ip.sh
RUN sed -i 's/\r$//' /docker-entrypoint.d/15-real-ip.sh
# Unique names, so a shared Docker network never resolves them to another app's container.
ENV BACKEND_UPSTREAM=http://pflanzn-backend:8000 \
    DOCS_UPSTREAM=http://pflanzn-docs:80 \
    UPSTREAM_RESOLVER=127.0.0.11 \
    MAX_UPLOAD_MB=30 \
    TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.1,::1,fc00::/7
COPY --from=builder /build/dist /usr/share/nginx/html

EXPOSE 4173

CMD ["nginx", "-g", "daemon off;"]
