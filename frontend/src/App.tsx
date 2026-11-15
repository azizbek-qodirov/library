import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";
import Categories from "./components/Categories";
import Main from "./components/Main";
import Navigation from "./components/Navigation";
import ErrorBoundary from "./components/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="app">
          <Navigation />
          <main className="page-content">
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Main />} />
                <Route path="/categories" element={<Categories />} />
              </Routes>
            </ErrorBoundary>
          </main>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;