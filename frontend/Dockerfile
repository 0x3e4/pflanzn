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

# The nginx image fills in ${DOCS_*} from the environment on start (envsubst on
# /etc/nginx/templates); nginx's own $variables are left alone.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
ENV DOCS_UPSTREAM=http://docs:80
ENV DOCS_RESOLVER=127.0.0.11
COPY --from=builder /build/dist /usr/share/nginx/html

EXPOSE 4173

CMD ["nginx", "-g", "daemon off;"]
