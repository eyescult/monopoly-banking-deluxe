import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { usePropertyStore, getGroupColor, getPropertyIcon } from '../store/propertyStore';
import {
    Menu, X, DollarSign, Send, ArrowRightLeft,
    LogOut, History, ShieldAlert, CircleAlert, Globe, Home, ShoppingCart
} from 'lucide-react';
import toast from 'react-hot-toast';


import TransactionModal from '../components/TransactionModal';
import GameEndModal from '../components/GameEndModal';
import Avatar from '../components/Avatar';
import { useTranslation } from 'react-i18next';

export default function GamePage() {
    const { gameId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { t, i18n } = useTranslation();

    const {
        currentGame,
        subscribeToGame,
        leaveGame,
        endGame,
        bankruptPlayer,
        refreshGameData
    } = useGameStore();
    const game = currentGame;

    // Property store for inline buy
    const {
        properties,
        initForLegacyGame: initProperties,
        buyProperty
    } = usePropertyStore();
    const [buyingProperty, setBuyingProperty] = useState(null);

    // UI States
    const [showSidebar, setShowSidebar] = useState(false);
    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [transactionConfig, setTransactionConfig] = useState(null);
    const [showGameEndModal, setShowGameEndModal] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [confirmEndGame, setConfirmEndGame] = useState(false);

    // Sidebar referansı (dışarı tıklandığında kapanması için)
    const sidebarRef = useRef(null);

    // Initial Loading State
    const [initialLoading, setInitialLoading] = useState(true);

    /**
     * Oyuna bağlanma ve real-time abonelik başlatma.
     */
    useEffect(() => {
        if (!user || !gameId) return;

        let subscription = null;
        let isMounted = true;

        const connect = async () => {
            const result = await subscribeToGame(gameId);
            // Prevent state updates and leaks if user leaves page quickly.
            if (!isMounted) {
                if (result?.success && result.subscription) {
                    result.subscription.unsubscribe();
                }
                return;
            }

            setInitialLoading(false);

            if (!result.success) {
                toast.error(result.error || t('game_connect_error'));
                navigate('/');
            } else {
                subscription = result.subscription;
            }
        };

        connect();

        return () => {
            isMounted = false;
            if (subscription) {
                subscription.unsubscribe();
            }
        };
    }, [user, gameId, subscribeToGame, navigate, t]);

    // Initialize property store for inline buy section
    useEffect(() => {
        if (!user?.id || !gameId) return;
        initProperties(gameId, user.id, user.name || 'Guest');
    }, [gameId, initProperties, user?.id, user?.name]);

    /**
     * Oyun bittiğinde modalı göster.
     */
    useEffect(() => {
        if (game?.status === 'completed' && game.winner_id) {
            const timer = setTimeout(() => {
                setShowGameEndModal(true);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [game?.status, game?.winner_id]);

    /**
     * Dışarı tıklama kontrolü (Sidebar için)
     */
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
                setShowSidebar(false);
            }
        };

        if (showSidebar) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showSidebar]);


    // Loading ekranı
    if (initialLoading || !game) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>{t('connecting')}</p>
            </div>
        );
    }

    const currentPlayer = game.players.find(p => p.user_id === user.id);
    const isHost = game.created_by === user.id;
    const transactions = game.transaction_history || [];
    const freeParkingBalance = game.free_parking_money || 0;

    // Oyuncu oyunda değilse (örn. atıldıysa veya hata olduysa)
    if (!currentPlayer) {
        return (
            <div className="error-screen">
                <h2>{t('not_in_game_title')}</h2>
                <button className="btn btn-primary" onClick={() => navigate('/')}>
                    {t('return_home')}
                </button>
            </div>
        );
    }

    /**
     * Oyundan ayrılma işlemi.
     */
    const handleLeaveGame = async () => {
        const result = await leaveGame(user.id);
        if (result.success) {
            navigate('/');
        } else {
            toast.error(t('leave_error'));
        }
    };

    /**
     * Oyunu sonlandırma işlemi (Sadece kurucu).
     */
    const handleEndGame = async () => {
        const result = await endGame(game.id);
        if (result.success) {
            setConfirmEndGame(false);
            toast.success(t('game_ended'));
        } else {
            toast.error(t('end_game_error'));
        }
    };

    /**
     * İşlem modalını açar (Bankadan para çek, oyuncuya öde vb.)
     */
    const openTransaction = (type = 'fromBank', targetId = null) => {
        setTransactionConfig({ type, targetId });
        setShowTransactionModal(true);
        setShowSidebar(false);
    };

    /**
     * İflas bildirme işlemi.
     */
    const handleBankruptcy = async () => {
        if (confirm(t('bankruptcy_confirm'))) {
            setInitialLoading(true);
            const result = await bankruptPlayer(game.id, user.id);
            if (result.success) {
                toast.success(t('bankruptcy_declared'));
            } else {
                toast.error(result.error || t('bankruptcy_error'));
            }
            setInitialLoading(false);
        }
    };

    /**
     * Tarih formatlama yardımcısı.
     */
    const formatTime = (isoString) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        return date.toLocaleTimeString(i18n.language === 'en' ? 'en-US' : 'tr-TR', { hour: '2-digit', minute: '2-digit' });
    };

    /**
     * İşlem geçmişini daha okunabilir hale getirir.
     */
    const getTransactionDesc = (tx) => {
        const amount = `$${tx.amount.toLocaleString()}`;

        if (tx.type === 'initial_balance') return t('tx_initial_balance');
        if (tx.type === 'join_bonus') return t('tx_join_bonus');

        const fromPlayer = game.players.find(p => p.user_id === tx.from_user_id);
        const toPlayer = game.players.find(p => p.user_id === tx.to_user_id);
        const fromName = fromPlayer ? fromPlayer.name : t('unknown_player');
        const toName = toPlayer ? toPlayer.name : t('unknown_player');

        switch (tx.type) {
            case 'transfer':
                return t('tx_transfer', { from: fromName, to: toName, amount });
            case 'pay_bank':
                return t('tx_pay_bank', { name: fromName, amount });
            case 'receive_bank':
                return t('tx_receive_bank', { name: toName, amount });
            case 'pay_parking':
                return t('tx_pay_parking', { name: fromName, amount });
            case 'receive_parking':
                return t('tx_receive_parking', { name: toName, amount });
            case 'salary':
                return t('tx_salary', { name: toName, amount });
            default:
                return t('tx_unknown');
        }
    };

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
    };

    const isBankrupt = !!currentPlayer.bankrupt_timestamp;

    return (
        <div className={`game-page ${isBankrupt ? 'bankrupt-mode' : ''}`}>
            {/* Sidebar Overlay */}
            {showSidebar && (
                <div className="sidebar-overlay" onClick={() => setShowSidebar(false)}></div>
            )}

            {/* Sidebar Start */}
            <div ref={sidebarRef} className={`sidebar ${showSidebar ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <h3>{t('game_menu')}</h3>
                    <button className="sidebar-close" onClick={() => setShowSidebar(false)}>
                        <X size={24} />
                    </button>
                </div>

                <div className="player-list-mini">
                    <h4>{t('players')}</h4>
                    {game.players.map(p => (
                        <div key={p.user_id} className={`player-row ${p.bankrupt_timestamp ? 'bankrupt' : ''}`}>
                            <Avatar user={p} size={32} />
                            <span className="player-name">{p.name}</span>
                            <span className="player-balance">${p.balance.toLocaleString()}</span>
                        </div>
                    ))}
                </div>

                <div className="sidebar-divider"></div>

                <div className="menu-items">
                    <button className="menu-item" onClick={() => { setShowHistory(true); setShowSidebar(false); }}>
                        <History size={20} />
                        <span>{t('tx_history')}</span>
                    </button>

                    <button className="menu-item danger" onClick={handleBankruptcy} disabled={isBankrupt}>
                        <ShieldAlert size={20} />
                        <span>{t('declare_bankruptcy')}</span>
                    </button>

                    {isHost && (
                        <button className="menu-item danger" onClick={() => setConfirmEndGame(true)}>
                            <CircleAlert size={20} />
                            <span>{t('end_game')}</span>
                        </button>
                    )}

                    <button className="menu-item warning" onClick={handleLeaveGame}>
                        <LogOut size={20} />
                        <span>{t('leave_game')}</span>
                    </button>
                </div>

                <div className="sidebar-divider"></div>

                {/* Language Switcher in Sidebar */}
                <div className="sidebar-item-group">
                    <div className="sidebar-item-header">
                        <Globe size={20} />
                        <span>{t('language')}</span>
                    </div>
                    <div className="language-options" style={{ paddingLeft: '44px', display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button
                            className={`btn btn-small ${i18n.language === 'tr' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => changeLanguage('tr')}
                            style={{ flex: 1 }}
                        >
                            {t('turkish')}
                        </button>
                        <button
                            className={`btn btn-small ${i18n.language === 'en' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => changeLanguage('en')}
                            style={{ flex: 1 }}
                        >
                            {t('english')}
                        </button>
                    </div>
                </div>

                <div className="game-code-section">
                    <span>{t('game_code_label')}:</span>
                    <span className="code">{game.id}</span>
                </div>
            </div>
            {/* Sidebar End */}


            {/* Üst Bar */}
            <div className="game-header">
                <div className="user-info">
                    <Avatar user={currentPlayer} size={40} />
                    <div>
                        <div className="user-name">{currentPlayer.name}</div>
                        {isBankrupt && <div className="status-badge error">{t('bankrupt')}</div>}
                    </div>
                </div>
                <div className="game-code-display">
                    {game.id}
                </div>
                <button className="menu-btn" onClick={() => setShowSidebar(true)}>
                    <Menu size={24} />
                </button>
            </div>

            {/* Bakiye Kartı */}
            <div className="balance-card fade-in">
                <div className="balance-label">{t('current_balance')}</div>
                <div className="balance-amount">
                    ${currentPlayer.balance.toLocaleString()}
                </div>
            </div>

            {/* Hızlı İşlemler */}
            <div className="quick-actions fade-in-up">
                <button
                    className="action-btn success"
                    onClick={() => openTransaction('fromBank')}
                    disabled={isBankrupt}
                >
                    <div className="icon-wrapper">
                        <DollarSign size={24} />
                    </div>
                    <span>{t('withdraw_bank')}</span>
                </button>

                <button
                    className="action-btn warning"
                    onClick={() => openTransaction('fromSalary')}
                    disabled={isBankrupt}
                >
                    <div className="icon-wrapper">
                        <DollarSign size={24} />
                    </div>
                    <span>{t('salary_receive')}</span>
                </button>

                <button
                    className="action-btn danger"
                    onClick={() => openTransaction('toBank')}
                    disabled={isBankrupt}
                >
                    <div className="icon-wrapper">
                        <DollarSign size={24} />
                    </div>
                    <span>{t('pay_bank')}</span>
                </button>

                {game.enable_free_parking && (
                    <button
                        className="action-btn info"
                        onClick={() => openTransaction('toFreeParking')}
                        disabled={isBankrupt}
                    >
                        <div className="icon-wrapper">
                            <DollarSign size={24} />
                        </div>
                        <span>{t('pay_parking')}</span>
                    </button>
                )}
            </div>

            <div className="quick-actions fade-in-up" style={{ marginTop: '12px' }}>
                <button className="action-btn info" onClick={() => navigate('/properties')}>
                    <div className="icon-wrapper"><Home size={24} /></div>
                    <span>{t('properties') || 'Properties'}</span>
                </button>
                <button className="action-btn warning" onClick={() => navigate('/trades')}>
                    <div className="icon-wrapper"><ArrowRightLeft size={24} /></div>
                    <span>{t('trades') || 'Trades'}</span>
                </button>
            </div>

            {/* Inline Buy Properties Section */}
            {properties.filter(p => !p.owner_id && p.type !== 'special').length > 0 && (
                <div className="players-section fade-in-up">
                    <div className="section-header">
                        <h3><ShoppingCart size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />{t('buy_property') || 'Buy Property'}</h3>
                    </div>
                    <div className="games-list" style={{ maxHeight: 320, overflowY: 'auto' }}>
                        {properties
                            .filter(p => !p.owner_id && p.type !== 'special')
                            .map(p => {
                                const color = getGroupColor(p.group_name);
                                return (
                                    <div key={p.id} className="game-card property-card" style={{ marginBottom: 8 }}>
                                        <div style={{ height: 6, width: '100%', borderRadius: '8px 8px 0 0', backgroundColor: color }} />
                                        <div className="game-card-header" style={{ padding: '8px 12px' }}>
                                            <span style={{ fontSize: '0.9rem' }}>
                                                <strong>#{p.position}</strong>{' '}
                                                {getPropertyIcon(p.type)}{' '}
                                                {p.name}
                                            </span>
                                            <span style={{
                                                fontSize: '0.7rem', padding: '2px 6px', borderRadius: 'var(--radius-full)',
                                                background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-secondary)'
                                            }}>
                                                {p.group_name || p.type}
                                            </span>
                                        </div>
                                        <div className="game-card-body" style={{ padding: '4px 12px 10px' }}>
                                            <div style={{ display: 'flex', gap: 16, fontSize: '0.85rem', marginBottom: 6 }}>
                                                <span><strong>${p.price.toLocaleString()}</strong></span>
                                                <span style={{ color: 'var(--text-secondary)' }}>Rent: ${p.rent_base}</span>
                                            </div>
                                            <button
                                                className="btn btn-primary btn-small"
                                                disabled={isBankrupt || buyingProperty === p.id || currentPlayer.balance < p.price}
                                                onClick={async () => {
                                                    setBuyingProperty(p.id);
                                                    const result = await buyProperty(p.id, user.id);
                                                    if (result.success) {
                                                        // Deduct from legacy balance
                                                        await refreshGameData(gameId);
                                                        toast.success(`Bought ${p.name}!`);
                                                    } else {
                                                        toast.error(result.error || 'Purchase failed');
                                                    }
                                                    setBuyingProperty(null);
                                                }}
                                            >
                                                {buyingProperty === p.id ? 'Buying…' : `Buy $${p.price.toLocaleString()}`}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* Oyuncu Listesi (Transfer için) */}
            <div className="players-section fade-in-up">
                <div className="section-header">
                    <h3>{t('transfer_to_player')}</h3>
                </div>
                <div className="players-grid">
                    {game.players
                        .filter(p => p.user_id !== user.id && !p.bankrupt_timestamp)
                        .map(player => (
                            <button
                                key={player.user_id}
                                className="player-card"
                                onClick={() => openTransaction('toPlayer', player.user_id)}
                                disabled={isBankrupt}
                            >
                                <Avatar user={player} size={48} />
                                <span className="player-name">{player.name}</span>
                                <span className="send-icon">
                                    <Send size={16} />
                                    {t('send')}
                                </span>
                            </button>
                        ))}

                    {game.players.filter(p => p.user_id !== user.id && !p.bankrupt_timestamp).length === 0 && (
                        <div className="empty-state">
                            <p>{t('no_other_players')}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Otopark Bilgisi (Opsiyonel) */}
            {game.enable_free_parking && (
                <div className="parking-card fade-in-up">
                    <div className="parking-info">
                        <div className="parking-label">{t('free_parking_balance')}</div>
                        <div className="parking-amount">${freeParkingBalance.toLocaleString()}</div>
                    </div>
                    <button
                        className="btn btn-small btn-outline"
                        onClick={() => openTransaction('fromFreeParking')}
                        disabled={isBankrupt}
                    >
                        {t('collect')}
                    </button>
                </div>
            )}


            {/* Modallar */}

            {showHistory && (
                <div className="modal-overlay" onClick={() => setShowHistory(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">{t('last_transactions')}</h2>
                            <button onClick={() => setShowHistory(false)} className="btn btn-small btn-ghost">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="history-list">
                            {transactions.length > 0 ? (
                                [...transactions].slice(0, 20).map((tx, idx) => (
                                    <div key={idx} className="history-item">
                                        <div className="history-icon">
                                            <ArrowRightLeft size={16} />
                                        </div>
                                        <div className="history-details">
                                            <div className="history-desc">
                                                {getTransactionDesc(tx)}
                                            </div>
                                            <div className="history-time">
                                                {formatTime(tx.created_at)}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="empty-text">{t('no_transactions')}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {confirmEndGame && (
                <div className="modal-overlay" onClick={() => setConfirmEndGame(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">{t('end_game')}?</h2>
                        </div>
                        <div className="modal-body">
                            <p>{t('end_game_confirm')}</p>
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-outline flex-1" onClick={() => setConfirmEndGame(false)}>{t('cancel')}</button>
                            <button className="btn btn-danger flex-1" onClick={handleEndGame}>{t('end_game')}</button>
                        </div>
                    </div>
                </div>
            )}

            {showTransactionModal && (
                <TransactionModal
                    game={game}
                    currentPlayer={currentPlayer}
                    initialConfig={transactionConfig}
                    onClose={() => {
                        setShowTransactionModal(false);
                        setTransactionConfig(null);
                        // Force-refresh game data so the balance updates immediately
                        // even if the realtime channel is slow.
                        refreshGameData(gameId);
                    }}
                />
            )}

            {showGameEndModal && game.winner_id && (
                <GameEndModal
                    game={game}
                    currentPlayer={currentPlayer}
                    winner={game.players.find(p => p.user_id === game.winner_id) || { name: t('unknown'), user_id: game.winner_id }}
                    onClose={() => setShowGameEndModal(false)}
                    onLeaveGame={handleLeaveGame}
                />
            )}
        </div>
    );
}
