import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ExportImportService } from '../services/ExportImportService';
import { DynamicIcon } from '../components/DynamicIcon';
import { Category, RecurringTransaction } from '../models/types';
import { hashPin } from '../utils/securityUtils';
import { compressImageFile } from '../utils/imageUtils';

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

interface ProfileViewProps {
  onTriggerWelcomeTour?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onTriggerWelcomeTour }) => {
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
    signOut,
    resetFinancialData,
    deleteAccount,
    changePassword,
    cards,
    setActiveTab
  } = useApp();

  // Password change states
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showCurrentPass, setShowCurrentPass] = useState<boolean>(false);
  const [showNewPass, setShowNewPass] = useState<boolean>(false);
  const [passError, setPassError] = useState<string>('');
  const [passSuccess, setPassSuccess] = useState<string>('');
  const [isUpdatingPass, setIsUpdatingPass] = useState<boolean>(false);

  // Reset data states
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Delete account states
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState<boolean>(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');
  const [isDeletingAccount, setIsDeletingAccount] = useState<boolean>(false);

  const [name, setName] = useState<string>(profile.name);
  const [username, setUsername] = useState<string>(profile.username || '');
  const [email, setEmail] = useState<string>(profile.email || '');
  const [currency, setCurrency] = useState<string>(profile.currency);
  const [language, setLanguage] = useState<'es' | 'en'>(profile.language);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(profile.theme);
  const [accentColor, setAccentColor] = useState<string>(profile.accentColor);
  
  // Security
  const [pinCode, setPinCode] = useState<string>('');
  const [isPinChanged, setIsPinChanged] = useState<boolean>(false);
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

  const handleSaveProfile = async () => {
    if (!username.trim()) {
      alert('Por favor, ingresa un nombre de usuario.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      alert('Por favor, ingresa un correo electrónico válido.');
      return;
    }

    let finalPinCode: string | undefined = profile.pinCode;
    if (isPinChanged) {
      if (pinCode.length === 4) {
        finalPinCode = await hashPin(pinCode);
      } else if (pinCode.length === 0) {
        finalPinCode = undefined;
      } else {
        alert('El código PIN debe tener exactamente 4 dígitos.');
        return;
      }
    }

    await updateProfile({
      name,
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      avatar: profile.avatar, // preserve avatar
      currency,
      language,
      theme,
      accentColor,
      pinCode: finalPinCode,
      biometricsEnabled: false,
      stealthModeEnabled: stealthModeEnabled
    });
    alert('Configuración guardada correctamente.');
  };


  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImageFile(file, 256, 256, 0.8);
        updateProfile({
          ...profile,
          avatar: compressed
        });
      } catch (err) {
        console.warn('[ProfileView] Avatar compression failed, falling back to direct reader:', err);
        const reader = new FileReader();
        reader.onloadend = () => {
          updateProfile({
            ...profile,
            avatar: reader.result as string
          });
        };
        reader.readAsDataURL(file);
      }
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

  const handleExecuteResetData = async () => {
    setIsResetting(true);
    try {
      await resetFinancialData();
      setShowResetConfirmModal(false);
      alert('¡Tus datos financieros han sido restablecidos exitosamente!');
    } catch (err: any) {
      console.error(err);
      alert('Error al restablecer los datos: ' + (err.message || err));
    } finally {
      setIsResetting(false);
    }
  };

  const handleExecuteChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (!currentPassword) {
      setPassError('Por favor ingresa tu contraseña actual.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPassError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }
    if (newPassword === currentPassword) {
      setPassError('La nueva contraseña no puede ser igual a la contraseña actual.');
      return;
    }

    setIsUpdatingPass(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPassSuccess('¡Contraseña actualizada con éxito!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPassSuccess('');
      }, 1500);
    } catch (err: any) {
      setPassError(err.message || 'Error al cambiar la contraseña. Verifica tu contraseña actual.');
    } finally {
      setIsUpdatingPass(false);
    }
  };

  const handleExecuteDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'ELIMINAR') {
      alert('Por favor escribe la palabra ELIMINAR en mayúsculas para confirmar.');
      return;
    }

    setIsDeletingAccount(true);
    try {
      await deleteAccount();
    } catch (err: any) {
      console.error(err);
      alert('Error al eliminar la cuenta: ' + (err.message || err));
      setIsDeletingAccount(false);
    }
  };

  // Report Exports
  const handleExportCSV = () => ExportImportService.exportToCSV(transactions);
  const handleExportExcel = () => ExportImportService.exportToExcel(transactions);
  const handleExportPDF = () => ExportImportService.exportToPDF(transactions, profile.currency);

  return (
    <div className="view-screen animate-fade-in">
      {/* Fixed View Header */}
      <div className="view-header">
        <div style={styles.header}>
          <h2>Mi Perfil</h2>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="view-content">
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="input-label" style={{ marginBottom: 0 }}>Código PIN de Acceso (4 dígitos)</label>
            {profile.pinCode && !isPinChanged && (
              <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>● PIN Activo (Cifrado)</span>
            )}
          </div>
          <input
            type="password"
            maxLength={4}
            pattern="\d*"
            inputMode="numeric"
            placeholder={profile.pinCode ? "Escribe 4 dígitos para cambiar el PIN" : "Introduce código PIN de bloqueo (4 dígitos)"}
            value={pinCode}
            onChange={(e) => {
              setIsPinChanged(true);
              setPinCode(e.target.value.replace(/\D/g, ''));
            }}
            className="input-field"
          />
          {profile.pinCode && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {isPinChanged && pinCode.length === 4 ? 'Nuevo PIN listo para guardar' : ''}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsPinChanged(true);
                  setPinCode('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: '11px',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Desactivar PIN de bloqueo
              </button>
            </div>
          )}
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



      {/* Payment Cards Section */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={styles.cardTitle}>Tarjetas y Cuentas</span>
          <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: '700' }}>
            {cards.filter(c => c.isActive).length} activas
          </span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
          Administra tus tarjetas de débito, crédito y límites de sobregiro o alertas de uso de saldo.
        </p>
        <button
          className="btn btn-secondary"
          onClick={() => setActiveTab('cards')}
          style={{ ...styles.actionBtn, width: '100%', borderColor: 'rgba(99, 102, 241, 0.35)', color: '#6366f1' }}
        >
          <DynamicIcon name="CreditCard" size={16} color="#6366f1" />
          <span style={{ fontWeight: '700' }}>Gestionar Mis Tarjetas</span>
        </button>
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
          {onTriggerWelcomeTour && (
            <button className="btn btn-secondary" onClick={onTriggerWelcomeTour} style={{ ...styles.actionBtn, gridColumn: 'span 2' }}>
              <DynamicIcon name="HelpCircle" size={16} />
              <span>Ver Tutorial de Bienvenida</span>
            </button>
          )}
        </div>
      </div>

      {/* PWA Mobile App Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <span style={styles.cardTitle}>Aplicación Móvil (PWA)</span>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
          Instala FinanList en tu pantalla de inicio para usarla en pantalla completa como una app nativa y con soporte sin conexión.
        </p>
        <button
          className="btn btn-secondary"
          onClick={() => window.dispatchEvent(new CustomEvent('trigger-pwa-install'))}
          style={{ ...styles.actionBtn, width: '100%', borderColor: 'rgba(139, 92, 246, 0.3)' }}
        >
          <DynamicIcon name="Smartphone" size={16} color="var(--color-primary, #8b5cf6)" />
          <span style={{ fontWeight: '600', color: 'var(--color-primary, #8b5cf6)' }}>Instalar o Ver Guía Móvil</span>
        </button>
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
          <button className="btn btn-secondary" onClick={() => setShowResetConfirmModal(true)} style={{ ...styles.actionBtn, color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <DynamicIcon name="Trash2" size={16} color="#ef4444" />
            <span>Restablecer Datos</span>
          </button>
        </div>
      </div>

      {/* Security & Password Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <span style={styles.cardTitle}>Seguridad de la Cuenta</span>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
          Actualiza la contraseña de tu cuenta para mantener tu información protegida.
        </p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setPassError('');
            setPassSuccess('');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setShowPasswordModal(true);
          }}
          style={{ ...styles.actionBtn, width: '100%', justifyContent: 'center' }}
        >
          <DynamicIcon name="Lock" size={16} color="var(--color-primary)" />
          <span style={{ fontWeight: '600' }}>Cambiar Contraseña</span>
        </button>
      </div>

      {/* Danger Zone Card */}
      <div className="card" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px', 
        border: '1px solid rgba(239, 68, 68, 0.3)', 
        backgroundColor: 'rgba(239, 68, 68, 0.04)' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DynamicIcon name="AlertTriangle" size={18} color="#ef4444" />
          <span style={{ ...styles.cardTitle, color: '#ef4444' }}>Zona de Peligro</span>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
          Acciones de alto impacto sobre tu cuenta y tus registros financieros.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          <button 
            type="button"
            className="btn btn-secondary" 
            onClick={() => setShowResetConfirmModal(true)} 
            style={{ 
              ...styles.actionBtn, 
              width: '100%', 
              color: '#f59e0b', 
              borderColor: 'rgba(245, 158, 11, 0.3)',
              justifyContent: 'center' 
            }}
          >
            <DynamicIcon name="RotateCcw" size={16} color="#f59e0b" />
            <span>Restablecer Datos Financieros</span>
          </button>

          <button 
            type="button"
            className="btn btn-secondary" 
            onClick={() => {
              setDeleteConfirmText('');
              setShowDeleteAccountModal(true);
            }} 
            style={{ 
              ...styles.actionBtn, 
              width: '100%', 
              color: '#ef4444', 
              borderColor: 'rgba(239, 68, 68, 0.35)',
              justifyContent: 'center' 
            }}
          >
            <DynamicIcon name="Trash2" size={16} color="#ef4444" />
            <span>Eliminar Perfil y Cuenta</span>
          </button>
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
      </div>

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

      {/* MODAL CAMBIAR CONTRASEÑA */}
      {showPasswordModal && (
        <div className="modal-overlay open" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85%', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>Cambiar Contraseña</h2>
              <button className="btn-ghost" onClick={() => setShowPasswordModal(false)}>
                <DynamicIcon name="X" size={24} color="var(--text-secondary)" />
              </button>
            </div>

            <form onSubmit={handleExecuteChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
              {passError && (
                <div style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', padding: '10px 14px', borderRadius: '10px', fontSize: '12px' }}>
                  {passError}
                </div>
              )}

              {passSuccess && (
                <div style={{ backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)', padding: '10px 14px', borderRadius: '10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DynamicIcon name="CheckCircle" size={16} color="var(--color-success)" />
                  <span>{passSuccess}</span>
                </div>
              )}

              <div className="input-group">
                <label className="input-label">Contraseña Actual</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    placeholder="Ingresa tu contraseña actual"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="input-field"
                    style={{ paddingRight: '40px' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <DynamicIcon name={showCurrentPass ? 'EyeOff' : 'Eye'} size={18} />
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Nueva Contraseña (mínimo 6 caracteres)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-field"
                    style={{ paddingRight: '40px' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <DynamicIcon name={showNewPass ? 'EyeOff' : 'Eye'} size={18} />
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Confirmar Nueva Contraseña</label>
                <input
                  type={showNewPass ? 'text' : 'password'}
                  placeholder="Repite la nueva contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isUpdatingPass}
                style={{ marginTop: '8px', padding: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
              >
                {isUpdatingPass ? (
                  <span>Actualizando contraseña...</span>
                ) : (
                  <>
                    <DynamicIcon name="Check" size={16} />
                    <span>Guardar Nueva Contraseña</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RESTABLECER DATOS */}
      {showResetConfirmModal && (
        <div className="modal-overlay open" onClick={() => !isResetting && setShowResetConfirmModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DynamicIcon name="RotateCcw" size={20} color="#f59e0b" />
                <h2 style={{ color: '#f59e0b' }}>Restablecer Datos</h2>
              </div>
              <button className="btn-ghost" onClick={() => !isResetting && setShowResetConfirmModal(false)}>
                <DynamicIcon name="X" size={24} color="var(--text-secondary)" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
                ¿Estás seguro de que deseas restablecer todos tus datos financieros?
              </p>

              <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '12px', padding: '12px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                <strong style={{ color: '#f59e0b', display: 'block', marginBottom: '4px' }}>Qué sucederá:</strong>
                • Se eliminarán todas las transacciones, presupuestos, metas de ahorro, deudas y suscripciones recurrentes de la base de datos en la nube y de este dispositivo.<br/>
                • <strong>Tu cuenta, perfil, correo y contraseña permanecerán intactos.</strong><br/>
                • Al recargar la página, los datos eliminados no volverán a aparecer.
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isResetting}
                  onClick={() => setShowResetConfirmModal(false)}
                  style={{ flex: 1, padding: '10px' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={isResetting}
                  onClick={handleExecuteResetData}
                  style={{ flex: 1, backgroundColor: '#f59e0b', color: '#000', fontWeight: '700', padding: '10px', border: 'none', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
                >
                  {isResetting ? <span>Restableciendo...</span> : <span>Sí, Restablecer</span>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR PERFIL */}
      {showDeleteAccountModal && (
        <div className="modal-overlay open" onClick={() => !isDeletingAccount && setShowDeleteAccountModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DynamicIcon name="AlertTriangle" size={20} color="#ef4444" />
                <h2 style={{ color: '#ef4444' }}>Eliminar Perfil y Cuenta</h2>
              </div>
              <button className="btn-ghost" onClick={() => !isDeletingAccount && setShowDeleteAccountModal(false)}>
                <DynamicIcon name="X" size={24} color="var(--text-secondary)" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '12px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                <strong style={{ color: '#ef4444', display: 'block', marginBottom: '4px' }}>⚠️ ACCIÓN DEFINITIVA E IRREVERSIBLE:</strong>
                • Se eliminará permanentemente tu perfil y todos los datos personales asociados en la base de datos.<br/>
                • Se borrarán todas tus transacciones, presupuestos, metas y deudas.<br/>
                • Tu sesión se cerrará de inmediato y serás redirigido a la pantalla de registro inicial.
              </div>

              <div className="input-group">
                <label className="input-label" style={{ color: 'var(--text-secondary)' }}>
                  Para confirmar, escribe <b style={{ color: '#ef4444' }}>ELIMINAR</b> en mayúsculas:
                </label>
                <input
                  type="text"
                  placeholder="ELIMINAR"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="input-field"
                  style={{ textAlign: 'center', fontWeight: '700', letterSpacing: '1px', borderColor: deleteConfirmText.trim().toUpperCase() === 'ELIMINAR' ? '#ef4444' : 'var(--border-color)' }}
                  disabled={isDeletingAccount}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isDeletingAccount}
                  onClick={() => setShowDeleteAccountModal(false)}
                  style={{ flex: 1, padding: '10px' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={isDeletingAccount || deleteConfirmText.trim().toUpperCase() !== 'ELIMINAR'}
                  onClick={handleExecuteDeleteAccount}
                  style={{ 
                    flex: 1, 
                    backgroundColor: deleteConfirmText.trim().toUpperCase() === 'ELIMINAR' ? '#ef4444' : 'var(--border-color)', 
                    color: '#fff', 
                    fontWeight: '700', 
                    padding: '10px', 
                    border: 'none', 
                    borderRadius: '10px', 
                    cursor: deleteConfirmText.trim().toUpperCase() === 'ELIMINAR' ? 'pointer' : 'not-allowed',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '6px' 
                  }}
                >
                  {isDeletingAccount ? <span>Eliminando...</span> : <span>Eliminar Definitivamente</span>}
                </button>
              </div>
            </div>
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
