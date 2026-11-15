package api

import (
	"strings"

	"github.com/gin-gonic/gin"

	// _ "library-gateway/internal/http/docs"
	"library-gateway/internal/http/handlers"
	"library-gateway/internal/pkg/config"

	l "github.com/azizbek-qodirov/logger"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

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

	// Users
	router.POST("/user", h.CreateUser)
	router.GET("/user/:id", h.GetUserByID)
	router.PUT("/user/:id", h.UpdateUser)
	router.DELETE("/user/:id", h.DeleteUser)
	router.GET("/users", h.GetAllUsers)

	// Categories
	router.POST("/category", h.CreateCategory)
	router.GET("/category/:id", h.GetCategoryByID)
	router.PUT("/category/:id", h.UpdateCategory)
	router.DELETE("/category/:id", h.DeleteCategory)
	router.GET("/categories", h.GetAllCategories)

	// Publishers
	router.POST("/publisher", h.CreatePublisher)
	router.GET("/publisher/:id", h.GetPublisherByID)
	router.PUT("/publisher/:id", h.UpdatePublisher)
	router.DELETE("/publisher/:id", h.DeletePublisher)
	router.GET("/publishers", h.GetAllPublishers)

	// Authors
	router.POST("/author", h.CreateAuthor)
	router.GET("/author/:id", h.GetAuthorByID)
	router.PUT("/author/:id", h.UpdateAuthor)
	router.DELETE("/author/:id", h.DeleteAuthor)
	router.GET("/authors", h.GetAllAuthors)

	// Books
	router.POST("/book", h.CreateBook)
	router.GET("/book/:id", h.GetBookByID)
	router.PUT("/book/:id", h.UpdateBook)
	router.DELETE("/book/:id", h.DeleteBook)
	router.GET("/books", h.GetAllBooks)

	// Borrowings
	router.POST("/borrowing", h.CreateBorrowing)
	router.GET("/borrowing/:id", h.GetBorrowing)
	router.PUT("/borrowing/:id", h.UpdateBorrowing)
	router.DELETE("/borrowing/:id", h.DeleteBorrowing)
	router.GET("/borrowings", h.GetAllBorrowings)

	// Recommended
	router.GET("/recommended", h.GetRecommendedBooks)
	router.GET("/recommended/:id", h.GetRecommendedBook)
	router.POST("/recommended", h.CreateRecommendedBook)
	router.DELETE("/recommended/:id", h.DeleteRecommendedBook)

	// Files
	router.POST("/file", h.CreateFile)
	router.GET("/file/:id", h.GetFile)
	router.DELETE("/file/:id", h.DeleteFile)
	router.GET("/files", h.GetAllFiles)
	return router
}
