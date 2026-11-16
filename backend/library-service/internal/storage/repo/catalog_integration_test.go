package repo

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	pb "library/internal/pkg/genproto"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func testDatabase(t *testing.T, beforeInventory func(*sql.DB)) *sql.DB {
	t.Helper()
	dsn := os.Getenv("LIBRARY_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set LIBRARY_TEST_DATABASE_URL to run against PostgreSQL")
	}
	admin, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = admin.Close() })
	schema := fmt.Sprintf("library_test_%d", time.Now().UnixNano())
	if _, err := admin.Exec("CREATE SCHEMA " + schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = admin.Exec("DROP SCHEMA " + schema + " CASCADE") })

	conn, err := url.Parse(dsn)
	if err != nil {
		t.Fatal(err)
	}
	params := conn.Query()
	params.Set("search_path", schema)
	conn.RawQuery = params.Encode()
	db, err := sql.Open("postgres", conn.String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	migrations, err := filepath.Glob("../../migrations/*.up.sql")
	if err != nil || len(migrations) == 0 {
		t.Fatalf("locate migrations: %v", err)
	}
	for _, migration := range migrations {
		if beforeInventory != nil && filepath.Base(migration) == "000003_inventory_and_catalog.up.sql" {
			beforeInventory(db)
		}
		data, err := os.ReadFile(migration)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := db.Exec(string(data)); err != nil {
			t.Fatalf("apply %s: %v", migration, err)
		}
	}
	return db
}

func insertID(t *testing.T, db *sql.DB, query string, args ...any) string {
	t.Helper()
	var id string
	if err := db.QueryRow(query, args...).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

func TestCatalogInventory(t *testing.T) {
	db := testDatabase(t, nil)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	books := NewBookRepo(db)
	loans := NewBorrowingRepo(db)
	categories := NewCategoryRepo(db)
	recommendations := NewRecommendedRepo(db)

	userID := insertID(t, db, "INSERT INTO users (full_name, group_name, role) VALUES ('Student','CS-01','student') RETURNING id")
	authorID := insertID(t, db, "INSERT INTO authors (name) VALUES ('Ada Lovelace') RETURNING id")
	categoryID := insertID(t, db, "INSERT INTO categories (name) VALUES ('Science') RETURNING id")
	insertID(t, db, "INSERT INTO categories (name) VALUES ('Arts') RETURNING id")
	_, err := books.CreateBook(ctx, &pb.BookCreateReq{
		Title: "Calculus", Isbn: "1234567890", PageCount: 120, TotalCopies: 1,
		AuthorIds: []string{authorID}, CategoryIds: []string{categoryID},
	})
	if err != nil {
		t.Fatal(err)
	}
	list, err := books.GetAllBooks(ctx, &pb.BooksGetAllReq{Search: "lovelace", CategoryIds: []string{categoryID}, Limit: 10})
	if err != nil || list.TotalCount != 1 || len(list.Books) != 1 {
		t.Fatalf("list %+v: %v", list, err)
	}
	book := list.Books[0]
	if book.CoverImageId != nil || book.PublisherId != nil || book.PublishedDate != "" || len(book.AuthorIds) != 1 || book.AvailableCopies != 1 {
		t.Fatalf("unexpected projection %v", book)
	}
	ranked, err := categories.GetAllCategories(ctx, &pb.CategoriesGetAllReq{Limit: 1, SortByBookCount: true})
	if err != nil || len(ranked.Categories) != 1 || ranked.Categories[0].Id != categoryID || ranked.Categories[0].BookCount != 1 {
		t.Fatalf("category ranking %+v: %v", ranked, err)
	}
	users, err := NewUserRepo(db).GetAllUsers(ctx, &pb.UsersGetAllReq{GroupName: "cs", Limit: 10})
	if err != nil || users.Total != 1 || len(users.Users) != 1 {
		t.Fatalf("group search %+v: %v", users, err)
	}
	if _, err := recommendations.CreateRecommended(ctx, &pb.RecommendedCreateReq{BookId: book.Id}); err != nil {
		t.Fatal(err)
	}
	featured, err := recommendations.GetAllRecommendeds(ctx, &pb.RecommendedsGetAllReq{Limit: 10})
	if err != nil || len(featured.Recommendeds) != 1 || featured.Recommendeds[0].BookId.Id != book.Id {
		t.Fatalf("recommendations %+v: %v", featured, err)
	}

	req := &pb.BorrowingCreateReq{BookId: book.Id, UserId: userID, FromDate: "2026-01-01", DueDate: "2026-01-14"}
	results := make(chan error, 2)
	var workers sync.WaitGroup
	for range 2 {
		workers.Add(1)
		go func() {
			defer workers.Done()
			_, err := loans.Create(ctx, req)
			results <- err
		}()
	}
	workers.Wait()
	close(results)
	successes := 0
	for err := range results {
		if err == nil {
			successes++
		} else if status.Code(err) != codes.FailedPrecondition {
			t.Fatalf("checkout error: %v", err)
		}
	}
	if successes != 1 {
		t.Fatalf("successful checkouts = %d, want 1", successes)
	}
	active, err := loans.GetAll(ctx, &pb.BorrowingsGetAllReq{Limit: 10, Status: "borrowed"})
	if err != nil || active.TotalCount != 1 || active.Borrowings[0].Book.AvailableCopies != 0 {
		t.Fatalf("loans %+v: %v", active, err)
	}

	loanID := active.Borrowings[0].Id
	if _, err := loans.Delete(ctx, &pb.ByID{Id: loanID}); status.Code(err) != codes.FailedPrecondition {
		t.Fatalf("deleting active loan should fail: %v", err)
	}
	if _, err := books.DeleteBook(ctx, &pb.ByID{Id: book.Id}); err == nil {
		t.Fatal("deleting a book with loan history should fail")
	}
	bookAfter, err := books.GetBook(ctx, &pb.ByID{Id: book.Id})
	if err != nil || len(bookAfter.AuthorIds) != 1 || len(bookAfter.CategoryIds) != 1 {
		t.Fatalf("failed delete changed associations: %+v, %v", bookAfter, err)
	}

	update := &pb.BorrowingUpdateReq{Id: loanID, Body: &pb.BorrowingUpdateBody{
		Status: "lost", FromDate: req.FromDate, DueDate: req.DueDate,
	}}
	if _, err := loans.Update(ctx, update); err != nil {
		t.Fatal(err)
	}
	update.Body.Status = "returned"
	for range 2 {
		if _, err := loans.Update(ctx, update); err != nil {
			t.Fatal(err)
		}
	}
	returned, err := loans.Get(ctx, &pb.ByID{Id: loanID})
	if err != nil || returned.Book.AvailableCopies != 1 || returned.ReturnedAt == "" {
		t.Fatalf("returned loan %+v: %v", returned, err)
	}

	update.Body.Status = "borrowed"
	if _, err := loans.Update(ctx, update); status.Code(err) != codes.FailedPrecondition {
		t.Fatalf("reopening returned loan: %v", err)
	}
	if _, err := db.Exec("UPDATE books SET is_reference_only = true WHERE id = $1", book.Id); err != nil {
		t.Fatal(err)
	}
	if _, err := loans.Create(ctx, req); status.Code(err) != codes.FailedPrecondition {
		t.Fatalf("reference-only checkout: %v", err)
	}
	if _, err := db.Exec("UPDATE books SET is_reference_only = false WHERE id = $1", book.Id); err != nil {
		t.Fatal(err)
	}
	req.RequestId = "a84c3369-dcd8-47b1-ac2d-e27680a12998"
	for range 2 {
		if _, err := loans.Create(ctx, req); err != nil {
			t.Fatalf("checkout with request ID: %v", err)
		}
	}
	req.Notes = "changed request"
	if _, err := loans.Create(ctx, req); status.Code(err) != codes.AlreadyExists {
		t.Fatalf("reusing the checkout request ID with different fields: %v", err)
	}
	second, err := loans.GetAll(ctx, &pb.BorrowingsGetAllReq{Limit: 10, Status: "borrowed"})
	if err != nil || second.TotalCount != 1 || len(second.Borrowings) != 1 {
		t.Fatalf("idempotent checkout %+v: %v", second, err)
	}
	secondID := second.Borrowings[0].Id
	if _, err := books.UpdateBook(ctx, &pb.BookUpdateReq{Id: book.Id, Body: &pb.BookUpdateBody{
		Title: "Calculus", Isbn: "1234567890", PageCount: 120, TotalCopies: 0,
	}}); status.Code(err) != codes.FailedPrecondition {
		t.Fatalf("reducing stock below outstanding loans: %v", err)
	}
	extension, _ := time.Parse(time.DateOnly, "2026-02-01")
	if _, err := loans.Renew(ctx, secondID, extension); err != nil {
		t.Fatal(err)
	}
	renewed, err := loans.Get(ctx, &pb.ByID{Id: secondID})
	if err != nil || renewed.ExtensionDate != "2026-02-01" {
		t.Fatalf("renewed loan %+v: %v", renewed, err)
	}
	for range 2 {
		if _, err := loans.SetStatus(ctx, secondID, "returned"); err != nil {
			t.Fatal(err)
		}
	}
	bookAfter, err = books.GetBook(ctx, &pb.ByID{Id: book.Id})
	if err != nil || bookAfter.AvailableCopies != 1 {
		t.Fatalf("stock after repeated return %+v: %v", bookAfter, err)
	}

}

func TestCoverLifecycle(t *testing.T) {
	db := testDatabase(t, nil)
	ctx := context.Background()
	files := NewFileRepo(db)
	books := NewBookRepo(db)
	file, err := files.CreateFile(ctx, &pb.FileCreateReq{PendingUpload: true, ObjectKey: "cover.png", MimeType: "image/png"})
	if err != nil || file.State != "pending_upload" {
		t.Fatalf("reserve file %+v: %v", file, err)
	}
	id := &pb.ByID{Id: file.Id}
	book := &pb.BookCreateReq{Title: "Catalog", Isbn: "1234567891", PageCount: 1, CoverImageId: file.Id}
	if _, err := books.CreateBook(ctx, book); err == nil {
		t.Fatal("a pending file should not be attachable")
	}
	if _, err := files.PrepareFileDeletion(ctx, id); status.Code(err) != codes.FailedPrecondition {
		t.Fatalf("active upload should not be deleted: %v", err)
	}
	if _, err := files.ActivateFile(ctx, id); err != nil {
		t.Fatal(err)
	}
	if _, err := books.CreateBook(ctx, book); err != nil {
		t.Fatal(err)
	}
	if _, err := files.PrepareFileDeletion(ctx, id); status.Code(err) != codes.FailedPrecondition {
		t.Fatalf("deleting an attached cover should fail: %v", err)
	}
	if _, err := db.Exec("DELETE FROM books WHERE cover_image_id = $1", id.Id); err != nil {
		t.Fatal(err)
	}
	for range 2 {
		pending, err := files.PrepareFileDeletion(ctx, id)
		if err != nil || pending.State != "deleting" || pending.ObjectKey != "cover.png" {
			t.Fatalf("prepare deletion %+v: %v", pending, err)
		}
	}
	if _, err := books.CreateBook(ctx, book); err == nil {
		t.Fatal("a deleting file should not be attachable")
	}
	if _, err := files.DeleteFile(ctx, id); err != nil {
		t.Fatal(err)
	}
	if _, err := files.GetFile(ctx, id); err != sql.ErrNoRows {
		t.Fatalf("file after finalize: %v", err)
	}
}

func TestInventoryMigrationReconcilesExistingLoans(t *testing.T) {
	var bookID string
	db := testDatabase(t, func(db *sql.DB) {
		userID := insertID(t, db, "INSERT INTO users (full_name, role) VALUES ('Existing borrower', 'student') RETURNING id")
		bookID = insertID(t, db, `INSERT INTO books
			(title, isbn, published_date, total_copies, available_copies)
			VALUES ('Existing title', '1234567892', '2020-01-01', 1, 1) RETURNING id`)
		if _, err := db.Exec(`INSERT INTO borrowings (book_id, user_id, from_date, due_date, status)
			VALUES ($1, $2, '2026-01-01', '2026-01-31', 'borrowed'),
			       ($1, $2, '2026-01-01', '2026-01-31', 'lost'),
			       ($1, $2, '2026-01-01', '2026-01-31', 'returned')`, bookID, userID); err != nil {
			t.Fatal(err)
		}
	})

	book, err := NewBookRepo(db).GetBook(context.Background(), &pb.ByID{Id: bookID})
	if err != nil || book.TotalCopies != 2 || book.AvailableCopies != 0 {
		t.Fatalf("reconciled copies %+v: %v", book, err)
	}
}
