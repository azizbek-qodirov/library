package handlers

import (
	"context"
	"net/http"
	"time"

	"library-gateway/internal/pkg/errors"
	pb "library-gateway/internal/pkg/genproto"
	"library-gateway/internal/pkg/validation"

	"github.com/gin-gonic/gin"
)

// CreateAuthor godoc
// @Summary Creates a new author
// @Description Creates a new author in the database
// @Tags 04-Author
// @Accept json
// @Produce json
// @Param message body pb.AuthorCreateReq true "Author create request"
// @Success 201 {object} pb.Void "Author created successfully"
// @Failure 400 {object} string "Invalid request payload"
// @Failure 500 {object} string "Server error"
// @Security StaffAuth
// @Router /author [post]
func (h *HTTPHandler) CreateAuthor(c *gin.Context) {
	req := &pb.AuthorCreateReq{}
	if err := c.ShouldBindJSON(req); err != nil {
		errors.BadRequest(c, "Invalid request payload", err.Error())
		return
	}

	if err := validation.ValidateStringNotEmpty(req.Name, "Name"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	_, err := h.AS.CreateAuthor(ctx, req)
	if err != nil {
		errors.HandleGRPCError(c, err, "Create author")
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Author created successfully"})
}

// GetAuthorByID godoc
// @Summary Get author by ID
// @Description Retrieves an author's information by ID
// @Tags 04-Author
// @Accept json
// @Produce json
// @Param id path string true "Author ID"
// @Success 200 {object} pb.AuthorGetRes "Author found"
// @Failure 400 {object} string "Invalid author ID"
// @Failure 404 {object} string "Author not found"
// @Failure 500 {object} string "Server error"
// @Router /author/{id} [get]
func (h *HTTPHandler) GetAuthorByID(c *gin.Context) {
	id := c.Param("id")
	if err := validation.ValidateUUID(id, "Author ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	resp, err := h.AS.GetAuthor(ctx, &pb.ByID{Id: id})
	if err != nil {
		errors.HandleGRPCError(c, err, "Get author")
		return
	}

	c.JSON(http.StatusOK, resp)
}

// UpdateAuthor godoc
// @Summary Update author
// @Description Updates an existing author
// @Tags 04-Author
// @Accept json
// @Produce json
// @Param id path string true "Author ID"
// @Param message body pb.AuthorUpdateBody true "Author update request"
// @Success 200 {object} pb.Void "Author updated successfully"
// @Failure 400 {object} string "Invalid request payload or author ID"
// @Failure 404 {object} string "Author not found"
// @Failure 500 {object} string "Server error"
// @Security StaffAuth
// @Router /author/{id} [put]
func (h *HTTPHandler) UpdateAuthor(c *gin.Context) {
	id := c.Param("id")
	if err := validation.ValidateUUID(id, "Author ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	body := &pb.AuthorUpdateBody{}
	if err := c.ShouldBindJSON(body); err != nil {
		errors.BadRequest(c, "Invalid request payload", err.Error())
		return
	}

	if body.Name != "" {
		if err := validation.ValidateStringNotEmpty(body.Name, "Name"); err != nil {
			errors.ValidationError(c, err)
			return
		}
	}

	req := &pb.AuthorUpdateReq{
		Id:   id,
		Body: body,
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	_, err := h.AS.UpdateAuthor(ctx, req)
	if err != nil {
		errors.HandleGRPCError(c, err, "Update author")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Author updated successfully"})
}

// DeleteAuthor godoc
// @Summary Delete author
// @Description Deletes an author by ID
// @Tags 04-Author
// @Accept json
// @Produce json
// @Param id path string true "Author ID"
// @Success 200 {object} pb.Void "Author deleted successfully"
// @Failure 400 {object} string "Invalid author ID"
// @Failure 404 {object} string "Author not found"
// @Failure 500 {object} string "Server error"
// @Security StaffAuth
// @Router /author/{id} [delete]
func (h *HTTPHandler) DeleteAuthor(c *gin.Context) {
	id := c.Param("id")
	if err := validation.ValidateUUID(id, "Author ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	_, err := h.AS.DeleteAuthor(ctx, &pb.ByID{Id: id})
	if err != nil {
		errors.HandleGRPCError(c, err, "Delete author")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Author deleted successfully"})
}

// GetAllAuthors godoc
// @Summary Get all authors
// @Description Retrieves a list of all authors
// @Tags 04-Author
// @Accept json
// @Produce json
// @Param limit query int false "Limit"
// @Param offset query int false "Offset"
// @Param search query string false "Search query"
// @Param order_by query string false "Sort by name or birth_date"
// @Success 200 {object} pb.GetAllAuthorsRes "List of authors"
// @Failure 500 {object} string "Server error"
// @Router /authors [get]
func (h *HTTPHandler) GetAllAuthors(c *gin.Context) {
	limit, offset, ok := pagination(c)
	if !ok {
		return
	}

	search := c.Query("search")

	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Second*5)
	defer cancel()

	resp, err := h.AS.GetAllAuthors(ctx, &pb.AuthorsGetAllReq{
		Limit:   uint64(limit),
		Offset:  uint64(offset),
		Search:  search,
		OrderBy: c.Query("order_by"),
	})
	if err != nil {
		errors.HandleGRPCError(c, err, "Get all authors")
		return
	}

	c.JSON(http.StatusOK, resp)
}
