FROM node:24.22.1-slim AS build
WORKDIR /workspace
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend ./frontend
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
WORKDIR /workspace/frontend
RUN npm run build

FROM node:24.22.1-slim AS run
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /workspace/frontend
COPY --from=build /workspace/frontend/.next-prod/standalone ./.next-prod/standalone
RUN test -f .next-prod/standalone/frontend/server.js
EXPOSE 3000
CMD ["node", ".next-prod/standalone/frontend/server.js"]
