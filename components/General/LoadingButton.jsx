import { forwardRef } from 'react';
import { ClipLoader } from 'react-spinners';

const LoadingButton = forwardRef(({
  children,
  loading = false,
  loadingText = 'Loading...',
  disabled = false,
  className = '',
  spinnerColor = 'currentColor',
  spinnerSize = 16,
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      disabled={loading || disabled}
      className={`inline-flex items-center justify-center gap-2 transition-opacity disabled:opacity-50 ${className}`}
      {...props}
    >
      {loading && <ClipLoader size={spinnerSize} color={spinnerColor} />}
      {loading ? loadingText : children}
    </button>
  );
});

LoadingButton.displayName = 'LoadingButton';

export default LoadingButton;