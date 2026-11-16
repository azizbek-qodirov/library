package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func main() {
	if len(os.Args) != 2 {
		log.Fatal("usage: libraryctl migrate | seed-if-empty | reset-demo-catalog")
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := run(ctx, os.Args[1]); err != nil {
		log.Fatal(err)
	}
}

func run(ctx context.Context, command string) error {
	if command != "migrate" && command != "seed-if-empty" && command != "reset-demo-catalog" {
		return fmt.Errorf("unknown command %q", command)
	}
	db, err := openDatabase()
	if err != nil {
		return err
	}
	defer db.Close()

	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := db.PingContext(pingCtx); err != nil {
		return fmt.Errorf("connect to PostgreSQL: %w", err)
	}

	if command != "migrate" {
		return seedCatalog(ctx, db, command == "seed-if-empty")
	}
	dir, err := filepath.Abs(env("MIGRATIONS_DIR", "/app/migrations"))
	if err != nil {
		return err
	}
	driver, err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		return err
	}
	source := url.URL{Scheme: "file", Path: dir}
	runner, err := migrate.NewWithDatabaseInstance(source.String(), "postgres", driver)
	if err != nil {
		return err
	}
	defer runner.Close()
	if err := runner.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("apply PostgreSQL migrations: %w", err)
	}
	log.Print("PostgreSQL schema is up to date")
	return nil
}

func openDatabase() (*sql.DB, error) {
	dsn := url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(env("POSTGRES_USER", "postgres"), os.Getenv("POSTGRES_PASSWORD")),
		Host:   net.JoinHostPort(env("POSTGRES_HOST", "postgres"), env("POSTGRES_PORT", "5432")),
		Path:   "/" + env("POSTGRES_DATABASE", "library_db"),
	}
	values := dsn.Query()
	values.Set("sslmode", env("POSTGRES_SSL_MODE", "disable"))
	values.Set("connect_timeout", "10")
	dsn.RawQuery = values.Encode()
	return sql.Open("postgres", dsn.String())
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
