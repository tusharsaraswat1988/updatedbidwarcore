import React from 'react';
import { Link } from 'wouter';
import { Moon, Sun, Search } from 'lucide-react';
import { useBranding } from '../hooks/use-branding';
import { BrandLogoImage } from './brand-logo-image';

export const Header = ({
  toggleTheme,
  theme,
}: {
  toggleTheme: () => void;
  theme: 'dark' | 'light';
}) => {
  const { logos, brandName } = useBranding();

  // High contrast brand logo: dark text for light theme, white text for dark theme
  const brandSrc =
    theme === 'light'
      ? logos.main || logos.mainReverse
      : logos.mainReverse || logos.main;

  const scrollToSearch = () => {
    const el = document.getElementById('hero-search-input') || document.getElementById('search-section') || document.getElementById('discover-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      if ('focus' in el) (el as HTMLElement).focus();
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 dark:bg-[#070C18]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-white/[0.08] py-2 sm:py-2.5 shadow-xs transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex justify-between items-center">
        <Link
          href="/"
          className="flex items-center gap-2 hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-amber-400 rounded-lg"
          aria-label={`${brandName || 'BidWar'} Home`}
        >
          <BrandLogoImage
            theme={theme}
            src={brandSrc}
            alt={brandName || 'BidWar'}
            className="h-7 sm:h-8 w-auto object-contain"
          />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/"
            className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 transition px-2 py-1"
          >
            Home
          </Link>
          <button
            type="button"
            onClick={scrollToSearch}
            className="text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 transition p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Search tournaments"
          >
            <Search size={18} />
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 transition p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </nav>
      </div>
    </header>
  );
};
