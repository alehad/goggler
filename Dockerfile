FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run prisma:generate
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S goggler && adduser -S goggler -G goggler
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER goggler
EXPOSE 3000
CMD ["node", "server.js"]
