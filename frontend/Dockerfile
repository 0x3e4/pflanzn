FROM node:24

WORKDIR /

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

EXPOSE 4173

CMD ["pnpm", "exec", "vite", "preview", "--host", "--port", "4173"]
