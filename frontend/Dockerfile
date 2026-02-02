FROM node:18-alpine

WORKDIR /app
ENV CHOKIDAR_USEPOLLING=true
ENV HOST=0.0.0.0
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3000 9229
CMD ["node", "--inspect=0.0.0.0:9229", "node_modules/.bin/react-scripts", "start"]
