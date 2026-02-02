import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

/**
 * Mevcut bir oyuna 4 haneli kod ile katılmayı sağlayan modal.
 */
export default function JoinGameModal({ onClose }) {
    const { user } = useAuthStore();
    const { joinGame } = useGameStore();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [gameId, setGameId] = useState('');
    const [loading, setLoading] = useState(false);

    /**
     * Kod ile oyuna katılma işlemini başlatır.
     */
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validasyon
        if (!gameId.trim()) {
            toast.error(t('enter_game_code'));
            return;
        }

        setLoading(true);
        const result = await joinGame(gameId.trim(), user.id);
        setLoading(false);

        if (result.success) {
            toast.success(t('join_success') || 'Oyuna katıldınız!');
            // Katılınan oyunun sayfasına yönlendir
            navigate(`/game/${gameId.toUpperCase()}`);
        } else {
            toast.error(result.error || t('join_error'));
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">{t('join_game')}</h2>
                    <button onClick={onClose} className="btn btn-small btn-ghost">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Oyun Kodu Girişi */}
                    <div className="form-group">
                        <label className="form-label">{t('game_code')}</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder={t('game_code_placeholder')}
                            value={gameId}
                            onChange={(e) => setGameId(e.target.value.toUpperCase())}
                            maxLength={4}
                            style={{
                                textAlign: 'center',
                                fontSize: '1.5rem',
                                fontWeight: '600',
                                letterSpacing: '0.25em'
                            }}
                            autoFocus
                            required
                        />
                        <p className="text-sm text-secondary mt-2">
                            {t('get_code_note')}
                        </p>
                    </div>

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
                            className="btn btn-secondary flex-1"
                            disabled={loading || !gameId.trim()}
                        >
                            {loading ? t('joining') : t('join')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

