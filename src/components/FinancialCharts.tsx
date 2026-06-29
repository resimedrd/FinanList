import React from 'react';

// --- BAR CHART COMPONENT (INCOME VS EXPENSE) ---
interface BarChartProps {
  data: Array<{
    monthName: string;
    income: number;
    expense: number;
  }>;
  currency: string;
}

export const IncomeExpenseBarChart: React.FC<BarChartProps> = ({ data, currency }) => {
  // SVG dims
  const width = 340;
  const height = 180;
  const paddingLeft = 40;
  const paddingRight = 10;
  const paddingTop = 15;
  const paddingBottom = 25;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Find max value to scale the bars
  const maxVal = Math.max(
    ...data.map(d => Math.max(d.income, d.expense)),
    100 // fallback base min limit
  );

  // Take past 6 months to make it fit beautifully on mobile screens
  const activeData = data.slice(-6);
  const barGroupWidth = chartWidth / activeData.length;
  const barWidth = Math.max(4, barGroupWidth * 0.3);
  const gap = 3;

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', margin: '0 auto', width: '100%', maxWidth: '340px' }}>
        {/* Horizontal gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = paddingTop + chartHeight * (1 - ratio);
          const gridVal = maxVal * ratio;
          return (
            <g key={idx}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="var(--border-color)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={paddingLeft - 8}
                y={y + 4}
                fill="var(--text-secondary)"
                fontSize={9}
                fontWeight="500"
                textAnchor="end"
              >
                {gridVal >= 1000 ? `${currency}${(gridVal / 1000).toFixed(0)}k` : `${currency}${gridVal.toFixed(0)}`}
              </text>
            </g>
          );
        })}

        {/* Draw Bars */}
        {activeData.map((d, i) => {
          const x = paddingLeft + i * barGroupWidth + barGroupWidth / 2;
          
          // Income bar
          const incomeHeight = (d.income / maxVal) * chartHeight;
          const incomeY = paddingTop + chartHeight - incomeHeight;
          const incomeX = x - barWidth - gap / 2;
          
          // Expense bar
          const expenseHeight = (d.expense / maxVal) * chartHeight;
          const expenseY = paddingTop + chartHeight - expenseHeight;
          const expenseX = x + gap / 2;

          return (
            <g key={d.monthName}>
              {/* Income bar (green) */}
              <rect
                x={incomeX}
                y={incomeY}
                width={barWidth}
                height={Math.max(2, incomeHeight)}
                rx={2}
                fill="var(--color-success)"
                style={{ transition: 'height 0.4s ease, y 0.4s ease' }}
              />
              
              {/* Expense bar (indigo/accent) */}
              <rect
                x={expenseX}
                y={expenseY}
                width={barWidth}
                height={Math.max(2, expenseHeight)}
                rx={2}
                fill="var(--color-primary)"
                style={{ transition: 'height 0.4s ease, y 0.4s ease' }}
              />
              
              {/* Month label */}
              <text
                x={x}
                y={height - 8}
                fill="var(--text-secondary)"
                fontSize={10}
                fontWeight="600"
                textAnchor="middle"
              >
                {d.monthName}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

interface LineChartProps {
  data: Array<{
    day: number;
    balance: number;
  }>;
  currency: string;
  stealthMode?: boolean;
}

export const CashFlowLineChart: React.FC<LineChartProps> = ({ data, currency, stealthMode }) => {
  const width = 340;
  const height = 180;
  const paddingLeft = 40;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 25;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  if (data.length < 2) {
    return (
      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '12px' }}>
        No hay datos suficientes este mes para trazar la tendencia.
      </div>
    );
  }

  // --- Spend velocity forecast calculation ---
  const lastIndex = data.length - 1;
  const lastRealBalance = data[lastIndex].balance;
  const lastRealDay = data[lastIndex].day;

  // Let's calculate the average daily delta
  const dailyDelta = lastRealDay > 1 ? lastRealBalance / lastRealDay : lastRealBalance;
  
  // Predict until the end of the month (e.g. 30 days)
  const totalDaysInMonth = 30;
  const projectionPoints: Array<{ day: number; balance: number }> = [...data];

  if (lastRealDay < totalDaysInMonth) {
    for (let day = lastRealDay + 1; day <= totalDaysInMonth; day++) {
      const predictedBalance = lastRealBalance + (day - lastRealDay) * dailyDelta;
      projectionPoints.push({
        day,
        balance: Number(predictedBalance.toFixed(2))
      });
    }
  }

  const allBalances = projectionPoints.map(d => d.balance);
  const minBal = Math.min(...allBalances, 0);
  const maxBal = Math.max(...allBalances, 10);
  const valRange = maxBal - minBal;

  // Generate coordinates for real balance line
  const realPoints = data.map((d) => {
    // Distribute X coordinates up to the 30th day to align the forecast timeline
    const x = paddingLeft + ((d.day - 1) / (totalDaysInMonth - 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((d.balance - minBal) / (valRange || 1)) * chartHeight;
    return { x, y };
  });

  // Generate coordinates for the full projection line
  const projectionPointsCoords = projectionPoints.map((d) => {
    const x = paddingLeft + ((d.day - 1) / (totalDaysInMonth - 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((d.balance - minBal) / (valRange || 1)) * chartHeight;
    return { x, y };
  });

  // Construct path string for real line
  const pathD = realPoints.reduce((path, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${path} L ${p.x} ${p.y}`;
  }, '');

  // Construct path string for full projection line
  const projPathD = projectionPointsCoords.reduce((path, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${path} L ${p.x} ${p.y}`;
  }, '');

  // Fill gradient path (closes at bottom chart height for real cash flow)
  const fillD = `${pathD} L ${realPoints[realPoints.length - 1].x} ${paddingTop + chartHeight} L ${realPoints[0].x} ${paddingTop + chartHeight} Z`;

  return (
    <div style={{ width: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', margin: '0 auto', width: '100%', maxWidth: '340px' }}>
        <defs>
          <linearGradient id="lineGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--color-info)" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="projGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--text-secondary)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--text-muted)" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Gridlines */}
        {[0, 0.5, 1].map((ratio, idx) => {
          const y = paddingTop + chartHeight * (1 - ratio);
          const gridVal = minBal + valRange * ratio;
          
          let gridLabel = '';
          if (stealthMode) {
            gridLabel = '••••';
          } else {
            gridLabel = gridVal >= 1000 ? `${currency}${(gridVal / 1000).toFixed(0)}k` : `${currency}${gridVal.toFixed(0)}`;
          }

          return (
            <g key={idx}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="var(--border-color)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={paddingLeft - 8}
                y={y + 4}
                fill="var(--text-secondary)"
                fontSize={9}
                fontWeight="500"
                textAnchor="end"
              >
                {gridLabel}
              </text>
            </g>
          );
        })}

        {/* Shaded Area Chart Fill */}
        <path d={fillD} fill="url(#areaFill)" style={{ transition: 'd 0.3s ease' }} />

        {/* Dotted spending forecasting line */}
        {projectionPointsCoords.length > realPoints.length && (
          <path
            d={projPathD}
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            strokeLinecap="round"
            style={{ transition: 'd 0.3s ease' }}
          />
        )}

        {/* Glow Line Chart Path */}
        <path
          d={pathD}
          fill="none"
          stroke="url(#lineGlow)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transition: 'd 0.3s ease' }}
        />

        {/* Start and end dots */}
        {realPoints.length > 0 && (
          <>
            <circle cx={realPoints[0].x} cy={realPoints[0].y} r={3.5} fill="var(--color-primary)" />
            <circle cx={realPoints[realPoints.length - 1].x} cy={realPoints[realPoints.length - 1].y} r={3.5} fill="var(--color-info)" />
          </>
        )}

        {/* Label first and last day of the month */}
        <text
          x={paddingLeft}
          y={height - 8}
          fill="var(--text-secondary)"
          fontSize={10}
          fontWeight="600"
          textAnchor="start"
        >
          Día 1
        </text>
        <text
          x={width - paddingRight}
          y={height - 8}
          fill="var(--text-secondary)"
          fontSize={10}
          fontWeight="600"
          textAnchor="end"
        >
          Día 30 (Fin)
        </text>
      </svg>
    </div>
  );
};
