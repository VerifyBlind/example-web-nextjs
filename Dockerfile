# 1. Build Stage
FROM node:20-alpine AS builder
WORKDIR /app

ENV NODE_OPTIONS="--max-old-space-size=1536"

COPY package*.json ./
RUN --mount=type=cache,id=npm-example-web-nextjs,target=/root/.npm,sharing=shared \
    npm install --legacy-peer-deps --no-audit --no-fund

COPY . .

ARG LOCAL_URL_REPLACE=false
RUN if [ "$LOCAL_URL_REPLACE" = "true" ]; then \
      find /app -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.js" -o -name "*.html" \) \
        -not -path "*/node_modules/*" \
        -exec sed -i \
          -e 's|https://cdn.verifyblind.com|http://cdn.verifyblind.localhost|g' \
          -e 's|https://api.verifyblind.com|http://api.verifyblind.localhost|g' \
          -e 's|https://partner.verifyblind.com|http://partner.verifyblind.localhost|g' \
          -e 's|https://admin.verifyblind.com|http://admin.verifyblind.localhost|g' \
          -e 's|https://test.verifyblind.com|http://test.verifyblind.localhost|g' \
          -e 's|https://app.verifyblind.com|http://app.verifyblind.localhost|g' \
          -e 's|https://verifyblind.com|http://verifyblind.localhost|g' \
          {} +; \
    fi

# Sentry DSN build anında bundle'a gömülür (NEXT_PUBLIC_*). CI --build-arg ile geçer; boşsa Sentry kapalı.
ARG NEXT_PUBLIC_EXAMPLES_SENTRY_DSN=
ENV NEXT_PUBLIC_EXAMPLES_SENTRY_DSN=$NEXT_PUBLIC_EXAMPLES_SENTRY_DSN

RUN npm run build

# 2. Runtime Stage (standalone output)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3001
CMD ["node", "server.js"]
