ARG NODE_BASE_IMAGE=docker.m.daocloud.io/library/node:22-alpine
ARG NGINX_BASE_IMAGE=docker.m.daocloud.io/library/nginx:1.27-alpine

FROM ${NODE_BASE_IMAGE} AS web-builder
WORKDIR /web
COPY package*.json ./
RUN npm install
COPY . ./
RUN npm run build

FROM ${NGINX_BASE_IMAGE}
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-builder /web/dist /usr/share/nginx/html

EXPOSE 80
