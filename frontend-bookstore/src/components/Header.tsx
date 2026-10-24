import React, { useState, useEffect } from 'react';
import { ShoppingCart, Search, User, Menu, X, BookOpen, LogOut, Globe } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { useCart } from '../context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { API_BASE_URL } from '../config/api';

const API = `${API_BASE_URL}`;

interface Category {
  category_id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  level: number;
  sort_order: number;
}

interface SearchSuggestion {
  book_id: string;
  title: string;
  author?: string;
  price?: string | number;
}

export function Header() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);
  const [targetLang, setTargetLang] = useState('');
  const navigate = useNavigate();

  const { token, setToken, cartCount } = useCart();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    fetch(`${API}/categories`)
      .then(res => res.json())
      .then(data => {
        const cats = Array.isArray(data) ? data : [];
        setCategories(cats);
      })
      .catch(err => console.error('Lỗi tải danh mục:', err));
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setIsSuggesting(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsSuggesting(true);
      try {
        const res = await fetch(`${API}/search/suggest?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setSuggestions([]);
          return;
        }
        const json = await res.json();
        setSuggestions(Array.isArray(json.data) ? json.data : []);
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Loi goi y tim kiem:', error);
        }
      } finally {
        setIsSuggesting(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [searchQuery]);

  const hiddenNavSlugs = ['sach-ngoai-van', 'dam-my'];
  const excludedIds = new Set<string>();
  categories
    .filter(c => hiddenNavSlugs.includes(c.slug))
    .forEach(c => excludedIds.add(c.category_id));
  if (excludedIds.size > 0) {
    let changed = true;
    while (changed) {
      changed = false;
      categories.forEach(c => {
        if (c.parent_id && excludedIds.has(c.parent_id) && !excludedIds.has(c.category_id)) {
          excludedIds.add(c.category_id);
          changed = true;
        }
      });
    }
  }
  const visibleCategories = categories.filter(c => !excludedIds.has(c.category_id));
  const level2Categories = visibleCategories.filter(c => c.level === 2);
  const topLevelCategories = level2Categories.length > 0 ? level2Categories : visibleCategories.filter(c => c.level === 1);

  const categoryLabel = (cat: Category) => {
    const key = `categories.${cat.slug}`;
    return i18n.exists(key) ? t(key) : cat.name;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
      setSearchQuery('');
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    navigate(`/book/${suggestion.book_id}`);
    setIsSearchOpen(false);
    setSearchQuery('');
    setSuggestions([]);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    navigate('/');
  };

  const handleLanguageChange = (lang: string) => {
    if (i18n.language === lang) return;
    setTargetLang(lang);
    setIsChangingLanguage(true);
    setTimeout(() => {
      i18n.changeLanguage(lang);
      setIsChangingLanguage(false);
    }, 1200);
  };

  const formatPrice = (price?: string | number) => {
    const numPrice = Number(price || 0);
    if (i18n.language === 'en') {
      const usdPrice = numPrice / 25000;
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(usdPrice);
    }
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(numPrice);
  };

  const renderSuggestions = () => {
    const query = searchQuery.trim();
    if (query.length < 2 || (!isSuggesting && suggestions.length === 0)) return null;

    return (
      <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-xl shadow-xl overflow-hidden z-50">
        {isSuggesting && suggestions.length === 0 ? (
          <div className="px-4 py-3 text-sm text-slate-500 dark:text-dark-text-muted">{t('header.searching')}</div>
        ) : (
          suggestions.map((suggestion) => (
            <button
              key={suggestion.book_id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full text-left px-4 py-3 hover:bg-indigo-50 dark:hover:bg-dark-surface-hover transition-colors border-b border-slate-100 dark:border-dark-border last:border-0"
            >
              <span className="block text-sm font-semibold text-slate-900 dark:text-dark-text line-clamp-1">{suggestion.title}</span>
              <span className="mt-0.5 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-dark-text-muted">
                <span className="line-clamp-1">{suggestion.author || t('header.anonymous')}</span>
                <span className="font-bold text-indigo-600 whitespace-nowrap">{formatPrice(suggestion.price)}</span>
              </span>
            </button>
          ))
        )}
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-indigo-100 dark:border-dark-border bg-white/95 dark:bg-dark-bg/95 backdrop-blur-md shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between gap-4 md:gap-8">
        <button
          className="md:hidden p-2 text-indigo-900 -ml-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        <Link to="/" className="flex items-center gap-2 text-indigo-950 dark:text-white shrink-0">
          <BookOpen className="w-8 h-8 text-indigo-600" />
          <span className="text-xl md:text-2xl font-bold font-serif tracking-tight">
            Modern Book
          </span>
        </Link>

        <div className="hidden md:block flex-1 max-w-2xl">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder={t('header.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-5 py-2.5 bg-slate-100 dark:bg-dark-surface border border-slate-200 dark:border-dark-border hover:border-slate-300 dark:hover:border-slate-600 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white dark:focus:bg-dark-surface-hover transition-all font-sans text-sm text-slate-700 dark:text-dark-text placeholder:text-slate-500 dark:placeholder:text-dark-text-muted"
            />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-indigo-600 transition-colors rounded-full">
              <Search className="w-4 h-4" />
            </button>
            {renderSuggestions()}
          </form>
        </div>

        <div className="flex items-center gap-3 sm:gap-6 shrink-0">
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="md:hidden p-2 text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>

          <Link to="/cart" className="p-2 text-slate-600 dark:text-dark-text-muted hover:text-indigo-600 dark:hover:text-dark-accent transition-colors relative flex items-center">
            <ShoppingCart className="w-6 h-6 stroke-[1.5]" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                {cartCount}
              </span>
            )}
          </Link>

          {token ? (
            <div className="hidden sm:flex items-center gap-4">
              <Link to="/account" className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-dark-text hover:text-indigo-600 dark:hover:text-dark-accent transition-colors">
                <User className="w-5 h-5 text-indigo-600 dark:text-dark-accent" /> {t('header.account')}
              </Link>
              <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-700 font-medium">
                {t('header.logout')}
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden sm:flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-dark-text hover:text-indigo-600 dark:hover:text-dark-accent transition-colors"
            >
              {t('header.login')}
            </Link>
          )}

          {/* Dark Mode Toggle */}
          <div className="hidden sm:flex items-center">
            <ThemeToggle />
          </div>

          {/* Language Selector */}
          <div className="relative group hidden sm:flex items-center">
            <button className="flex items-center gap-1 text-sm font-bold text-slate-700 dark:text-dark-text hover:text-indigo-600 dark:hover:text-dark-accent transition-colors p-2">
              <Globe className="w-5 h-5 text-slate-500 dark:text-dark-text-muted group-hover:text-indigo-600 dark:group-hover:text-dark-accent transition-colors" /> {i18n.language === 'en' ? 'EN' : 'VN'}
            </button>
            <div className="absolute top-full right-0 w-36 bg-white dark:bg-dark-surface rounded-lg shadow-xl border border-slate-100 dark:border-dark-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 origin-top">
              <button onClick={() => handleLanguageChange('vi')} className={`w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-indigo-50 dark:hover:bg-dark-surface-hover transition-colors ${i18n.language === 'vi' ? 'text-indigo-700 dark:text-dark-accent bg-indigo-50/50 dark:bg-dark-surface-hover' : 'text-slate-600 dark:text-dark-text hover:text-indigo-600 dark:hover:text-dark-accent'}`}>{t('header.langVN')}</button>
              <button onClick={() => handleLanguageChange('en')} className={`w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-indigo-50 dark:hover:bg-dark-surface-hover transition-colors ${i18n.language === 'en' ? 'text-indigo-700 dark:text-dark-accent bg-indigo-50/50 dark:bg-dark-surface-hover' : 'text-slate-600 dark:text-dark-text hover:text-indigo-600 dark:hover:text-dark-accent'}`}>{t('header.langEN')}</button>
            </div>
          </div>
        </div>
      </div>

      <nav className="hidden md:flex border-t border-slate-100 dark:border-dark-border bg-white dark:bg-dark-bg">
        <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-center gap-4 lg:gap-8">
          <Link to="/search" className="text-sm font-bold text-indigo-700 hover:text-indigo-800 transition-colors whitespace-nowrap">
            {t('header.allBooks')}
          </Link>
          <div className="h-4 w-px bg-slate-300"></div>
          {topLevelCategories.slice(0, 7).map(cat => (
            <Link
              key={cat.category_id}
              to={`/search?category=${cat.category_id}`}
              className="text-sm font-medium text-slate-600 dark:text-dark-text-muted hover:text-indigo-600 dark:hover:text-dark-accent transition-colors whitespace-nowrap"
            >
              {categoryLabel(cat)}
            </Link>
          ))}
        </div>
      </nav>

      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-indigo-50 dark:border-dark-border bg-white dark:bg-dark-bg overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-4 py-4">
              <form onSubmit={handleSearch} className="relative">
                <input
                  type="text"
                  placeholder={t('header.searchPlaceholderMobile')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-dark-surface border border-slate-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-sans text-sm dark:text-dark-text dark:placeholder-dark-text-muted"
                  autoFocus
                />
                <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors">
                  {t('header.search')}
                </button>
                {renderSuggestions()}
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden absolute top-[80px] left-0 right-0 bg-white dark:bg-dark-bg border-b border-indigo-100 dark:border-dark-border shadow-xl"
          >
            <div className="flex flex-col p-4 gap-4 max-h-[70vh] overflow-y-auto">
              <Link to="/search" onClick={() => setIsMobileMenuOpen(false)} className="text-lg font-bold text-indigo-700 dark:text-dark-accent hover:text-indigo-800 dark:hover:text-indigo-400 transition-colors">
                {t('header.allBooks')}
              </Link>
              {topLevelCategories.map(cat => (
                <Link
                  key={cat.category_id}
                  to={`/search?category=${cat.category_id}`}
                  className="text-lg font-medium text-slate-700 dark:text-dark-text hover:text-indigo-600 dark:hover:text-dark-accent transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {categoryLabel(cat)}
                </Link>
              ))}

              <div className="h-px bg-slate-100 dark:bg-dark-border w-full my-2" />

              {token ? (
                <>
                  <Link to="/account" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 text-lg font-medium text-slate-700 dark:text-dark-text hover:text-indigo-600 dark:hover:text-dark-accent transition-colors">
                    <User className="w-5 h-5" /> {t('header.account')}
                  </Link>
                  <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className="flex items-center gap-2 text-lg font-medium text-red-500 hover:text-red-700 transition-colors">
                    <LogOut className="w-5 h-5" /> {t('header.logout')}
                  </button>
                </>
              ) : (
                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 text-lg font-medium text-slate-700 dark:text-dark-text hover:text-indigo-600 dark:hover:text-dark-accent">
                  <User className="w-5 h-5" /> {t('header.login')}
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {createPortal(
        <AnimatePresence>
          {isChangingLanguage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm"
            >
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-6"></div>
              <p className="text-xl font-bold font-serif text-slate-800 animate-pulse">
                {targetLang === 'en' ? 'Changing the language for you...' : 'Đang chuyển ngôn ngữ cho bạn...'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </header>
  );
}
