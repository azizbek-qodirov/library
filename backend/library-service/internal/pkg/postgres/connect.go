package postgres

import (
	"database/sql"
	"fmt"
	"library/internal/pkg/config"
	"time"

	_ "github.com/lib/pq"
)

type Postgres struct {
	DB *sql.DB
}

func New(cfg *config.Config) (*Postgres, error) {
	dbConn := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable",
		cfg.PostgresUser,
		cfg.PostgresPassword,
		cfg.PostgresHost,
		cfg.PostgresPort,
		cfg.PostgresDatabase)
	db, err := sql.Open("postgres", dbConn)
	if err != nil {
		return nil, err
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)                // Maximum number of open connections
	db.SetMaxIdleConns(5)                 // Maximum number of idle connections
	db.SetConnMaxLifetime(5 * time.Minute) // 5 minutes

	err = db.Ping()
	if err != nil {
		return nil, err
	}

	return &Postgres{DB: db}, nil
}
func (db *Postgres) Close() error {
	return db.DB.Close()
}
