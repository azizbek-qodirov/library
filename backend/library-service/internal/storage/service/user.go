package service

import (
	"context"
	"database/sql"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"library/internal/pkg/funcs"
	pb "library/internal/pkg/genproto"
	"library/internal/storage/repo"
)

type UserService struct {
	userRepo *repo.UserRepo
	pb.UnimplementedUserServiceServer
}

func NewUserService(db *sql.DB) *UserService {
	return &UserService{
		userRepo: repo.NewUserRepo(db),
	}
}

func (s *UserService) CreateUser(ctx context.Context, req *pb.UserCreateReq) (*pb.Void, error) {
	if strings.TrimSpace(req.FullName) == "" {
		return nil, status.Error(codes.InvalidArgument, "full name is required")
	}
	if req.Email != "" && !funcs.IsValidEmail(req.Email) {
		return nil, status.Error(codes.InvalidArgument, "invalid email address")
	}

	if !funcs.IsValidRole(req.Role) {
		return nil, status.Error(codes.InvalidArgument, "invalid role")
	}

	return s.userRepo.CreateUser(ctx, req)
}

func (s *UserService) GetUser(ctx context.Context, req *pb.ByID) (*pb.UserGetRes, error) {
	return s.userRepo.GetUser(ctx, req)
}

func (s *UserService) UpdateUser(ctx context.Context, req *pb.UserUpdateReq) (*pb.Void, error) {
	if req.GetBody() == nil {
		return nil, status.Error(codes.InvalidArgument, "user update body is required")
	}
	if strings.TrimSpace(req.Body.FullName) == "" {
		return nil, status.Error(codes.InvalidArgument, "full name is required")
	}
	if req.Body.Email != "" && !funcs.IsValidEmail(req.Body.Email) {
		return nil, status.Error(codes.InvalidArgument, "invalid email address")
	}

	if !funcs.IsValidRole(req.Body.Role) {
		return nil, status.Error(codes.InvalidArgument, "invalid role")
	}
	return s.userRepo.UpdateUser(ctx, req)
}

func (s *UserService) DeleteUser(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	return s.userRepo.DeleteUser(ctx, req)
}

func (s *UserService) GetAllUsers(ctx context.Context, req *pb.UsersGetAllReq) (*pb.UsersGetAllRes, error) {
	if req.Limit <= 0 {
		req.Limit = 10 // default
	}
	if req.Limit > 100 {
		req.Limit = 100 // cap max
	}
	if req.Offset < 0 {
		req.Offset = 0
	}
	req.Search = strings.TrimSpace(req.Search)

	return s.userRepo.GetAllUsers(ctx, req)
}
