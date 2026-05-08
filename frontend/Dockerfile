# syntax=docker/dockerfile:1
ARG NODE_VERSION=24
ARG NGINX_VERSION=1.30-alpine

# ---------- Builder ----------
FROM node:${NODE_VERSION}-slim AS builder
WORKDIR /build

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# ---------- Runtime ----------
FROM nginx:${NGINX_VERSION} AS runtime

RUN rm -rf /usr/share/nginx/html/* \
 && rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /build/dist /usr/share/nginx/html

EXPOSE 4173

CMD ["nginx", "-g", "daemon off;"]
