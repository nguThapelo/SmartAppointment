import { useLottie } from 'lottie-react';
import loadingAnimation from '@/public/animations/loading.json';

const LoadingScreen = ({
  message = 'Loading...',
  size = 'medium',
  fullScreen = false,
  className = ''
}) => {
  const options = {
    animationData: loadingAnimation,
    loop: true,
    autoplay: true,
  };

  const { View } = useLottie(options);

  const sizeClasses = {
    small: 'w-16 h-16',
    medium: 'w-24 h-24',
    large: 'w-32 h-32'
  };

  const containerClasses = fullScreen
    ? 'fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-80'
    : 'flex flex-col items-center justify-center py-8';

  return (
    <div className={`${containerClasses} ${className}`}>
      <div className={sizeClasses[size]}>
        {View}
      </div>
      {message && (
        <p className="mt-4 text-sm text-gray-600 animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
};

export default LoadingScreen;