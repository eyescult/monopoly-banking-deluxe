import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Clock, Share2, Home, Building2, Banknote, UserRound } from 'lucide-react';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { usePropertyStore, getGroupColor } from '../store/propertyStore';
import { estimatePropertyWorth } from '../services/rentEngine';
import Avatar from './Avatar';

export default function GameEndModal({ game, currentPlayer, winner, onClose, onLeaveGame }) {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const properties = usePropertyStore(state => state.properties);

    // Calculate scoreboard automatically matching the Premium Net-Worth ranking methodology
    const scoreboard = useMemo(() => {
        const board = game.players.map(p => {
            const playerProps = properties.filter(prop => prop.owner_id === p.user_id);
            let assetsValue = 0;
            playerProps.forEach(prop => {
                assetsValue += estimatePropertyWorth(prop);
            });
            const isBankrupt = !!p.bankrupt_timestamp;
            const netWorth = isBankrupt ? 0 : p.balance + assetsValue;

            return {
                ...p,
                assetsValue,
                netWorth,
                isBankrupt
            };
        });

        // Sort descending by Net Worth.
        return board.sort((a, b) => b.netWorth - a.netWorth);
    }, [game.players, properties]);

    // Override local isWinner using Scoreboard array safely.
    const actualWinner = scoreboard[0];
    const isWinner = actualWinner.user_id === currentPlayer.user_id;

    useEffect(() => {
        if (isWinner) {
            const duration = 3000;
            const end = Date.now() + duration;

            const frame = () => {
                confetti({
                    particleCount: 3,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: ['#2196F3', '#4CAF50', '#FFEB3B', '#FF9800', '#F44336']
                });
                confetti({
                    particleCount: 3,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: ['#2196F3', '#4CAF50', '#FFEB3B', '#FF9800', '#F44336']
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            };
            frame();
        }
    }, [isWinner]);

    const gameDuration = () => {
        if (!game.starting_timestamp) return `0${t('seconds_short') || 's'}`;

        const start = new Date(game.starting_timestamp);
        const end = game.ending_timestamp ? new Date(game.ending_timestamp) : new Date();
        const diffMs = end - start;

        const hours = Math.floor(diffMs / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);
        const seconds = Math.floor((diffMs % 60000) / 1000);

        if (hours > 0) {
            return `${hours}${t('hours')} ${minutes}${t('minutes')}`;
        } else if (minutes > 0) {
            return `${minutes}${t('minutes')} ${seconds}sn`;
        }
        return `${seconds}sn`;
    };

    const handleShare = async () => {
        const message = isWinner
            ? `🏆 Monopoly: I won with a Net Worth of $${actualWinner.netWorth.toLocaleString()}! Game time: ${gameDuration()}`
            : `🎮 Monopoly: ${actualWinner.name} won with a Net Worth of $${actualWinner.netWorth.toLocaleString()}! Game time: ${gameDuration()}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Monopoly --Banking Deluxe-',
                    text: message
                });
            } catch {
                console.log('Share cancelled');
            }
        } else {
            navigator.clipboard.writeText(message);
            toast.success(t('copied') || 'Mesaj kopyalandı!');
        }
    };

    const handleGoHome = async () => {
        const result = await onLeaveGame();
        if (result.success) {
            onClose();
            navigate('/');
        } else {
            toast.error(t('leave_error') || 'Oyundan çıkış yapılamadı');
        }
    };

    return (
        <div className="modal-overlay game-end-overlay" style={{ backdropFilter: 'blur(10px)', alignContent: 'center' }}>
            <div className="modal-content game-end-modal premium-glass-card" onClick={(e) => e.stopPropagation()} style={{ 
                maxWidth: '700px', 
                width: '95%',
                padding: '24px 32px',
                background: 'linear-gradient(145deg, rgba(30, 30, 40, 0.9) 0%, rgba(15, 15, 20, 0.95) 100%)',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div className="trophy-icon" style={{ 
                        background: isWinner ? 'rgba(255, 215, 0, 0.15)' : 'rgba(144, 164, 174, 0.1)',
                        padding: '16px',
                        borderRadius: '50%',
                        boxShadow: isWinner ? '0 0 30px rgba(255, 215, 0, 0.4)' : 'none',
                        marginBottom: '1rem'
                    }}>
                        <Trophy size={64} color={isWinner ? '#FFD700' : '#90A4AE'} />
                    </div>

                    <h2 className="game-end-title" style={{ textAlign: 'center', fontSize: '1.8rem', marginBottom: '0.5rem', color: isWinner ? '#FFD700' : 'white' }}>
                        {isWinner 
                            ? (t('winner_announcement')?.replace('{{name}}', currentPlayer.name) || `Congratulations, ${currentPlayer.name}! You win!`) 
                            : (t('winner_is_player', { name: actualWinner.name }) || `${actualWinner.name} wins!`)}
                    </h2>
                    
                    <div className="stat-item" style={{ color: 'rgba(255,255,255,0.6)', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.9rem' }}>
                        <Clock size={16} />
                        <span>{t('play_time') || 'Süre'}: {gameDuration()}</span>
                    </div>
                </div>

                <div className="scoreboard-container" style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.8)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '12px' }}>
                        {t('scoreboard') || 'Scoreboard'}
                    </h3>
                    
                    <div className="scoreboard-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {scoreboard.map((p, index) => (
                            <div key={p.user_id} className={`scoreboard-row ${p.user_id === currentPlayer.user_id ? 'is-me' : ''}`} style={{
                                display: 'grid',
                                gridTemplateColumns: '40px 1fr 100px 100px 120px',
                                gap: '10px',
                                alignItems: 'center',
                                background: p.isBankrupt ? 'rgba(244, 67, 54, 0.05)' : (index === 0 ? 'rgba(255, 215, 0, 0.05)' : 'rgba(255, 255, 255, 0.03)'),
                                padding: '12px',
                                borderRadius: '12px',
                                border: index === 0 ? '1px solid rgba(255, 215, 0, 0.3)' : '1px solid rgba(255,255,255,0.05)',
                                opacity: p.isBankrupt ? 0.6 : 1
                            }}>
                                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: index === 0 ? '#FFD700' : 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                                    #{index + 1}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                                    <Avatar user={p} size={32} />
                                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 'bold' }}>
                                        {p.name}
                                        {p.isBankrupt && <span style={{ fontSize: '0.7rem', color: '#F44336', marginLeft: '6px' }}>({t('bankrupt') || 'Bankrupt'})</span>}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>{t('cash') || 'Cash'}</span>
                                    <span style={{ fontFamily: 'monospace', fontWeight: '500' }}>${p.balance >= 1000000 ? (p.balance / 1000000).toFixed(1) + 'M' : p.balance.toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                                    <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>{t('assets') || 'Assets'}</span>
                                    <span style={{ fontFamily: 'monospace', fontWeight: '500' }}>${p.assetsValue >= 1000000 ? (p.assetsValue / 1000000).toFixed(1) + 'M' : p.assetsValue.toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', background: index === 0 ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px' }}>
                                    <span style={{ fontSize: '0.7rem', color: index === 0 ? '#FFD700' : 'rgba(255,255,255,0.7)', textTransform: 'uppercase', fontWeight: 'bold' }}>{t('net_worth') || 'Total'}</span>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1.1rem', color: index === 0 ? '#FFD700' : 'white' }}>${p.netWorth >= 1000000 ? (p.netWorth / 1000000).toFixed(1) + 'M' : p.netWorth.toLocaleString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="modal-actions" style={{ marginTop: '24px' }}>
                    <button className="btn btn-outline flex-1" onClick={handleShare}>
                        <Share2 size={18} />
                        {t('share') || 'Paylaş'}
                    </button>
                    <button className="btn btn-primary flex-1" onClick={handleGoHome}>
                        <Home size={18} />
                        {t('return_home') || 'Ana Sayfa'}
                    </button>
                </div>
            </div>
            
            {/* Embedded styles for mobile responsive grid */}
            <style dangerouslySetInnerHTML={{__html: `
                @media (max-width: 600px) {
                    .scoreboard-row {
                        grid-template-columns: 30px 1fr !important;
                        grid-template-rows: auto auto auto;
                        padding: 16px !important;
                    }
                    .scoreboard-row > div:nth-child(3),
                    .scoreboard-row > div:nth-child(4) {
                        display: flex !important;
                        flex-direction: row !important;
                        justify-content: space-between !important;
                        grid-column: 1 / -1;
                        border-top: 1px solid rgba(255,255,255,0.05);
                        padding-top: 8px;
                        margin-top: 8px;
                    }
                    .scoreboard-row > div:nth-child(5) {
                        display: flex !important;
                        flex-direction: row !important;
                        justify-content: space-between !important;
                        grid-column: 1 / -1;
                        margin-top: 8px;
                    }
                }
            `}} />
        </div>
    );
}
