package postgres

import (
	"context"
	"database/sql"
	"library/internal/pkg/config"
	"net"
	"net/url"
	"strconv"
	"time"

	_ "github.com/lib/pq"
)

type Postgres struct {
	DB *sql.DB
}

func New(cfg *config.Config) (*Postgres, error) {
	dsn := url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(cfg.PostgresUser, cfg.PostgresPassword),
		Host:   net.JoinHostPort(cfg.PostgresHost, strconv.Itoa(cfg.PostgresPort)),
		Path:   "/" + cfg.PostgresDatabase,
	}
	options := dsn.Query()
	options.Set("sslmode", cfg.PostgresSSLMode)
	dsn.RawQuery = options.Encode()
	db, err := sql.Open("postgres", dsn.String())
	if err != nil {
		return nil, err
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)                 // Maximum number of open connections
	db.SetMaxIdleConns(5)                  // Maximum number of idle connections
	db.SetConnMaxLifetime(5 * time.Minute) // 5 minutes

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	err = db.PingContext(ctx)
	if err != nil {
		return nil, err
	}

	return &Postgres{DB: db}, nil
}
func (db *Postgres) Close() error {
	return db.DB.Close()
}
