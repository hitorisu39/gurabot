# Builder
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl
WORKDIR /gurabot

COPY package.json yarn.lock ./
COPY prisma ./prisma/
RUN yarn install --frozen-lockfile

COPY . .

RUN yarn prisma generate
RUN yarn build:prod

# Runner
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl
WORKDIR /gurabot

ENV NODE_ENV=production
ENV APP_MODE=production

COPY package.json yarn.lock ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

RUN yarn install --production --frozen-lockfile
RUN npx prisma generate

COPY --from=builder /gurabot/dist ./dist

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

ENTRYPOINT ["/gurabot/entrypoint.sh"]