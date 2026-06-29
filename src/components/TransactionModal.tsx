import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { DynamicIcon } from './DynamicIcon';
import { Transaction } from '../models/types';
import { LocalRepository } from '../repositories/LocalRepository';


interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editTransaction?: Transaction; // optional for edit mode
  defaultType?: 'income' | 'expense';
}

export const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose, editTransaction, defaultType }) => {
  const { categories, addTransaction, updateTransaction, profile, addCategory } = useApp();

  const [amount, setAmount] = useState<string>('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [selectedSubCatId, setSelectedSubCatId] = useState<string>('');
  const [account, setAccount] = useState<string>('Efectivo');
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [tagsInput, setTagsInput] = useState<string>('');
  const [favorite, setFavorite] = useState<boolean>(false);
  const [suggestedCatId, setSuggestedCatId] = useState<string>('');
  
  // Advanced fields
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [locationName, setLocationName] = useState<string>('');
  const [receiptPhoto, setReceiptPhoto] = useState<string>('');

  // Inline category creation states
  const [showInlineAddCategory, setShowInlineAddCategory] = useState<boolean>(false);
  const [inlineCatName, setInlineCatName] = useState<string>('');
  const [inlineCatColor, setInlineCatColor] = useState<string>('#6366f1');
  const [inlineCatIcon, setInlineCatIcon] = useState<string>('Tag');

  const handleCreateInlineCategory = () => {
    if (!inlineCatName.trim()) {
      alert('Por favor, ingresa un nombre para la categoría.');
      return;
    }
    const newCatId = addCategory({
      name: inlineCatName.trim(),
      color: inlineCatColor,
      icon: inlineCatIcon
    });
    setSelectedCatId(newCatId);
    setInlineCatName('');
    setShowInlineAddCategory(false);
  };

  // Default values or load edit details
  useEffect(() => {
    if (isOpen) {
      setSuggestedCatId('');
      setShowInlineAddCategory(false);
      setInlineCatName('');
      setInlineCatColor('#6366f1');
      setInlineCatIcon('Tag');
      
      if (editTransaction) {
        setAmount(editTransaction.amount.toString());
        setType(editTransaction.type);
        setSelectedCatId(editTransaction.categoryId);
        setSelectedSubCatId(editTransaction.subcategoryId || '');
        setAccount(editTransaction.account);
        setDate(editTransaction.date);
        setTime(editTransaction.time);
        setNotes(editTransaction.notes || '');
        setTagsInput((editTransaction.tags || []).join(', '));
        setFavorite(editTransaction.favorite || false);
        setLocationName(editTransaction.location?.name || '');
        setReceiptPhoto(editTransaction.receiptPhoto || '');
        setShowAdvanced(!!(editTransaction.notes || editTransaction.tags?.length || editTransaction.location || editTransaction.receiptPhoto));
      } else {
        // Reset to default
        setAmount('');
        setType(defaultType || 'expense');
        setSelectedCatId('');
        setSelectedSubCatId('');
        setAccount('Efectivo');
        
        const now = new Date();
        setDate(now.toISOString().split('T')[0]);
        setTime(now.toTimeString().split(' ')[0].slice(0, 5));
        
        setNotes('');
        setTagsInput('');
        setFavorite(false);
        setLocationName('');
        setReceiptPhoto('');
        setShowAdvanced(false);
      }
    }
  }, [isOpen, editTransaction, defaultType]);

  // Filter categories by type
  const isIncomeCat = (catId: string) => ['cat_sal', 'cat_inv', 'cat_extra'].includes(catId);
  const filteredCategories = categories.filter(c => !c.parentId && (type === 'income' ? isIncomeCat(c.id) : !isIncomeCat(c.id)));
  const subcategories = categories.filter(c => c.parentId === selectedCatId);

  // Auto select subcategory if empty
  useEffect(() => {
    if (filteredCategories.length > 0 && !selectedCatId) {
      setSelectedCatId(filteredCategories[0].id);
    }
  }, [type, filteredCategories, selectedCatId]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationName(`Coordenadas: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        },
        () => {
          setLocationName('San José, Costa Rica (Simulado)');
        }
      );
    } else {
      setLocationName('Ubicación no soportada');
    }
  };

  const handleSave = () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Por favor, ingresa un monto válido.');
      return;
    }

    const categoryObj = categories.find(c => c.id === selectedCatId);
    if (!categoryObj) {
      alert('Por favor, selecciona una categoría.');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    const transactionData = {
      amount: numAmount,
      type,
      categoryId: selectedCatId,
      subcategoryId: selectedSubCatId || undefined,
      account,
      date,
      time,
      notes: notes || undefined,
      tags: tags.length ? tags : undefined,
      color: categoryObj.color,
      icon: categoryObj.icon,
      receiptPhoto: receiptPhoto || undefined,
      location: locationName ? { name: locationName } : undefined,
      favorite
    };

    if (editTransaction) {
      updateTransaction({
        ...editTransaction,
        ...transactionData
      });
    } else {
      addTransaction(transactionData);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={`modal-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editTransaction ? 'Editar Movimiento' : 'Nuevo Movimiento'}</h2>
          <button className="btn-ghost" onClick={onClose} style={styles.closeBtn}>
            <DynamicIcon name="X" size={24} color="var(--text-secondary)" />
          </button>
        </div>

        {/* Expense/Income Toggle */}
        <div style={styles.typeToggle}>
          <button
            onClick={() => setType('expense')}
            style={{
              ...styles.toggleBtn,
              backgroundColor: type === 'expense' ? 'var(--color-danger-light)' : 'transparent',
              color: type === 'expense' ? 'var(--color-danger)' : 'var(--text-secondary)',
              borderColor: type === 'expense' ? 'var(--color-danger)' : 'transparent',
            }}
          >
            Gasto
          </button>
          <button
            onClick={() => setType('income')}
            style={{
              ...styles.toggleBtn,
              backgroundColor: type === 'income' ? 'var(--color-success-light)' : 'transparent',
              color: type === 'income' ? 'var(--color-success)' : 'var(--text-secondary)',
              borderColor: type === 'income' ? 'var(--color-success)' : 'transparent',
            }}
          >
            Ingreso
          </button>
        </div>

        {/* Big Amount Input */}
        <div style={styles.amountContainer}>
          <span style={styles.currencySymbol}>{profile.currency}</span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={styles.amountInput}
            autoFocus
          />
        </div>

        {/* Account selection horizontal scroll */}
        <div className="input-group">
          <label className="input-label">Cuenta de Pago</label>
          <div style={styles.horizontalScroll}>
            {['Efectivo', 'Tarjeta', 'Banco', 'Broker'].map(acc => (
              <button
                key={acc}
                onClick={() => setAccount(acc)}
                style={{
                  ...styles.scrollItem,
                  backgroundColor: account === acc ? 'var(--color-primary-light)' : 'var(--bg-card)',
                  borderColor: account === acc ? 'var(--color-primary)' : 'var(--border-color)',
                  color: account === acc ? 'var(--color-primary)' : 'var(--text-primary)',
                }}
              >
                {acc}
              </button>
            ))}
          </div>
        </div>

        {/* Category selection */}
        <div className="input-group" style={{ marginBottom: showInlineAddCategory ? '8px' : '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="input-label" style={{ margin: 0 }}>Categoría</label>
            {!showInlineAddCategory && (
              <button 
                type="button" 
                onClick={() => setShowInlineAddCategory(true)} 
                className="btn btn-ghost" 
                style={{ 
                  fontSize: '11px', 
                  padding: '4px 8px', 
                  color: 'var(--color-primary)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  width: 'auto',
                  border: 'none', 
                  cursor: 'pointer', 
                  background: 'none'
                }}
              >
                <span>➕ Crear nueva</span>
              </button>
            )}
          </div>

          {showInlineAddCategory && (
            <div style={{ 
              border: '1px dashed var(--color-primary)', 
              borderRadius: '12px', 
              padding: '12px', 
              backgroundColor: 'var(--bg-card)', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '10px',
              marginBottom: '14px',
              width: '100%'
            }}>
              <div style={{ fontWeight: '700', fontSize: '11px', color: 'var(--color-primary)' }}>Nueva Categoría Rápida</div>
              
              <div className="input-group" style={{ marginBottom: 0 }}>
                <input
                  type="text"
                  placeholder="Nombre de la categoría, ej. Regalos"
                  value={inlineCatName}
                  onChange={(e) => setInlineCatName(e.target.value)}
                  className="input-field"
                  style={{ fontSize: '16px', padding: '10px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', margin: '4px 0' }}>
                {['#ff4d4d', '#3399ff', '#b366ff', '#ff66b2', '#ffcc00', '#22c55e', '#00cccc', '#e11d48', '#f97316', '#a855f7', '#06b6d4', '#71717a'].map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setInlineCatColor(color)}
                    style={{
                      height: '18px',
                      width: '18px',
                      borderRadius: '50%',
                      backgroundColor: color,
                      border: 'none',
                      outline: inlineCatColor === color ? '2px solid var(--text-primary)' : 'none',
                      cursor: 'pointer',
                      justifySelf: 'center'
                    }}
                  />
                ))}
              </div>

              <select
                value={inlineCatIcon}
                onChange={(e) => setInlineCatIcon(e.target.value)}
                className="input-field"
                style={{ fontSize: '13px', padding: '8px' }}
              >
                <option value="Tag">🏷️ Etiqueta genérica</option>
                <option value="Coffee">☕ Comida / Café</option>
                <option value="Car">🚗 Vehículo / Transporte</option>
                <option value="Tv">📺 Entretenimiento / Ocio</option>
                <option value="ShoppingBag">🛍️ Compras / Ropa</option>
                <option value="Zap">⚡ Servicios / Recibos</option>
                <option value="HeartPulse">❤️ Salud / Farmacia</option>
                <option value="Plane">✈️ Viajes / Vacaciones</option>
                <option value="GraduationCap">🎓 Educación / Cursos</option>
              </select>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button" 
                  onClick={handleCreateInlineCategory} 
                  className="btn btn-primary"
                  style={{ fontSize: '11px', padding: '6px', flex: 1 }}
                >
                  Crear y Seleccionar
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowInlineAddCategory(false);
                    setInlineCatName('');
                  }} 
                  className="btn btn-secondary"
                  style={{ fontSize: '11px', padding: '6px', flex: 1 }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {!showInlineAddCategory && (
            <div style={styles.gridContainer}>
              {filteredCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCatId(cat.id);
                    setSelectedSubCatId(''); // Reset subcategory on main change
                    setSuggestedCatId(''); // Clear suggestion on manual select
                  }}
                  style={{
                    ...styles.categoryGridItem,
                    backgroundColor: selectedCatId === cat.id ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                    borderColor: selectedCatId === cat.id ? cat.color : 'var(--border-color)',
                    animation: suggestedCatId === cat.id ? 'pulseGlow 1.5s infinite alternate' : 'none'
                  }}
                >
                  <div style={{ ...styles.catIconCircle, backgroundColor: cat.color }}>
                    <DynamicIcon name={cat.icon} size={18} color="white" />
                  </div>
                  <span style={styles.catNameText}>
                    {cat.name}
                    {suggestedCatId === cat.id && (
                      <span style={{ fontSize: '8px', color: 'var(--color-primary)', fontWeight: '700', display: 'block', marginTop: '1px' }}>
                        💡 Sugerido
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Subcategories (only if selected category has them) */}
        {subcategories.length > 0 && (
          <div className="input-group animate-fade-in">
            <label className="input-label">Subcategoría (Opcional)</label>
            <div style={styles.horizontalScroll}>
              <button
                onClick={() => setSelectedSubCatId('')}
                style={{
                  ...styles.scrollItem,
                  backgroundColor: selectedSubCatId === '' ? 'var(--color-primary-light)' : 'var(--bg-card)',
                  borderColor: selectedSubCatId === '' ? 'var(--color-primary)' : 'var(--border-color)',
                  color: selectedSubCatId === '' ? 'var(--color-primary)' : 'var(--text-primary)',
                }}
              >
                Ninguna
              </button>
              {subcategories.map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubCatId(sub.id)}
                  style={{
                    ...styles.scrollItem,
                    backgroundColor: selectedSubCatId === sub.id ? 'var(--color-primary-light)' : 'var(--bg-card)',
                    borderColor: selectedSubCatId === sub.id ? sub.color : 'var(--border-color)',
                    color: selectedSubCatId === sub.id ? 'var(--color-primary)' : 'var(--text-primary)',
                  }}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Toggle Advanced */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={styles.advancedToggle}
        >
          <span>{showAdvanced ? 'Ocultar detalles' : 'Más detalles opcionales'}</span>
          <DynamicIcon name={showAdvanced ? 'ChevronUp' : 'ChevronDown'} size={16} />
        </button>

        {/* Advanced details section */}
        {showAdvanced && (
          <div style={styles.advancedContainer}>
            <div style={styles.row}>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Fecha</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="input-field"
                />
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Hora</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Notas / Concepto (Auto-categorización Inteligente)</label>
              <textarea
                placeholder="Ej. McDonalds, Gasolina, Netflix, Farmacia..."
                value={notes}
                onChange={(e) => {
                  const val = e.target.value;
                  setNotes(val);
                  if (!val.trim()) {
                    setSuggestedCatId('');
                    return;
                  }
                  const suggested = LocalRepository.getCategorySuggestionByText(val);
                  if (suggested) {
                    setSelectedCatId(suggested);
                    setSelectedSubCatId('');
                    setSuggestedCatId(suggested);
                  } else {
                    setSuggestedCatId('');
                  }
                }}
                className="input-field"
                style={{ height: '70px', resize: 'none' }}
              />
            </div>


            <div className="input-group">
              <label className="input-label">Etiquetas (separadas por comas)</label>
              <input
                type="text"
                placeholder="viajes, vacaciones, comida-rapida"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="input-field"
              />
            </div>

            {/* Favorite check */}
            <div style={styles.checkboxRow}>
              <span style={{ fontSize: '13px', fontWeight: '500' }}>Marcar como favorito</span>
              <button
                onClick={() => setFavorite(!favorite)}
                style={{
                  ...styles.favBtn,
                  color: favorite ? '#f43f5e' : 'var(--text-muted)'
                }}
              >
                <DynamicIcon name={favorite ? 'Heart' : 'Heart'} size={24} color={favorite ? '#f43f5e' : 'var(--text-muted)'} />
              </button>
            </div>

            {/* Location Attachment */}
            <div className="input-group">
              <label className="input-label">Ubicación</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Obtener ubicación o escribir..."
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="input-field"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={handleGetLocation}
                  style={styles.attachBtn}
                  title="Obtener ubicación actual"
                >
                  <DynamicIcon name="MapPin" size={18} />
                </button>
              </div>
            </div>

            {/* Photo Attachment */}
            <div className="input-group">
              <label className="input-label">Foto del Comprobante</label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <label style={styles.photoUploadLabel}>
                  <DynamicIcon name="Camera" size={18} />
                  <span>Subir foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    style={{ display: 'none' }}
                  />
                </label>
                {receiptPhoto && (
                  <div style={styles.previewContainer}>
                    <img src={receiptPhoto} alt="Comprobante" style={styles.photoPreview} />
                    <button onClick={() => setReceiptPhoto('')} style={styles.deletePhotoBtn}>
                      <DynamicIcon name="Trash2" size={12} color="white" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <button className="btn btn-primary" onClick={handleSave} style={{ marginTop: '10px' }}>
          {editTransaction ? 'Guardar Cambios' : 'Registrar Movimiento'}
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  closeBtn: {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
  },
  typeToggle: {
    display: 'flex',
    backgroundColor: 'var(--bg-input)',
    padding: '4px',
    borderRadius: '12px',
    gap: '4px',
  },
  toggleBtn: {
    flex: 1,
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid transparent',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s ease',
  },
  amountContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '6px',
    margin: '10px 0',
  },
  currencySymbol: {
    fontSize: '36px',
    fontWeight: '800',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-display)',
  },
  amountInput: {
    fontSize: '44px',
    fontWeight: '800',
    color: 'var(--text-primary)',
    border: 'none',
    background: 'none',
    outline: 'none',
    width: '180px',
    textAlign: 'left',
    fontFamily: 'var(--font-display)',
  },
  horizontalScroll: {
    display: 'flex',
    gap: '10px',
    overflowX: 'auto',
    padding: '4px 0',
  },
  scrollItem: {
    padding: '10px 16px',
    borderRadius: '20px',
    border: '1px solid var(--border-color)',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.1s ease',
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
  },
  categoryGridItem: {
    padding: '12px 6px',
    borderRadius: '14px',
    border: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    transition: 'all 0.1s ease',
  },
  catIconCircle: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catNameText: {
    fontSize: '11px',
    fontWeight: '500',
    color: 'var(--text-primary)',
  },
  advancedToggle: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    color: 'var(--color-primary)',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    margin: '5px auto',
  },
  advancedContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '14px',
  },
  row: {
    display: 'flex',
    gap: '12px',
  },
  checkboxRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  favBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  attachBtn: {
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
  photoUploadLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    padding: '10px 16px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  previewContainer: {
    position: 'relative',
    width: '46px',
    height: '46px',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
  },
  deletePhotoBtn: {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    backgroundColor: 'var(--color-danger)',
    border: 'none',
    borderRadius: '50%',
    width: '18px',
    height: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
};
export default TransactionModal;
