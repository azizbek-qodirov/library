package repo

import (
	"context"
	"database/sql"
	"regexp"
	"strings"

	pb "library/internal/pkg/genproto"

	"github.com/lib/pq"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

var catalogBarcode = regexp.MustCompile(`(?i)^OX-[1-9][0-9]{0,18}$`)

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
			isbn, published_date, publisher_id, language, page_count, total_copies, available_copies, publication_year
		) VALUES ($1,NULLIF($2,'')::uuid,$3,$4,$5,NULLIF(btrim($6),''),NULLIF($7,'')::date,NULLIF($8,'')::uuid,$9,$10,$11,$11,NULLIF($12::int,0))
		RETURNING id
	`
	var bookID string
	err = tx.QueryRowContext(ctx, query,
		req.Title, req.CoverImageId, req.Location, req.IsReferenceOnly,
		req.Description, strings.TrimSpace(req.Isbn), req.GetPublishedDate(), req.PublisherId,
		req.Language, req.PageCount, req.TotalCopies, req.PublicationYear,
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
	return readJSON[pb.BookGetRes](r.db.QueryRowContext(ctx, "SELECT "+bookJSON+" FROM books b WHERE b.id = $1", req.Id))
}

func (r *BookRepo) UpdateBook(ctx context.Context, req *pb.BookUpdateReq) (*pb.Void, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	query := `
		UPDATE books
		SET title=$1, cover_image_id=NULLIF($2,'')::uuid, location=$3, is_reference_only=$4,
		    description=$5, isbn=NULLIF(btrim($6),''), published_date=NULLIF($7,'')::date, publisher_id=NULLIF($8,'')::uuid, language=$9,
		    page_count=$10, total_copies=$11, available_copies=available_copies + ($11 - total_copies),
		    publication_year=CASE WHEN $13::int IS NULL THEN publication_year ELSE NULLIF($13,0) END, updated_at = NOW()
		WHERE id=$12 AND available_copies + ($11 - total_copies) >= 0
	`
	result, err := tx.ExecContext(ctx, query,
		req.Body.Title, req.Body.CoverImageId, req.Body.Location, req.Body.IsReferenceOnly,
		req.Body.Description, strings.TrimSpace(req.Body.Isbn), req.Body.GetPublishedDate(), req.Body.PublisherId,
		req.Body.Language, req.Body.PageCount, req.Body.TotalCopies,
		req.Id, req.Body.PublicationYear,
	)
	if err != nil {
		return nil, err
	}

	// reset categories
	if err := requireAffected(result, nil); err != nil {
		if status.Code(err) != codes.NotFound {
			return nil, err
		}
		var exists bool
		if err := tx.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM books WHERE id = $1)", req.Id).Scan(&exists); err != nil {
			return nil, err
		}
		if exists {
			return nil, status.Error(codes.FailedPrecondition, "total copies cannot be lower than the outstanding inventory")
		}
		return nil, err
	}

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
	// Junction rows cascade in the same statement. Loan history restricts deletion.
	return &pb.Void{}, requireAffected(r.db.ExecContext(ctx, "DELETE FROM books WHERE id = $1", req.Id))
}

func (r *BookRepo) GetAllBooks(ctx context.Context, req *pb.BooksGetAllReq) (*pb.BooksGetAllRes, error) {
	query := listQuery{where: " FROM books b WHERE TRUE"}
	if req.Location != "" {
		query.add(" AND b.location ILIKE $%d", "%"+req.Location+"%")
	}
	if len(req.CategoryIds) > 0 {
		query.add(` AND EXISTS (SELECT 1 FROM book_categories bc
			WHERE bc.book_id = b.id AND bc.category_id = ANY($%d::uuid[]))`, pq.Array(req.CategoryIds))
	}
	if len(req.AuthorIds) > 0 {
		query.add(` AND EXISTS (SELECT 1 FROM book_authors ba
			WHERE ba.book_id = b.id AND ba.author_id = ANY($%d::uuid[]))`, pq.Array(req.AuthorIds))
	}
	if req.PublisherId != "" {
		query.add(" AND b.publisher_id = $%d", req.PublisherId)
	}
	if req.Language != "" {
		query.add(" AND b.language ILIKE $%d", "%"+req.Language+"%")
	}
	if req.IsReferenceOnly != nil {
		query.add(" AND b.is_reference_only = $%d", *req.IsReferenceOnly)
	}
	if req.AvailableOnly {
		query.where += " AND b.available_copies > 0 AND NOT coalesce(b.is_reference_only, false)"
	}
	if term := strings.TrimSpace(req.Search); catalogBarcode.MatchString(term) {
		query.add(` AND EXISTS (SELECT 1 FROM book_copies c WHERE c.book_id = b.id AND c.barcode = $%d)`, strings.ToUpper(term))
	} else if term != "" {
		query.add(catalogSearch, "%"+searchApostrophes.Replace(term)+"%")
	}

	page, args := query.page(" ORDER BY b.title, b.id", req.Limit, req.Offset)
	rows, err := r.db.QueryContext(ctx, "SELECT "+bookJSON+page, args...)
	if err != nil {
		return nil, err
	}
	books, err := readJSONList[pb.BookGetRes](rows)
	if err != nil {
		return nil, err
	}
	var total int64
	err = r.db.QueryRowContext(ctx, "SELECT count(*)"+query.where, query.args...).Scan(&total)
	if err != nil {
		return nil, err
	}
	return &pb.BooksGetAllRes{Books: books, TotalCount: total}, nil
}
