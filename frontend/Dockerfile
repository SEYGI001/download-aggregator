# Imagem de producao do frontend: arquivos estaticos servidos por nginx.
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html app.js styles.css config.js /usr/share/nginx/html/

EXPOSE 80