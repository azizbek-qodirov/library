import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Book } from "./types";

interface RecommendedResponse {
  recommendeds: Array<{ book_id: Book }>;
  total_count: number;
}

function Main() {
  const navigate = useNavigate();
  const [recommendedBooks, setRecommendedBooks] = useState<Book[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchRecommendedBooks = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(`${import.meta.env.VITE_API_URL}/recommended?limit=8`, {
          signal: abortController.signal
        });
        if (res.ok) {
          const data: RecommendedResponse = await res.json();
          setRecommendedBooks(data.recommendeds?.map(r => r.book_id) || []);
        } else {
          setError("Tavsiya etilgan kitoblarni yuklashda xatolik");
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return; // Ignore abort errors
        console.error("Failed to fetch recommended books:", err);
        setError("Tarmoq xatosi: Serverga ulanib bo'lmadi");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendedBooks();

    return () => {
      abortController.abort();
    };
  }, []);

  const nextSlide = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlide((prev) => (prev + 1) % recommendedBooks.length);
    const timeout = setTimeout(() => setIsTransitioning(false), 400);
    return () => clearTimeout(timeout);
  }, [isTransitioning, recommendedBooks.length]);

  const prevSlide = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlide((prev) => (prev - 1 + recommendedBooks.length) % recommendedBooks.length);
    const timeout = setTimeout(() => setIsTransitioning(false), 400);
    return () => clearTimeout(timeout);
  }, [isTransitioning, recommendedBooks.length]);

  useEffect(() => {
    if (isPaused || recommendedBooks.length === 0 || isTransitioning) return;

    const interval = setInterval(() => {
      nextSlide();
    }, 3000);

    return () => clearInterval(interval);
  }, [isPaused, recommendedBooks.length, isTransitioning, nextSlide]);

  const goToSlide = (index: number) => {
    if (isTransitioning || index === currentSlide) return;
    setIsTransitioning(true);
    setCurrentSlide(index);
    setTimeout(() => setIsTransitioning(false), 400);
  };

  return (
    <div className="main-page min-vh-100 d-flex align-items-center">
      <div className="container-fluid">
        <div className="row align-items-center min-vh-100">
          {/* Left Content */}
          <div className="col-lg-6 col-md-12">
            <div className="px-4 px-lg-5">
              <h1 className="display-3 fw-bold text-white mb-4">
                <span className="text-gradient">Oxus Universiteti</span> kutubxonasiga xush kelibsiz!
              </h1>
              <p className="lead text-light opacity-75 mb-5">
                Har bir buyuk fikr birinchi sahifadan boshlanadi — endi o'z sahifangizni tez va oson biz bilan toping!
              </p>
              <button
                className="btn-explore"
                onClick={() => navigate("/categories")}
              >
                <span className="btn-text">Kitoblarni kashf eting</span>
                <span className="btn-arrow">→</span>
                <div className="btn-bg"></div>
              </button>
            </div>
          </div>

          {/* Right Carousel - Desktop Only */}
          <div className="col-lg-6 d-none d-lg-block">
            {isLoading && (
              <div className="text-center text-white p-5">
                <div className="spinner-border" role="status">
                  <span className="visually-hidden">Yuklanmoqda...</span>
                </div>
                <p className="mt-3">Tavsiya etilgan kitoblar yuklanmoqda...</p>
              </div>
            )}
            {error && (
              <div className="alert alert-warning text-center" role="alert">
                {error}
              </div>
            )}
            {!isLoading && !error && recommendedBooks.length > 0 && (
              <div 
                className="carousel-3d"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
              >
                {/* Navigation Buttons */}
                <div className="carousel-navigation">
                  <button 
                    className="carousel-nav nav-prev"
                    onClick={prevSlide}
                    disabled={isTransitioning}
                  >
                    <span>‹</span>
                  </button>
                  <button 
                    className="carousel-nav nav-next"
                    onClick={nextSlide}
                    disabled={isTransitioning}
                  >
                    <span>›</span>
                  </button>
                </div>

                {/* 3D Carousel Container */}
                <div className="carousel-container">
                  <div className="carousel-stage">
                    {recommendedBooks.map((book, index) => {
                      const position = (index - currentSlide + recommendedBooks.length) % recommendedBooks.length;
                      
                      let className = "carousel-book";
                      let style = {};
                      
                      switch (position) {
                        case 0: // Center - Active
                          className += " center-book active";
                          style = {
                            transform: "translateX(-50%) translateZ(0) scale(1)",
                            left: "50%",
                            opacity: 1,
                            zIndex: 10
                          };
                          break;
                        case 1: // Right
                          className += " right-book";
                          style = {
                            transform: "translateX(-50%) translateZ(-200px) rotateY(-35deg) scale(0.8)",
                            left: "70%",
                            opacity: 0.8,
                            zIndex: 5
                          };
                          break;
                        case recommendedBooks.length - 1: // Left
                          className += " left-book";
                          style = {
                            transform: "translateX(-50%) translateZ(-200px) rotateY(35deg) scale(0.8)",
                            left: "30%",
                            opacity: 0.8,
                            zIndex: 5
                          };
                          break;
                        case 2: // Far right
                          className += " far-right";
                          style = {
                            transform: "translateX(-50%) translateZ(-400px) rotateY(-50deg) scale(0.6)",
                            left: "85%",
                            opacity: 0.4,
                            zIndex: 2
                          };
                          break;
                        case recommendedBooks.length - 2: // Far left
                          className += " far-left";
                          style = {
                            transform: "translateX(-50%) translateZ(-400px) rotateY(50deg) scale(0.6)",
                            left: "15%",
                            opacity: 0.4,
                            zIndex: 2
                          };
                          break;
                        default: // Hidden
                          className += " hidden-book";
                          style = {
                            transform: "translateX(-50%) translateZ(-600px) scale(0.4)",
                            left: "50%",
                            opacity: 0,
                            zIndex: 0
                          };
                      }

                      return (
                        <div
                          key={book.id}
                          className={className}
                          style={style}
                          onClick={() => position !== 0 && goToSlide(index)}
                        >
                          <div className="book-card-3d">
                            <div className="liquid-bg"></div>
                            <div className="book-cover">
                              {book.cover_image_id?.url ? (
                                <img
                                  src={book.cover_image_id.url}
                                  alt={book.title}
                                  className="book-image"
                                />
                              ) : (
                                <div className="book-placeholder">
                                  <div className="placeholder-icon">📚</div>
                                  <div className="placeholder-text">No Cover</div>
                                </div>
                              )}
                              <div className="book-shine"></div>
                            </div>
                            <div className="book-info">
                              <h6 className="book-title">{book.title}</h6>
                              {book.author_ids && book.author_ids.length > 0 && (
                                <p className="book-author">{book.author_ids[0].name}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Main;