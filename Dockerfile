FROM node:22-alpine AS build

WORKDIR /app

COPY my-react-app/package*.json ./
RUN npm ci

COPY my-react-app/ ./

# .env files stay out of the image (.dockerignore), so Vite gets the Google sign-in client ID as a
# build argument: docker build --build-arg VITE_GOOGLE_CLIENT_ID=... .
# The API needs none: the site calls /api, which nginx.conf forwards to the backend.
ARG VITE_GOOGLE_CLIENT_ID
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]