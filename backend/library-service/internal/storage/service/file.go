package service

import (
	"context"
	"database/sql"

	pb "library/internal/pkg/genproto"
	"library/internal/storage/repo"
)

type FileService struct {
	repo *repo.FileRepo
	pb.UnimplementedFileServiceServer
}

func NewFileService(db *sql.DB) *FileService {
	return &FileService{repo: repo.NewFileRepo(db)}
}

func (s *FileService) CreateFile(ctx context.Context, req *pb.FileCreateReq) (*pb.FileGetRes, error) {
	return s.repo.CreateFile(ctx, req)
}

func (s *FileService) GetFile(ctx context.Context, req *pb.ByID) (*pb.FileGetRes, error) {
	return s.repo.GetFile(ctx, req)
}

func (s *FileService) DeleteFile(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	return s.repo.DeleteFile(ctx, req)
}

func (s *FileService) GetAllFiles(ctx context.Context, req *pb.FilesGetAllReq) (*pb.GetAllFilesRes, error) {
	// Default pagination
	if req.Limit == 0 {
		req.Limit = 10
	}
	return s.repo.GetAllFiles(ctx, req)
}

func (s *FileService) ActivateFile(ctx context.Context, req *pb.ByID) (*pb.FileGetRes, error) {
	return s.repo.ActivateFile(ctx, req)
}

func (s *FileService) PrepareFileDeletion(ctx context.Context, req *pb.ByID) (*pb.FileGetRes, error) {
	return s.repo.PrepareFileDeletion(ctx, req)
}
