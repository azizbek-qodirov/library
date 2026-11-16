# University Library

The public React app serves the catalog. The librarian React app manages books, borrowers, loans, and recommendations. Both use the Go HTTP gateway, which calls the Go library service over gRPC. PostgreSQL stores records and MinIO stores public cover images.

## Run locally

Install Go 1.24.5, Node 22, PostgreSQL, MinIO, and the `migrate` CLI with PostgreSQL support.

1. Start PostgreSQL and create an empty `library_db` database. Start MinIO and create credentials that can manage the cover bucket.
2. Copy each `.env.example` to `.env` in `backend/library-service/`, `backend/api-gateway/`, `frontend/`, and `librarian/`. Set your PostgreSQL, MinIO, and librarian credentials in the backend files.
3. Run `DATABASE_URL='postgres://USER:PASSWORD@localhost:5432/library_db?sslmode=disable' make migrate` with your PostgreSQL connection URL. URL-encode special characters in the connection string.
4. Install frontend dependencies with `(cd frontend && npm ci) && (cd librarian && npm ci)`.
5. Run `make run`. Open the catalog at [localhost:5173](http://localhost:5173), the librarian app at [localhost:5174](http://localhost:5174), and Swagger at [localhost:8088/api/swagger/index.html](http://localhost:8088/api/swagger/index.html). Press Ctrl+C to stop all four processes.

The gateway checks `STAFF_USERNAME` and `STAFF_PASSWORD` for staff routes. Unconfigured staff access is disabled. The browser keeps credentials in memory until sign-out or refresh. Use HTTPS for the public gateway in production. Keep the gRPC listener on loopback or a private service network accessible to the gateway only. Set `LIBRARY_GRPC_ADDRESS` and `GRPC_BIND_ADDRESS` when running across separate containers. Configure `MINIO_PUBLIC_URL` to the browser-accessible HTTPS base URL for the cover bucket. Use a bucket dedicated to public cover images.

## Upgrade an existing database

Back up the database, then run `make migrate` before deploying both new Go services. Migration 000003 treats borrowed and lost records as outstanding copies. It sets availability to total copies minus those records and raises totals when there are already more outstanding records than copies. Review these counts against physical stock if the old catalog tracked missing or unavailable copies manually. Lost copies become available again only when marked returned.

A failed cover upload remains identifiable in the staff file list. After two minutes, retry cleanup with `DELETE /file/{id}`. Retry the same deletion if object storage is temporarily unavailable. A cover still attached to a catalog record cannot be deleted.

The repository previously tracked local service credentials and runtime logs. Rotate any previously committed credential that was used in a real environment.

## Check and regenerate

Run `make check` after installing dependencies. To exercise the PostgreSQL integration tests, set `LIBRARY_TEST_DATABASE_URL` to a disposable PostgreSQL database whose user can create schemas. The tests apply migrations in an isolated schema and clean it up.

The canonical protobuf source is `backend/proto/library_submodule/`. Install `protoc` 31.1, then install the matching Go generators and run `make proto_gen`.

```sh
go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.6
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.5.1
go install github.com/swaggo/swag/cmd/swag@v1.16.6
make proto_gen
make -C backend swag_gen
```

The tools must be on `PATH`. Generated Go is checked in for both modules. Existing protobuf field numbers and public JSON property names are preserved so the two frontends and other clients can upgrade together.

## Docker Compose and deployment

Use Docker Engine with the Compose v2 plugin. From the repository root, copy `.env.example` to `.env`, set the database, storage, and staff credentials, then run:

```sh
docker compose up --build -d --wait
```

Open [the catalog](http://localhost:8080/), [the librarian dashboard](http://localhost:8080/librarian/), or [Swagger](http://localhost:8080/api/swagger/index.html). The stack publishes only the web proxy. PostgreSQL, MinIO, and the gRPC service are reachable on the Compose network. The default web binding is `127.0.0.1:8080`. On the server, route your HTTPS reverse proxy to that port.

The Docker build regenerates and compares both sets of Go protobuf files, tests the Go modules, and builds and lints both React apps. Compose waits for PostgreSQL and object storage, runs the migrations, then runs the one-time catalog bootstrap and starts the application. The bootstrap inserts the demo into a new empty database. On an existing database with any catalog or borrower data, it skips the demo and marks the bootstrap complete. PostgreSQL and MinIO use named volumes. The deploy workflow reuses those volumes.

### Explicit database reset

This command replaces every catalog and circulation table, including users and borrowing history, with the sample catalog on the Docker database you select. It keeps the schema and previous objects in MinIO. Run it only where you intend to erase the records.

```sh
docker compose run --rm seed
```

The seed contains ten Uzbek editions, eight authors, five publishers, seven categories, ten covers, and three featured titles. Users and loans start empty. Edition years and page counts come from the linked listings. Physical stock and placement are sample values. The manifest and covers are in `backend/api-gateway/cmd/libraryctl/catalog/`. The versioned insertion SQL at `catalog/migrations/000001_insert_uzbek_catalog.sql` runs through `libraryctl` in the same transaction as the bootstrap marker, after MinIO has received the covers.

### GitHub Actions

The single workflow validates pull requests to `main`. Its smoke checks exercise the seeded catalog, CRUD requests, filter validation, lending transitions, and cover storage on a disposable stack. A successful push to `main` ships the tested images and Compose configuration over SSH, then waits for the stack to become healthy. Use a Linux x86-64 server with Docker Engine and Compose v2. The SSH account must be able to run Docker and write to its own home directory. The active release is available in `~/library-deploy/current` after a successful deployment.

Set these repository secrets:

| Secret | Value |
|---|---|
| `SSH_HOST` | Deployment server hostname or IP address |
| `SSH_USER` | Deployment SSH user |
| `SSH_PRIVATE_KEY` | Private key accepted by the server for noninteractive login |
| `SSH_KNOWN_HOSTS` | Verified OpenSSH known-hosts entry for the server |
| `DEPLOY_ENV` | Complete Compose dotenv contents, using the root `.env.example` as the template |

For a custom SSH port, set the optional repository variable `SSH_PORT` and provide the matching `[host]:port` entry in `SSH_KNOWN_HOSTS`. Quote any dotenv values containing a dollar sign with single quotes. Keep database and storage settings stable between releases. Changing a PostgreSQL initialization password in dotenv does not rotate the password inside an existing volume.

When managing a release on the server, run Compose commands from `~/library-deploy/current`. Back up the database before an intentional reset or production schema upgrade. The workflow applies schema migrations on deploy and keeps reset as an explicit maintenance command.
