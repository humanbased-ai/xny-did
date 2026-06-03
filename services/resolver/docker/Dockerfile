# Dockerfile for xny/did-resolver

FROM node:20

# build xny did resolver driver

WORKDIR /usr/src/app
COPY package.json ./
RUN npm install
COPY . .

# done

EXPOSE 8080

CMD [ "node", "index.js" ]
