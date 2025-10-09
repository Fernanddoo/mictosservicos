FROM node:18

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

# Instala o Prisma Client
RUN npx prisma generate


EXPOSE 3000
CMD [ "node", "server.js" ]