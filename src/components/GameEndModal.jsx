import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Clock, Share2, Home } from 'lucide-react';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

export default function GameEndModal({ game, currentPlayer, winner, onClose, onLeaveGame }) {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const isWinner = winner.user_id === currentPlayer.user_id;

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
        if (!game.starting_timestamp) return `0${t('seconds_short')}`;

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

    const bankruptMessage = () => {
        if (!currentPlayer.bankrupt_timestamp || !game.starting_timestamp) return null;

        const bankruptTime = new Date(currentPlayer.bankrupt_timestamp);
        const start = new Date(game.starting_timestamp);
        const diffMs = bankruptTime - start;

        const hours = Math.floor(diffMs / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);
        const seconds = Math.floor((diffMs % 60000) / 1000);

        if (hours > 0) {
            return `${hours}${t('hours')} ${minutes}${t('minutes')} sonra iflas`;
        } else if (minutes > 0) {
            return `${minutes}${t('minutes')} ${seconds}sn sonra iflas`;
        }
        return `${seconds}sn sonra iflas`;
    };

    const handleShare = async () => {
        const message = isWinner
            ? `🏆 Monopoly oyununda kazandım! Oyun süresi: ${gameDuration()}`
            : `🎮 Monopoly oynadım! ${winner.name} kazandı. Oyun süresi: ${gameDuration()}`;
        // Translation for share message is tricky because social apps might expect local lang.
        // Keeping it simple or hardcoded might be safer unless we want to fully localize share text too.
        // Let's keep existing logic but maybe localized string if possible.
        // But 'gameDuration' returns localized string now.

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
        <div className="modal-overlay game-end-overlay">
            <div className="modal-content game-end-modal" onClick={(e) => e.stopPropagation()}>
                <div className="trophy-icon">
                    <Trophy size={80} color={isWinner ? '#FFD700' : '#90A4AE'} />
                </div>

                <h2 className="game-end-title">
                    {isWinner ? t('winner_is_you') || 'Oyunu kazandınız!' : t('winner_is_player', { name: winner.name }) || `${winner.name} oyunu kazandı!`}
                </h2>

                {!isWinner && currentPlayer.bankrupt_timestamp && (
                    <div className="bankruptcy-badge">
                        <span className="bankruptcy-icon">💸</span>
                        <span>{bankruptMessage()}</span>
                    </div>
                )}

                <div className="game-stats">
                    <div className="stat-item">
                        <Clock size={20} />
                        <span>{t('play_time')}: {gameDuration()}</span>
                    </div>
                </div>

                <div className="game-end-message">
                    {t('game_end_desc') || 'Diğer tüm oyuncular iflas etti.'}
                </div>

                <div className="modal-actions">
                    <button className="btn btn-outline flex-1" onClick={handleShare}>
                        <Share2 size={18} />
                        {t('share') || 'Paylaş'}
                    </button>
                    <button className="btn btn-primary flex-1" onClick={handleGoHome}>
                        <Home size={18} />
                        {t('return_home')}
                    </button>
                </div>
            </div>
        </div>
    );
}


