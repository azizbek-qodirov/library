package handlers

import (
	"context"
	"net/http"
	"regexp"
	"strings"
	"time"

	"library-gateway/internal/pkg/errors"
	pb "library-gateway/internal/pkg/genproto"
	"library-gateway/internal/pkg/validation"

	"github.com/gin-gonic/gin"
)

var copyBarcode = regexp.MustCompile(`^OX-[1-9][0-9]{0,18}$`)

// GetCopyByBarcode godoc
// @Summary Look up a library copy by university barcode
// @Tags 05-Book
// @Produce json
// @Param barcode path string true "University barcode, such as OX-123"
// @Success 200 {object} pb.CopyLookupRes
// @Failure 400 {object} string
// @Failure 404 {object} string
// @Security StaffAuth
// @Router /copy/{barcode} [get]
func (h *HTTPHandler) GetCopyByBarcode(c *gin.Context) {
	barcode := strings.ToUpper(strings.TrimSpace(c.Param("barcode")))
	if !copyBarcode.MatchString(barcode) {
		errors.BadRequest(c, "Enter a university barcode such as OX-123")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()
	result, err := h.BookS.GetCopyByBarcode(ctx, &pb.CopyBarcodeReq{Barcode: barcode})
	if err != nil {
		errors.HandleGRPCError(c, err, "Find copy by barcode")
		return
	}
	c.JSON(http.StatusOK, result)
}

// ListBookCopies godoc
// @Summary List physical copies and their barcodes
// @Tags 05-Book
// @Produce json
// @Param id path string true "Book ID"
// @Success 200 {object} pb.BookCopiesRes
// @Failure 400 {object} string
// @Security StaffAuth
// @Router /book/{id}/copies [get]
func (h *HTTPHandler) ListBookCopies(c *gin.Context) {
	id := c.Param("id")
	if err := validation.ValidateUUID(id, "Book ID"); err != nil {
		errors.ValidationError(c, err)
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()
	result, err := h.BookS.ListBookCopies(ctx, &pb.ByID{Id: id})
	if err != nil {
		errors.HandleGRPCError(c, err, "List book copies")
		return
	}
	c.JSON(http.StatusOK, result)
}
