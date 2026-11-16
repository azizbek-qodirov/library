package repo

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
)

// bookJSON projects the same book representation for catalog, loan and
// recommendation reads. The outer query supplies the books row as b.
const bookJSON = `jsonb_build_object(
	'id', b.id, 'title', b.title, 'location', b.location,
	'is_reference_only', b.is_reference_only, 'description', b.description,
	'isbn', b.isbn, 'published_date', b.published_date::date,
	'publication_year', b.publication_year, 'language', b.language, 'page_count', b.page_count,
	'total_copies', b.total_copies, 'available_copies', b.available_copies,
	'cover_image_id', (SELECT to_jsonb(f) - 'state' - 'object_key' FROM files f WHERE f.id = b.cover_image_id),
	'publisher_id', (SELECT jsonb_build_object('id', p.id, 'name', p.name, 'description', p.description)
		FROM publishers p WHERE p.id = b.publisher_id),
	'category_ids', (SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'description', c.description) ORDER BY c.name, c.id)
		FROM book_categories bc JOIN categories c ON c.id = bc.category_id WHERE bc.book_id = b.id),
	'author_ids', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.name, a.id)
		FROM book_authors ba JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = b.id)
)`

var searchApostrophes = strings.NewReplacer("‘", "'", "’", "'", "ʻ", "'", "ʼ", "'", "`", "'")

// Use whole-character replacements so this also works on legacy SQL_ASCII databases.
func foldApostropheSQL(column string) string {
	for _, apostrophe := range []string{"'‘'", "'’'", "'ʻ'", "'ʼ'", "chr(96)"} {
		column = "replace(" + column + ", " + apostrophe + ", chr(39))"
	}
	return column
}

// Match common Uzbek apostrophe forms and both printed and compact ISBNs.
var catalogSearch = ` AND (` + foldApostropheSQL("b.title") + ` ILIKE $%[1]d
	OR ` + foldApostropheSQL("b.description") + ` ILIKE $%[1]d
	OR b.isbn ILIKE $%[1]d
	OR (translate($%[1]d, '- %%', '') ~ '^[0-9]+[xX]?$'
	    AND translate(b.isbn, '- ', '') ILIKE translate($%[1]d, '- ', ''))
	OR EXISTS (SELECT 1 FROM book_authors ba JOIN authors a ON a.id = ba.author_id
		WHERE ba.book_id = b.id AND ` + foldApostropheSQL("a.name") + ` ILIKE $%[1]d)
)`

func readJSON[T any](row *sql.Row) (*T, error) {
	var data []byte
	if err := row.Scan(&data); err != nil {
		return nil, err
	}
	var value T
	if err := json.Unmarshal(data, &value); err != nil {
		return nil, err
	}
	return &value, nil
}

func readJSONList[T any](rows *sql.Rows) ([]*T, error) {
	defer rows.Close()
	var values []*T
	for rows.Next() {
		var data []byte
		if err := rows.Scan(&data); err != nil {
			return nil, err
		}
		var value T
		if err := json.Unmarshal(data, &value); err != nil {
			return nil, err
		}
		values = append(values, &value)
	}
	return values, rows.Err()
}

type listQuery struct {
	where string
	args  []any
}

func (q *listQuery) add(condition string, value any) {
	q.args = append(q.args, value)
	q.where += fmt.Sprintf(condition, len(q.args))
}

func (q listQuery) page(order string, limit, offset int64) (string, []any) {
	query := q.where + order + fmt.Sprintf(" LIMIT $%d OFFSET $%d", len(q.args)+1, len(q.args)+2)
	return query, append(append([]any(nil), q.args...), limit, offset)
}
