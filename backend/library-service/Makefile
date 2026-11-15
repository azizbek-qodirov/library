run:
	go mod tidy;
	make proto_gen;
	clear;
	go run cmd/main.go;

migrate_up:
	migrate -path internal/migrations -database postgres://postgres:1129@localhost:5432/library_db?sslmode=disable -verbose up

migrate_down:
	migrate -path internal/migrations -database postgres://postgres:1129@localhost:5432/library_db?sslmode=disable -verbose down

migrate_force:
	migrate -path internal/migrations -database postgres://postgres:1129@localhost:5432/library_db?sslmode=disable -verbose force 1

migrate_file:
	migrate create -ext sql -dir internal/migrations -seq create_table

proto_gen:
	protoc --go_out=./ --go-grpc_out=./ library_submodule/*.proto

spush:
	cd library_submodule && git add . && git commit -m "protos changed" && git push
	make proto_gen