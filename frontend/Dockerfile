FROM node:24

WORKDIR /

# Accept build arguments for Vite env vars
ARG VITE_AUTH_MODE
ARG VITE_SHOW_PROTECTED_VIEW
ARG VITE_ENABLE_LOCATIONS
ARG VITE_DOMAIN
ARG VITE_TZ
ARG VITE_LOCALE
ARG VITE_LLM_PROVIDER

# Set as environment variables for build
ENV VITE_AUTH_MODE=$VITE_AUTH_MODE
ENV VITE_SHOW_PROTECTED_VIEW=$VITE_SHOW_PROTECTED_VIEW
ENV VITE_ENABLE_LOCATIONS=$VITE_ENABLE_LOCATIONS
ENV VITE_DOMAIN=$VITE_DOMAIN
ENV VITE_TZ=$VITE_TZ
ENV VITE_LOCALE=$VITE_LOCALE
ENV VITE_LLM_PROVIDER=$VITE_LLM_PROVIDER

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

EXPOSE 4173

CMD ["pnpm", "exec", "vite", "preview", "--host", "--port", "4173"]
