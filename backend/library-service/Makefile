.PHONY: run migrate_up migrate_down proto_gen

run:
	go run ./cmd

migrate_up:
	@test -n "$$DATABASE_URL" || (echo "Set DATABASE_URL first" >&2; exit 1)
	migrate -path internal/migrations -database "$$DATABASE_URL" up

migrate_down:
	@test -n "$$DATABASE_URL" || (echo "Set DATABASE_URL first" >&2; exit 1)
	migrate -path internal/migrations -database "$$DATABASE_URL" down 1

proto_gen:
	../proto/generate.sh
