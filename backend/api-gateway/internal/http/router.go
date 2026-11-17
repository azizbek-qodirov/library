package api

import (
	"crypto/sha256"
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	// _ "library-gateway/internal/http/docs"
	"library-gateway/internal/http/handlers"
	"library-gateway/internal/pkg/config"

	l "github.com/azizbek-qodirov/logger"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// @title University Library API
// @version 1.0
// @securityDefinitions.basic StaffAuth

// @tag.name 01-User
// @tag.description User CRUD methods

// @tag.name 02-Category
// @tag.description Category CRUD methods

// @tag.name 03-Publisher
// @tag.description Publisher CRUD methods

// @tag.name 04-Author
// @tag.description Author CRUD methods

// @tag.name 05-Book
// @tag.description Book CRUD methods

// @tag.name 06-Borrowing
// @tag.description Borrowing CRUD methods

// @tag.name 07-Recommended
// @tag.description Recommended books CRUD methods

// @tag.name 08-File
// @tag.description File management methods

func NewRouter(h *handlers.HTTPHandler, logger *l.Logger, cfg *config.Config) *gin.Engine {
	router := gin.Default()

	router.GET("api/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// CORS middleware with configurable origins
	allowedOrigins := strings.Split(cfg.CORS_ALLOWED_ORIGINS, ",")
	router.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		c.Writer.Header().Add("Vary", "Origin")

		// Check if origin is in allowed list
		allowed := false
		for _, allowedOrigin := range allowedOrigins {
			if strings.TrimSpace(allowedOrigin) == origin {
				allowed = true
				break
			}
		}

		if allowed {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
			c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")
		}

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	staff := router.Group("")
	staff.Use(requireStaff(cfg))
	staff.GET("/staff/session", func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		c.Status(http.StatusNoContent)
	})

	// Users
	staff.POST("/user", h.CreateUser)
	staff.GET("/user/:id", h.GetUserByID)
	staff.PUT("/user/:id", h.UpdateUser)
	staff.DELETE("/user/:id", h.DeleteUser)
	staff.GET("/users", h.GetAllUsers)

	// Categories
	staff.POST("/category", h.CreateCategory)
	router.GET("/category/:id", h.GetCategoryByID)
	staff.PUT("/category/:id", h.UpdateCategory)
	staff.DELETE("/category/:id", h.DeleteCategory)
	router.GET("/categories", h.GetAllCategories)

	// Publishers
	staff.POST("/publisher", h.CreatePublisher)
	router.GET("/publisher/:id", h.GetPublisherByID)
	staff.PUT("/publisher/:id", h.UpdatePublisher)
	staff.DELETE("/publisher/:id", h.DeletePublisher)
	router.GET("/publishers", h.GetAllPublishers)

	// Authors
	staff.POST("/author", h.CreateAuthor)
	router.GET("/author/:id", h.GetAuthorByID)
	staff.PUT("/author/:id", h.UpdateAuthor)
	staff.DELETE("/author/:id", h.DeleteAuthor)
	router.GET("/authors", h.GetAllAuthors)

	// Books
	staff.POST("/book", h.CreateBook)
	router.GET("/book/:id", h.GetBookByID)
	staff.GET("/book/:id/copies", h.ListBookCopies)
	staff.GET("/copy/:barcode", h.GetCopyByBarcode)
	staff.PUT("/book/:id", h.UpdateBook)
	staff.DELETE("/book/:id", h.DeleteBook)
	router.GET("/books", h.GetAllBooks)

	// Borrowings
	staff.POST("/borrowing", h.CreateBorrowing)
	staff.GET("/borrowing/:id", h.GetBorrowing)
	staff.PUT("/borrowing/:id", h.UpdateBorrowing)
	staff.POST("/borrowing/:id/return", h.ReturnBorrowing)
	staff.POST("/borrowing/:id/renew", h.RenewBorrowing)
	staff.POST("/borrowing/:id/lost", h.MarkBorrowingLost)
	staff.DELETE("/borrowing/:id", h.DeleteBorrowing)
	staff.GET("/borrowings", h.GetAllBorrowings)

	// Recommended
	router.GET("/recommended", h.GetRecommendedBooks)
	router.GET("/recommended/:id", h.GetRecommendedBook)
	staff.POST("/recommended", h.CreateRecommendedBook)
	staff.DELETE("/recommended/:id", h.DeleteRecommendedBook)

	// Files
	staff.POST("/file", h.CreateFile)
	staff.GET("/file/:id", h.GetFile)
	staff.DELETE("/file/:id", h.DeleteFile)
	staff.GET("/files", h.GetAllFiles)
	return router
}

func requireStaff(cfg *config.Config) gin.HandlerFunc {
	expectedUser := sha256.Sum256([]byte(cfg.STAFF_USERNAME))
	expectedPassword := sha256.Sum256([]byte(cfg.STAFF_PASSWORD))
	enabled := cfg.STAFF_USERNAME != "" && cfg.STAFF_PASSWORD != ""

	return func(c *gin.Context) {
		if !enabled {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "Staff access is not configured"})
			return
		}

		username, password, ok := c.Request.BasicAuth()
		userHash := sha256.Sum256([]byte(username))
		passwordHash := sha256.Sum256([]byte(password))
		matches := subtle.ConstantTimeCompare(userHash[:], expectedUser[:]) &
			subtle.ConstantTimeCompare(passwordHash[:], expectedPassword[:])
		if !ok || matches != 1 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Staff credentials are required"})
			return
		}
		c.Header("Cache-Control", "no-store")
		c.Next()
	}
}
