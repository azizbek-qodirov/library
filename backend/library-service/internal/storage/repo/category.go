package repo

import (
	"context"
	"database/sql"
	"strings"

	pb "library/internal/pkg/genproto"
)

type CategoryRepo struct {
	db *sql.DB
}

func NewCategoryRepo(db *sql.DB) *CategoryRepo {
	return &CategoryRepo{db: db}
}

func (r *CategoryRepo) CreateCategory(ctx context.Context, req *pb.CategoryCreateReq) (*pb.CategoryGetRes, error) {
	var category pb.CategoryGetRes
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING id, name, description`,
		strings.TrimSpace(req.Name), req.Description,
	).Scan(&category.Id, &category.Name, &category.Description)
	if err != nil {
		return nil, err
	}
	return &category, nil
}

func (r *CategoryRepo) GetCategory(ctx context.Context, req *pb.ByID) (*pb.CategoryGetRes, error) {
	query := `SELECT id, name, coalesce(description, '') FROM categories WHERE id = $1`
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
	result, err := r.db.ExecContext(ctx, query, req.Body.Name, req.Body.Description, req.Id)
	if err := requireAffected(result, err); err != nil {
		return nil, err
	}
	return &pb.Void{}, nil
}

func (r *CategoryRepo) DeleteCategory(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	query := `DELETE FROM categories WHERE id = $1`
	result, err := r.db.ExecContext(ctx, query, req.Id)
	if err := requireAffected(result, err); err != nil {
		return nil, err
	}
	return &pb.Void{}, nil
}

func (r *CategoryRepo) GetAllCategories(ctx context.Context, req *pb.CategoriesGetAllReq) (*pb.GetAllCategoriesRes, error) {
	query := listQuery{where: " FROM categories c WHERE TRUE"}
	if req.Search != "" {
		query.add(" AND (c.name ILIKE $%[1]d OR c.description ILIKE $%[1]d)", "%"+req.Search+"%")
	}
	order := " ORDER BY c.name, c.id"
	bookCount := "0"
	if req.SortByBookCount {
		bookCount = "(SELECT count(*) FROM book_categories bc WHERE bc.category_id = c.id)"
		order = " ORDER BY book_count DESC, c.name, c.id"
	}
	page, args := query.page(order, int64(req.Limit), int64(req.Offset))
	rows, err := r.db.QueryContext(ctx, "SELECT c.id, c.name, coalesce(c.description, ''), "+bookCount+" AS book_count"+page, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var categories []*pb.CategoryGetRes
	for rows.Next() {
		var category pb.CategoryGetRes
		if err := rows.Scan(&category.Id, &category.Name, &category.Description, &category.BookCount); err != nil {
			return nil, err
		}
		categories = append(categories, &category)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	var total uint64
	if err := r.db.QueryRowContext(ctx, "SELECT count(*)"+query.where, query.args...).Scan(&total); err != nil {
		return nil, err
	}
	return &pb.GetAllCategoriesRes{Categories: categories, TotalCount: total}, nil
}
