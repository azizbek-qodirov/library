package repo

import (
	"context"
	"database/sql"
	"fmt"
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
	query := "SELECT * FROM users WHERE id = $1"
	var user pb.UserGetRes
	var created_at, updated_at sql.NullString
	err := r.db.QueryRowContext(ctx, query, req.Id).Scan(
		&user.Id,
		&user.FullName,
		&user.GroupName,
		&user.Email,
		&user.Phone,
		&user.Role,
		&created_at,
		&updated_at,
	)
	if err != nil {
		return nil, err
	}
	if created_at.Valid {
		user.CreatedAt = created_at.String
	}
	if updated_at.Valid {
		user.UpdatedAt = updated_at.String
	}
	return &user, nil
}

func (r *UserRepo) UpdateUser(ctx context.Context, req *pb.UserUpdateReq) (*pb.Void, error) {
	query := `
		UPDATE users SET full_name = $1, group_name = $2, email = $3, phone = $4, role = $5, updated_at = $6
		WHERE id = $7`
	_, err := r.db.ExecContext(
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
	if err != nil {
		return nil, err
	}
	return &pb.Void{}, nil
}

func (r *UserRepo) DeleteUser(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	query := "DELETE FROM users WHERE id = $1"
	_, err := r.db.ExecContext(ctx, query, req.Id)
	if err != nil {
		return nil, err
	}
	return &pb.Void{}, nil
}

func (r *UserRepo) GetAllUsers(ctx context.Context, req *pb.UsersGetAllReq) (*pb.UsersGetAllRes, error) {
	query := `
		SELECT id, full_name, group_name, email, phone, role, created_at, updated_at
		FROM users
		WHERE 1=1
	`
	var args []interface{}
	argCount := 1

	// search (matches full_name, email, or phone)
	if req.Search != "" {
		query += fmt.Sprintf(" AND (full_name ILIKE $%d OR email ILIKE $%d OR phone ILIKE $%d)", argCount, argCount+1, argCount+2)
		args = append(args, "%"+req.Search+"%", "%"+req.Search+"%", "%"+req.Search+"%")
		argCount += 3
	}

	// filter by group name
	if req.GroupName != "" {
		query += fmt.Sprintf(" AND group_name ILIKE $%d", argCount)
		args = append(args, "%"+req.GroupName+"%")
		argCount++
	}

	// filter by role
	if req.Role != "" {
		query += fmt.Sprintf(" AND role = $%d", argCount)
		args = append(args, req.Role)
		argCount++
	}

	// pagination
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argCount, argCount+1)
	args = append(args, req.Limit, req.Offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// scan results

	var users []*pb.UserGetRes
	for rows.Next() {
		var user pb.UserGetRes
		var created_at, updated_at sql.NullString
		if err := rows.Scan(
			&user.Id,
			&user.FullName,
			&user.GroupName,
			&user.Email,
			&user.Phone,
			&user.Role,
			&created_at,
			&updated_at,
		); err != nil {
			return nil, err
		}
		if created_at.Valid {
			user.CreatedAt = created_at.String
		}
		if updated_at.Valid {
			user.UpdatedAt = updated_at.String
		}
		users = append(users, &user)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}

	// count query (for pagination metadata)
	countQuery := "SELECT count(id) FROM users WHERE 1=1"
	var countArgs []interface{}
	argCount = 1

	if req.Search != "" {
		countQuery += fmt.Sprintf(" AND (full_name ILIKE $%d OR email ILIKE $%d OR phone ILIKE $%d)", argCount, argCount+1, argCount+2)
		countArgs = append(countArgs, "%"+req.Search+"%", "%"+req.Search+"%", "%"+req.Search+"%")
		argCount += 3
	}
	if req.GroupName != "" {
		countQuery += fmt.Sprintf(" AND group_name = $%d", argCount)
		countArgs = append(countArgs, req.GroupName)
		argCount++
	}
	if req.Role != "" {
		countQuery += fmt.Sprintf(" AND role = $%d", argCount)
		countArgs = append(countArgs, req.Role)
		argCount++
	}

	var totalCount int64
	if err = r.db.QueryRowContext(ctx, countQuery, countArgs...).Scan(&totalCount); err != nil {
		return nil, err
	}

	return &pb.UsersGetAllRes{
		Users: users,
		Total: totalCount,
	}, nil
}
