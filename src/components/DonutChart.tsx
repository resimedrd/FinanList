import React, { useState } from 'react';

interface DonutChartProps {
  data: Array<{
    categoryId: string;
    name: string;
    amount: number;
    percentage: number;
    color: string;
    icon: string;
  }>;
  total: number;
  currency: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({ data, total, currency }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // SVG properties
  const radius = 35;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  
  let accumulatedPercentage = 0;

  if (total === 0 || data.length === 0) {
    return (
      <div style={styles.chartContainer}>
        <svg viewBox="0 0 100 100" style={styles.svg}>
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke="var(--border-color)"
            strokeWidth={strokeWidth}
          />
        </svg>
        <div style={styles.centerLabel}>
          <div style={styles.centerTextLabel}>Total</div>
          <div style={styles.centerValue}>{currency}0</div>
        </div>
      </div>
    );
  }

  // Active / Selected info
  const hasActive = activeIndex !== null && activeIndex < data.length;
  const displayLabel = hasActive ? data[activeIndex].name : 'Gastos';
  const displayValue = hasActive ? data[activeIndex].amount : total;
  const displayPercent = hasActive ? `${data[activeIndex].percentage.toFixed(1)}%` : null;
  const displayColor = hasActive ? data[activeIndex].color : 'var(--text-secondary)';

  return (
    <div style={styles.chartContainer}>
      <svg viewBox="0 0 100 100" style={styles.svg}>
        {/* Gray base circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="transparent"
          stroke="var(--border-color)"
          strokeWidth={strokeWidth - 2}
          style={{ opacity: 0.3 }}
        />
        
        {/* Data Segments */}
        {data.map((item, idx) => {
          const dashArray = `${(item.percentage / 100) * circumference} ${circumference}`;
          const dashOffset = circumference - (accumulatedPercentage / 100) * circumference;
          accumulatedPercentage += item.percentage;
          
          const isSelected = activeIndex === idx;

          return (
            <circle
              key={item.categoryId || idx}
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke={item.color}
              strokeWidth={isSelected ? strokeWidth + 2.5 : strokeWidth}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 50 50)"
              onClick={() => setActiveIndex(isSelected ? null : idx)}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
              style={{
                ...styles.circleSegment,
                cursor: 'pointer',
                opacity: activeIndex === null || isSelected ? 1 : 0.6,
              }}
            />
          );
        })}
      </svg>

      {/* Centered balance label */}
      <div style={styles.centerLabel}>
        <span style={{ ...styles.centerTextLabel, color: displayColor }}>
          {displayLabel}
        </span>
        <span style={styles.centerValue}>
          {currency}{displayValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        {displayPercent && (
          <span style={styles.centerPercentLabel}>
            {displayPercent}
          </span>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  chartContainer: {
    position: 'relative',
    width: '145px',
    height: '145px',
    margin: '0 auto',
    flexShrink: 0,
  },
  svg: {
    width: '100%',
    height: '100%',
  },
  circleSegment: {
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    strokeLinecap: 'round',
  },
  centerLabel: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    width: '75%',
    pointerEvents: 'none',
  },
  centerTextLabel: {
    fontSize: '9px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    transition: 'color 0.2s ease',
  },
  centerValue: {
    fontSize: '13px',
    fontWeight: '800',
    fontFamily: 'var(--font-display)',
    color: 'var(--text-primary)',
    marginTop: '1px',
    wordBreak: 'break-all',
  },
  centerPercentLabel: {
    fontSize: '9px',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    marginTop: '1px',
  },
};

export default DonutChart;
