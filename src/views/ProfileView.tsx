import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ExportImportService } from '../services/ExportImportService';
import { DynamicIcon } from '../components/DynamicIcon';
import { Category, RecurringTransaction } from '../models/types';

// Predefined accents for a premium UI
const ACCENT_COLORS = [
  { name: 'Morado Bonito', value: '#8b5cf6' },
  { name: 'Índigo', value: '#6366f1' },
  { name: 'Esmeralda', value: '#10b981' },
  { name: 'Ámbar', value: '#f59e0b' },
  { name: 'Carmesí', value: '#ef4444' },
  { name: 'Turquesa', value: '#06b6d4' },
  { name: 'Rosa Violeta', value: '#ec4899' }
];

export const ProfileView: React.FC = () => {
  const {
    profile,
    updateProfile,
    transactions,
    backupData,
    restoreData,
    categories,
    recurring,
    addCategory,
    updateCategory,
    deleteCategory,
    addRecurring,
    updateRecurring,
    deleteRecurring,
    signOut
  } = useApp();

  const [name, setName] = useState<string>(profile.name);
  const [username, setUsername] = useState<string>(profile.username || '');
  const [email, setEmail] = useState<string>(profile.email || '');
  const [currency, setCurrency] = useState<string>(profile.currency);
  const [language, setLanguage] = useState<'es' | 'en'>(profile.language);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(profile.theme);
  const [accentColor, setAccentColor] = useState<string>(profile.accentColor);
  
  // Security
  const [pinCode, setPinCode] = useState<string>(profile.pinCode || '');
  const [stealthModeEnabled, setStealthModeEnabled] = useState<boolean>(!!profile.stealthModeEnabled);


  // Category management states
  const [showCatModal, setShowCatModal] = useState<boolean>(false);
  const [showAddCatModal, setShowAddCatModal] = useState<boolean>(false);
  const [catName, setCatName] = useState<string>('');
  const [catType, setCatType] = useState<'income' | 'expense'>('expense');
  const [catColor, setCatColor] = useState<string>('#6366f1');
  const [catIcon, setCatIcon] = useState<string>('Tag');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  // Recurring transactions states
  const [showRecModal, setShowRecModal] = useState<boolean>(false);
  const [showAddRecModal, setShowAddRecModal] = useState<boolean>(false);
  const [recAmount, setRecAmount] = useState<string>('');
  const [recType, setRecType] = useState<'income' | 'expense'>('expense');
  const [recCatId, setRecCatId] = useState<string>('');
  const [recAccount, setRecAccount] = useState<string>('Efectivo');
  const [recNotes, setRecNotes] = useState<string>('');
  const [recFrequency, setRecFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [recStartDate, setRecStartDate] = useState<string>('');

  const handleOpenAddCategory = (cat?: Category) => {
    if (cat) {
      setEditingCatId(cat.id);
      setCatName(cat.name);
      setCatType(['cat_sal', 'cat_inv', 'cat_extra'].includes(cat.id) ? 'income' : 'expense');
      setCatColor(cat.color);
      setCatIcon(cat.icon);
    } else {
      setEditingCatId(null);
      setCatName('');
      setCatType('expense');
      setCatColor('#6366f1');
      setCatIcon('Tag');
    }
    setShowAddCatModal(true);
  };

  const handleSaveCategory = () => {
    if (!catName.trim()) {
      alert('Por favor, ingresa un nombre para la categoría.');
      return;
    }

    if (editingCatId) {
      updateCategory({
        id: editingCatId,
        name: catName.trim(),
        color: catColor,
        icon: catIcon
      });
    } else {
      addCategory({
        name: catName.trim(),
        color: catColor,
        icon: catIcon
      });
    }
    setShowAddCatModal(false);
  };

  const handleDeleteCategory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('¿Estás seguro de que deseas eliminar esta categoría? Esto podría afectar a transacciones vinculadas.')) {
      deleteCategory(id);
    }
  };

  const handleOpenAddRecurring = () => {
    setRecAmount('');
    setRecType('expense');
    setRecNotes('');
    setRecFrequency('monthly');
    const now = new Date();
    setRecStartDate(now.toISOString().split('T')[0]);
    setShowAddRecModal(true);
  };

  const isIncomeCat = (catId: string) => ['cat_sal', 'cat_inv', 'cat_extra'].includes(catId);
  const filteredCatsForRec = categories.filter(c => !c.parentId && (recType === 'income' ? isIncomeCat(c.id) : !isIncomeCat(c.id)));

  // Sync category selection on type change
  React.useEffect(() => {
    if (filteredCatsForRec.length > 0) {
      setRecCatId(filteredCatsForRec[0].id);
    }
  }, [recType, categories]);

  const handleSaveRecurring = () => {
    const val = parseFloat(recAmount);
    if (isNaN(val) || val <= 0) {
      alert('Por favor, ingresa un monto válido.');
      return;
    }
    const catObj = categories.find(c => c.id === recCatId);
    if (!catObj) {
      alert('Por favor, selecciona una categoría.');
      return;
    }

    addRecurring({
      amount: val,
      type: recType,
      categoryId: recCatId,
      account: recAccount,
      notes: recNotes.trim() || undefined,
      frequency: recFrequency,
      startDate: recStartDate || new Date().toISOString().split('T')[0],
      active: true,
      color: catObj.color,
      icon: catObj.icon
    });
    setShowAddRecModal(false);
  };

  const handleToggleRecurring = (rec: RecurringTransaction) => {
    updateRecurring({
      ...rec,
      active: !rec.active
    });
  };

  const handleDeleteRecurring = (id: string) => {
    if (confirm('¿Deseas eliminar esta transacción recurrente? Ya no se generarán más movimientos automáticos.')) {
      deleteRecurring(id);
    }
  };

  const handleSaveProfile = () => {
    if (!username.trim()) {
      alert('Por favor, ingresa un nombre de usuario.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      alert('Por favor, ingresa un correo electrónico válido.');
      return;
    }
    updateProfile({
      name,
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      avatar: profile.avatar, // preserve avatar
      currency,
      language,
      theme,
      accentColor,
      pinCode: pinCode || undefined,
      biometricsEnabled: false,
      stealthModeEnabled: stealthModeEnabled
    });
    alert('Configuración guardada correctamente.');
  };


  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateProfile({
          ...profile,
          avatar: reader.result as string
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Backups
  const handleExportBackup = () => {
    const backupJson = backupData();
    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finanlist_respaldo_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const success = restoreData(result);
        if (success) {
          alert('¡Respaldo importado y restaurado con éxito!');
          window.location.reload(); // Hard reload to reload context state
        } else {
          alert('Error al restaurar respaldo. Verifica el formato del archivo.');
        }
      };
      reader.readAsText(file);
    }
  };

  // Report Exports
  const handleExportCSV = () => ExportImportService.exportToCSV(transactions);
  const handleExportExcel = () => ExportImportService.exportToExcel(transactions);
  const handleExportPDF = () => ExportImportService.exportToPDF(transactions, profile.currency);

  return (
    <div className="view-content animate-fade-in">
      <div style={styles.header}>
        <h2>Mi Perfil</h2>
      </div>

      {/* Avatar Card */}
      <div className="card" style={styles.profileCard}>
        <div style={styles.avatarContainer}>
          <div style={styles.avatarCircle}>
            {profile.avatar ? (
              <img src={profile.avatar} alt="Profile" style={styles.avatarImg} />
            ) : (
              <span style={styles.avatarInitial}>{profile.name.charAt(0)}</span>
            )}
          </div>
          <label style={styles.avatarUploadBtn}>
            <DynamicIcon name="Camera" size={14} />
            Cambiar Foto
            <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
          </label>
        </div>
        
        <div className="input-group">
          <label className="input-label">Nombre Completo</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field"
          />
        </div>

        <div className="input-group">
          <label className="input-label">Nombre de Usuario</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
            className="input-field"
            placeholder="Ej. frankespinal"
          />
        </div>

        <div className="input-group">
          <label className="input-label">Correo Electrónico</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
            placeholder="Ej. frank@example.com"
          />
        </div>
      </div>

      {/* Accent Colors Selection */}
      <div className="card">
        <span style={styles.cardTitle}>Color de Énfasis (Tema)</span>
        <div style={styles.colorsGrid}>
          {ACCENT_COLORS.map(color => (
            <button
              key={color.value}
              onClick={() => setAccentColor(color.value)}
              style={{
                ...styles.colorBtn,
                backgroundColor: color.value,
                outline: accentColor === color.value ? `3px solid var(--text-primary)` : 'none'
              }}
              title={color.name}
            />
          ))}
        </div>
      </div>

      {/* Preferences Settings */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <span style={styles.cardTitle}>Preferencias Generales</span>

        <div style={styles.row}>
          <div className="input-group" style={{ flex: 1 }}>
            <label className="input-label">Moneda Principal</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="input-field"
            >
              <option value="RD$">Peso Dominicano (RD$)</option>
              <option value="$">Dólar ($)</option>
              <option value="€">Euro (€)</option>
              <option value="COL$">Peso Colombiano (COL$)</option>
              <option value="MXN$">Peso Mexicano (MXN$)</option>
              <option value="S/">Sol Peruano (S/)</option>
            </select>
          </div>

          <div className="input-group" style={{ flex: 1 }}>
            <label className="input-label">Idioma</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as any)}
              className="input-field"
            >
              <option value="es">Español</option>
              <option value="en">Inglés</option>
            </select>
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">Tema Visual</label>
          <div style={styles.segmentControl}>
            {['light', 'dark', 'system'].map(t => (
              <button
                key={t}
                onClick={() => setTheme(t as any)}
                style={{
                  ...styles.segmentBtn,
                  backgroundColor: theme === t ? 'var(--bg-phone)' : 'transparent',
                  color: theme === t ? 'var(--color-primary)' : 'var(--text-secondary)',
                  fontWeight: theme === t ? '700' : '500',
                }}
              >
                {t === 'light' ? 'Claro' : t === 'dark' ? 'Oscuro' : 'Sistema'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Security Block */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <span style={styles.cardTitle}>Seguridad y Bloqueo</span>

        <div className="input-group">
          <label className="input-label">Código PIN de Acceso (4 dígitos)</label>
          <input
            type="password"
            maxLength={4}
            pattern="\d*"
            inputMode="numeric"
            placeholder="Introduce código PIN de bloqueo"
            value={pinCode}
            onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
            className="input-field"
          />
        </div>

        <div style={styles.toggleRow}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600' }}>Modo Stealth por defecto</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Iniciar siempre con montos ocultos.</div>
          </div>
          <input
            type="checkbox"
            checked={stealthModeEnabled}
            onChange={(e) => setStealthModeEnabled(e.target.checked)}
            style={{ width: '20px', height: '20px', accentColor: 'var(--color-primary)' }}
          />
        </div>
      </div>



      {/* Advanced Administration */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <span style={styles.cardTitle}>Administración Avanzada</span>
        <div style={styles.exportButtonsGrid}>
          <button className="btn btn-secondary" onClick={() => setShowCatModal(true)} style={styles.actionBtn}>
            <DynamicIcon name="Tags" size={16} />
            <span>Gestionar Categorías</span>
          </button>
          <button className="btn btn-secondary" onClick={() => setShowRecModal(true)} style={styles.actionBtn}>
            <DynamicIcon name="CalendarClock" size={16} />
            <span>Suscripciones / Fijos</span>
          </button>
        </div>
      </div>

      {/* Actions (Export Statement) */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <span style={styles.cardTitle}>Exportar Estados de Cuenta</span>
        <div style={styles.exportButtonsGrid}>
          <button className="btn btn-secondary" onClick={handleExportCSV} style={styles.actionBtn}>
            <DynamicIcon name="FileText" size={16} />
            <span>CSV</span>
          </button>
          <button className="btn btn-secondary" onClick={handleExportExcel} style={styles.actionBtn}>
            <DynamicIcon name="Table" size={16} />
            <span>Excel</span>
          </button>
          <button className="btn btn-secondary" onClick={handleExportPDF} style={styles.actionBtn}>
            <DynamicIcon name="Printer" size={16} />
            <span>Imprimir PDF</span>
          </button>
        </div>
      </div>

      {/* Backup and restore */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <span style={styles.cardTitle}>Copias de Seguridad (Respaldos)</span>
        <div style={styles.exportButtonsGrid}>
          <button className="btn btn-secondary" onClick={handleExportBackup} style={styles.actionBtn}>
            <DynamicIcon name="Download" size={16} />
            <span>Exportar Copia</span>
          </button>
          <label style={{ ...styles.actionBtn, display: 'inline-flex', cursor: 'pointer', textAlign: 'center', justifyContent: 'center' }} className="btn btn-secondary">
            <DynamicIcon name="Upload" size={16} />
            <span>Importar Copia</span>
            <input type="file" accept=".json" onChange={handleImportBackup} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* Save Button */}
      <button className="btn btn-primary" onClick={handleSaveProfile} style={{ marginBottom: '10px' }}>
        Guardar Configuración de Perfil
      </button>

      {/* Logout button */}
      <button 
        className="btn btn-secondary" 
        onClick={() => {
          if (confirm('¿Deseas cerrar tu sesión?')) {
            signOut();
          }
        }} 
        style={{ 
          marginBottom: '20px', 
          backgroundColor: 'var(--color-danger-light)', 
          color: 'var(--color-danger)', 
          borderColor: 'transparent',
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <DynamicIcon name="LogOut" size={16} />
        <span>Cerrar Sesión</span>
      </button>

      {/* CATEGORIES MANAGEMENT MODAL */}
      {showCatModal && (
        <div className="modal-overlay open" onClick={() => setShowCatModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '80%', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>Gestionar Categorías</h2>
              <button className="btn-ghost" onClick={() => setShowCatModal(false)}>
                <DynamicIcon name="X" size={24} color="var(--text-secondary)" />
              </button>
            </div>
            
            <button className="btn btn-secondary" onClick={() => handleOpenAddCategory()} style={{ marginBottom: '14px', padding: '10px' }}>
              <DynamicIcon name="Plus" size={16} />
              <span>Nueva Categoría</span>
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {categories.filter(c => !c.parentId).map(cat => (
                <div
                  key={cat.id}
                  onClick={() => handleOpenAddCategory(cat)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <DynamicIcon name={cat.icon} size={16} color="white" />
                    </div>
                    <span style={{ fontWeight: '600', fontSize: '13px' }}>{cat.name}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                      {['cat_sal', 'cat_inv', 'cat_extra'].includes(cat.id) ? 'Ingreso' : 'Gasto'}
                    </span>
                  </div>
                  
                  {!['cat_food', 'cat_trans', 'cat_fun', 'cat_shop', 'cat_bills', 'cat_health', 'cat_travel', 'cat_saving', 'cat_sal', 'cat_inv', 'cat_extra'].includes(cat.id) && (
                    <button onClick={(e) => handleDeleteCategory(cat.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                      <DynamicIcon name="Trash2" size={16} color="var(--color-danger)" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT CATEGORY MODAL SHEET */}
      {showAddCatModal && (
        <div className="modal-overlay open" onClick={() => setShowAddCatModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCatId ? 'Editar Categoría' : 'Nueva Categoría'}</h2>
              <button className="btn-ghost" onClick={() => setShowAddCatModal(false)}>
                <DynamicIcon name="X" size={24} color="var(--text-secondary)" />
              </button>
            </div>

            <div className="input-group">
              <label className="input-label">Nombre de Categoría</label>
              <input
                type="text"
                placeholder="Ej. Regalos, Educación"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Tipo de Categoría</label>
              <div style={styles.segmentControl}>
                <button
                  type="button"
                  onClick={() => setCatType('expense')}
                  style={{
                    ...styles.segmentBtn,
                    backgroundColor: catType === 'expense' ? 'var(--bg-phone)' : 'transparent',
                    color: catType === 'expense' ? 'var(--color-primary)' : 'var(--text-secondary)',
                    fontWeight: catType === 'expense' ? '700' : '500',
                  }}
                >
                  Gasto
                </button>
                <button
                  type="button"
                  onClick={() => setCatType('income')}
                  style={{
                    ...styles.segmentBtn,
                    backgroundColor: catType === 'income' ? 'var(--bg-phone)' : 'transparent',
                    color: catType === 'income' ? 'var(--color-primary)' : 'var(--text-secondary)',
                    fontWeight: catType === 'income' ? '700' : '500',
                  }}
                >
                  Ingreso
                </button>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Color de la Categoría</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                {['#ff4d4d', '#3399ff', '#b366ff', '#ff66b2', '#ffcc00', '#22c55e', '#00cccc', '#e11d48', '#f97316', '#a855f7', '#06b6d4', '#71717a'].map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setCatColor(color)}
                    style={{
                      aspectRatio: '1',
                      borderRadius: '50%',
                      backgroundColor: color,
                      border: 'none',
                      outline: catColor === color ? '3px solid var(--text-primary)' : 'none',
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Icono</label>
              <select
                value={catIcon}
                onChange={(e) => setCatIcon(e.target.value)}
                className="input-field"
              >
                <option value="Tag">Etiqueta</option>
                <option value="Coffee">Café / Alimento</option>
                <option value="Car">Vehículo</option>
                <option value="Tv">Televisión</option>
                <option value="ShoppingBag">Compras</option>
                <option value="Zap">Servicios</option>
                <option value="HeartPulse">Salud</option>
                <option value="Plane">Viaje</option>
                <option value="Briefcase">Trabajo</option>
                <option value="TrendingUp">Inversiones</option>
                <option value="Coins">Monedas</option>
                <option value="Target">Ahorro</option>
                <option value="GraduationCap">Estudios</option>
                <option value="Sparkles">Estilo</option>
              </select>
            </div>

            <button className="btn btn-primary" onClick={handleSaveCategory} style={{ marginTop: '10px' }}>
              Guardar Categoría
            </button>
          </div>
        </div>
      )}

      {/* RECURRING TRANSACTIONS MODAL */}
      {showRecModal && (
        <div className="modal-overlay open" onClick={() => setShowRecModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '80%', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>Transacciones Recurrentes</h2>
              <button className="btn-ghost" onClick={() => setShowRecModal(false)}>
                <DynamicIcon name="X" size={24} color="var(--text-secondary)" />
              </button>
            </div>
            
            <button className="btn btn-secondary" onClick={handleOpenAddRecurring} style={{ marginBottom: '14px', padding: '10px' }}>
              <DynamicIcon name="Plus" size={16} />
              <span>Programar Transacción</span>
            </button>

            {recurring.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recurring.map(rec => (
                  <div
                    key={rec.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: rec.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <DynamicIcon name={rec.icon} size={16} color="white" />
                        </div>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '13px' }}>
                            {rec.notes || categories.find(c => c.id === rec.categoryId)?.name || 'Transacción'}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                            Frecuencia: {rec.frequency === 'daily' ? 'Diario' : rec.frequency === 'weekly' ? 'Semanal' : rec.frequency === 'monthly' ? 'Mensual' : 'Anual'}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: rec.type === 'income' ? 'var(--color-success)' : 'var(--text-primary)' }}>
                          {rec.type === 'income' ? '+' : '-'}{profile.currency}{rec.amount.toLocaleString()}
                        </div>
                        <button onClick={() => handleDeleteRecurring(rec.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                          <DynamicIcon name="Trash2" size={16} color="var(--color-danger)" />
                        </button>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '4px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Estado: <b>{rec.active ? 'Activo' : 'Pausado'}</b>
                      </span>
                      <button 
                        onClick={() => handleToggleRecurring(rec)}
                        className={`btn ${rec.active ? 'btn-secondary' : 'btn-primary'}`}
                        style={{ padding: '4px 8px', fontSize: '10px', width: 'auto', borderRadius: '6px' }}
                      >
                        {rec.active ? 'Pausar' : 'Activar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)', padding: '20px' }}>
                No tienes transacciones recurrentes programadas.
              </p>
            )}
          </div>
        </div>
      )}

      {/* PROGRAM TRANSACTION MODAL SHEET */}
      {showAddRecModal && (
        <div className="modal-overlay open" onClick={() => setShowAddRecModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Programar Movimiento</h2>
              <button className="btn-ghost" onClick={() => setShowAddRecModal(false)}>
                <DynamicIcon name="X" size={24} color="var(--text-secondary)" />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <button
                type="button"
                onClick={() => setRecType('expense')}
                className="btn"
                style={{
                  flex: 1,
                  backgroundColor: recType === 'expense' ? 'var(--color-danger-light)' : 'transparent',
                  color: recType === 'expense' ? 'var(--color-danger)' : 'var(--text-secondary)',
                  border: recType === 'expense' ? '1px solid var(--color-danger)' : '1px solid var(--border-color)',
                  padding: '8px'
                }}
              >
                Gasto Fijo
              </button>
              <button
                type="button"
                onClick={() => setRecType('income')}
                className="btn"
                style={{
                  flex: 1,
                  backgroundColor: recType === 'income' ? 'var(--color-success-light)' : 'transparent',
                  color: recType === 'income' ? 'var(--color-success)' : 'var(--text-secondary)',
                  border: recType === 'income' ? '1px solid var(--color-success)' : '1px solid var(--border-color)',
                  padding: '8px'
                }}
              >
                Ingreso Fijo
              </button>
            </div>

            <div className="input-group">
              <label className="input-label">Monto</label>
              <input
                type="number"
                placeholder="0.00"
                value={recAmount}
                onChange={(e) => setRecAmount(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Categoría</label>
              <select
                value={recCatId}
                onChange={(e) => setRecCatId(e.target.value)}
                className="input-field"
              >
                {filteredCatsForRec.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Frecuencia</label>
                <select
                  value={recFrequency}
                  onChange={(e) => setRecFrequency(e.target.value as any)}
                  className="input-field"
                >
                  <option value="daily">Diaria</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensual</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>

              <div className="input-group" style={{ flex: 1 }}>
                <label className="input-label">Cuenta</label>
                <select
                  value={recAccount}
                  onChange={(e) => setRecAccount(e.target.value)}
                  className="input-field"
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Banco">Banco</option>
                  <option value="Broker">Broker</option>
                </select>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Fecha de Inicio</label>
              <input
                type="date"
                value={recStartDate}
                onChange={(e) => setRecStartDate(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Nota descriptiva</label>
              <input
                type="text"
                placeholder="Ej. Alquiler, Spotify, Nómina"
                value={recNotes}
                onChange={(e) => setRecNotes(e.target.value)}
                className="input-field"
              />
            </div>

            <button className="btn btn-primary" onClick={handleSaveRecurring} style={{ marginTop: '10px' }}>
              Programar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  },
  avatarContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
  },
  avatarCircle: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-primary-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid var(--border-focus)',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  avatarInitial: {
    fontSize: '32px',
    fontWeight: '700',
    color: 'var(--color-primary)',
    fontFamily: 'var(--font-display)',
  },
  avatarUploadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--color-primary)',
    cursor: 'pointer',
  },
  cardTitle: {
    fontSize: '12px',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px',
    display: 'block',
  },
  colorsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '8px',
  },
  colorBtn: {
    aspectRatio: '1',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    transition: 'transform 0.1s ease',
  },
  row: {
    display: 'flex',
    gap: '12px',
  },
  segmentControl: {
    display: 'flex',
    backgroundColor: 'var(--bg-input)',
    padding: '4px',
    borderRadius: '12px',
    gap: '4px',
    width: '100%',
  },
  segmentBtn: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '12px',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s ease',
  },
  toggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '12px',
  },
  exportButtonsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  actionBtn: {
    fontSize: '12px',
    padding: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
};
export default ProfileView;
