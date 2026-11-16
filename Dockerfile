# syntax=docker/dockerfile:1.7
FROM golang:1.24.5-alpine AS proto
ARG TARGETARCH
RUN apk add --no-cache ca-certificates curl unzip
RUN case "$TARGETARCH" in amd64) arch=x86_64 ;; arm64) arch=aarch_64 ;; *) exit 1 ;; esac \
    && curl -fsSL "https://github.com/protocolbuffers/protobuf/releases/download/v31.1/protoc-31.1-linux-${arch}.zip" -o /tmp/protoc.zip \
    && unzip -q /tmp/protoc.zip -d /usr/local && rm /tmp/protoc.zip
RUN --mount=type=cache,target=/go/pkg/mod \
    go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.6 \
    && go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.5.1

FROM proto AS go-build
WORKDIR /src
COPY backend/api-gateway/go.mod backend/api-gateway/go.sum backend/api-gateway/
COPY backend/library-service/go.mod backend/library-service/go.sum backend/library-service/
RUN --mount=type=cache,target=/go/pkg/mod \
    (cd backend/api-gateway && go mod download) && (cd backend/library-service && go mod download)
COPY backend/proto backend/proto
COPY backend/api-gateway backend/api-gateway
COPY backend/library-service backend/library-service
RUN cp -R backend/api-gateway/internal/pkg/genproto /tmp/gateway-proto \
    && cp -R backend/library-service/internal/pkg/genproto /tmp/service-proto \
    && backend/proto/generate.sh \
    && diff -r /tmp/gateway-proto backend/api-gateway/internal/pkg/genproto \
    && diff -r /tmp/service-proto backend/library-service/internal/pkg/genproto

FROM go-build AS go-binaries
ENV CGO_ENABLED=0
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    (cd backend/api-gateway && go test ./... && go build -trimpath -o /out/gateway . && go build -trimpath -o /out/libraryctl ./cmd/libraryctl) \
    && (cd backend/library-service && go test ./... && go build -trimpath -o /out/library-service ./cmd)

FROM golang:1.24.5-alpine AS object-storage-build
ENV CGO_ENABLED=0
RUN apk add --no-cache ca-certificates
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    go install github.com/minio/minio@v0.0.0-20250422221226-0d7408fc9969

FROM node:22-alpine AS web-build
WORKDIR /src
COPY frontend/package*.json frontend/
COPY librarian/package*.json librarian/
RUN --mount=type=cache,target=/root/.npm \
    (cd frontend && npm ci) && (cd librarian && npm ci)
COPY shared shared
COPY frontend frontend
COPY librarian librarian
ENV VITE_API_URL=/api
RUN (cd frontend && npm run lint && npm run build) \
    && (cd librarian && npm run lint && npm run build -- --base=/librarian/)

FROM alpine:3.22 AS runtime
RUN apk add --no-cache ca-certificates \
    && addgroup -S -g 10001 library \
    && adduser -S -D -H -u 10001 -G library library \
    && mkdir -p /app/logs /data \
    && chown -R library:library /app /data
WORKDIR /app
USER 10001:10001

FROM runtime AS gateway
COPY --from=go-binaries /out/gateway /usr/local/bin/gateway
EXPOSE 8088
ENTRYPOINT ["/usr/local/bin/gateway"]

FROM runtime AS library-service
COPY --from=go-binaries /out/library-service /usr/local/bin/library-service
EXPOSE 50050
ENTRYPOINT ["/usr/local/bin/library-service"]

FROM runtime AS ops
COPY --from=go-binaries /out/libraryctl /usr/local/bin/libraryctl
COPY backend/library-service/internal/migrations /app/migrations
ENTRYPOINT ["/usr/local/bin/libraryctl"]

FROM runtime AS object-storage
COPY --from=object-storage-build /go/bin/minio /usr/local/bin/minio
ENV HOME=/data
EXPOSE 9000
ENTRYPOINT ["/usr/local/bin/minio"]
CMD ["server", "/data", "--address", ":9000", "--console-address", "127.0.0.1:9001"]

FROM nginx:1.28-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /src/frontend/dist/ /usr/share/nginx/html/
COPY --from=web-build /src/librarian/dist/ /usr/share/nginx/html/librarian/
EXPOSE 8080
