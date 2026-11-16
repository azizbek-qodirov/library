package repo

import (
	"context"
	"database/sql"
	"errors"
	"time"

	pb "library/internal/pkg/genproto"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type BorrowingRepo struct {
	db *sql.DB
}

func NewBorrowingRepo(db *sql.DB) *BorrowingRepo {
	return &BorrowingRepo{db: db}
}

func (r *BorrowingRepo) Create(ctx context.Context, req *pb.BorrowingCreateReq) (*pb.Void, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var id string
	err = tx.QueryRowContext(ctx, `
		INSERT INTO borrowings (book_id, user_id, from_date, due_date, notes, request_id, checkout_payload)
		VALUES ($1, $2, $3, $4, $5, NULLIF($6, '')::uuid,
			CASE WHEN $6 <> '' THEN jsonb_build_array($1::uuid, $2::uuid, $3::date, $4::date, $5::text) END)
		ON CONFLICT (request_id) DO NOTHING RETURNING id`,
		req.BookId, req.UserId, req.FromDate, req.DueDate, req.Notes, req.RequestId).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		var same bool
		err = tx.QueryRowContext(ctx, `
			SELECT checkout_payload = jsonb_build_array($1::uuid, $2::uuid, $3::date, $4::date, $5::text)
			FROM borrowings WHERE request_id = $6`, req.BookId, req.UserId, req.FromDate,
			req.DueDate, req.Notes, req.RequestId).Scan(&same)
		if err != nil {
			return nil, err
		}
		if !same {
			return nil, status.Error(codes.AlreadyExists, "checkout request ID was used with different details")
		}
		return &pb.Void{}, nil
	}
	if err != nil {
		return nil, err
	}

	result, err := tx.ExecContext(ctx, `
		UPDATE books SET available_copies = available_copies - 1, updated_at = now()
		WHERE id = $1 AND NOT coalesce(is_reference_only, false) AND available_copies > 0`, req.BookId)
	if err != nil {
		return nil, err
	}
	if err := requireAffected(result, nil); err != nil {
		if status.Code(err) == codes.NotFound {
			return nil, status.Error(codes.FailedPrecondition, "book is unavailable for checkout")
		}
		return nil, err
	}
	return &pb.Void{}, tx.Commit()
}

const borrowingJSON = `jsonb_build_object(
	'id', l.id, 'book', ` + bookJSON + `, 'user', to_jsonb(u),
	'from_date', l.from_date, 'due_date', l.due_date, 'extension_date', l.extension_date,
	'status', l.status, 'returned_at', l.returned_at, 'notes', l.notes
)`
const borrowingsFrom = " FROM borrowings l JOIN books b ON b.id = l.book_id JOIN users u ON u.id = l.user_id"

func (r *BorrowingRepo) Get(ctx context.Context, req *pb.ByID) (*pb.BorrowingGetRes, error) {
	return readJSON[pb.BorrowingGetRes](r.db.QueryRowContext(ctx, "SELECT "+borrowingJSON+borrowingsFrom+" WHERE l.id = $1", req.Id))
}

func (r *BorrowingRepo) Update(ctx context.Context, req *pb.BorrowingUpdateReq) (*pb.Void, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	body := req.Body
	var bookID, previousStatus string
	err = tx.QueryRowContext(ctx, "SELECT book_id, status FROM borrowings WHERE id = $1 FOR UPDATE", req.Id).
		Scan(&bookID, &previousStatus)
	if err != nil {
		return nil, err
	}
	if err := adjustLoanInventory(ctx, tx, bookID, previousStatus, body.Status); err != nil {
		return nil, err
	}

	_, err = tx.ExecContext(ctx, `
		UPDATE borrowings
		SET from_date = $1, due_date = $2, extension_date = NULLIF($3, '')::date,
		    status = $4::borrowing_status_type, notes = $6, updated_at = now(),
		    returned_at = CASE WHEN $4::borrowing_status_type = 'returned'
		        THEN coalesce(NULLIF($5, '')::date, CASE WHEN returned_at IS NOT NULL THEN greatest($1::date, returned_at) END, greatest($1::date, current_date)) ELSE NULL END
		WHERE id = $7`, body.FromDate, body.DueDate, body.GetExtensionDate(),
		body.Status, body.GetReturnedAt(), body.Notes, req.Id)
	if err != nil {
		return nil, err
	}
	return &pb.Void{}, tx.Commit()
}

// adjustLoanInventory is called while the loan row is locked.
func adjustLoanInventory(ctx context.Context, tx *sql.Tx, bookID, previous, next string) error {
	if previous == next {
		return nil
	}
	if previous == "returned" || (previous == "lost" && next != "returned") {
		return status.Error(codes.FailedPrecondition, "invalid loan status transition")
	}
	if next == "returned" {
		_, err := tx.ExecContext(ctx, `
			UPDATE books SET available_copies = available_copies + 1, updated_at = now()
			WHERE id = $1`, bookID)
		return err
	}
	return nil
}

func (r *BorrowingRepo) SetStatus(ctx context.Context, id, next string) (*pb.Void, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var bookID, previous string
	err = tx.QueryRowContext(ctx, "SELECT book_id, status FROM borrowings WHERE id = $1 FOR UPDATE", id).
		Scan(&bookID, &previous)
	if err != nil {
		return nil, err
	}
	if previous == next {
		return &pb.Void{}, nil
	}
	if err := adjustLoanInventory(ctx, tx, bookID, previous, next); err != nil {
		return nil, err
	}
	_, err = tx.ExecContext(ctx, `
		UPDATE borrowings SET status = $1::borrowing_status_type, updated_at = now(),
		    returned_at = CASE WHEN $1::borrowing_status_type = 'returned'
		        THEN greatest(from_date, current_date) ELSE NULL END
		WHERE id = $2`, next, id)
	if err != nil {
		return nil, err
	}
	return &pb.Void{}, tx.Commit()
}

func (r *BorrowingRepo) Renew(ctx context.Context, id string, extension time.Time) (*pb.Void, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var loanStatus string
	var deadline time.Time
	if err := tx.QueryRowContext(ctx, `
		SELECT status, coalesce(extension_date, due_date) FROM borrowings
		WHERE id = $1 FOR UPDATE`, id).Scan(&loanStatus, &deadline); err != nil {
		return nil, err
	}
	if loanStatus != "borrowed" || extension.Before(deadline) {
		return nil, status.Error(codes.FailedPrecondition, "only active loans can be extended and the deadline cannot move earlier")
	}
	if extension.Equal(deadline) {
		return &pb.Void{}, nil
	}
	if _, err := tx.ExecContext(ctx, "UPDATE borrowings SET extension_date = $1, updated_at = now() WHERE id = $2", extension.Format(time.DateOnly), id); err != nil {
		return nil, err
	}
	return &pb.Void{}, tx.Commit()
}

func (r *BorrowingRepo) Delete(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	result, err := r.db.ExecContext(ctx, "DELETE FROM borrowings WHERE id = $1 AND status = 'returned'", req.Id)
	if err := requireAffected(result, err); err != nil {
		if status.Code(err) != codes.NotFound {
			return nil, err
		}
		var exists bool
		if err := r.db.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM borrowings WHERE id = $1)", req.Id).Scan(&exists); err != nil {
			return nil, err
		}
		if exists {
			return nil, status.Error(codes.FailedPrecondition, "only returned loans can be deleted")
		}
		return nil, err
	}
	return &pb.Void{}, nil
}

func (r *BorrowingRepo) GetAll(ctx context.Context, req *pb.BorrowingsGetAllReq) (*pb.BorrowingsGetAllRes, error) {
	query := listQuery{where: borrowingsFrom + " WHERE TRUE"}
	if req.Search != "" {
		query.add(` AND (b.title ILIKE $%[1]d OR u.full_name ILIKE $%[1]d OR EXISTS (
			SELECT 1 FROM book_authors ba JOIN authors a ON a.id = ba.author_id
			WHERE ba.book_id = b.id AND a.name ILIKE $%[1]d))`, "%"+req.Search+"%")
	}
	if req.FromDate != "" {
		query.add(" AND l.from_date >= $%d", req.FromDate)
	}
	if req.DueDate != "" {
		query.add(" AND l.due_date <= $%d", req.DueDate)
	}
	if req.Status != "" {
		query.add(" AND l.status = $%d", req.Status)
	}
	page, args := query.page(" ORDER BY l.created_at DESC, l.id", req.Limit, req.Offset)
	rows, err := r.db.QueryContext(ctx, "SELECT "+borrowingJSON+page, args...)
	if err != nil {
		return nil, err
	}
	borrowings, err := readJSONList[pb.BorrowingGetRes](rows)
	if err != nil {
		return nil, err
	}
	var total int64
	if err := r.db.QueryRowContext(ctx, "SELECT count(*)"+query.where, query.args...).Scan(&total); err != nil {
		return nil, err
	}
	return &pb.BorrowingsGetAllRes{Borrowings: borrowings, TotalCount: total}, nil
}
