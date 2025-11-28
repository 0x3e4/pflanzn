FROM node:22

WORKDIR /

# Accept build arguments for Vite env vars
ARG VITE_AUTH_MODE
ARG VITE_DOMAIN
ARG VITE_TZ
ARG VITE_LOCALE
ARG VITE_LLM_PROVIDER

# Set as environment variables for build
ENV VITE_AUTH_MODE=$VITE_AUTH_MODE
ENV VITE_DOMAIN=$VITE_DOMAIN
ENV VITE_TZ=$VITE_TZ
ENV VITE_LOCALE=$VITE_LOCALE
ENV VITE_LLM_PROVIDER=$VITE_LLM_PROVIDER

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 4173

CMD ["npx", "vite", "preview", "--host", "--port", "4173"]