import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { API_BASE_URL } from '../config/api';

interface SafeImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
    src?: string | null;
    fallbackSrc?: string;
}

export function SafeImage({
    src,
    fallbackSrc = 'https://placehold.co/300x450/e2e8f0/64748b?text=Book+Cover',
    alt = 'Book Cover',
    className,
    ...props
}: SafeImageProps) {
    const API_URL = import.meta.env.VITE_API_URL || API_BASE_URL;
    
    const getFormattedSrc = (source?: string | null) => {
        if (!source) return fallbackSrc;
        if (source.startsWith('/')) return `${API_URL}${source}`;
        return source;
    };

    const [imgSrc, setImgSrc] = useState<string>(getFormattedSrc(src));
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        setImgSrc(getFormattedSrc(src));
        setHasError(false);
    }, [src, fallbackSrc]);

    const handleError = () => {
        if (!hasError) {
            setImgSrc(fallbackSrc);
            setHasError(true);
        }
    };

    return (
        <img
            src={imgSrc}
            alt={alt}
            onError={handleError}
            className={className}
            {...props}
        />
    );
}
