.PHONY: run check proto_gen migrate

run:
	bash scripts/dev.sh

check:
	cd backend/library-service && go test ./...
	cd backend/api-gateway && go test ./...
	cd frontend && npm run lint && npm run build
	cd librarian && npm run lint && npm run build

proto_gen:
	backend/proto/generate.sh

migrate:
	$(MAKE) -C backend/library-service migrate_up
