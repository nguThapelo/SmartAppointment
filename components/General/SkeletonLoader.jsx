const SkeletonLoader = ({
  className = '',
  lines = 3,
  height = 'h-4',
  spacing = 'space-y-2'
}) => {
  return (
    <div className={`animate-pulse ${spacing} ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={`bg-gray-200 rounded ${height} ${index === lines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  );
};

export default SkeletonLoader;