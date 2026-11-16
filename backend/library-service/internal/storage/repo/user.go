package repo

import (
	"context"
	"database/sql"
	pb "library/internal/pkg/genproto"
	"time"
)

type UserRepo struct {
	db *sql.DB
}

func NewUserRepo(db *sql.DB) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) CreateUser(ctx context.Context, req *pb.UserCreateReq) (*pb.Void, error) {
	query := `
		INSERT INTO users (full_name, group_name, email, phone, role, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)`
	_, err := r.db.ExecContext(
		ctx,
		query,
		req.FullName,
		req.GroupName,
		req.Email,
		req.Phone,
		req.Role,
		time.Now(),
	)

	if err != nil {
		return nil, err
	}
	return &pb.Void{}, nil
}

func (r *UserRepo) GetUser(ctx context.Context, req *pb.ByID) (*pb.UserGetRes, error) {
	return readJSON[pb.UserGetRes](r.db.QueryRowContext(ctx, "SELECT to_jsonb(u) FROM users u WHERE id = $1", req.Id))
}

func (r *UserRepo) UpdateUser(ctx context.Context, req *pb.UserUpdateReq) (*pb.Void, error) {
	query := `
		UPDATE users SET full_name = $1, group_name = $2, email = $3, phone = $4, role = $5, updated_at = $6
		WHERE id = $7`
	result, err := r.db.ExecContext(
		ctx,
		query,
		req.Body.FullName,
		req.Body.GroupName,
		req.Body.Email,
		req.Body.Phone,
		req.Body.Role,
		time.Now(),
		req.Id,
	)
	if err := requireAffected(result, err); err != nil {
		return nil, err
	}
	return &pb.Void{}, nil
}

func (r *UserRepo) DeleteUser(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	query := "DELETE FROM users WHERE id = $1"
	result, err := r.db.ExecContext(ctx, query, req.Id)
	if err := requireAffected(result, err); err != nil {
		return nil, err
	}
	return &pb.Void{}, nil
}

func (r *UserRepo) GetAllUsers(ctx context.Context, req *pb.UsersGetAllReq) (*pb.UsersGetAllRes, error) {
	query := listQuery{where: " FROM users u WHERE TRUE"}
	if req.Search != "" {
		query.add(" AND (full_name ILIKE $%[1]d OR email ILIKE $%[1]d OR phone ILIKE $%[1]d)", "%"+req.Search+"%")
	}
	if req.GroupName != "" {
		query.add(" AND group_name ILIKE $%d", "%"+req.GroupName+"%")
	}
	if req.Role != "" {
		query.add(" AND role = $%d", req.Role)
	}
	page, args := query.page(" ORDER BY full_name, id", req.Limit, req.Offset)
	rows, err := r.db.QueryContext(ctx, "SELECT to_jsonb(u)"+page, args...)
	if err != nil {
		return nil, err
	}
	users, err := readJSONList[pb.UserGetRes](rows)
	if err != nil {
		return nil, err
	}
	var total int64
	if err := r.db.QueryRowContext(ctx, "SELECT count(*)"+query.where, query.args...).Scan(&total); err != nil {
		return nil, err
	}
	return &pb.UsersGetAllRes{Users: users, Total: total}, nil
}
