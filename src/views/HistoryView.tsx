import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { DynamicIcon } from '../components/DynamicIcon';
import { Transaction } from '../models/types';

interface HistoryViewProps {
  onOpenTransactionModal: (editTx?: Transaction) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onOpenTransactionModal }) => {
  const { transactions, categories, profile, deleteTransaction } = useApp();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedType, setSelectedType] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [onlyFavorites, setOnlyFavorites] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Calendar state
  const [showCalendar, setShowCalendar] = useState<boolean>(false);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDayStr, setSelectedDayStr] = useState<string>(''); // YYYY-MM-DD format

  // Reset day selection when closing calendar
  useEffect(() => {
    if (!showCalendar) {
      setSelectedDayStr('');
    }
  }, [showCalendar]);

  const handleDeleteTx = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('¿Estás seguro de que deseas eliminar este movimiento?')) {
      deleteTransaction(id);
    }
  };

  // Filter transactions dynamically
  const filteredTxs = transactions.filter(tx => {
    // Search Term match (amount, notes, category name, tags)
    const matchesSearch = 
      searchTerm === '' ||
      tx.amount.toString().includes(searchTerm) ||
      (tx.notes && tx.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
      tx.categoryId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.tags && tx.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())));

    // Type match
    const matchesType = selectedType === 'all' || tx.type === selectedType;

    // Category match
    const matchesCategory = selectedCategory === 'all' || tx.categoryId === selectedCategory;

    // Account match
    const matchesAccount = selectedAccount === 'all' || tx.account === selectedAccount;

    // Favorites match
    const matchesFavorites = !onlyFavorites || !!tx.favorite;

    // Date match (Calendar)
    const matchesCalendarDate = selectedDayStr === '' || tx.date === selectedDayStr;

    return matchesSearch && matchesType && matchesCategory && matchesAccount && matchesFavorites && matchesCalendarDate;
  });

  // Calendar Helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayIndex = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Adjust so Monday is 0
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Generate calendar grid days
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayIndex = getFirstDayIndex(currentDate);
  const calendarCells = [];

  // Empty padding cells for first week
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }

  // Actual day cells
  for (let i = 1; i <= daysInMonth; i++) {
    const dayStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    calendarCells.push({ day: i, dateStr: dayStr });
  }

  // Get active dots for dates containing transactions
  const getTxDotsForDate = (dateStr: string) => {
    const dayTxs = transactions.filter(t => t.date === dateStr);
    const hasIncome = dayTxs.some(t => t.type === 'income');
    const hasExpense = dayTxs.some(t => t.type === 'expense');
    return { hasIncome, hasExpense };
  };

  const toggleDaySelection = (dateStr: string) => {
    if (selectedDayStr === dateStr) {
      setSelectedDayStr(''); // Unselect if clicked again
    } else {
      setSelectedDayStr(dateStr);
    }
  };

  return (
    <div className="view-content animate-fade-in">
      <div style={styles.header}>
        <h2>Movimientos</h2>
        <button
          onClick={() => setShowCalendar(!showCalendar)}
          style={{
            ...styles.calendarToggleBtn,
            backgroundColor: showCalendar ? 'var(--color-primary-light)' : 'var(--bg-card)',
            borderColor: showCalendar ? 'var(--color-primary)' : 'var(--border-color)',
          }}
        >
          <DynamicIcon name="Calendar" size={18} color={showCalendar ? 'var(--color-primary)' : 'var(--text-primary)'} />
          <span>Calendario</span>
        </button>
      </div>

      {/* Search Input Bar */}
      <div style={styles.searchRow}>
        <div style={styles.searchBar}>
          <DynamicIcon name="Search" size={18} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Buscar por monto, nota, etiqueta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} style={styles.clearSearchBtn}>
              <DynamicIcon name="X" size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            ...styles.filterToggleBtn,
            backgroundColor: showFilters ? 'var(--bg-card-hover)' : 'var(--bg-card)',
            borderColor: showFilters ? 'var(--border-focus)' : 'var(--border-color)',
          }}
        >
          <DynamicIcon name="SlidersHorizontal" size={18} />
        </button>
      </div>

      {/* Advanced Filter Panel */}
      {showFilters && (
        <div className="card animate-fade-in" style={styles.filterPanel}>
          <div style={styles.filterItem}>
            <span style={styles.filterLabel}>Tipo de Movimiento</span>
            <div style={styles.filterOptions}>
              {['all', 'income', 'expense'].map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedType(t as any)}
                  style={{
                    ...styles.filterBadge,
                    backgroundColor: selectedType === t ? 'var(--color-primary-light)' : 'var(--bg-input)',
                    borderColor: selectedType === t ? 'var(--color-primary)' : 'var(--border-color)',
                    color: selectedType === t ? 'var(--color-primary)' : 'var(--text-primary)',
                  }}
                >
                  {t === 'all' ? 'Todos' : t === 'income' ? 'Ingresos' : 'Gastos'}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.filterItem}>
            <span style={styles.filterLabel}>Cuenta de Pago</span>
            <div style={styles.filterOptions}>
              {['all', 'Efectivo', 'Tarjeta', 'Banco', 'Broker'].map(a => (
                <button
                  key={a}
                  onClick={() => setSelectedAccount(a)}
                  style={{
                    ...styles.filterBadge,
                    backgroundColor: selectedAccount === a ? 'var(--color-primary-light)' : 'var(--bg-input)',
                    borderColor: selectedAccount === a ? 'var(--color-primary)' : 'var(--border-color)',
                    color: selectedAccount === a ? 'var(--color-primary)' : 'var(--text-primary)',
                  }}
                >
                  {a === 'all' ? 'Todas' : a}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.filterItem}>
            <span style={styles.filterLabel}>Categoría</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input-field"
              style={{ padding: '10px', fontSize: '13px' }}
            >
              <option value="all">Todas las Categorías</option>
              {categories.filter(c => !c.parentId).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div style={styles.row}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={onlyFavorites}
                onChange={(e) => setOnlyFavorites(e.target.checked)}
                style={{ accentColor: 'var(--color-primary)' }}
              />
              <span>Mostrar solo favoritos ❤️</span>
            </label>

            <button
              onClick={() => {
                setSelectedType('all');
                setSelectedAccount('all');
                setSelectedCategory('all');
                setOnlyFavorites(false);
                setSearchTerm('');
              }}
              style={styles.resetFiltersBtn}
            >
              Reestablecer filtros
            </button>
          </div>
        </div>
      )}

      {/* Calendar Grid Section */}
      {showCalendar && (
        <div className="card animate-fade-in" style={styles.calendarContainer}>
          <div style={styles.calendarHeader}>
            <button onClick={handlePrevMonth} style={styles.calendarArrow}>
              <DynamicIcon name="ChevronLeft" size={18} />
            </button>
            <span style={styles.calendarMonthName}>
              {currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
            </span>
            <button onClick={handleNextMonth} style={styles.calendarArrow}>
              <DynamicIcon name="ChevronRight" size={18} />
            </button>
          </div>

          {/* Weekday Labels */}
          <div style={styles.weekdayGrid}>
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
              <span key={d} style={styles.weekdayLabel}>{d}</span>
            ))}
          </div>

          {/* Day Grid */}
          <div style={styles.daysGrid}>
            {calendarCells.map((cell, idx) => {
              if (!cell) return <div key={`empty-${idx}`} />;
              
              const isSelected = selectedDayStr === cell.dateStr;
              const { hasIncome, hasExpense } = getTxDotsForDate(cell.dateStr);

              return (
                <button
                  key={cell.dateStr}
                  onClick={() => toggleDaySelection(cell.dateStr)}
                  style={{
                    ...styles.dayButton,
                    backgroundColor: isSelected ? 'var(--color-primary)' : 'transparent',
                    color: isSelected ? 'white' : 'var(--text-primary)',
                    fontWeight: isSelected ? '700' : '400',
                  }}
                >
                  <span>{cell.day}</span>
                  <div style={styles.dotsRow}>
                    {hasIncome && <span style={{ ...styles.calendarDot, backgroundColor: isSelected ? 'white' : 'var(--color-success)' }} />}
                    {hasExpense && <span style={{ ...styles.calendarDot, backgroundColor: isSelected ? 'white' : 'var(--color-danger)' }} />}
                  </div>
                </button>
              );
            })}
          </div>
          {selectedDayStr && (
            <div style={styles.selectedDayBanner}>
              <span>Filtrando día: <b>{selectedDayStr}</b></span>
              <button onClick={() => setSelectedDayStr('')} style={styles.resetFiltersBtn}>Limpiar día</button>
            </div>
          )}
        </div>
      )}

      {/* Transaction List */}
      <div>
        {filteredTxs.length > 0 ? (
          <div className="tx-list">
            {filteredTxs.map((tx) => (
              <div
                key={tx.id}
                className="tx-item"
                onClick={() => onOpenTransactionModal(tx)}
              >
                <div style={{ ...styles.txIconWrapper, backgroundColor: tx.color }}>
                  <DynamicIcon name={tx.icon} size={20} color="white" />
                </div>
                <div className="tx-details">
                  <div className="tx-title">
                    {(() => {
                      const cat = categories.find(c => c.id === tx.categoryId);
                      if (tx.notes) {
                        const cleanNotes = tx.notes.replace(/#\w+(:[^\s]+)?/g, '').trim();
                        if (cleanNotes) return cleanNotes;
                      }
                      return cat ? cat.name : tx.categoryId.replace('cat_', '').replace(/^\w/, c => c.toUpperCase());
                    })()}
                    {tx.favorite && (
                      <span style={{ marginLeft: '6px' }}>
                        <DynamicIcon name="Heart" size={12} color="#f43f5e" />
                      </span>
                    )}
                  </div>
                  <div className="tx-meta">
                    <span>{tx.account}</span>
                    <span>•</span>
                    <span>{tx.date} {tx.time}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className={`tx-amount ${tx.type}`}>
                    {tx.type === 'income' ? '+' : '-'}{profile.currency}{tx.amount.toFixed(2)}
                  </div>
                  <button
                    onClick={(e) => handleDeleteTx(tx.id, e)}
                    style={styles.deleteTxBtn}
                    title="Eliminar movimiento"
                  >
                    <DynamicIcon name="Trash2" size={14} color="var(--text-muted)" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state card">
            <DynamicIcon name="SearchCode" size={32} className="empty-state-icon" />
            <p>No se encontraron movimientos con los filtros actuales.</p>
            <p className="empty-state-quote">"Organizar las finanzas es la clave para la tranquilidad mental."</p>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calendarToggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  searchRow: {
    display: 'flex',
    gap: '10px',
    width: '100%',
  },
  searchBar: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 14px',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-card)',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    background: 'none',
    padding: '12px 0',
    fontSize: '13px',
    color: 'var(--text-primary)',
    outline: 'none',
  },
  clearSearchBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  filterToggleBtn: {
    width: '46px',
    height: '46px',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-card)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  filterItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  filterLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
  },
  filterOptions: {
    display: 'flex',
    gap: '8px',
  },
  filterBadge: {
    padding: '6px 12px',
    borderRadius: '14px',
    border: '1px solid var(--border-color)',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.1s ease',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '10px',
  },
  resetFiltersBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-danger)',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  calendarContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px',
  },
  calendarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 4px',
  },
  calendarMonthName: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  calendarArrow: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
  },
  weekdayGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    textAlign: 'center',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '6px',
  },
  weekdayLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  daysGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '4px',
  },
  dayButton: {
    aspectRatio: '1',
    border: 'none',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '13px',
    position: 'relative',
    transition: 'all 0.1s ease',
  },
  dotsRow: {
    display: 'flex',
    gap: '3px',
    height: '4px',
    marginTop: '2px',
  },
  calendarDot: {
    width: '4px',
    height: '4px',
    borderRadius: '50%',
  },
  selectedDayBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderRadius: '10px',
    backgroundColor: 'var(--color-primary-light)',
    fontSize: '12px',
    color: 'var(--color-primary)',
  },
  txIconWrapper: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteTxBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '6px',
    opacity: 0.7,
    transition: 'opacity 0.1s ease',
  },
};
export default HistoryView;
