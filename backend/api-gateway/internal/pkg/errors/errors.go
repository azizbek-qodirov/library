package errors

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// ErrorResponse represents a standardized error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Details string `json:"details,omitempty"`
}

// HandleGRPCError converts gRPC errors to appropriate HTTP responses
func HandleGRPCError(c *gin.Context, err error, operation string) {
	if err == nil {
		return
	}

	st, ok := status.FromError(err)
	if !ok {
		// Not a gRPC error, treat as internal server error
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Internal server error",
			Details: operation + " failed",
		})
		return
	}

	var httpStatus int
	var errorMessage string

	switch st.Code() {
	case codes.OK:
		return
	case codes.InvalidArgument:
		httpStatus = http.StatusBadRequest
		errorMessage = "Invalid request parameters"
	case codes.NotFound:
		httpStatus = http.StatusNotFound
		errorMessage = "Resource not found"
	case codes.AlreadyExists:
		httpStatus = http.StatusConflict
		errorMessage = "Resource already exists"
	case codes.PermissionDenied:
		httpStatus = http.StatusForbidden
		errorMessage = "Permission denied"
	case codes.Unauthenticated:
		httpStatus = http.StatusUnauthorized
		errorMessage = "Authentication required"
	case codes.FailedPrecondition:
		httpStatus = http.StatusBadRequest
		errorMessage = "Precondition failed"
	case codes.Unimplemented:
		httpStatus = http.StatusNotImplemented
		errorMessage = "Feature not implemented"
	case codes.Unavailable:
		httpStatus = http.StatusServiceUnavailable
		errorMessage = "Service unavailable"
	default:
		httpStatus = http.StatusInternalServerError
		errorMessage = "Internal server error"
	}

	c.JSON(httpStatus, ErrorResponse{
		Error:   errorMessage,
		Details: st.Message(),
	})
}

// BadRequest sends a 400 Bad Request response
func BadRequest(c *gin.Context, message string, details ...string) {
	c.JSON(http.StatusBadRequest, ErrorResponse{
		Error:   message,
		Details: joinDetails(details),
	})
}

// NotFound sends a 404 Not Found response
func NotFound(c *gin.Context, resource string) {
	c.JSON(http.StatusNotFound, ErrorResponse{
		Error: resource + " not found",
	})
}

// InternalError sends a 500 Internal Server Error response
func InternalError(c *gin.Context, operation string, details ...string) {
	c.JSON(http.StatusInternalServerError, ErrorResponse{
		Error:   operation + " failed",
		Details: joinDetails(details),
	})
}

// Conflict sends a 409 Conflict response
func Conflict(c *gin.Context, message string) {
	c.JSON(http.StatusConflict, ErrorResponse{
		Error: message,
	})
}

// ValidationError sends a 400 Bad Request response for validation errors
func ValidationError(c *gin.Context, err error) {
	c.JSON(http.StatusBadRequest, ErrorResponse{
		Error:   "Validation failed",
		Details: err.Error(),
	})
}

// joinDetails joins multiple detail strings into one
func joinDetails(details []string) string {
	if len(details) == 0 {
		return ""
	}
	return strings.Join(details, "; ")
}
