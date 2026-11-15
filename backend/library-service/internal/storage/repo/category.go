package repo

import (
	"context"
	"database/sql"
	"fmt"

	pb "library/internal/pkg/genproto"
)

type CategoryRepo struct {
	db *sql.DB
}

func NewCategoryRepo(db *sql.DB) *CategoryRepo {
	return &CategoryRepo{db: db}
}

func (r *CategoryRepo) CreateCategory(ctx context.Context, req *pb.CategoryCreateReq) (*pb.Void, error) {
	query := `INSERT INTO categories (name, description) VALUES ($1, $2)`
	_, err := r.db.ExecContext(ctx, query, req.Name, req.Description)
	if err != nil {
		return nil, err
	}
	return &pb.Void{}, nil
}

func (r *CategoryRepo) GetCategory(ctx context.Context, req *pb.ByID) (*pb.CategoryGetRes, error) {
	query := `SELECT id, name, description FROM categories WHERE id = $1`
	var cat pb.CategoryGetRes
	err := r.db.QueryRowContext(ctx, query, req.Id).Scan(
		&cat.Id,
		&cat.Name,
		&cat.Description,
	)
	if err != nil {
		return nil, err
	}
	return &cat, nil
}

func (r *CategoryRepo) UpdateCategory(ctx context.Context, req *pb.CategoryUpdateReq) (*pb.Void, error) {
	query := `UPDATE categories SET name = $1, description = $2 WHERE id = $3`
	_, err := r.db.ExecContext(ctx, query, req.Body.Name, req.Body.Description, req.Id)
	if err != nil {
		return nil, err
	}
	return &pb.Void{}, nil
}

func (r *CategoryRepo) DeleteCategory(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	query := `DELETE FROM categories WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, req.Id)
	if err != nil {
		return nil, err
	}
	return &pb.Void{}, nil
}

func (r *CategoryRepo) GetAllCategories(ctx context.Context, req *pb.CategoriesGetAllReq) (*pb.GetAllCategoriesRes, error) {
	query := `SELECT id, name, description FROM categories WHERE 1=1`
	var args []interface{}
	argCount := 1

	// search
	if req.Search != "" {
		query += fmt.Sprintf(" AND (name ILIKE $%d OR description ILIKE $%d)", argCount, argCount+1)
		args = append(args, "%"+req.Search+"%", "%"+req.Search+"%")
		argCount += 2
	}

	// pagination
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argCount, argCount+1)
	args = append(args, req.Limit, req.Offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var categories []*pb.CategoryGetRes
	for rows.Next() {
		var cat pb.CategoryGetRes
		if err := rows.Scan(&cat.Id, &cat.Name, &cat.Description); err != nil {
			return nil, err
		}
		categories = append(categories, &cat)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}

	// Count for pagination
	countQuery := "SELECT count(id) FROM categories WHERE 1=1"
	var countArgs []interface{}
	argCount = 1

	if req.Search != "" {
		countQuery += fmt.Sprintf(" AND (name ILIKE $%d OR description ILIKE $%d)", argCount, argCount+1)
		countArgs = append(countArgs, "%"+req.Search+"%", "%"+req.Search+"%")
		argCount += 2
	}

	var total uint64
	if err := r.db.QueryRowContext(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return nil, err
	}

	return &pb.GetAllCategoriesRes{
		Categories: categories,
		TotalCount: total,
	}, nil
}
