import { useState } from 'react';
import type { ComponentProps } from 'react';

import AuthorsSection from './Authors';
import BooksSection from './Books';
import BorrowingsSection from './Borrowing';
import CategoriesSection from './Categories';
import PublishersSection from './Publishers';
import RecommendedSection from './Recommended';
import UsersSection from './UsersSection';

type SectionData = {
  users: ComponentProps<typeof UsersSection>['savedData'];
  categories: ComponentProps<typeof CategoriesSection>['savedData'];
  authors: ComponentProps<typeof AuthorsSection>['savedData'];
  publishers: ComponentProps<typeof PublishersSection>['savedData'];
  books: ComponentProps<typeof BooksSection>['savedData'];
  borrowings: ComponentProps<typeof BorrowingsSection>['savedData'];
  recommended: ComponentProps<typeof RecommendedSection>['savedData'];
};

const LibrarianDashboard = ({ onSignOut }: { onSignOut: () => void }) => {
  const [activeSection, setActiveSection] = useState<keyof SectionData>('users');
  const [savedSectionData, setSavedSectionData] = useState<Partial<SectionData>>({});

  const menuItems: { id: keyof SectionData; label: string; icon: string; description: string }[] = [
    { id: 'users', label: 'Users', icon: '👥', description: 'Manage students & teachers' },
    { id: 'categories', label: 'Categories', icon: '📂', description: 'Book categories' },
    { id: 'authors', label: 'Authors', icon: '✍️', description: 'Author information' },
    { id: 'publishers', label: 'Publishers', icon: '🏢', description: 'Publishing houses' },
    { id: 'books', label: 'Books', icon: '📚', description: 'Library inventory' },
    { id: 'borrowings', label: 'Borrowings', icon: '📋', description: 'Loan management' },
    { id: 'recommended', label: 'Recommended', icon: '⭐', description: 'Featured books' }
  ];

  const handleSectionChange = (sectionId: keyof SectionData) => {
    setActiveSection(sectionId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSectionDataChange = <K extends keyof SectionData>(sectionId: K, data: SectionData[K]) => {
    setSavedSectionData(prev => ({
      ...prev,
      [sectionId]: data
    }));
  };

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'users':
        return <UsersSection savedData={savedSectionData.users} onDataChange={data => handleSectionDataChange('users', data)} />;
      case 'categories':
        return <CategoriesSection savedData={savedSectionData.categories ?? null} onDataChange={data => handleSectionDataChange('categories', data)} />;
      case 'authors':
        return <AuthorsSection savedData={savedSectionData.authors ?? null} onDataChange={data => handleSectionDataChange('authors', data)} />;
      case 'publishers':
        return <PublishersSection savedData={savedSectionData.publishers} onDataChange={data => handleSectionDataChange('publishers', data)} />;
      case 'books':
        return <BooksSection savedData={savedSectionData.books} onDataChange={data => handleSectionDataChange('books', data ?? undefined)} />;
      case 'borrowings':
        return <BorrowingsSection savedData={savedSectionData.borrowings ?? null} onDataChange={data => handleSectionDataChange('borrowings', data)} />;
      case 'recommended':
        return <RecommendedSection savedData={savedSectionData.recommended ?? null} onDataChange={data => handleSectionDataChange('recommended', data)} />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <div className="container-fluid p-0">
        <div className="row g-0">
          {/* Sidebar */}
          <div className="col-md-3 col-lg-2 library-sidebar">
            {/* Header */}
            <div className="p-3 text-white border-bottom border-secondary">
              <div className="d-flex align-items-center gap-2">
                <div style={{ fontSize: '1.5rem' }}>📚</div>
                <div>
                  <h6 className="mb-0 fw-bold">Library Admin</h6>
                  <button className="btn btn-link btn-sm text-white p-0" onClick={onSignOut}>Sign out</button>
                  <small className="text-muted" style={{ fontSize: '0.75rem' }}>Management Dashboard</small>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="nav library-sidebar-nav p-3">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  className={`nav-link text-start border-0 rounded mb-2 position-relative ${
                    activeSection === item.id 
                      ? 'bg-primary text-white shadow-sm' 
                      : 'text-light bg-transparent'
                  }`}
                  onClick={() => handleSectionChange(item.id)}
                  style={{ 
                    transition: 'all 0.3s ease',
                    padding: '0.75rem 1rem',
                    fontSize: '0.9rem',
                    fontWeight: activeSection === item.id ? '600' : '400'
                  }}
                  onMouseEnter={(e) => {
                    if (activeSection !== item.id) {
                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                      e.currentTarget.style.transform = 'translateX(5px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeSection !== item.id) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }
                  }}
                  aria-current={activeSection === item.id ? "page" : undefined}
                  title={item.description}
                >
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {savedSectionData[item.id] && (
                    <div className="position-absolute" style={{ top: '8px', right: '8px' }}>
                      <span 
                        className="badge rounded-pill" 
                        style={{ 
                          backgroundColor: '#ffc107',
                          fontSize: '0.6rem',
                          padding: '3px 6px'
                        }}
                        title="Unsaved changes"
                      >
                        ●
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </nav>

            {/* Footer */}
            <div className="library-sidebar-footer w-100 p-3 text-center border-top border-secondary">
              <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                University Library System v1.0
              </small>
            </div>
          </div>

          {/* Main Content */}
          <div className="col-md-9 col-lg-10 ms-auto">
            <div className="p-3 p-md-4">
              {/* Breadcrumb */}
              <nav aria-label="breadcrumb" className="mb-3">
                <ol className="breadcrumb">
                  <li className="breadcrumb-item">
                    <a href="#" className="text-decoration-none" onClick={(e) => {
                      e.preventDefault();
                      setActiveSection('users');
                    }}>
                      Dashboard
                    </a>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    {menuItems.find(i => i.id === activeSection)?.label}
                  </li>
                </ol>
              </nav>

              {/* Content Area */}
              <div className="content-wrapper">
                {renderActiveSection()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LibrarianDashboard;
