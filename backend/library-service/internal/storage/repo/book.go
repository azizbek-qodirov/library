package repo

import (
	"context"
	"database/sql"
	"fmt"

	pb "library/internal/pkg/genproto"

	"github.com/lib/pq"
)

type BookRepo struct {
	db *sql.DB
}

func NewBookRepo(db *sql.DB) *BookRepo {
	return &BookRepo{db: db}
}

func (r *BookRepo) CreateBook(ctx context.Context, req *pb.BookCreateReq) (*pb.Void, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	query := `
		INSERT INTO books (
			title, cover_image_id, location, is_reference_only, description,
			isbn, published_date, publisher_id, language, page_count, total_copies, available_copies
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		RETURNING id
	`
	var bookID string
	err = tx.QueryRowContext(ctx, query,
		req.Title, req.CoverImageId, req.Location, req.IsReferenceOnly,
		req.Description, req.Isbn, req.PublishedDate, req.PublisherId,
		req.Language, req.PageCount, req.TotalCopies, req.AvailableCopies,
	).Scan(&bookID)
	if err != nil {
		return nil, err
	}

	for _, catID := range req.CategoryIds {
		_, err := tx.ExecContext(ctx,
			`INSERT INTO book_categories (book_id, category_id) VALUES ($1, $2)`,
			bookID, catID,
		)
		if err != nil {
			return nil, err
		}
	}

	if len(req.GetAuthorIds()) > 0 {
		for _, aid := range req.GetAuthorIds() {
			_, err := tx.ExecContext(ctx,
				`INSERT INTO book_authors (book_id, author_id) VALUES ($1, $2)`,
				bookID, aid,
			)
			if err != nil {
				return nil, err
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &pb.Void{}, nil
}

func (r *BookRepo) GetBook(ctx context.Context, req *pb.ByID) (*pb.BookGetRes, error) {
	query := `
		SELECT id, title, cover_image_id, location, is_reference_only, description,
		       isbn, published_date, publisher_id, language, page_count, total_copies, available_copies
		FROM books WHERE id = $1
	`
	var b pb.BookGetRes
	var publisherID string
	var coverFileID sql.NullString

	err := r.db.QueryRowContext(ctx, query, req.Id).Scan(
		&b.Id, &b.Title, &coverFileID, &b.Location, &b.IsReferenceOnly,
		&b.Description, &b.Isbn, &b.PublishedDate, &publisherID, &b.Language,
		&b.PageCount, &b.TotalCopies, &b.AvailableCopies,
	)
	if err != nil {
		return nil, err
	}

	// load cover image object
	if coverFileID.Valid {
		var file pb.FileGetRes
		err := r.db.QueryRowContext(ctx, `
			SELECT id, url, mime_type, size, created_at, updated_at
			FROM files WHERE id = $1
		`, coverFileID.String).Scan(
			&file.Id, &file.Url, &file.MimeType, &file.Size, &file.CreatedAt, &file.UpdatedAt,
		)
		if err == nil { // don’t fail the whole book if file missing
			b.CoverImageId = &file
		}
	}

	// load publisher
	if publisherID != "" {
		var pub pb.PublisherGetRes
		err := r.db.QueryRowContext(ctx, `SELECT id, name FROM publishers WHERE id=$1`, publisherID).Scan(
			&pub.Id, &pub.Name,
		)
		if err != nil {
			return nil, err
		}
		b.PublisherId = &pub
	}

	// load categories
	cRows, err := r.db.QueryContext(ctx, `
		SELECT c.id, c.name
		FROM categories c
		JOIN book_categories bc ON bc.category_id = c.id
		WHERE bc.book_id = $1
	`, b.Id)
	if err != nil {
		return nil, err
	}
	for cRows.Next() {
		var c pb.CategoryGetRes
		if err := cRows.Scan(&c.Id, &c.Name); err != nil {
			cRows.Close()
			return nil, err
		}
		b.CategoryIds = append(b.CategoryIds, &c)
	}
	cRows.Close()

	// load authors
	aRows, err := r.db.QueryContext(ctx, `
		SELECT a.id, a.name
		FROM authors a
		JOIN book_authors ba ON ba.author_id = a.id
		WHERE ba.book_id = $1
	`, b.Id)
	if err != nil {
		return nil, err
	}
	for aRows.Next() {
		var a pb.AuthorGetRes
		if err := aRows.Scan(&a.Id, &a.Name); err != nil {
			aRows.Close()
			return nil, err
		}
		b.AuthorIds = append(b.AuthorIds, &a)
	}
	aRows.Close()

	return &b, nil
}

func (r *BookRepo) UpdateBook(ctx context.Context, req *pb.BookUpdateReq) (*pb.Void, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	query := `
		UPDATE books
		SET title=$1, cover_image_id=$2, location=$3, is_reference_only=$4,
		    description=$5, isbn=$6, published_date=$7, publisher_id=$8, language=$9,
		    page_count=$10, total_copies=$11, available_copies=$12, updated_at = NOW()
		WHERE id=$13
	`
	_, err = tx.ExecContext(ctx, query,
		req.Body.Title, req.Body.CoverImageId, req.Body.Location, req.Body.IsReferenceOnly,
		req.Body.Description, req.Body.Isbn, req.Body.PublishedDate, req.Body.PublisherId,
		req.Body.Language, req.Body.PageCount, req.Body.TotalCopies, req.Body.AvailableCopies,
		req.Id,
	)
	if err != nil {
		return nil, err
	}

	// reset categories
	_, err = tx.ExecContext(ctx, `DELETE FROM book_categories WHERE book_id=$1`, req.Id)
	if err != nil {
		return nil, err
	}
	for _, cid := range req.Body.CategoryIds {
		_, err := tx.ExecContext(ctx,
			`INSERT INTO book_categories (book_id, category_id) VALUES ($1, $2)`,
			req.Id, cid,
		)
		if err != nil {
			return nil, err
		}
	}

	// reset authors
	_, err = tx.ExecContext(ctx, `DELETE FROM book_authors WHERE book_id=$1`, req.Id)
	if err != nil {
		return nil, err
	}
	for _, aid := range req.Body.GetAuthorIds() {
		_, err := tx.ExecContext(ctx,
			`INSERT INTO book_authors (book_id, author_id) VALUES ($1, $2)`,
			req.Id, aid,
		)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &pb.Void{}, nil
}

func (r *BookRepo) DeleteBook(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	_, err := r.db.ExecContext(ctx, `DELETE FROM book_categories WHERE book_id=$1`, req.Id)
	if err != nil {
		return nil, err
	}
	_, err = r.db.ExecContext(ctx, `DELETE FROM book_authors WHERE book_id=$1`, req.Id)
	if err != nil {
		return nil, err
	}
	_, err = r.db.ExecContext(ctx, `DELETE FROM books WHERE id=$1`, req.Id)
	if err != nil {
		return nil, err
	}
	return &pb.Void{}, nil
}

func (r *BookRepo) GetAllBooks(ctx context.Context, req *pb.BooksGetAllReq) (*pb.BooksGetAllRes, error) {
	query := `
		SELECT b.id, b.title, b.cover_image_id, b.location, b.is_reference_only,
		       b.description, b.isbn, b.published_date, b.publisher_id, b.language,
		       b.page_count, b.total_copies, b.available_copies
		FROM books b
		LEFT JOIN book_authors ba ON b.id = ba.book_id
		LEFT JOIN authors a ON ba.author_id = a.id
		WHERE 1=1
	`
	var args []interface{}
	argCount := 1

	// --- filters ---
	if req.Location != "" {
		query += fmt.Sprintf(" AND b.location ILIKE $%d", argCount)
		args = append(args, "%"+req.Location+"%")
		argCount++
	}
	if len(req.CategoryIds) > 0 {
		query += fmt.Sprintf(`
			AND EXISTS (
				SELECT 1 FROM book_categories bc
				WHERE bc.book_id = b.id
				  AND bc.category_id = ANY($%d)
			)`, argCount)
		args = append(args, pq.Array(req.CategoryIds))
		argCount++
	}
	if len(req.AuthorIds) > 0 {
		query += fmt.Sprintf(`
			AND EXISTS (
				SELECT 1 FROM book_authors ba2
				WHERE ba2.book_id = b.id
				  AND ba2.author_id = ANY($%d)
			)`, argCount)
		args = append(args, pq.Array(req.AuthorIds))
		argCount++
	}
	if req.PublisherId != "" {
		query += fmt.Sprintf(" AND b.publisher_id=$%d", argCount)
		args = append(args, req.PublisherId)
		argCount++
	}
	if req.Language != "" {
		query += fmt.Sprintf(" AND b.language ILIKE $%d", argCount)
		args = append(args, "%"+req.Language+"%")
		argCount++
	}
	// Handle optional bool for is_reference_only
	// nil = not set (show all books)
	// true = show only reference books
	// false = show only borrowable books
	if req.IsReferenceOnly != nil {
		query += fmt.Sprintf(" AND b.is_reference_only=$%d", argCount)
		args = append(args, *req.IsReferenceOnly)
		argCount++
	}
	if req.Search != "" {
		query += fmt.Sprintf(
			" AND (b.title ILIKE $%d OR b.description ILIKE $%d OR b.isbn ILIKE $%d OR a.name ILIKE $%d)",
			argCount, argCount+1, argCount+2, argCount+3,
		)
		args = append(args,
			"%"+req.Search+"%",
			"%"+req.Search+"%",
			"%"+req.Search+"%",
			"%"+req.Search+"%",
		)
		argCount += 4
	}

	query += " GROUP BY b.id"
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argCount, argCount+1)
	args = append(args, req.Limit, req.Offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var books []*pb.BookGetRes
	for rows.Next() {
		var b pb.BookGetRes
		var publisherID string
		var coverFileID sql.NullString

		if err := rows.Scan(
			&b.Id, &b.Title, &coverFileID, &b.Location, &b.IsReferenceOnly,
			&b.Description, &b.Isbn, &b.PublishedDate, &publisherID, &b.Language,
			&b.PageCount, &b.TotalCopies, &b.AvailableCopies,
		); err != nil {
			return nil, err
		}

		// --- load cover file object ---
		if coverFileID.Valid {
			var file pb.FileGetRes
			err := r.db.QueryRowContext(ctx, `
				SELECT id, url, mime_type, size, created_at, updated_at
				FROM files WHERE id = $1
			`, coverFileID.String).Scan(
				&file.Id, &file.Url, &file.MimeType, &file.Size, &file.CreatedAt, &file.UpdatedAt,
			)
			if err == nil {
				b.CoverImageId = &file
			}
		}

		// --- load publisher object ---
		if publisherID != "" {
			var pub pb.PublisherGetRes
			err := r.db.QueryRowContext(ctx, `SELECT id, name FROM publishers WHERE id=$1`, publisherID).
				Scan(&pub.Id, &pub.Name)
			if err != nil {
				return nil, err
			}
			b.PublisherId = &pub
		}

		// --- load categories as objects ---
		cRows, err := r.db.QueryContext(ctx, `
			SELECT c.id, c.name
			FROM categories c
			JOIN book_categories bc ON bc.category_id = c.id
			WHERE bc.book_id=$1
		`, b.Id)
		if err != nil {
			return nil, err
		}
		for cRows.Next() {
			var c pb.CategoryGetRes
			if err := cRows.Scan(&c.Id, &c.Name); err != nil {
				cRows.Close()
				return nil, err
			}
			b.CategoryIds = append(b.CategoryIds, &c)
		}
		cRows.Close()

		// --- load authors as objects ---
		aRows, err := r.db.QueryContext(ctx, `
			SELECT a.id, a.name
			FROM authors a
			JOIN book_authors ba ON ba.author_id = a.id
			WHERE ba.book_id=$1
		`, b.Id)
		if err != nil {
			return nil, err
		}
		for aRows.Next() {
			var a pb.AuthorGetRes
			if err := aRows.Scan(&a.Id, &a.Name); err != nil {
				aRows.Close()
				return nil, err
			}
			b.AuthorIds = append(b.AuthorIds, &a)
		}
		aRows.Close()

		books = append(books, &b)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}

	// --- count query ---
	countQuery := `
		SELECT count(DISTINCT b.id)
		FROM books b
		LEFT JOIN book_authors ba ON b.id = ba.book_id
		LEFT JOIN authors a ON ba.author_id = a.id
		WHERE 1=1
	`
	var countArgs []interface{}
	argCount = 1

	if req.Location != "" {
		countQuery += fmt.Sprintf(" AND b.location ILIKE $%d", argCount)
		countArgs = append(countArgs, "%"+req.Location+"%")
		argCount++
	}
	if len(req.CategoryIds) > 0 {
		countQuery += fmt.Sprintf(`
			AND EXISTS (
				SELECT 1 FROM book_categories bc
				WHERE bc.book_id = b.id
				  AND bc.category_id = ANY($%d)
			)`, argCount)
		countArgs = append(countArgs, pq.Array(req.CategoryIds))
		argCount++
	}
	if len(req.AuthorIds) > 0 {
		countQuery += fmt.Sprintf(`
			AND EXISTS (
				SELECT 1 FROM book_authors ba2
				WHERE ba2.book_id = b.id
				  AND ba2.author_id = ANY($%d)
			)`, argCount)
		countArgs = append(countArgs, pq.Array(req.AuthorIds))
		argCount++
	}
	if req.PublisherId != "" {
		countQuery += fmt.Sprintf(" AND b.publisher_id=$%d", argCount)
		countArgs = append(countArgs, req.PublisherId)
		argCount++
	}
	if req.Language != "" {
		countQuery += fmt.Sprintf(" AND b.language ILIKE $%d", argCount)
		countArgs = append(countArgs, "%"+req.Language+"%")
		argCount++
	}
	if req.IsReferenceOnly != nil {
		countQuery += fmt.Sprintf(" AND b.is_reference_only=$%d", argCount)
		countArgs = append(countArgs, *req.IsReferenceOnly)
		argCount++
	}
	if req.Search != "" {
		countQuery += fmt.Sprintf(
			" AND (b.title ILIKE $%d OR b.description ILIKE $%d OR b.isbn ILIKE $%d OR a.name ILIKE $%d)",
			argCount, argCount+1, argCount+2, argCount+3,
		)
		countArgs = append(countArgs,
			"%"+req.Search+"%",
			"%"+req.Search+"%",
			"%"+req.Search+"%",
			"%"+req.Search+"%",
		)
		argCount += 4
	}

	var total int64
	if err := r.db.QueryRowContext(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return nil, err
	}

	return &pb.BooksGetAllRes{
		Books:      books,
		TotalCount: total,
	}, nil
}
