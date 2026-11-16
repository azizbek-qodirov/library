.PHONY: run proto_gen swag_gen

run:
	go run .

proto_gen:
	../proto/generate.sh

swag_gen:
	swag init -g ./internal/http/router.go -o ./internal/http/docs --parseInternal
