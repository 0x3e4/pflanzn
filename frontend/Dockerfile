FROM node:22

WORKDIR /

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 4173

CMD ["npx", "vite", "preview", "--host", "--port", "4173"]