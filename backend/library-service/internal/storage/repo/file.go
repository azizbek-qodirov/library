package repo

import (
	"context"
	"database/sql"

	pb "library/internal/pkg/genproto"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type FileRepo struct {
	db *sql.DB
}

func NewFileRepo(db *sql.DB) *FileRepo {
	return &FileRepo{db: db}
}

func (r *FileRepo) CreateFile(ctx context.Context, req *pb.FileCreateReq) (*pb.FileGetRes, error) {
	state := "ready"
	if req.PendingUpload {
		state = "pending_upload"
	}
	return readJSON[pb.FileGetRes](r.db.QueryRowContext(ctx, `
		INSERT INTO files (url, mime_type, size, object_key, state)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING to_jsonb(files)`, req.Url, req.MimeType, req.Size, req.ObjectKey, state))
}

func (r *FileRepo) GetFile(ctx context.Context, req *pb.ByID) (*pb.FileGetRes, error) {
	return readJSON[pb.FileGetRes](r.db.QueryRowContext(ctx, "SELECT to_jsonb(f) FROM files f WHERE id = $1", req.Id))
}

func (r *FileRepo) ActivateFile(ctx context.Context, req *pb.ByID) (*pb.FileGetRes, error) {
	return readJSON[pb.FileGetRes](r.db.QueryRowContext(ctx, `
		UPDATE files SET state = 'ready', updated_at = now()
		WHERE id = $1 AND state IN ('pending_upload', 'ready')
		RETURNING to_jsonb(files)`, req.Id))
}

func (r *FileRepo) PrepareFileDeletion(ctx context.Context, req *pb.ByID) (*pb.FileGetRes, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// The cover trigger takes a conflicting lock before attaching this file.
	var uploadInProgress bool
	if err := tx.QueryRowContext(ctx, `SELECT state = 'pending_upload' AND created_at > now() - interval '2 minutes'
		FROM files WHERE id = $1 FOR UPDATE`, req.Id).Scan(&uploadInProgress); err != nil {
		return nil, err
	}
	if uploadInProgress {
		return nil, status.Error(codes.FailedPrecondition, "upload may still be in progress; retry after two minutes")
	}
	var inUse bool
	if err := tx.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM books WHERE cover_image_id = $1)", req.Id).Scan(&inUse); err != nil {
		return nil, err
	}
	if inUse {
		return nil, status.Error(codes.FailedPrecondition, "file is still used as a book cover")
	}
	file, err := readJSON[pb.FileGetRes](tx.QueryRowContext(ctx, `
		UPDATE files SET state = 'deleting', updated_at = now() WHERE id = $1
		RETURNING to_jsonb(files)`, req.Id))
	if err != nil {
		return nil, err
	}
	return file, tx.Commit()
}

func (r *FileRepo) DeleteFile(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	result, err := r.db.ExecContext(ctx, "DELETE FROM files WHERE id = $1 AND state = 'deleting'", req.Id)
	if err := requireAffected(result, err); err != nil {
		if status.Code(err) != codes.NotFound {
			return nil, err
		}
		var exists bool
		if err := r.db.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM files WHERE id = $1)", req.Id).Scan(&exists); err != nil {
			return nil, err
		}
		if exists {
			return nil, status.Error(codes.FailedPrecondition, "prepare file deletion before finalizing it")
		}
	}
	return &pb.Void{}, nil
}

func (r *FileRepo) GetAllFiles(ctx context.Context, req *pb.FilesGetAllReq) (*pb.GetAllFilesRes, error) {
	query := listQuery{where: " FROM files f WHERE TRUE"}
	if req.MimeType != "" {
		query.add(" AND mime_type = $%d", req.MimeType)
	}
	page, args := query.page(" ORDER BY created_at DESC, id", req.Limit, req.Offset)
	rows, err := r.db.QueryContext(ctx, "SELECT to_jsonb(f)"+page, args...)
	if err != nil {
		return nil, err
	}
	files, err := readJSONList[pb.FileGetRes](rows)
	if err != nil {
		return nil, err
	}
	var total int64
	if err := r.db.QueryRowContext(ctx, "SELECT count(*)"+query.where, query.args...).Scan(&total); err != nil {
		return nil, err
	}
	return &pb.GetAllFilesRes{Files: files, TotalCount: total}, nil
}
