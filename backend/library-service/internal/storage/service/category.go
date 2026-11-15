package service

import (
	"context"
	"database/sql"

	pb "library/internal/pkg/genproto"
	"library/internal/storage/repo"
)

type CategoryService struct {
	repo *repo.CategoryRepo
	pb.UnimplementedCategoryServiceServer
}

func NewCategoryService(db *sql.DB) *CategoryService {
	return &CategoryService{repo: repo.NewCategoryRepo(db)}
}

func (s *CategoryService) CreateCategory(ctx context.Context, req *pb.CategoryCreateReq) (*pb.Void, error) {
	return s.repo.CreateCategory(ctx, req)
}

func (s *CategoryService) GetCategory(ctx context.Context, req *pb.ByID) (*pb.CategoryGetRes, error) {
	return s.repo.GetCategory(ctx, req)
}

func (s *CategoryService) UpdateCategory(ctx context.Context, req *pb.CategoryUpdateReq) (*pb.Void, error) {
	return s.repo.UpdateCategory(ctx, req)
}

func (s *CategoryService) DeleteCategory(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	return s.repo.DeleteCategory(ctx, req)
}

func (s *CategoryService) GetAllCategories(ctx context.Context, req *pb.CategoriesGetAllReq) (*pb.GetAllCategoriesRes, error) {
	// default limit if not set
	if req.Limit == 0 {
		req.Limit = 10
	}
	return s.repo.GetAllCategories(ctx, req)
}
