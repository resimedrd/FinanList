import React from 'react';

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
          strokeWidth={strokeWidth - 1}
        />
        
        {/* Data Segments */}
        {data.map((item, idx) => {
          const dashArray = `${(item.percentage / 100) * circumference} ${circumference}`;
          const dashOffset = circumference - (accumulatedPercentage / 100) * circumference;
          accumulatedPercentage += item.percentage;
          
          return (
            <circle
              key={item.categoryId || idx}
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke={item.color}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 50 50)"
              style={styles.circleSegment}
            />
          );
        })}
      </svg>

      {/* Centered balance label */}
      <div style={styles.centerLabel}>
        <span style={styles.centerTextLabel}>Gastos</span>
        <span style={styles.centerValue}>
          {currency}{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  chartContainer: {
    position: 'relative',
    width: '180px',
    height: '180px',
    margin: '0 auto',
  },
  svg: {
    width: '100%',
    height: '100%',
  },
  circleSegment: {
    transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
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
    width: '70%',
    pointerEvents: 'none',
  },
  centerTextLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  centerValue: {
    fontSize: '18px',
    fontWeight: '800',
    fontFamily: 'var(--font-display)',
    color: 'var(--text-primary)',
    marginTop: '2px',
    wordBreak: 'break-all',
  },
};
export default DonutChart;
