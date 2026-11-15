package repo

import (
	"context"
	"database/sql"
	"fmt"

	pb "library/internal/pkg/genproto"
)

type AuthorRepo struct {
	db *sql.DB
}

func NewAuthorRepo(db *sql.DB) *AuthorRepo {
	return &AuthorRepo{db: db}
}

func (r *AuthorRepo) CreateAuthor(ctx context.Context, req *pb.AuthorCreateReq) (*pb.Void, error) {
	query := `INSERT INTO authors (name, birth_date, biography) VALUES ($1, $2, $3)`
	_, err := r.db.ExecContext(ctx, query, req.Name, req.BirthDate, req.Biography)
	if err != nil {
		return nil, err
	}
	return &pb.Void{}, nil
}

func (r *AuthorRepo) GetAuthor(ctx context.Context, req *pb.ByID) (*pb.AuthorGetRes, error) {
	query := `SELECT id, name, birth_date, biography FROM authors WHERE id = $1`
	var author pb.AuthorGetRes
	err := r.db.QueryRowContext(ctx, query, req.Id).Scan(
		&author.Id,
		&author.Name,
		&author.BirthDate,
		&author.Biography,
	)
	if err != nil {
		return nil, err
	}
	return &author, nil
}

func (r *AuthorRepo) UpdateAuthor(ctx context.Context, req *pb.AuthorUpdateReq) (*pb.Void, error) {
	query := `UPDATE authors SET name = $1, birth_date = $2, biography = $3 WHERE id = $4`
	_, err := r.db.ExecContext(ctx, query, req.Body.Name, req.Body.BirthDate, req.Body.Biography, req.Id)
	if err != nil {
		return nil, err
	}
	return &pb.Void{}, nil
}

func (r *AuthorRepo) DeleteAuthor(ctx context.Context, req *pb.ByID) (*pb.Void, error) {
	query := `DELETE FROM authors WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, req.Id)
	if err != nil {
		return nil, err
	}
	return &pb.Void{}, nil
}

func (r *AuthorRepo) GetAllAuthors(ctx context.Context, req *pb.AuthorsGetAllReq) (*pb.GetAllAuthorsRes, error) {
	query := `SELECT id, name, birth_date, biography FROM authors WHERE 1=1`
	var args []interface{}
	argCount := 1

	// search
	if req.Search != "" {
		query += fmt.Sprintf(" AND (name ILIKE $%d OR biography ILIKE $%d)", argCount, argCount+1)
		args = append(args, "%"+req.Search+"%", "%"+req.Search+"%")
		argCount += 2
	}

	// order by
	if req.OrderBy != "" {
		query += " ORDER BY " + req.OrderBy
	}

	// pagination
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argCount, argCount+1)
	args = append(args, req.Limit, req.Offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var authors []*pb.AuthorGetRes
	for rows.Next() {
		var author pb.AuthorGetRes
		var birthDate sql.NullString
		if err := rows.Scan(&author.Id, &author.Name, &birthDate, &author.Biography); err != nil {
			return nil, err
		}
		if birthDate.Valid {
			author.BirthDate = &birthDate.String
		}
		authors = append(authors, &author)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}

	// Count for pagination
	countQuery := "SELECT count(id) FROM authors WHERE 1=1"
	var countArgs []interface{}
	argCount = 1

	if req.Search != "" {
		countQuery += fmt.Sprintf(" AND (name ILIKE $%d OR biography ILIKE $%d)", argCount, argCount+1)
		countArgs = append(countArgs, "%"+req.Search+"%", "%"+req.Search+"%")
		argCount += 2
	}

	var total uint64
	if err := r.db.QueryRowContext(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return nil, err
	}

	return &pb.GetAllAuthorsRes{
		Authors:    authors,
		TotalCount: total,
	}, nil
}
