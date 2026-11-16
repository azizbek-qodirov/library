package handlers

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"library-gateway/internal/pkg/errors"
	pb "library-gateway/internal/pkg/genproto"
	"library-gateway/internal/pkg/validation"

	"github.com/gin-gonic/gin"
)

// CreateBook godoc
// @Summary Creates a new book
// @Description Creates a new book in the database
// @Tags 05-Book
// @Accept json
// @Produce json
// @Param message body pb.BookCreateReq true "Book create request"
// @Success 201 {object} pb.Void "Book created successfully"
// @Failure 400 {object} string "Invalid request payload"
// @Failure 500 {object} string "Server error"
// @Security StaffAuth
// @Router /book [post]
func (h *HTTPHandler) CreateBook(c *gin.Context) {
	req := &pb.BookCreateReq{}
	if err := c.ShouldBindJSON(req); err != nil {
		errors.BadRequest(c, "Invalid request payload", err.Error())
		return
	}

	// Validate required fields
	if err := validation.ValidateStringNotEmpty(req.Title, "Title"); err != nil {
		errors.ValidationError(c, err)
		return
	}
	if err := validation.ValidateISBN(req.Isbn); err != nil {
		errors.ValidationError(c, err)
		return
	}
	if err := validation.ValidatePositiveInt(int(req.PageCount), "Page count"); err != nil {
		errors.ValidationError(c, err)
		return
	}
	if req.TotalCopies < 0 {
		errors.BadRequest(c, "Total copies cannot be negative")
		return
	}

	// Validate foreign key IDs
	if req.PublisherId != "" {
		if err := validation.ValidateUUID(req.PublisherId, "Publisher ID"); err != nil {
			errors.ValidationError(c, err)
			return
		}
	}
	if err := validation.ValidateUUIDArray(req.CategoryIds, "Category IDs"); err != nil {
		errors.ValidationError(c, err)
		return
	}
	if err := validation.ValidateUUIDArray(req.AuthorIds, "Author IDs"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	_, err := h.BookS.CreateBook(ctx, req)
	if err != nil {
		errors.HandleGRPCError(c, err, "Create book")
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Book created successfully"})
}

// GetBookByID godoc
// @Summary Get book by ID
// @Description Retrieves a book's information by ID
// @Tags 05-Book
// @Accept json
// @Produce json
// @Param id path string true "Book ID"
// @Success 200 {object} pb.BookGetRes "Book found"
// @Failure 400 {object} string "Invalid book ID"
// @Failure 404 {object} string "Book not found"
// @Failure 500 {object} string "Server error"
// @Router /book/{id} [get]
func (h *HTTPHandler) GetBookByID(c *gin.Context) {
	id := c.Param("id")

	// Validate UUID format
	if err := validation.ValidateUUID(id, "Book ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	resp, err := h.BookS.GetBook(ctx, &pb.ByID{Id: id})
	if err != nil {
		errors.HandleGRPCError(c, err, "Get book")
		return
	}

	c.JSON(http.StatusOK, resp)
}

// UpdateBook godoc
// @Summary Update book
// @Description Updates an existing book
// @Tags 05-Book
// @Accept json
// @Produce json
// @Param id path string true "Book ID"
// @Param message body pb.BookUpdateBody true "Book update request"
// @Success 200 {object} pb.Void "Book updated successfully"
// @Failure 400 {object} string "Invalid request payload or book ID"
// @Failure 404 {object} string "Book not found"
// @Failure 500 {object} string "Server error"
// @Security StaffAuth
// @Router /book/{id} [put]
func (h *HTTPHandler) UpdateBook(c *gin.Context) {
	id := c.Param("id")

	// Validate UUID format
	if err := validation.ValidateUUID(id, "Book ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	body := &pb.BookUpdateBody{}
	if err := c.ShouldBindJSON(body); err != nil {
		errors.BadRequest(c, "Invalid request payload", err.Error())
		return
	}

	// Validate fields if present
	if body.Title != "" {
		if err := validation.ValidateStringNotEmpty(body.Title, "Title"); err != nil {
			errors.ValidationError(c, err)
			return
		}
	}
	if body.Isbn != "" {
		if err := validation.ValidateISBN(body.Isbn); err != nil {
			errors.ValidationError(c, err)
			return
		}
	}
	if body.PublisherId != "" {
		if err := validation.ValidateUUID(body.PublisherId, "Publisher ID"); err != nil {
			errors.ValidationError(c, err)
			return
		}
	}
	if len(body.CategoryIds) > 0 {
		if err := validation.ValidateUUIDArray(body.CategoryIds, "Category IDs"); err != nil {
			errors.ValidationError(c, err)
			return
		}
	}
	if len(body.AuthorIds) > 0 {
		if err := validation.ValidateUUIDArray(body.AuthorIds, "Author IDs"); err != nil {
			errors.ValidationError(c, err)
			return
		}
	}

	req := &pb.BookUpdateReq{
		Id:   id,
		Body: body,
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	_, err := h.BookS.UpdateBook(ctx, req)
	if err != nil {
		errors.HandleGRPCError(c, err, "Update book")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Book updated successfully"})
}

// DeleteBook godoc
// @Summary Delete book
// @Description Deletes a book by ID
// @Tags 05-Book
// @Accept json
// @Produce json
// @Param id path string true "Book ID"
// @Success 200 {object} pb.Void "Book deleted successfully"
// @Failure 400 {object} string "Invalid book ID"
// @Failure 404 {object} string "Book not found"
// @Failure 500 {object} string "Server error"
// @Security StaffAuth
// @Router /book/{id} [delete]
func (h *HTTPHandler) DeleteBook(c *gin.Context) {
	id := c.Param("id")

	// Validate UUID format
	if err := validation.ValidateUUID(id, "Book ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	_, err := h.BookS.DeleteBook(ctx, &pb.ByID{Id: id})
	if err != nil {
		errors.HandleGRPCError(c, err, "Delete book")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Book deleted successfully"})
}

// GetAllBooks godoc
// @Summary Get all books
// @Description Retrieves a list of books with optional filters for location, categories, authors, publisher, language, reference-only status, and search query
// @Tags 05-Book
// @Accept json
// @Produce json
// @Param limit query int false "Number of books to return" default(10)
// @Param offset query int false "Pagination offset" default(0)
// @Param search query string false "Search by book title, ISBN, or author name"
// @Param location query string false "Filter by book location"
// @Param category_ids query string false "Comma-separated list of category IDs to filter"
// @Param author_ids query string false "Comma-separated list of author IDs to filter"
// @Param publisher_id query string false "Filter by publisher ID"
// @Param language query string false "Filter by book language"
// @Param is_reference_only query bool false "Filter only reference books"
// @Success 200 {object} pb.BooksGetAllRes "List of books with total count"
// @Failure 400 {object} string "Invalid request parameters"
// @Failure 500 {object} string "Server error"
// @Param available_only query bool false "Only books available for checkout"
// @Router /books [get]
func (h *HTTPHandler) GetAllBooks(c *gin.Context) {
	limit, offset, ok := pagination(c)
	if !ok {
		return
	}

	availableOnly, err := strconv.ParseBool(c.DefaultQuery("available_only", "false"))
	if err != nil {
		errors.BadRequest(c, "Invalid available_only filter")
		return
	}

	// Filters
	search := c.Query("search")
	location := c.Query("location")
	language := c.Query("language")
	publisherID := c.Query("publisher_id")

	// Parse is_reference_only as optional bool (nil if not provided)
	var isReferenceOnly *bool
	if refOnlyStr := c.Query("is_reference_only"); refOnlyStr != "" {
		refOnly, err := strconv.ParseBool(refOnlyStr)
		if err != nil {
			errors.BadRequest(c, "Invalid is_reference_only filter")
			return
		}
		isReferenceOnly = &refOnly
	}

	// Validate publisher ID if provided
	if publisherID != "" {
		if err := validation.ValidateUUID(publisherID, "Publisher ID"); err != nil {
			errors.ValidationError(c, err)
			return
		}
	}

	// Comma-separated list parsing with validation
	categoryIDs := []string{}
	if c.Query("category_ids") != "" {
		categoryIDs = strings.Split(c.Query("category_ids"), ",")
		// Validate all category IDs to prevent SQL injection
		if err := validation.ValidateUUIDArray(categoryIDs, "Category IDs"); err != nil {
			errors.ValidationError(c, err)
			return
		}
	}

	authorIDs := []string{}
	if c.Query("author_ids") != "" {
		authorIDs = strings.Split(c.Query("author_ids"), ",")
		// Validate all author IDs to prevent SQL injection
		if err := validation.ValidateUUIDArray(authorIDs, "Author IDs"); err != nil {
			errors.ValidationError(c, err)
			return
		}
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	resp, err := h.BookS.GetAllBooks(ctx, &pb.BooksGetAllReq{
		Search:          search,
		Location:        location,
		CategoryIds:     categoryIDs,
		AuthorIds:       authorIDs,
		PublisherId:     publisherID,
		Language:        language,
		IsReferenceOnly: isReferenceOnly,
		AvailableOnly:   availableOnly,
		Limit:           int64(limit),
		Offset:          int64(offset),
	})
	if err != nil {
		errors.HandleGRPCError(c, err, "Get all books")
		return
	}

	c.JSON(http.StatusOK, resp)
}
