import React, { useState } from 'react';
import { LibraryProvider, useLibrary } from './context/LibraryContext';
import { Navbar, SidebarNavbar, NavTab } from './components/Navbar';
import { ScanFeedbackBanner } from './components/ScanFeedbackBanner';
import { DashboardPrestiti } from './components/dashboard/DashboardPrestiti';
import { CatalogView } from './components/catalog/CatalogView';
import { StudentsView } from './components/students/StudentsView';
import { AiSearchAssistant } from './components/ai/AiSearchAssistant';
import { SettingsAndData } from './components/settings/SettingsAndData';
import { NewLoanModal } from './components/dashboard/NewLoanModal';
import { BookDetailModal } from './components/catalog/BookDetailModal';
import { AddBookModal } from './components/catalog/AddBookModal';
import { getContentWidthClass, getDensityPaddingClass } from './utils/layoutPresets';
import { AuthScreen } from './components/auth/AuthScreen';
import { SchoolSwitcherModal } from './components/auth/SchoolSwitcherModal';
import { Book } from './types';

function MainAppContent() {
  const { settings, currentUser, currentSchool } = useLibrary();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');

  const [isSchoolSwitcherOpen, setIsSchoolSwitcherOpen] = useState(false);

  // If user is not authenticated or no school selected, show multi-tenant login/registration screen
  if (!currentUser || !currentSchool) {
    return (
      <>
        <ScanFeedbackBanner />
        <AuthScreen />
      </>
    );
  }

  const isSidebar = settings.navPosition === 'sidebar';
  const widthClass = getContentWidthClass(settings.contentWidth);
  const densityClass = getDensityPaddingClass(settings.contentDensity);
  const isLargeFont = settings.fontSize === 'large';

  // Shared modals accessible from any view
  const [loanModalBook, setLoanModalBook] = useState<Book | null>(null);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [detailModalBook, setDetailModalBook] = useState<Book | null>(null);
  const [isAddBookModalOpen, setIsAddBookModalOpen] = useState(false);

  const handleOpenLoanForBook = (book: Book) => {
    setLoanModalBook(book);
    setIsLoanModalOpen(true);
  };

  const handleOpenBookDetail = (book: Book) => {
    setDetailModalBook(book);
  };

  return (
    <div
      className={`min-h-screen bg-slate-50 flex ${
        isSidebar ? 'flex-col md:flex-row' : 'flex-col'
      } font-sans text-slate-800 ${isLargeFont ? 'text-[1.05rem]' : ''}`}
    >
      {/* Visual Feedback Toast for Barcode Scans */}
      <ScanFeedbackBanner />

      {/* Main App Navigation Bar (Top Bar or Vertical Sidebar) */}
      {isSidebar ? (
        <SidebarNavbar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onOpenAddBookModal={() => setIsAddBookModalOpen(true)}
          onOpenSchoolSwitcher={() => setIsSchoolSwitcherOpen(true)}
        />
      ) : (
        <Navbar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onOpenAddBookModal={() => setIsAddBookModalOpen(true)}
          onOpenSchoolSwitcher={() => setIsSchoolSwitcherOpen(true)}
        />
      )}

      {/* Content Area Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Main Tab Content */}
        <main className={`flex-1 w-full mx-auto ${widthClass} ${densityClass}`}>
          {currentTab === 'dashboard' && (
            <DashboardPrestiti
              onOpenCatalog={() => setCurrentTab('catalogo')}
              onOpenAiSearch={() => setCurrentTab('ai')}
              onOpenAddBookModal={() => setIsAddBookModalOpen(true)}
            />
          )}

          {currentTab === 'catalogo' && (
            <CatalogView
              onLoanBook={handleOpenLoanForBook}
              onOpenAddModal={() => setIsAddBookModalOpen(true)}
              isAddModalOpen={isAddBookModalOpen}
              onCloseAddModal={() => setIsAddBookModalOpen(false)}
            />
          )}

          {currentTab === 'alunni' && <StudentsView />}

          {currentTab === 'ai' && (
            <AiSearchAssistant
              onLoanBook={handleOpenLoanForBook}
              onViewBookDetail={handleOpenBookDetail}
            />
          )}

          {currentTab === 'impostazioni' && <SettingsAndData />}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
          <div className={`${widthClass} mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500`}>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">BiblioScuola</span>
              <span>• Gestionale Biblioteca Scolastica</span>
              <span className="hidden md:inline">• Supporto Lettori Barcode USB</span>
            </div>
            <div className="text-slate-400">
              Dati memorizzati localmente con persistenza • Pronto per LIM e tablet
            </div>
          </div>
        </footer>
      </div>

      {/* Cross-view Add Book Modal */}
      {isAddBookModalOpen && (
        <AddBookModal
          isOpen={isAddBookModalOpen}
          onClose={() => setIsAddBookModalOpen(false)}
          onBookAdded={(newBook) => {
            setDetailModalBook(newBook);
          }}
        />
      )}

      {/* Cross-view New Loan Modal */}
      {isLoanModalOpen && (
        <NewLoanModal
          isOpen={isLoanModalOpen}
          onClose={() => {
            setIsLoanModalOpen(false);
            setLoanModalBook(null);
          }}
          preselectedBook={loanModalBook}
        />
      )}

      {/* Cross-view Book Detail Modal */}
      {detailModalBook && (
        <BookDetailModal
          book={detailModalBook}
          isOpen={!!detailModalBook}
          onClose={() => setDetailModalBook(null)}
          onLoanBook={handleOpenLoanForBook}
        />
      )}

      {/* Multi-Tenant School Switcher Modal */}
      <SchoolSwitcherModal
        isOpen={isSchoolSwitcherOpen}
        onClose={() => setIsSchoolSwitcherOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <LibraryProvider>
      <MainAppContent />
    </LibraryProvider>
  );
}
