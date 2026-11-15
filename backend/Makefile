run:
	(cd library-service && make run) &
	(cd api-gateway && make run) &
	wait

swag_gen:
	swag init -g ./internal/http/router.go -o ./internal/http/docs force 1

proto_gen:
	protoc --go_out=./ --go-grpc_out=./ library_submodule/*.proto
	
drun:
	docker run -p 9000:9000 -p 9001:9001 --name minio -v ~/minio/data:/data -e "MINIO_ROOT_USER=user" -e "MINIO_ROOT_PASSWORD=password" quay.io/minio/minio server /data --console-address ":9001"

spull:
	cd library_submodule && git pull
	make proto-gen