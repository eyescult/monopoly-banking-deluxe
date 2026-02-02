import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { X, DollarSign, Users, Building2, Car, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Para transferi işlemlerini yöneten modal bileşeni.
 * Oyuncular arası, banka ve otopark işlemlerini görsel bir arayüzle sunar.
 */
export default function TransactionModal({ game, currentPlayer, onClose, initialConfig }) {
    const { makeTransaction } = useGameStore();

    // State yönetimi
    // Initialize state directly from props to avoid synchronous setState in effect
    const [transactionType, setTransactionType] = useState(initialConfig?.type || 'fromBank');
    const [amount, setAmount] = useState('');
    const [selectedPlayer, setSelectedPlayer] = useState(initialConfig?.targetId || '');
    const [loading, setLoading] = useState(false);

    // İşlem yapılabilecek diğer oyuncuları filtrele (aktif olanlar)
    const otherPlayers = game.players.filter(
        p => p.user_id !== currentPlayer.user_id && p.balance > 0
    );

    /**
     * Modal başlığını dinamik olarak belirler.
     */
    let modalTitle = 'Para Transferi';
    if (initialConfig) {
        if (transactionType === 'toPlayer') {
            const targetPlayer = game.players.find(p => p.user_id === selectedPlayer);
            modalTitle = targetPlayer ? `${targetPlayer.name} Kişisine Öde` : 'Oyuncuya Öde';
        } else if (transactionType === 'toBank') {
            modalTitle = 'Bankaya Öde';
        } else if (transactionType === 'fromBank') {
            modalTitle = 'Bankadan Çek';
        } else if (transactionType === 'toFreeParking') {
            modalTitle = 'Otoparka Öde';
        } else if (transactionType === 'fromFreeParking') {
            modalTitle = 'Otoparktan Al';
        }
    }

    /**
     * Form gönderildiğinde transfer işlemini tetikler.
     * Timeout ve retry mekanizması ile güvenilirlik artırıldı.
     */
    const handleSubmit = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const amountNum = parseInt(amount, 10);

        // Form validasyonları
        if (isNaN(amountNum) || amountNum <= 0) {
            toast.error('Geçerli bir miktar girin', { id: 'tx-invalid-amount' });
            return;
        }

        if ((transactionType === 'toBank' || transactionType === 'toPlayer' || transactionType === 'toFreeParking') && amountNum > currentPlayer.balance) {
            toast.error('Yetersiz bakiye', { id: 'tx-insufficient-funds' });
            return;
        }

        if (transactionType === 'toPlayer' && !selectedPlayer) {
            toast.error('Lütfen bir oyuncu seçin');
            return;
        }

        setLoading(true);
        const loadingToast = toast.loading('İşlem yapılıyor...');

        // Alıcı ID belirleme
        const toUserId = transactionType === 'toPlayer' ? selectedPlayer :
            transactionType === 'fromBank' || transactionType === 'fromSalary' || transactionType === 'fromFreeParking'
                ? currentPlayer.user_id : null;

        const txData = {
            gameId: game.id,
            type: transactionType,
            amount: amountNum,
            fromUserId: currentPlayer.user_id,
            toUserId: toUserId
        };

        /**
         * Timeout ile sarmalanmış işlem fonksiyonu.
         * Ekran kapandığında işlem askıda kalabilir, bu yüzden timeout ekliyoruz.
         */
        const executeWithTimeout = async (retryCount = 0) => {
            const MAX_RETRIES = 1;
            const TIMEOUT_MS = 15000; // 15 saniye timeout

            try {
                // Promise.race ile timeout uygula
                const result = await Promise.race([
                    makeTransaction(txData),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)
                    )
                ]);

                return result;
            } catch (err) {
                // Timeout durumunda retry dene
                if (err.message === 'TIMEOUT' && retryCount < MAX_RETRIES) {
                    console.warn(`[Transaction] Timeout, retrying... (${retryCount + 1}/${MAX_RETRIES})`);
                    return executeWithTimeout(retryCount + 1);
                }
                throw err;
            }
        };

        try {
            const result = await executeWithTimeout();
            setLoading(false);
            toast.dismiss(loadingToast);

            if (result.success) {
                toast.success('İşlem başarılı!', { id: 'tx-success' });
                onClose();
            } else {
                toast.error(`Hata: ${result.error || 'Bilinmeyen hata'}`);
            }
        } catch (err) {
            setLoading(false);
            toast.dismiss(loadingToast);

            if (err.message === 'TIMEOUT') {
                toast.error('İşlem zaman aşımına uğradı. Lütfen tekrar deneyin.', {
                    id: 'tx-timeout',
                    duration: 5000
                });
            } else {
                toast.error(`Beklenmeyen hata: ${err.message}`);
            }
        }
    };

    const isSimpleMode = !!initialConfig;

    // İşlem tipleri ve ikonları
    const transactionTypes = [
        { value: 'fromBank', label: 'Bankadan Al', icon: Building2, color: 'var(--success)' },
        { value: 'toBank', label: 'Bankaya Öde', icon: Building2, color: 'var(--danger)' },
        { value: 'toPlayer', label: 'Oyuncuya Öde', icon: Users, color: 'var(--info)' },
        { value: 'fromSalary', label: 'Maaş Al', icon: Wallet, color: 'var(--warning)' },
    ];

    if (game.enable_free_parking) {
        transactionTypes.push(
            { value: 'toFreeParking', label: 'Otoparka Öde', icon: Car, color: '#9333ea' },
            { value: 'fromFreeParking', label: 'Otoparktan Al', icon: Car, color: '#06b6d4' }
        );
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">{modalTitle}</h2>
                    <button onClick={onClose} className="btn btn-small btn-ghost">
                        <X size={24} />
                    </button>
                </div>

                <div className="info-box">
                    <div className="info-label">Mevcut Bakiyeniz</div>
                    <div className="info-value">
                        ${currentPlayer.balance.toLocaleString()}
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Manuel İşlem Tipi Seçimi */}
                    {!isSimpleMode && (
                        <div className="form-group">
                            <label className="form-label">İşlem Tipi</label>
                            <div className="transaction-grid">
                                {transactionTypes.map((type) => {
                                    const Icon = type.icon;
                                    return (
                                        <button
                                            key={type.value}
                                            type="button"
                                            onClick={() => setTransactionType(type.value)}
                                            className={`type-btn ${transactionType === type.value ? 'active' : ''}`}
                                            style={transactionType === type.value ? {
                                                background: type.color,
                                                borderColor: type.color,
                                                color: 'white'
                                            } : {}}
                                        >
                                            <Icon size={24} />
                                            <span>{type.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Oyuncu Seçimi */}
                    {!isSimpleMode && transactionType === 'toPlayer' && (
                        <div className="form-group">
                            <label className="form-label">Alıcı Oyuncu</label>
                            <select
                                className="form-input"
                                value={selectedPlayer}
                                onChange={(e) => setSelectedPlayer(e.target.value)}
                                required
                            >
                                <option value="">Oyuncu Seçin...</option>
                                {otherPlayers.map((player) => (
                                    <option key={player.user_id} value={player.user_id}>
                                        {player.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Miktar Girişi (Bazı işlemlerde otomatik bakiye kullanılır) */}
                    {transactionType !== 'fromSalary' && transactionType !== 'fromFreeParking' && (
                        <div className="form-group">
                            <label className="form-label">Miktar</label>
                            <div className="amount-input-wrapper">
                                <DollarSign className="amount-icon" size={24} />
                                <input
                                    type="number"
                                    className="amount-input"
                                    placeholder="0"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    min="1"
                                    step="1"
                                    autoFocus
                                    required
                                />
                            </div>

                            {/* Hızlı Miktar Butonları - Monopoly Para Birimleri */}
                            <div className="quick-amount-grid">
                                {[1, 5, 10, 20, 50, 100, 200, 500].map((val) => (
                                    <button
                                        key={val}
                                        type="button"
                                        className="btn btn-outline btn-small money-btn"
                                        onClick={() => setAmount(prev => {
                                            const currentVal = parseInt(prev, 10) || 0;
                                            return (currentVal + val).toString();
                                        })}
                                    >
                                        +${val}
                                    </button>
                                ))}
                            </div>
                            {/* Sıfırlama Butonu */}
                            <button
                                type="button"
                                className="btn btn-ghost btn-small"
                                onClick={() => setAmount('')}
                                style={{ marginTop: '0.5rem', width: '100%' }}
                            >
                                Sıfırla
                            </button>
                        </div>
                    )}

                    <div className="modal-actions">
                        <button
                            type="button"
                            className="btn btn-outline flex-1"
                            onClick={onClose}
                            disabled={loading}
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            className="btn btn-success flex-1"
                            disabled={loading}
                        >
                            {loading ? 'İşleniyor...' : 'Onayla'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
