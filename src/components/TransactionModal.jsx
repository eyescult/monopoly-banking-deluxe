import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { X, DollarSign, Users, Building2, Car, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

/**
 * Para transferi işlemlerini yöneten modal bileşeni.
 * Oyuncular arası, banka ve otopark işlemlerini görsel bir arayüzle sunar.
 */
export default function TransactionModal({ game, currentPlayer, onClose, initialConfig }) {
    const makeTransaction = useGameStore(state => state.makeTransaction);
    const { t } = useTranslation();

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

    // Whether the current transaction type uses a fixed (non-user-entered) amount
    const isFixedAmount = transactionType === 'fromSalary' || transactionType === 'fromFreeParking';

    /**
     * Modal başlığını dinamik olarak belirler.
     */
    let modalTitle = t('transfer_title');
    if (initialConfig) {
        if (transactionType === 'toPlayer') {
            const targetPlayer = game.players.find(p => p.user_id === selectedPlayer);
            modalTitle = targetPlayer ? t('pay_to', { name: targetPlayer.name }) : t('pay_to_player');
        } else if (transactionType === 'toBank') {
            modalTitle = t('pay_to_bank');
        } else if (transactionType === 'fromBank') {
            modalTitle = t('withdraw_from_bank');
        } else if (transactionType === 'toFreeParking') {
            modalTitle = t('pay_to_parking');
        } else if (transactionType === 'fromFreeParking') {
            modalTitle = t('take_from_parking');
        } else if (transactionType === 'fromSalary') {
            modalTitle = t('salary_action') || 'Receive Salary';
        }
    }

    /**
     * Form gönderildiğinde transfer işlemini tetikler.
     * Timeout ve retry mekanizması ile güvenilirlik artırıldı.
     */
    const handleSubmit = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Determine the effective amount depending on transaction type
        let amountNum;
        if (transactionType === 'fromSalary') {
            amountNum = game.salary;
        } else if (transactionType === 'fromFreeParking') {
            amountNum = game.free_parking_money || 0;
        } else {
            amountNum = parseInt(amount, 10);
        }

        // Form validasyonları
        if (isNaN(amountNum) || amountNum <= 0) {
            if (transactionType === 'fromFreeParking') {
                toast.error(t('parking_empty') || 'Free parking has no money', { id: 'tx-parking-empty' });
            } else {
                toast.error(t('invalid_amount'), { id: 'tx-invalid-amount' });
            }
            return;
        }

        if ((transactionType === 'toBank' || transactionType === 'toPlayer' || transactionType === 'toFreeParking') && amountNum > currentPlayer.balance) {
            toast.error(t('insufficient_funds'), { id: 'tx-insufficient-funds' });
            return;
        }

        if (transactionType === 'toPlayer' && !selectedPlayer) {
            toast.error(t('select_player_warning'));
            return;
        }

        setLoading(true);
        const loadingToast = toast.loading(t('processing_tx'));

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
            const TIMEOUT_MS = 25000; // 25 saniye timeout (Retry logic için süre tanındı)

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
                toast.success(t('transaction_success'), { id: 'tx-success' });
                onClose();
            } else {
                toast.error(`${t('error')}: ${result.error || t('unknown_error')}`);
            }
        } catch (err) {
            setLoading(false);
            toast.dismiss(loadingToast);

            if (err.message === 'TIMEOUT') {
                toast.error(t('tx_timeout'), {
                    id: 'tx-timeout',
                    duration: 5000
                });
            } else if (err.message === 'QUEUE_TIMEOUT') {
                toast.error(t('tx_queue_timeout'), {
                    id: 'tx-queue-timeout',
                    duration: 5000
                });
            } else {
                toast.error(t('unexpected_error', { message: err.message }));
            }
        }
    };

    const isSimpleMode = !!initialConfig;

    // İşlem tipleri ve ikonları
    const transactionTypes = [
        { value: 'fromBank', label: t('withdraw_from_bank'), icon: Building2, color: 'var(--success)' },
        { value: 'toBank', label: t('pay_to_bank'), icon: Building2, color: 'var(--danger)' },
        { value: 'toPlayer', label: t('pay_to_player'), icon: Users, color: 'var(--info)' },
        { value: 'fromSalary', label: t('salary_action'), icon: Wallet, color: 'var(--warning)' },
    ];

    if (game.enable_free_parking) {
        transactionTypes.push(
            { value: 'toFreeParking', label: t('pay_to_parking'), icon: Car, color: '#9333ea' },
            { value: 'fromFreeParking', label: t('take_from_parking'), icon: Car, color: '#06b6d4' }
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
                    <div className="info-label">{t('current_balance')}</div>
                    <div className="info-value">
                        ${currentPlayer.balance.toLocaleString()}
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Manuel İşlem Tipi Seçimi */}
                    {!isSimpleMode && (
                        <div className="form-group">
                            <label className="form-label">{t('transaction_type')}</label>
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
                            <label className="form-label">{t('recipient_player')}</label>
                            <select
                                className="form-input"
                                value={selectedPlayer}
                                onChange={(e) => setSelectedPlayer(e.target.value)}
                                required
                            >
                                <option value="">{t('select_player')}</option>
                                {otherPlayers.map((player) => (
                                    <option key={player.user_id} value={player.user_id}>
                                        {player.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Fixed-amount confirmation for Salary & Free Parking */}
                    {isFixedAmount && (
                        <div className="info-box" style={{ marginBottom: 'var(--spacing-lg)' }}>
                            <div className="info-label">
                                {transactionType === 'fromSalary'
                                    ? (t('salary_amount') || 'Salary')
                                    : (t('parking_pot') || 'Free Parking Pot')}
                            </div>
                            <div className="info-value" style={{ color: 'var(--success)' }}>
                                ${transactionType === 'fromSalary'
                                    ? game.salary?.toLocaleString()
                                    : (game.free_parking_money || 0).toLocaleString()}
                            </div>
                        </div>
                    )}

                    {/* Miktar Girişi (Bazı işlemlerde otomatik bakiye kullanılır) */}
                    {!isFixedAmount && (
                        <div className="form-group">
                            <label className="form-label">{t('amount')}</label>
                            <div className="amount-input-wrapper">
                                <DollarSign className="amount-icon" size={24} />
                                <input
                                    type="number"
                                    className="amount-input"
                                    placeholder="0"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    min="1000"
                                    step="1000"
                                    autoFocus
                                    required
                                />
                            </div>

                            {/* Schnellbetrag-Buttons - Monopoly Banking Scal */}
                            <div className="quick-amount-grid">
                                {[100000, 500000, 1000000, 2000000, 5000000, 10000000, 20000000, 50000000].map((val) => (
                                    <button
                                        key={val}
                                        type="button"
                                        className="btn btn-outline btn-small money-btn"
                                        onClick={() => setAmount(prev => {
                                            const currentVal = parseInt(prev, 10) || 0;
                                            return (currentVal + val).toString();
                                        })}
                                    >
                                        +{val >= 1000000 ? `${val / 1000000}M` : `${val / 1000}K`}
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
                                {t('reset')}
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
                            {t('cancel')}
                        </button>
                        <button
                            type="submit"
                            className="btn btn-success flex-1"
                            disabled={loading}
                        >
                            {loading ? t('processing') : t('confirm')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
