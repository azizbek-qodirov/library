import { useState } from 'react';

import AuthorsSection from './Authors';
import BooksSection from './Books';
import BorrowingsSection from './Borrowing';
import CategoriesSection from './Categories';
import PublishersSection from './Publishers';
import RecommendedSection from './Recommended';
import UsersSection from './UsersSection';

// Main Dashboard Component
const LibrarianDashboard = () => {
  const [activeSection, setActiveSection] = useState('users');
  const [savedSectionData, setSavedSectionData] = useState<Record<string, any>>({});

  const menuItems = [
    { id: 'users', label: 'Users', icon: '👥', description: 'Manage students & teachers' },
    { id: 'categories', label: 'Categories', icon: '📂', description: 'Book categories' },
    { id: 'authors', label: 'Authors', icon: '✍️', description: 'Author information' },
    { id: 'publishers', label: 'Publishers', icon: '🏢', description: 'Publishing houses' },
    { id: 'books', label: 'Books', icon: '📚', description: 'Library inventory' },
    { id: 'borrowings', label: 'Borrowings', icon: '📋', description: 'Loan management' },
    { id: 'recommended', label: 'Recommended', icon: '⭐', description: 'Featured books' }
  ];

  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSectionDataChange = (sectionId: string, data: any) => {
    setSavedSectionData(prev => ({
      ...prev,
      [sectionId]: data
    }));
  };

  const renderActiveSection = () => {
    const sectionProps = {
      savedData: savedSectionData[activeSection],
      onDataChange: (data: any) => handleSectionDataChange(activeSection, data)
    };

    switch (activeSection) {
      case 'users':
        return <UsersSection {...sectionProps} />;
      case 'categories':
        return <CategoriesSection {...sectionProps} />;
      case 'authors':
        return <AuthorsSection {...sectionProps} />;
      case 'publishers':
        return <PublishersSection {...sectionProps} />;
      case 'books':
        return <BooksSection {...sectionProps} />;
      case 'borrowings':
        return <BorrowingsSection {...sectionProps} />;
      case 'recommended':
        return <RecommendedSection {...sectionProps} />;
      default:
        return <ComingSoonPlaceholder section={menuItems.find(i => i.id === activeSection)!} />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <div className="container-fluid p-0">
        <div className="row g-0">
          {/* Sidebar */}
          <div className="col-md-3 col-lg-2 position-fixed" style={{ 
            backgroundColor: '#212529', 
            minHeight: '100vh', 
            boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
            zIndex: 1000 
          }}>
            {/* Header */}
            <div className="p-3 text-white border-bottom border-secondary">
              <div className="d-flex align-items-center gap-2">
                <div style={{ fontSize: '1.5rem' }}>📚</div>
                <div>
                  <h6 className="mb-0 fw-bold">Library Admin</h6>
                  <small className="text-muted" style={{ fontSize: '0.75rem' }}>Management Dashboard</small>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="nav flex-column p-3" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 150px)' }}>
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
            <div className="position-absolute bottom-0 w-100 p-3 text-center border-top border-secondary">
              <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                University Library System v1.0
              </small>
            </div>
          </div>

          {/* Main Content */}
          <div className="col-md-9 col-lg-10 ms-auto">
            <div className="p-4">
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

// Placeholder component for sections
const ComingSoonPlaceholder = ({ section }: { section: { icon: string; label: string; description: string } }) => {
  return (
    <div className="text-center p-5">
      <div className="mb-4" style={{ fontSize: '4rem', opacity: 0.5 }}>
        {section.icon}
      </div>
      <h4 className="text-muted mb-2">{section.label} Section</h4>
      <p className="text-muted">{section.description}</p>
      <div className="alert alert-info d-inline-block mt-3">
        <small>
          <strong>Note:</strong> Import the actual section components to enable this feature
        </small>
      </div>
    </div>
  );
};

export default LibrarianDashboard;