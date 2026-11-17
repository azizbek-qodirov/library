package repo

import (
	"context"

	pb "library/internal/pkg/genproto"
)

const availableCopy = `NOT EXISTS (
	SELECT 1 FROM borrowings l WHERE l.copy_id = c.id AND l.status IN ('borrowed', 'lost')
)`

const copyJSON = `jsonb_build_object('id', c.id, 'barcode', c.barcode, 'status',
	CASE WHEN c.retired THEN 'retired' ELSE coalesce(
		(SELECT l.status::text FROM borrowings l
		 WHERE l.copy_id = c.id AND l.status IN ('borrowed', 'lost')), 'available') END)`

func (r *BookRepo) GetCopyByBarcode(ctx context.Context, barcode string) (*pb.CopyLookupRes, error) {
	return readJSON[pb.CopyLookupRes](r.db.QueryRowContext(ctx,
		"SELECT jsonb_build_object('copy', "+copyJSON+", 'book', "+bookJSON+")"+
			" FROM book_copies c JOIN books b ON b.id = c.book_id WHERE c.barcode = $1", barcode))
}

func (r *BookRepo) ListBookCopies(ctx context.Context, id string) (*pb.BookCopiesRes, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT "+copyJSON+" FROM book_copies c WHERE c.book_id = $1 ORDER BY c.number", id)
	if err != nil {
		return nil, err
	}
	copies, err := readJSONList[pb.BookCopy](rows)
	if err != nil {
		return nil, err
	}
	return &pb.BookCopiesRes{Copies: copies}, nil
}
