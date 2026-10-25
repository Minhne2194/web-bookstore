import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { SafeImage } from '../components/SafeImage';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config/api';

interface Book {
    book_id: string;
    title: string;
    author?: string;
    price: string | number;
    cover_url: string | null;
}

export function NewBooks() {
    const [books, setBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const { handleAddToCart } = useCart();
    const { t, i18n } = useTranslation();

    useEffect(() => {
        const fetchNewBooks = async () => {
            try {
                // Lấy sách sắp xếp theo newest (ngày ra mắt)
                const res = await fetch(`${API_BASE_URL}/books?sort=newest&limit=24`);
                const json = await res.json();
                if (json.data) {
                    setBooks(json.data);
                }
            } catch (err) {
                console.error(t('newBooks.errorLoading'), err);
            } finally {
                setLoading(false);
            }
        };

        fetchNewBooks();
    }, []);

    const formatPrice = (price: string | number) => {
        const numPrice = Number(price);
        if (i18n.language === 'en') {
            const usdPrice = numPrice / 25000;
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(usdPrice);
        }
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(numPrice);
    };

    return (
        <div className="bg-slate-50 dark:bg-dark-bg min-h-screen py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 dark:text-dark-text mb-4">{t('newBooks.title')}</h1>
                    <p className="text-slate-500 dark:text-dark-text-muted max-w-2xl mx-auto">{t('newBooks.subtitle')}</p>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 dark:border-dark-accent"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">
                        {books.map(book => (
                            <div key={book.book_id} className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-slate-100 dark:border-dark-border p-4 group flex flex-col h-full hover:shadow-md transition-shadow">
                                <Link to={`/book/${book.book_id}`} className="block relative overflow-hidden rounded-lg mb-4 aspect-2/3">
                                    <SafeImage
                                        src={book.cover_url || "https://placehold.co/300x450"}
                                        alt={book.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                </Link>

                                <div className="flex flex-col grow">
                                    <Link to={`/book/${book.book_id}`}>
                                        <h3 className="font-semibold text-slate-900 dark:text-dark-text line-clamp-2 hover:text-indigo-600 dark:hover:text-dark-accent transition-colors text-sm">
                                            {book.title}
                                        </h3>
                                    </Link>
                                    <p className="text-indigo-600 dark:text-dark-accent font-bold mt-auto pt-3">
                                        {formatPrice(book.price)}
                                    </p>
                                </div>

                                <button
                                    onClick={() => handleAddToCart(book.book_id)}
                                    className="w-full mt-3 bg-slate-900 dark:bg-dark-surface-hover text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-600 dark:hover:bg-dark-accent-hover transition-colors flex items-center justify-center gap-2"
                                >
                                    <ShoppingCart className="w-4 h-4" /> {t('newBooks.add')}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
