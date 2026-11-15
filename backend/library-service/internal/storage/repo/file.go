package repo

import (
	"context"
	"database/sql"
	"fmt"

	pb "library/internal/pkg/genproto"
)

type FileRepo struct {
	db *sql.DB
}

func NewFileRepo(db *sql.DB) *FileRepo {
	return &FileRepo{db: db}
}

func (r *FileRepo) CreateFile(ctx context.Context, req *pb.FileCreateReq) (*pb.FileGetRes, error) {
	query := `
		INSERT INTO files (url, mime_type, size)
		VALUES ($1, $2, $3)
		RETURNING id, url, mime_type, size, created_at, updated_at
	`
	var file pb.FileGetRes
	err := r.db.QueryRowContext(ctx, query, req.Url, req.MimeType, req.Size).Scan(
		&file.Id,
		&file.Url,
		&file.MimeType,
		&file.Size,
		&file.CreatedAt,
		&file.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &file, nil
}

func (r *FileRepo) GetFile(ctx context.Context, req *pb.ByID) (*pb.FileGetRes, error) {
	query := `
		SELECT id, url, mime_type, size, created_at, updated_at
		FROM files
		WHERE id = $1
	`
	var file pb.FileGetRes
	err := r.db.QueryRowContext(ctx, query, req.Id).Scan(
		&file.Id,
		&file.Url,
		&file.MimeType,
		&file.Size,
		&file.CreatedAt,
		&file.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &file, nil
}

func (r *FileRepo) DeleteFile(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	query := `DELETE FROM files WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, req.Id)
	if err != nil {
		return nil, err
	}
	return &pb.Void{}, nil
}

func (r *FileRepo) GetAllFiles(ctx context.Context, req *pb.FilesGetAllReq) (*pb.GetAllFilesRes, error) {
	query := `
		SELECT id, url, mime_type, size, created_at, updated_at
		FROM files
		WHERE 1=1
	`
	args := []interface{}{}
	argCount := 1

	if req.MimeType != "" {
		query += fmt.Sprintf(` AND mime_type = $%d`, argCount)
		args = append(args, req.MimeType)
		argCount++
	}

	query += fmt.Sprintf(` ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, argCount, argCount+1)
	args = append(args, req.Limit, req.Offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var files []*pb.FileGetRes
	for rows.Next() {
		var file pb.FileGetRes
		if err := rows.Scan(
			&file.Id,
			&file.Url,
			&file.MimeType,
			&file.Size,
			&file.CreatedAt,
			&file.UpdatedAt,
		); err != nil {
			return nil, err
		}
		files = append(files, &file)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}

	var total int64
	countQuery := `SELECT COUNT(*) FROM files WHERE 1=1`
	countArgs := []interface{}{}
	argCount = 1
	if req.MimeType != "" {
		countQuery += fmt.Sprintf(` AND mime_type = $%d`, argCount)
		countArgs = append(countArgs, req.MimeType)
	}
	if err := r.db.QueryRowContext(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return nil, err
	}

	return &pb.GetAllFilesRes{
		Files:      files,
		TotalCount: total,
	}, nil
}
