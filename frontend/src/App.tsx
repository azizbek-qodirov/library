import { useEffect } from 'react';
import { useI18n } from '../../shared/i18n';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";
import Categories from "./components/Categories";
import Main from "./components/Main";
import Navigation from "./components/Navigation";
import ErrorBoundary from "./components/ErrorBoundary";

function App() {
  const { t } = useI18n();
  useEffect(() => {
    document.title = t('Catalog page title');
  }, [t]);
  return (
    <ErrorBoundary t={t}>
      <BrowserRouter>
        <div className="app">
          <Navigation />
          <main className="page-content">
            <ErrorBoundary t={t}>
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