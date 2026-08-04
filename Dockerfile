# ---------------------------------------------------------
# Shared runtime base
# ---------------------------------------------------------
FROM node:20-bookworm-slim AS base

WORKDIR /gurabot

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        openssl \
        libcairo2 \
        libpango-1.0-0 \
        libjpeg62-turbo \
        libgif7 \
        librsvg2-2 \
        fontconfig \
        fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*


# ---------------------------------------------------------
# Native dependency build environment
# ---------------------------------------------------------
FROM base AS build-base

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        build-essential \
        pkg-config \
        libcairo2-dev \
        libpango1.0-dev \
        libjpeg-dev \
        libgif-dev \
        librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*


# ---------------------------------------------------------
# Application builder
# ---------------------------------------------------------
FROM build-base AS builder

COPY package.json yarn.lock ./
COPY prisma ./prisma/

RUN yarn install --frozen-lockfile

COPY . .

RUN yarn prisma generate
RUN yarn build:prod


# ---------------------------------------------------------
# Production dependencies
# ---------------------------------------------------------
FROM build-base AS production-dependencies

COPY package.json yarn.lock ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

RUN yarn install --production --frozen-lockfile
RUN npx prisma generate


# ---------------------------------------------------------
# Production runner
# ---------------------------------------------------------
FROM base AS runner

ENV NODE_ENV=production
ENV APP_MODE=production

COPY --from=production-dependencies /gurabot /gurabot

COPY --from=builder /gurabot/dist ./dist

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

ENTRYPOINT ["/gurabot/entrypoint.sh"]