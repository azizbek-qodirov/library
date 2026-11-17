import { Icon } from '../../../shared/Icon';
import type { IconName } from '../../../shared/Icon';
import { useI18n } from '../../../shared/i18n';
import type { Message } from '../../../shared/i18n';
import { LanguageSelect } from '../../../shared/LanguageSelect';
import { useEffect, useRef, useState } from 'react';
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

  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLElement>(null);

  useEffect(() => {
    if (menuOpen) navigation.current?.querySelector<HTMLButtonElement>('[aria-current="page"]')?.focus();
  }, [menuOpen]);
  const menuItems: { id: keyof SectionData; label: Message; icon: IconName }[] = [
    { id: 'users', label: 'Users', icon: 'users' },
    { id: 'books', label: 'Books', icon: 'book' },
    { id: 'borrowings', label: 'Borrowings', icon: 'loans' },
    { id: 'categories', label: 'Categories', icon: 'folder' },
    { id: 'authors', label: 'Authors', icon: 'pen' },
    { id: 'publishers', label: 'Publishers', icon: 'building' },
    { id: 'recommended', label: 'Recommended', icon: 'star' },
  ];
  const activeItem = menuItems.find(item => item.id === activeSection)!;

  const closeMenu = () => {
    setMenuOpen(false);
    menuButton.current?.focus();
  };

  const handleSectionChange = (sectionId: keyof SectionData) => {
    if (menuOpen) closeMenu();
    setActiveSection(sectionId);
    window.scrollTo({ top: 0 });
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
    <div className="staff-shell" onKeyDown={event => {
      if (event.key === 'Escape' && menuOpen) closeMenu();
    }}>
      <header className="staff-header">
        <button className="staff-icon-button staff-menu-toggle" ref={menuButton} type="button"
          aria-label={t(menuOpen ? 'Close navigation' : 'Open navigation')}
          aria-expanded={menuOpen} aria-controls="staff-navigation" onClick={() => setMenuOpen(open => !open)}>
          <Icon name={menuOpen ? 'close' : 'menu'} />
        </button>
        <div className="staff-brand">
          <span className="staff-brand-icon"><Icon name="library" size={22} /></span>
          <strong>{t('Oxus Library')}</strong>
        </div>
        <div className="staff-header-actions">
          <LanguageSelect />
          <button className="staff-icon-button staff-sign-out" type="button"
            aria-label={t('Sign out')} title={t('Sign out')} onClick={onSignOut}>
            <Icon name="logout" size={18} />
            <span>{t('Sign out')}</span>
          </button>
        </div>
      </header>
      {menuOpen && <div className="staff-menu-backdrop" aria-hidden="true" onClick={closeMenu} />}
      <aside className={`library-sidebar${menuOpen ? ' is-open' : ''}`} id="staff-navigation">
        <nav ref={navigation} className="library-sidebar-nav" aria-label={t('Dashboard navigation')}>
          {menuItems.map(item => (
            <button key={item.id} type="button" className="staff-nav-link"
              onClick={() => handleSectionChange(item.id)}
              aria-current={activeSection === item.id ? 'page' : undefined}>
              <Icon name={item.icon} />
              <span>{t(item.label)}</span>
              {savedSectionData[item.id] && (
                <span className="staff-unsaved" role="img" title={t('Unsaved changes')} aria-label={t('Unsaved changes')} />
              )}
            </button>
          ))}
        </nav>
      </aside>
      <main className="staff-main">
        <div className="staff-location">
          <span>{t('Staff dashboard')}</span>
          <span aria-hidden="true">/</span>
          <strong>{t(activeItem.label)}</strong>
        </div>
        <div className="content-wrapper">
          {renderActiveSection()}
        </div>
      </main>
    </div>
  );
};

export default LibrarianDashboard;
