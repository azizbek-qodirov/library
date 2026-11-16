package handlers

import (
	"strconv"

	"library-gateway/internal/pkg/errors"
	"library-gateway/internal/pkg/validation"

	"github.com/gin-gonic/gin"
)

func pagination(c *gin.Context) (limit, offset int64, ok bool) {
	limit, limitErr := strconv.ParseInt(c.DefaultQuery("limit", "10"), 10, 64)
	offset, offsetErr := strconv.ParseInt(c.DefaultQuery("offset", "0"), 10, 64)
	if limitErr != nil || offsetErr != nil {
		errors.BadRequest(c, "limit and offset must be integers")
		return 0, 0, false
	}
	if err := validation.ValidatePagination(limit, offset); err != nil {
		errors.ValidationError(c, err)
		return 0, 0, false
	}
	return limit, offset, true
}
