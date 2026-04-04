import React from 'react';

type SkeletonProps = {
  className?: string;
  style?: React.CSSProperties;
};

export const Skeleton = ({ className = '', style }: SkeletonProps) => {
  return <div className={`skeleton ${className}`.trim()} style={style} />;
};

type PageSkeletonProps = {
  titleWidth?: string;
  cards?: number;
};

export const PageSkeleton = ({ titleWidth = '220px', cards = 6 }: PageSkeletonProps) => {
  return (
    <div>
      <Skeleton className="skeleton-text" style={{ width: titleWidth, height: '32px', marginBottom: '2rem' }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="card" style={{ padding: '1.5rem' }}>
            <Skeleton className="skeleton-text" style={{ width: '55%', height: '16px', marginBottom: '0.75rem' }} />
            <Skeleton className="skeleton-text" style={{ width: '80%', height: '14px', marginBottom: '0.6rem' }} />
            <Skeleton className="skeleton-text" style={{ width: '65%', height: '14px' }} />
          </div>
        ))}
      </div>
    </div>
  );
};

type TableSkeletonProps = {
  titleWidth?: string;
  rows?: number;
  columns?: number;
};

export const TableSkeleton = ({ titleWidth = '260px', rows = 6, columns = 5 }: TableSkeletonProps) => {
  return (
    <div>
      <Skeleton className="skeleton-text" style={{ width: titleWidth, height: '32px', marginBottom: '2rem' }} />
      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '1rem' }}>
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="skeleton-text" style={{ height: '16px' }} />
          ))}
        </div>
        <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '1rem' }}>
              {Array.from({ length: columns }).map((_, c) => (
                <Skeleton key={c} className="skeleton-text" style={{ height: '14px' }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const InlineDotsLoader = () => {
  return (
    <span className="dots-loader" aria-label="loading">
      <span />
      <span />
      <span />
    </span>
  );
};
