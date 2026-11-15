package repo

import (
	"context"
	"database/sql"

	pb "library/internal/pkg/genproto"
)

type RecommendedRepo struct {
	db *sql.DB
}

func NewRecommendedRepo(db *sql.DB) *RecommendedRepo {
	return &RecommendedRepo{db: db}
}

func (r *RecommendedRepo) CreateRecommended(ctx context.Context, req *pb.RecommendedCreateReq) (*pb.Void, error) {
	query := `INSERT INTO recommendeds (book_id) VALUES ($1)`
	_, err := r.db.ExecContext(ctx, query, req.BookId)
	if err != nil {
		return nil, err
	}
	return &pb.Void{}, nil
}

func (r *RecommendedRepo) GetRecommended(ctx context.Context, req *pb.ByID) (*pb.RecommendedGetRes, error) {
	// Fetch the recommended row and its book
	query := `
		SELECT r.id, r.created_at,
		       b.id, b.title, b.cover_image_id, b.location,
		       b.is_reference_only, b.description, b.isbn, b.published_date,
		       b.publisher_id, b.language, b.page_count, b.total_copies, b.available_copies
		FROM recommendeds r
		JOIN books b ON r.book_id = b.id
		WHERE r.id = $1
	`

	var rec pb.RecommendedGetRes
	var book pb.BookGetRes
	var publisherID sql.NullString
	var coverFileID sql.NullString

	err := r.db.QueryRowContext(ctx, query, req.Id).Scan(
		&rec.Id,
		&rec.CreatedAt,
		&book.Id,
		&book.Title,
		&coverFileID,
		&book.Location,
		&book.IsReferenceOnly,
		&book.Description,
		&book.Isbn,
		&book.PublishedDate,
		&publisherID,
		&book.Language,
		&book.PageCount,
		&book.TotalCopies,
		&book.AvailableCopies,
	)
	if err != nil {
		return nil, err
	}

	// Fetch cover image as object
	if coverFileID.Valid && coverFileID.String != "" {
		var file pb.FileGetRes
		err := r.db.QueryRowContext(ctx, `
			SELECT id, url, mime_type, size, created_at, updated_at
			FROM files
			WHERE id = $1
		`, coverFileID.String).Scan(
			&file.Id, &file.Url, &file.MimeType, &file.Size, &file.CreatedAt, &file.UpdatedAt,
		)
		if err != nil && err != sql.ErrNoRows {
			return nil, err
		}
		if err == nil {
			book.CoverImageId = &file
		}
	}

	// Fetch Publisher
	if publisherID.Valid && publisherID.String != "" {
		var pub pb.PublisherGetRes
		if err := r.db.QueryRowContext(ctx,
			`SELECT id, name, description FROM publishers WHERE id = $1`,
			publisherID.String,
		).Scan(&pub.Id, &pub.Name, &pub.Description); err == nil {
			book.PublisherId = &pub
		} else if err != sql.ErrNoRows {
			return nil, err
		}
	}

	// Fetch Authors
	authorRows, err := r.db.QueryContext(ctx, `
		SELECT a.id, a.name, a.birth_date, a.biography
		FROM book_authors ba
		JOIN authors a ON ba.author_id = a.id
		WHERE ba.book_id = $1
	`, book.Id)
	if err == nil {
		defer authorRows.Close()
		for authorRows.Next() {
			var a pb.AuthorGetRes
			if err := authorRows.Scan(&a.Id, &a.Name, &a.BirthDate, &a.Biography); err != nil {
				return nil, err
			}
			book.AuthorIds = append(book.AuthorIds, &a)
		}
	}

	// Fetch Categories
	categoryRows, err := r.db.QueryContext(ctx, `
		SELECT c.id, c.name, c.description
		FROM book_categories bc
		JOIN categories c ON bc.category_id = c.id
		WHERE bc.book_id = $1
	`, book.Id)
	if err == nil {
		defer categoryRows.Close()
		for categoryRows.Next() {
			var c pb.CategoryGetRes
			if err := categoryRows.Scan(&c.Id, &c.Name, &c.Description); err != nil {
				return nil, err
			}
			book.CategoryIds = append(book.CategoryIds, &c)
		}
	}

	rec.BookId = &book
	return &rec, nil
}

func (r *RecommendedRepo) DeleteRecommended(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	query := `DELETE FROM recommendeds WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, req.Id)
	if err != nil {
		return nil, err
	}
	return &pb.Void{}, nil
}

func (r *RecommendedRepo) GetAllRecommendeds(ctx context.Context, req *pb.RecommendedsGetAllReq) (*pb.RecommendedsGetAllRes, error) {
	query := `
		SELECT r.id, r.created_at,
		       b.id, b.title, b.cover_image_id, b.location,
		       b.is_reference_only, b.description, b.isbn, b.published_date,
		       b.publisher_id, b.language, b.page_count, b.total_copies, b.available_copies
		FROM recommendeds r
		JOIN books b ON r.book_id = b.id
		ORDER BY r.created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.db.QueryContext(ctx, query, req.Limit, req.Offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var recommendeds []*pb.RecommendedGetRes

	for rows.Next() {
		var rec pb.RecommendedGetRes
		var book pb.BookGetRes
		var publisherID, coverImageID string

		if err := rows.Scan(
			&rec.Id,
			&rec.CreatedAt,
			&book.Id,
			&book.Title,
			&coverImageID,
			&book.Location,
			&book.IsReferenceOnly,
			&book.Description,
			&book.Isbn,
			&book.PublishedDate,
			&publisherID,
			&book.Language,
			&book.PageCount,
			&book.TotalCopies,
			&book.AvailableCopies,
		); err != nil {
			return nil, err
		}

		// Cover Image
		if coverImageID != "" {
			var file pb.FileGetRes
			fileQuery := `SELECT id, url, mime_type, size, created_at, updated_at FROM files WHERE id = $1`
			if err := r.db.QueryRowContext(ctx, fileQuery, coverImageID).Scan(
				&file.Id,
				&file.Url,
				&file.MimeType,
				&file.Size,
				&file.CreatedAt,
				&file.UpdatedAt,
			); err == nil {
				book.CoverImageId = &file
			}
		}

		// Publisher
		var pub pb.PublisherGetRes
		pubQuery := `SELECT id, name, description FROM publishers WHERE id = $1`
		if err := r.db.QueryRowContext(ctx, pubQuery, publisherID).Scan(
			&pub.Id,
			&pub.Name,
			&pub.Description,
		); err == nil {
			book.PublisherId = &pub
		}

		// Authors
		authorQuery := `
			SELECT a.id, a.name, a.birth_date, a.biography
			FROM book_authors ba
			JOIN authors a ON ba.author_id = a.id
			WHERE ba.book_id = $1
		`
		authorRows, err := r.db.QueryContext(ctx, authorQuery, book.Id)
		if err == nil {
			defer authorRows.Close()
			for authorRows.Next() {
				var a pb.AuthorGetRes
				if err := authorRows.Scan(&a.Id, &a.Name, &a.BirthDate, &a.Biography); err != nil {
					return nil, err
				}
				book.AuthorIds = append(book.AuthorIds, &a)
			}
		}

		// Categories
		categoryQuery := `
			SELECT c.id, c.name, c.description
			FROM book_categories bc
			JOIN categories c ON bc.category_id = c.id
			WHERE bc.book_id = $1
		`
		categoryRows, err := r.db.QueryContext(ctx, categoryQuery, book.Id)
		if err == nil {
			defer categoryRows.Close()
			for categoryRows.Next() {
				var c pb.CategoryGetRes
				if err := categoryRows.Scan(&c.Id, &c.Name, &c.Description); err != nil {
					return nil, err
				}
				book.CategoryIds = append(book.CategoryIds, &c)
			}
		}

		rec.BookId = &book
		recommendeds = append(recommendeds, &rec)
	}

	// Count
	var total int64
	countQuery := "SELECT count(id) FROM recommendeds"
	if err := r.db.QueryRowContext(ctx, countQuery).Scan(&total); err != nil {
		return nil, err
	}

	return &pb.RecommendedsGetAllRes{
		Recommendeds: recommendeds,
		TotalCount:   total,
	}, nil
}
