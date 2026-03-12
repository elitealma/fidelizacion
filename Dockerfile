# Usa una imagen oficial de Nginx más ligera
FROM nginx:alpine

# Copiamos los archivos estáticos de la web a la carpeta por defecto de Nginx
COPY . /usr/share/nginx/html

# (Opcional) Copiar archivo de configuración personalizado de nginx si hubiera
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
