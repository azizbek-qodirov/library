package repo

import (
	"context"
	"database/sql"
	"fmt"

	pb "library/internal/pkg/genproto"
)

type BorrowingRepo struct {
	db *sql.DB
}

func NewBorrowingRepo(db *sql.DB) *BorrowingRepo {
	return &BorrowingRepo{db: db}
}

func (r *BorrowingRepo) Create(ctx context.Context, req *pb.BorrowingCreateReq) (*pb.Void, error) {
	query := `
		INSERT INTO borrowings (book_id, user_id, from_date, due_date, notes)
		VALUES ($1, $2, $3, $4, $5)
	`
	_, err := r.db.ExecContext(ctx, query,
		req.BookId,
		req.UserId,
		req.FromDate,
		req.DueDate,
		req.Notes,
	)
	if err != nil {
		return nil, err
	}
	return &pb.Void{}, nil
}

func (r *BorrowingRepo) Get(ctx context.Context, req *pb.ByID) (*pb.BorrowingGetRes, error) {
	query := `
		SELECT 
			b.id, b.from_date, b.due_date, b.extension_date, b.status, b.returned_at, b.notes,
			bo.id, bo.title, bo.cover_image_id, bo.location, bo.is_reference_only,
			bo.description, bo.isbn, bo.published_date, bo.publisher_id, bo.language,
			bo.page_count, bo.total_copies, bo.available_copies,
			u.id, u.full_name, u.group_name, u.email, u.phone, u.role, u.created_at, u.updated_at
		FROM borrowings b
		JOIN books bo ON bo.id = b.book_id
		JOIN users u ON u.id = b.user_id
		WHERE b.id = $1
	`

	row := r.db.QueryRowContext(ctx, query, req.Id)

	var res pb.BorrowingGetRes
	var book pb.BookGetRes
	var user pb.UserGetRes
	var extension_date, returned_at, updated_at sql.NullString
	var publisherID, coverFileID string

	err := row.Scan(
		&res.Id, &res.FromDate, &res.DueDate, &extension_date, &res.Status, &returned_at, &res.Notes,
		&book.Id, &book.Title, &coverFileID, &book.Location, &book.IsReferenceOnly,
		&book.Description, &book.Isbn, &book.PublishedDate, &publisherID, &book.Language,
		&book.PageCount, &book.TotalCopies, &book.AvailableCopies,
		&user.Id, &user.FullName, &user.GroupName, &user.Email, &user.Phone, &user.Role, &user.CreatedAt, &updated_at,
	)
	if err != nil {
		return nil, err
	}

	if extension_date.Valid {
		res.ExtensionDate = extension_date.String
	}
	if returned_at.Valid {
		res.ReturnedAt = returned_at.String
	}
	if updated_at.Valid {
		user.UpdatedAt = updated_at.String
	}

	// Load cover image as FileGetRes object
	if coverFileID != "" {
		var file pb.FileGetRes
		err = r.db.QueryRowContext(ctx, `
			SELECT id, url, mime_type, size, created_at, updated_at
			FROM files
			WHERE id = $1
		`, coverFileID).Scan(
			&file.Id, &file.Url, &file.MimeType, &file.Size, &file.CreatedAt, &file.UpdatedAt,
		)
		if err != nil && err != sql.ErrNoRows {
			return nil, err
		}
		book.CoverImageId = &file
	}

	// Load publisher as object
	if publisherID != "" {
		var pub pb.PublisherGetRes
		err = r.db.QueryRowContext(ctx, `SELECT id, name FROM publishers WHERE id = $1`, publisherID).Scan(&pub.Id, &pub.Name)
		if err != nil && err != sql.ErrNoRows {
			return nil, err
		}
		book.PublisherId = &pub
	}

	// Load categories
	cRows, err := r.db.QueryContext(ctx, `
		SELECT c.id, c.name 
		FROM book_categories bc 
		JOIN categories c ON bc.category_id = c.id 
		WHERE bc.book_id = $1
	`, book.Id)
	if err != nil {
		return nil, err
	}
	for cRows.Next() {
		var cat pb.CategoryGetRes
		if err := cRows.Scan(&cat.Id, &cat.Name); err != nil {
			cRows.Close()
			return nil, err
		}
		book.CategoryIds = append(book.CategoryIds, &cat)
	}
	cRows.Close()

	// Load authors
	aRows, err := r.db.QueryContext(ctx, `
		SELECT a.id, a.name 
		FROM book_authors ba 
		JOIN authors a ON ba.author_id = a.id 
		WHERE ba.book_id = $1
	`, book.Id)
	if err != nil {
		return nil, err
	}
	for aRows.Next() {
		var author pb.AuthorGetRes
		if err := aRows.Scan(&author.Id, &author.Name); err != nil {
			aRows.Close()
			return nil, err
		}
		book.AuthorIds = append(book.AuthorIds, &author)
	}
	aRows.Close()

	res.Book = &book
	res.User = &user
	return &res, nil
}

func (r *BorrowingRepo) Update(ctx context.Context, req *pb.BorrowingUpdateReq) (*pb.Void, error) {
	query := `
		UPDATE borrowings
		SET from_date = $1,
		    due_date = $2,
		    extension_date = $3,
		    status = $4,
		    returned_at = $5,
		    notes = $6,
		    updated_at = NOW()
		WHERE id = $7
	`
	_, err := r.db.ExecContext(ctx, query,
		req.Body.FromDate,
		req.Body.DueDate,
		req.Body.ExtensionDate,
		req.Body.Status,
		req.Body.ReturnedAt,
		req.Body.Notes,
		req.Id,
	)
	if err != nil {
		return nil, err
	}
	return &pb.Void{}, nil
}

func (r *BorrowingRepo) Delete(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	_, err := r.db.ExecContext(ctx, `DELETE FROM borrowings WHERE id = $1`, req.Id)
	if err != nil {
		return nil, err
	}
	return &pb.Void{}, nil
}

// GetAll retrieves all borrowings with filters and pagination
// TODO: Optimize N+1 queries - currently makes separate queries for each borrowing's
// files, publishers, categories, and authors. Consider using:
// 1. Batch queries with IN clauses after collecting all IDs
// 2. PostgreSQL JSON aggregation functions
// 3. Single query with LEFT JOINs and array_agg()
func (r *BorrowingRepo) GetAll(ctx context.Context, req *pb.BorrowingsGetAllReq) (*pb.BorrowingsGetAllRes, error) {
	query := `
		SELECT 
			b.id, b.from_date, b.due_date, b.extension_date, b.status, b.returned_at, b.notes,
			bo.id, bo.title, bo.cover_image_id, bo.location, bo.is_reference_only,
			bo.description, bo.isbn, bo.published_date, bo.publisher_id, bo.language,
			bo.page_count, bo.total_copies, bo.available_copies,
			u.id, u.full_name, u.group_name, u.email, u.phone, u.role, u.created_at, u.updated_at
		FROM borrowings b
		JOIN books bo ON bo.id = b.book_id
		JOIN users u ON u.id = b.user_id
		WHERE 1=1
	`
	args := []interface{}{}
	argCount := 1

	// --- filters ---
	if req.Search != "" {
		query += fmt.Sprintf(` AND (
			bo.title ILIKE $%d OR
			u.full_name ILIKE $%d OR
			EXISTS (
				SELECT 1 FROM book_authors ba 
				JOIN authors a ON a.id = ba.author_id 
				WHERE ba.book_id = bo.id AND a.name ILIKE $%d
			)
		)`, argCount, argCount, argCount)
		args = append(args, "%"+req.Search+"%")
		argCount++
	}
	if req.FromDate != "" {
		query += fmt.Sprintf(" AND b.from_date >= $%d", argCount)
		args = append(args, req.FromDate)
		argCount++
	}
	if req.DueDate != "" {
		query += fmt.Sprintf(" AND b.due_date <= $%d", argCount)
		args = append(args, req.DueDate)
		argCount++
	}
	if req.Status != "" {
		query += fmt.Sprintf(" AND b.status = $%d", argCount)
		args = append(args, req.Status)
		argCount++
	}

	// Pagination
	query += fmt.Sprintf(" ORDER BY b.created_at DESC LIMIT $%d OFFSET $%d", argCount, argCount+1)
	args = append(args, req.Limit, req.Offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res pb.BorrowingsGetAllRes
	for rows.Next() {
		var b pb.BorrowingGetRes
		var book pb.BookGetRes
		var user pb.UserGetRes
		var publisherID, coverFileID string
		var extension_date, returned_at, updated_at sql.NullString

		err := rows.Scan(
			&b.Id, &b.FromDate, &b.DueDate, &extension_date, &b.Status, &returned_at, &b.Notes,
			&book.Id, &book.Title, &coverFileID, &book.Location, &book.IsReferenceOnly,
			&book.Description, &book.Isbn, &book.PublishedDate, &publisherID, &book.Language,
			&book.PageCount, &book.TotalCopies, &book.AvailableCopies,
			&user.Id, &user.FullName, &user.GroupName, &user.Email, &user.Phone, &user.Role, &user.CreatedAt, &updated_at,
		)
		if err != nil {
			return nil, err
		}

		if extension_date.Valid {
			b.ExtensionDate = extension_date.String
		}
		if returned_at.Valid {
			b.ReturnedAt = returned_at.String
		}
		if updated_at.Valid {
			user.UpdatedAt = updated_at.String
		}

		// --- load cover image ---
		if coverFileID != "" {
			var file pb.FileGetRes
			err = r.db.QueryRowContext(ctx, `
				SELECT id, url, mime_type, size, created_at, updated_at
				FROM files
				WHERE id = $1
			`, coverFileID).Scan(
				&file.Id, &file.Url, &file.MimeType, &file.Size, &file.CreatedAt, &file.UpdatedAt,
			)
			if err != nil && err != sql.ErrNoRows {
				return nil, err
			}
			book.CoverImageId = &file
		}

		// --- load publisher ---
		if publisherID != "" {
			var pub pb.PublisherGetRes
			err = r.db.QueryRowContext(ctx, `SELECT id, name FROM publishers WHERE id = $1`, publisherID).Scan(&pub.Id, &pub.Name)
			if err != nil && err != sql.ErrNoRows {
				return nil, err
			}
			book.PublisherId = &pub
		}

		// --- load categories ---
		cRows, err := r.db.QueryContext(ctx, `
			SELECT c.id, c.name 
			FROM book_categories bc 
			JOIN categories c ON bc.category_id = c.id 
			WHERE bc.book_id = $1
		`, book.Id)
		if err != nil {
			return nil, err
		}
		for cRows.Next() {
			var cat pb.CategoryGetRes
			if err := cRows.Scan(&cat.Id, &cat.Name); err != nil {
				cRows.Close()
				return nil, err
			}
			book.CategoryIds = append(book.CategoryIds, &cat)
		}
		cRows.Close()

		// --- load authors ---
		aRows, err := r.db.QueryContext(ctx, `
			SELECT a.id, a.name 
			FROM book_authors ba 
			JOIN authors a ON ba.author_id = a.id 
			WHERE ba.book_id = $1
		`, book.Id)
		if err != nil {
			return nil, err
		}
		for aRows.Next() {
			var author pb.AuthorGetRes
			if err := aRows.Scan(&author.Id, &author.Name); err != nil {
				aRows.Close()
				return nil, err
			}
			book.AuthorIds = append(book.AuthorIds, &author)
		}
		aRows.Close()

		b.Book = &book
		b.User = &user
		res.Borrowings = append(res.Borrowings, &b)
	}

	// --- count query ---
	countQuery := `SELECT COUNT(*) FROM borrowings b
		JOIN books bo ON bo.id = b.book_id
		JOIN users u ON u.id = b.user_id
		WHERE 1=1`
	countArgs := []interface{}{}
	argCount = 1

	if req.Search != "" {
		countQuery += fmt.Sprintf(` AND (
			bo.title ILIKE $%d OR
			u.full_name ILIKE $%d OR
			EXISTS (
				SELECT 1 FROM book_authors ba 
				JOIN authors a ON a.id = ba.author_id 
				WHERE ba.book_id = bo.id AND a.name ILIKE $%d
			)
		)`, argCount, argCount, argCount)
		countArgs = append(countArgs, "%"+req.Search+"%")
		argCount++
	}
	if req.FromDate != "" {
		countQuery += fmt.Sprintf(" AND b.from_date >= $%d", argCount)
		countArgs = append(countArgs, req.FromDate)
		argCount++
	}
	if req.DueDate != "" {
		countQuery += fmt.Sprintf(" AND b.due_date <= $%d", argCount)
		countArgs = append(countArgs, req.DueDate)
		argCount++
	}
	if req.Status != "" {
		countQuery += fmt.Sprintf(" AND b.status = $%d", argCount)
		countArgs = append(countArgs, req.Status)
		argCount++
	}

	err = r.db.QueryRowContext(ctx, countQuery, countArgs...).Scan(&res.TotalCount)
	if err != nil {
		return nil, err
	}

	return &res, nil
}
