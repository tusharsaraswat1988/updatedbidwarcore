import { Link } from 'wouter';
import { Moon, Sun, Search } from 'lucide-react';

export const Header = ({ toggleTheme, theme }: { toggleTheme: () => void, theme: 'dark' | 'light' }) => (
  <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 flex justify-between items-center shadow-md">
    <div className="text-2xl font-bold tracking-tighter text-yellow-600 dark:text-yellow-500">BID<span className="text-slate-900 dark:text-white">WAR</span></div>
    <nav className="flex items-center gap-6">
      <Link href="/" className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition">Home</Link>
      <button className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"><Search size={20}/></button>
      <button onClick={toggleTheme} className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition">
        {theme === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}
      </button>
    </nav>
  </header>
);
