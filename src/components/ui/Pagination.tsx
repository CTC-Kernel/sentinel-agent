
import React from 'react';
import { ChevronRight, ChevronDown } from './Icons';
import { Button } from './button';
import { useTranslation } from 'react-i18next';

interface PaginationProps {
 currentPage: number;
 totalItems: number;
 itemsPerPage: number;
 onPageChange: (page: number) => void;
 onItemsPerPageChange?: (itemsPerPage: number) => void;
 itemsPerPageOptions?: number[];
 showItemsPerPage?: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
 currentPage,
 totalItems,
 itemsPerPage,
 onPageChange,
 onItemsPerPageChange,
 itemsPerPageOptions = [20, 50, 100],
 showItemsPerPage = true
}) => {
 const { t } = useTranslation();
 const totalPages = Math.ceil(totalItems / itemsPerPage);

 const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
 const endItem = Math.min(currentPage * itemsPerPage, totalItems);

 const getPageNumbers = () => {
 const pages: (number | string)[] = [];
 const maxVisible = 5;

 if (totalPages <= maxVisible) {
 for (let i = 1; i <= totalPages; i++) {
 pages.push(i);
 }
 } else {
 pages.push(1);

 if (currentPage > 3) {
 pages.push('...');
 }

 const start = Math.max(2, currentPage - 1);
 const end = Math.min(totalPages - 1, currentPage + 1);

 for (let i = start; i <= end; i++) {
 pages.push(i);
 }

 if (currentPage < totalPages - 2) {
 pages.push('...');
 }

 pages.push(totalPages);
 }

 return pages;
 };

 if (totalItems === 0) {
 return null;
 }

 return (
 <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 glass-premium rounded-2xl border border-border/40 dark:border-white/5">
 <div className="flex items-center gap-4">
 <p className="text-sm text-muted-foreground font-medium">
  {startItem} {t('common.pagination.to', { defaultValue: 'à' })} {endItem} {t('common.pagination.of', { defaultValue: 'sur' })} {totalItems}
 </p>

 {showItemsPerPage && onItemsPerPageChange && (
  <div className="flex items-center gap-2">
  <label
  htmlFor="items-per-page"
  className="text-sm text-muted-foreground font-medium"
  >
  {t('common.pagination.show', { defaultValue: 'Afficher :' })}
  </label>
  <div className="relative">
  <select
  id="items-per-page"
  value={itemsPerPage}
  onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
  className="appearance-none bg-muted/50 border border-border/40 rounded-3xl px-4 py-2.5 pr-10 min-h-[44px] text-sm font-medium text-foreground focus:ring-2 focus-visible:ring-primary outline-none cursor-pointer"
  aria-label="Nombre d'éléments par page"
  >
  {itemsPerPageOptions.map(option => (
   <option key={option || 'unknown'} value={option}>{option}</option>
  ))}
  </select>
  <ChevronDown
  className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
  aria-hidden="true"
  />
  </div>
  </div>
 )}
 </div>

 {/* Navigation - WCAG AAA: minimum 44x44px touch targets */}
 <nav className="flex items-center gap-1.5" aria-label="Pagination">
 <Button
  onClick={() => onPageChange(currentPage - 1)}
  disabled={currentPage === 1}
  size="icon"
  variant="ghost"
  className="min-w-[44px] min-h-[44px] rounded-3xl disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
  aria-label="Page précédente"
  aria-disabled={currentPage === 1}
 >
  <ChevronRight className="h-5 w-5 rotate-180 text-muted-foreground" aria-hidden="true" />
 </Button>

 <div className="flex items-center gap-1" role="list">
  {getPageNumbers().map((page, index) => {
  if (page === '...') {
  return (
  <span
   key={`ellipsis-${index || 'unknown'}`}
   className="px-3 py-2 text-muted-foreground font-medium select-none"
   aria-hidden="true"
  >
   ...
  </span>
  );
  }

  const pageNum = page as number;
  const isActive = pageNum === currentPage;

  return (
  <Button
  key={pageNum || 'unknown'}
  onClick={() => onPageChange(pageNum)}
  variant={isActive ? 'default' : 'ghost'}
  className={`min-w-[44px] min-h-[44px] px-4 py-2 rounded-3xl text-sm font-bold transition-all ${isActive
   ? 'bg-foreground text-background shadow-lg'
   : 'text-muted-foreground hover:bg-muted'
   }`}
  aria-label={`Page ${pageNum}`}
  aria-current={isActive ? 'page' : undefined}
  >
  {pageNum}
  </Button>
  );
  })}
 </div>

 <Button
  onClick={() => onPageChange(currentPage + 1)}
  disabled={currentPage === totalPages}
  size="icon"
  variant="ghost"
  className="min-w-[44px] min-h-[44px] rounded-3xl disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
  aria-label="Page suivante"
  aria-disabled={currentPage === totalPages}
 >
  <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
 </Button>
 </nav>
 </div>
 );
};

