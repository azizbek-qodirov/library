package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
	"github.com/spf13/cast"
)

type Config struct {
	GRPCPort string

	PostgresHost     string
	PostgresPort     int
	PostgresUser     string
	PostgresPassword string
	PostgresDatabase string
	PostgresSSLMode  string
}

func Load() Config {
	if err := godotenv.Load(); err != nil {
		fmt.Println("No .env file found")
	}

	config := Config{}

	config.GRPCPort = cast.ToString(get("GRPC_BIND_ADDRESS", "127.0.0.1"+cast.ToString(get("GRPC_PORT", ":50050"))))

	config.PostgresHost = cast.ToString(get("POSTGRES_HOST", "localhost"))
	config.PostgresPort = cast.ToInt(get("POSTGRES_PORT", 5432))
	config.PostgresUser = cast.ToString(get("POSTGRES_USER", "postgres"))
	config.PostgresPassword = os.Getenv("POSTGRES_PASSWORD")
	config.PostgresDatabase = cast.ToString(get("POSTGRES_DATABASE", "library_db"))
	config.PostgresSSLMode = cast.ToString(get("POSTGRES_SSL_MODE", "disable"))

	return config
}

func get(key string, defaultValue interface{}) interface{} {
	val, exists := os.LookupEnv(key)

	if exists {
		return val
	}

	return defaultValue
}
