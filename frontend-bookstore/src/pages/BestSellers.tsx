import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, TrendingUp } from 'lucide-react';
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
    sold_count?: number;
}

export function BestSellers() {
    const [books, setBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const { handleAddToCart } = useCart();
    const { t, i18n } = useTranslation();

    useEffect(() => {
        const fetchBestSellers = async () => {
            try {
                // Lấy sách sắp xếp theo best seller (số lượng bán ra)
                const res = await fetch(`${API_BASE_URL}/books?sort=bestseller&limit=24`);
                const json = await res.json();
                if (json.data) {
                    setBooks(json.data);
                }
            } catch (err) {
                console.error(t('bestSellers.errorLoading'), err);
            } finally {
                setLoading(false);
            }
        };

        fetchBestSellers();
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
        <div className="bg-slate-50 min-h-screen py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-10 text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4">
                        <TrendingUp size={32} />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 mb-4">{t('bestSellers.title')}</h1>
                    <p className="text-slate-500 max-w-2xl mx-auto">{t('bestSellers.subtitle')}</p>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-600"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">
                        {books.map((book, idx) => (
                            <div key={book.book_id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 group flex flex-col h-full hover:shadow-md transition-shadow relative">
                                {/* Rank badge */}
                                {idx < 3 && (
                                    <div className={`absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm z-10 shadow-md ${idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-slate-300' : 'bg-amber-600'}`}>
                                        {idx + 1}
                                    </div>
                                )}
                                
                                <Link to={`/book/${book.book_id}`} className="block relative overflow-hidden rounded-lg mb-4 aspect-2/3">
                                    <SafeImage
                                        src={book.cover_url || "https://placehold.co/300x450"}
                                        alt={book.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                </Link>

                                <div className="flex flex-col grow">
                                    <Link to={`/book/${book.book_id}`}>
                                        <h3 className="font-semibold text-slate-900 line-clamp-2 hover:text-indigo-600 transition-colors text-sm">
                                            {book.title}
                                        </h3>
                                    </Link>
                                    <p className="text-rose-600 font-bold mt-auto pt-3">
                                        {formatPrice(book.price)}
                                    </p>
                                </div>

                                <button
                                    onClick={() => handleAddToCart(book.book_id)}
                                    className="w-full mt-3 bg-slate-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-rose-600 transition-colors flex items-center justify-center gap-2"
                                >
                                    <ShoppingCart className="w-4 h-4" /> {t('bestSellers.buyNow')}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
