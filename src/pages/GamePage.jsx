import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { usePropertyStore, getGroupColor, getPropertyIcon } from '../store/propertyStore';
import { calculateRent, isUtility } from '../services/rentEngine';
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
    const user = useAuthStore(state => state.user);
    const { t, i18n } = useTranslation();

    const game = useGameStore(state => state.currentGame);
    const subscribeToGame = useGameStore(state => state.subscribeToGame);
    const leaveGame = useGameStore(state => state.leaveGame);
    const endGame = useGameStore(state => state.endGame);
    const bankruptPlayer = useGameStore(state => state.bankruptPlayer);
    const refreshGameData = useGameStore(state => state.refreshGameData);

    // Property store for inline buy
    const properties = usePropertyStore(state => state.properties);
    const initProperties = usePropertyStore(state => state.initForLegacyGame);
    const buyProperty = usePropertyStore(state => state.buyProperty);
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
     * Oyuna bağlanma ve verileri getirme.
     */
    useEffect(() => {
        if (!user?.id || !gameId) return;

        let subscription = null;
        let isMounted = true;

        const connect = async () => {
            try {
                // Parallelize initialization to avoid sequential hangs
                const [subResult] = await Promise.all([
                    subscribeToGame(gameId),
                    initProperties(gameId, user.id, user.name || 'Guest')
                ]);
                
                if (isMounted) {
                    setInitialLoading(false);
                    if (!subResult?.success) {
                        toast.error(subResult?.error || t('game_connect_error'));
                        // Don't navigate away immediately, give it a chance
                    }
                }
            } catch (err) {
                console.error('Initialization error:', err);
                if (isMounted) setInitialLoading(false);
            }
        };

        connect();

        return () => {
            isMounted = false;
            // The store handles channel removal, but we can also manually call unsubscribe if we captured it:
            if (subscription) {
                // However, since we parallelized it and subResult is scoped in the try block,
                // we should rely on the store's cleanup or just unsubscribe here if we track it.
                // We'll leave it to the store.
            }
        };
    }, [user?.id, gameId, subscribeToGame, initProperties]);

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


    const myProperties = useMemo(
        () => {
            if (!user?.id) return [];
            return properties.filter(p => p.owner_id === user.id).sort((a, b) => a.position - b.position);
        },
        [properties, user?.id]
    );

    // Loading screen
    if (initialLoading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>{t('connecting')}</p>
            </div>
        );
    }

    // Game not found screen
    if (!game) {
        return (
            <div className="error-screen">
                <h2>{t('game_not_found_title') || 'Game Not Found'}</h2>
                <p>{t('game_not_found_desc') || 'The game code you entered does not exist or has been deleted.'}</p>
                <button className="btn btn-primary" onClick={async () => {
                    await useAuthStore.getState().setCurrentGameId(null);
                    navigate('/');
                }}>
                    {t('return_home')}
                </button>
            </div>
        );
    }

    const currentPlayer = game.players.find(p => p.user_id === user?.id);
    const isHost = game.created_by === user?.id;
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

    const isBankrupt = !!currentPlayer.bankrupt_timestamp;

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
        const locale = i18n.language === 'en' ? 'en-US' : i18n.language === 'de' ? 'de-DE' : 'tr-TR';
        return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
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



    return (
        <div className={`game-page premium-bg ${isBankrupt ? 'bankrupt-mode' : ''}`}>
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
                    <div className="language-options" style={{ paddingLeft: '44px', display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <button
                            className={`btn btn-small ${i18n.language === 'de' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => changeLanguage('de')}
                            style={{ flex: 1 }}
                        >
                            {t('german')}
                        </button>
                        <button
                            className={`btn btn-small ${i18n.language === 'en' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => changeLanguage('en')}
                            style={{ flex: 1 }}
                        >
                            {t('english')}
                        </button>
                        <button
                            className={`btn btn-small ${i18n.language === 'tr' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => changeLanguage('tr')}
                            style={{ flex: 1 }}
                        >
                            {t('turkish')}
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
            <div className="balance-section premium-glass-card fade-in" style={{ animation: 'float 6s ease-in-out infinite' }}>
                <div className="section-header" style={{ justifyContent: 'center', marginBottom: '8px' }}>{t('current_balance')}</div>
                <div className="main-balance">
                    ${currentPlayer.balance.toLocaleString()}
                </div>
            </div>

            {/* Owned Properties Scroll (Overview) */}
            {myProperties.length > 0 && (
                <div className="owned-properties-section fade-in-up" style={{ margin: '0 16px 24px 16px' }}>
                    <div className="section-header" style={{ marginBottom: '12px' }}>
                        <h3>{t('my_properties')}</h3>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{myProperties.length} {t('prop_owned_suffix')}</span>
                    </div>
                    <div className="horizontal-scroll" style={{ 
                        display: 'flex', 
                        overflowX: 'auto', 
                        gap: '12px', 
                        paddingBottom: '8px',
                        scrollbarWidth: 'none' // Firefox
                    }}>
                        {myProperties.map(property => {
                            const bandColor = getGroupColor(property.group_name);
                            const rentLabel = isUtility(property) ? 'Dice x' + (myProperties.filter(p => p.group_name === 'Mediacenters').length > 1 ? '10' : '4') + '*' : `$${calculateRent(property, properties).toLocaleString()}`;
                            return (
                                <div 
                                    key={property.id} 
                                    className="premium-glass-card" 
                                    style={{ 
                                        minWidth: '130px', 
                                        padding: '12px', 
                                        borderRadius: 'var(--radius-md)', 
                                        borderTop: `4px solid ${bandColor}`,
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => navigate('/properties')}
                                >
                                    <div style={{ fontSize: '0.9rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {property.name}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                        {t('prop_rent_label')} <strong style={{color: 'var(--text-primary)'}}>{rentLabel}</strong>
                                    </div>
                                    {(property.houses > 0 || property.is_hotel) && (
                                        <div style={{ marginTop: '6px', display: 'flex', gap: '2px' }}>
                                            {property.is_hotel ? (
                                                <span title="Hotel" style={{ fontSize: '12px' }}>🏨</span>
                                            ) : (
                                                Array.from({ length: property.houses }).map((_, i) => (
                                                    <span key={i} title="House" style={{ fontSize: '10px' }}>🏠</span>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Hızlı İşlemler */}
            <div className="quick-actions fade-in-up" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '0 16px', marginBottom: '24px' }}>
                <button
                    className="premium-action-btn success-btn"
                    onClick={() => openTransaction('fromBank')}
                    disabled={isBankrupt}
                >
                    <div className="premium-action-icon">
                        <DollarSign size={24} />
                    </div>
                    <span>{t('withdraw_bank')}</span>
                </button>

                <button
                    className="premium-action-btn warning-btn"
                    onClick={() => openTransaction('fromSalary')}
                    disabled={isBankrupt}
                >
                    <div className="premium-action-icon">
                        <DollarSign size={24} />
                    </div>
                    <span>{t('salary_receive')}</span>
                </button>

                <button
                    className="premium-action-btn danger-btn"
                    onClick={() => openTransaction('toBank')}
                    disabled={isBankrupt}
                >
                    <div className="premium-action-icon">
                        <DollarSign size={24} />
                    </div>
                    <span>{t('pay_bank')}</span>
                </button>

                {game.enable_free_parking && (
                    <button
                        className="premium-action-btn info-btn"
                        onClick={() => openTransaction('toFreeParking')}
                        disabled={isBankrupt}
                    >
                        <div className="premium-action-icon">
                            <DollarSign size={24} />
                        </div>
                        <span>{t('pay_parking')}</span>
                    </button>
                )}

                <button className="premium-action-btn secondary-btn" onClick={() => navigate('/properties')}>
                    <div className="premium-action-icon"><Home size={24} /></div>
                    <span>{t('properties') || 'Properties'}</span>
                </button>
                
                <button className="premium-action-btn secondary-btn" onClick={() => navigate('/trades')}>
                    <div className="premium-action-icon"><ArrowRightLeft size={24} /></div>
                    <span>{t('trades') || 'Trades'}</span>
                </button>
            </div>



            <div className="players-section fade-in-up" style={{ padding: '0 16px', marginBottom: '24px' }}>
                <div className="section-header" style={{ marginBottom: '12px' }}>
                    <h3>{t('transfer_to_player')}</h3>
                </div>
                <div className="players-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
                    {game.players
                        .filter(p => p.user_id !== user.id && !p.bankrupt_timestamp)
                        .map(player => (
                            <button
                                key={player.user_id}
                                className="premium-action-btn"
                                style={{ padding: '16px 8px' }}
                                onClick={() => openTransaction('toPlayer', player.user_id)}
                                disabled={isBankrupt}
                            >
                                <Avatar user={player} size={48} showBorder={true} />
                                <span className="player-name" style={{ fontSize: '0.9rem', marginTop: '4px' }}>{player.name}</span>
                                <span className="send-icon" style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)' }}>
                                    <Send size={14} />
                                    {t('send')}
                                </span>
                            </button>
                        ))}

                    {game.players.filter(p => p.user_id !== user.id && !p.bankrupt_timestamp).length === 0 && (
                        <div className="empty-state premium-glass-card" style={{ gridColumn: '1 / -1', padding: '24px', textAlign: 'center' }}>
                            <p>{t('no_other_players')}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Otopark Bilgisi (Opsiyonel) */}
            {game.enable_free_parking && (
                <div className="parking-card premium-glass-card fade-in-up" style={{ margin: '0 16px 24px 16px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="parking-info">
                        <div className="parking-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{t('free_parking_balance')}</div>
                        <div className="parking-amount" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>${freeParkingBalance.toLocaleString()}</div>
                    </div>
                    <button
                        className="btn btn-outline"
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
