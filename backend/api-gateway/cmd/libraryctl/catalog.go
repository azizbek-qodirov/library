package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"path"
	"strings"
	"time"

	"library-gateway/internal/pkg/config"
	minioConnect "library-gateway/internal/pkg/minio"

	"github.com/minio/minio-go/v7"
)

//go:embed catalog/books.json catalog/covers/* catalog/migrations/000001_insert_uzbek_catalog.sql
var catalogAssets embed.FS

type namedRecord struct {
	Name        string
	Description string
	BirthDate   *string `json:"birth_date"`
}

type catalogBook struct {
	Title           string
	Author          string
	Publisher       string
	Categories      []string
	Description     string
	ISBN            string
	PublicationYear int `json:"publication_year"`
	Pages           int
	Copies          int
	Location        string
	Language        string
	Cover           string
	SHA256          string
}

type demoCatalog struct {
	Authors    map[string]namedRecord
	Publishers map[string]namedRecord
	Categories map[string]namedRecord
	Books      []catalogBook
}

type coverAsset struct {
	data     []byte
	mimeType string
}

func loadCatalog() (demoCatalog, []coverAsset, error) {
	var catalog demoCatalog
	data, err := catalogAssets.ReadFile("catalog/books.json")
	if err != nil {
		return catalog, nil, err
	}
	if err := json.Unmarshal(data, &catalog); err != nil {
		return catalog, nil, err
	}
	if len(catalog.Books) != 10 {
		return catalog, nil, fmt.Errorf("expected ten books, found %d", len(catalog.Books))
	}
	covers := make([]coverAsset, 0, len(catalog.Books))
	for _, book := range catalog.Books {
		if book.Title == "" || len(book.ISBN) != 13 || book.Pages < 1 || book.Copies < 1 ||
			book.Language != "uzb" || book.PublicationYear < 1 || len(book.Categories) == 0 ||
			catalog.Authors[book.Author].Name == "" || catalog.Publishers[book.Publisher].Name == "" {
			return catalog, nil, fmt.Errorf("missing edition metadata for %q", book.Title)
		}
		for _, category := range book.Categories {
			if catalog.Categories[category].Name == "" {
				return catalog, nil, fmt.Errorf("unknown category %q on %q", category, book.Title)
			}
		}
		raw, err := catalogAssets.ReadFile("catalog/" + book.Cover)
		if err != nil {
			return catalog, nil, err
		}
		mimeType := http.DetectContentType(raw)
		digest := sha256.Sum256(raw)
		if (mimeType != "image/jpeg" && mimeType != "image/png" && mimeType != "image/webp") ||
			hex.EncodeToString(digest[:]) != book.SHA256 {
			return catalog, nil, fmt.Errorf("invalid cover file for %q", book.Title)
		}
		covers = append(covers, coverAsset{data: raw, mimeType: mimeType})
	}
	return catalog, covers, nil
}

const catalogTables = "borrowings, recommendeds, book_authors, book_categories, book_copies, books, users, authors, categories, publishers, files"

func seedCatalog(ctx context.Context, db *sql.DB, onlyIfEmpty bool) error {
	catalog, covers, err := loadCatalog()
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtext('library demo catalog'))"); err != nil {
		return err
	}

	if onlyIfEmpty {
		// Write the marker once, even when adopting an already-populated database.
		var initialized bool
		if err := tx.QueryRowContext(ctx, "SELECT EXISTS (SELECT FROM library_setup WHERE key = 'demo_catalog')").Scan(&initialized); err != nil {
			return err
		}
		if initialized {
			log.Print("Catalog bootstrap has already run")
			return nil
		}
		if _, err := tx.ExecContext(ctx, "LOCK TABLE "+catalogTables+" IN SHARE ROW EXCLUSIVE MODE"); err != nil {
			return err
		}
		var hasRecords bool
		if err := tx.QueryRowContext(ctx, `SELECT
			EXISTS (SELECT FROM books) OR EXISTS (SELECT FROM users) OR EXISTS (SELECT FROM authors)
			OR EXISTS (SELECT FROM categories) OR EXISTS (SELECT FROM publishers) OR EXISTS (SELECT FROM files)
			OR EXISTS (SELECT FROM borrowings) OR EXISTS (SELECT FROM recommendeds)
			OR EXISTS (SELECT FROM book_authors) OR EXISTS (SELECT FROM book_categories)`).Scan(&hasRecords); err != nil {
			return err
		}
		if hasRecords {
			if err := markCatalogInitialized(ctx, tx); err != nil {
				return err
			}
			log.Print("Existing records found. Initial demo seeding skipped.")
			return tx.Commit()
		}
	}

	cfg := config.Load()
	publicURL := strings.TrimRight(cfg.MINIO_PUBLIC_URL, "/")
	if publicURL == "" {
		scheme := "http"
		if cfg.MINIO_USE_SSL {
			scheme = "https"
		}
		publicURL = scheme + "://" + cfg.MINIO_ENDPOINT
	}
	storage, err := minioConnect.NewMinioClient(&cfg)
	if err != nil {
		return fmt.Errorf("initialize cover storage: %w", err)
	}

	var batch [12]byte
	if _, err := rand.Read(batch[:]); err != nil {
		return err
	}
	prefix := "demo-covers/" + hex.EncodeToString(batch[:])
	keys := make([]string, 0, len(covers))
	commitAttempted := false
	defer func() {
		if commitAttempted || len(keys) == 0 {
			return
		}
		_ = tx.Rollback()
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		for _, key := range keys {
			if err := storage.Client.RemoveObject(cleanupCtx, storage.DefaultBucket(), key, minio.RemoveObjectOptions{}); err != nil {
				log.Printf("could not clean up staged cover %s: %v", key, err)
			}
		}
	}()
	for i, cover := range covers {
		key := path.Join(prefix, path.Base(catalog.Books[i].Cover))
		keys = append(keys, key)
		if _, err := storage.Client.PutObject(ctx, storage.DefaultBucket(), key, bytes.NewReader(cover.data),
			int64(len(cover.data)), minio.PutObjectOptions{ContentType: cover.mimeType}); err != nil {
			return fmt.Errorf("upload cover for %q: %w", catalog.Books[i].Title, err)
		}
	}

	if !onlyIfEmpty {
		// Replace application data in one transaction and keep schema history.
		if _, err := tx.ExecContext(ctx, "TRUNCATE "+catalogTables); err != nil {
			return fmt.Errorf("clear library records: %w", err)
		}
	}
	if err := insertCatalog(ctx, tx, catalog, covers, keys, publicURL+"/"+storage.DefaultBucket()); err != nil {
		return err
	}

	if err := markCatalogInitialized(ctx, tx); err != nil {
		return err
	}
	// A connection failure during commit can leave its outcome uncertain. Keep these cover objects.
	commitAttempted = true
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit catalog reset: %w", err)
	}
	log.Printf("Catalog now has %d books, %d authors, %d publishers, %d categories, and %d covers",
		len(catalog.Books), len(catalog.Authors), len(catalog.Publishers), len(catalog.Categories), len(covers))
	return nil
}

func markCatalogInitialized(ctx context.Context, tx *sql.Tx) error {
	_, err := tx.ExecContext(ctx,
		"INSERT INTO library_setup (key) VALUES ('demo_catalog') ON CONFLICT DO NOTHING")
	return err
}

func insertCatalog(ctx context.Context, tx *sql.Tx, catalog demoCatalog, covers []coverAsset, keys []string, coverBaseURL string) error {
	type storedCover struct {
		URL       string `json:"url"`
		MimeType  string `json:"mime_type"`
		Size      int    `json:"size"`
		ObjectKey string `json:"object_key"`
	}
	storedCovers := make(map[string]storedCover, len(covers))
	for i, book := range catalog.Books {
		storedCovers[book.ISBN] = storedCover{
			URL: coverBaseURL + "/" + keys[i], MimeType: covers[i].mimeType,
			Size: len(covers[i].data), ObjectKey: keys[i],
		}
	}
	coverJSON, err := json.Marshal(storedCovers)
	if err != nil {
		return err
	}
	manifest, err := catalogAssets.ReadFile("catalog/books.json")
	if err != nil {
		return err
	}
	migration, err := catalogAssets.ReadFile("catalog/migrations/000001_insert_uzbek_catalog.sql")
	if err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx,
		"CREATE TEMP TABLE catalog_seed_payload (manifest jsonb, covers jsonb) ON COMMIT DROP"); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx,
		"INSERT INTO catalog_seed_payload VALUES ($1::jsonb, $2::jsonb)", string(manifest), string(coverJSON)); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, string(migration)); err != nil {
		return fmt.Errorf("apply catalog insertion migration: %w", err)
	}
	return nil
}
