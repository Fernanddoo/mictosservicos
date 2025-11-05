FROM node:18

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

# Instala o Prisma Client
RUN npx prisma generate

COPY docker-entrypoint.sh /usr/src/app/
RUN chmod +x /usr/src/app/docker-entrypoint.sh

EXPOSE 3003
ENTRYPOINT [ "/usr/src/app/docker-entrypoint.sh" ]
CMD [ "node", "server.js" ]