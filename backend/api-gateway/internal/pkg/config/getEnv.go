package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
	"github.com/spf13/cast"
)

type Config struct {
	GATEWAY_HTTP_PORT string
	LIBRARY_GRPC_PORT string

	MINIO_ENDPOINT    string
	MINIO_ACCESS_KEY  string
	MINIO_SECRET_KEY  string
	MINIO_USE_SSL     bool
	MINIO_BUCKET_NAME string

	CORS_ALLOWED_ORIGINS string
}

func Load() Config {
	if err := godotenv.Load(); err != nil {
		fmt.Println("No .env file found")
	}

	config := Config{}

	config.LIBRARY_GRPC_PORT = cast.ToString(get("LIBRARY_GRPC_PORT", ":50050"))
	config.GATEWAY_HTTP_PORT = cast.ToString(get("GATEWAY_HTTP_PORT", ":8088"))

	config.MINIO_ENDPOINT = cast.ToString(get("MINIO_ENDPOINT", "localhost:9000"))
	config.MINIO_ACCESS_KEY = cast.ToString(get("MINIO_ACCESS_KEY", "user"))
	config.MINIO_SECRET_KEY = cast.ToString(get("MINIO_SECRET_KEY", "password"))
	config.MINIO_USE_SSL = cast.ToBool(get("MINIO_USE_SSL", false))
	config.MINIO_BUCKET_NAME = cast.ToString(get("MINIO_BUCKET_NAME", "files-bucket"))

	config.CORS_ALLOWED_ORIGINS = cast.ToString(get("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173"))

	return config
}

func get(key string, defaultValue any) any {
	val, exists := os.LookupEnv(key)

	if exists {
		return val
	}

	return defaultValue
}
