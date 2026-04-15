import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';

// Oyuncu renk paleti
const PLAYER_COLORS = [
    '#2196F3', // Mavi
    '#009688', // Teal
    '#4CAF50', // Yeşil
    '#FFEB3B', // Sarı
    '#FF9800', // Turuncu
    '#F44336', // Kırmızı
];

const MAX_PLAYERS = 6;

/**
 * Oyun mantığı ve durumu (state) yönetimi için Zustand store.
 * Oyun oluşturma, katılma, para transferleri ve gerçek zamanlı güncellemeleri yönetir.
 */
export const useGameStore = create((set, get) => ({
    currentGame: null,      // Aktif oyun verisi
    currentGameId: null,    // Aktif oyun ID'si (reconnection için)
    games: [],              // (Kullanılmıyor olabilir, genel oyun listesi için)
    loading: false,          // İşlem yüklenme durumu
    realtimeChannel: null,  // Supabase realtime kanal referansı
    isPageVisible: true,    // Sayfa görünürlük durumu (ekran açık/kapalı)


    /**
     * Rastgele 4 haneli benzersiz oyun ID'si üretir.
     */
    generateGameId: () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 4; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },

    /**
     * Yeni bir oyun oluşturur ve kurucuyu oyuna dahil eder.
     */
    createGame: async (settings, userId) => {
        try {
            set({ loading: true });

            let gameId = get().generateGameId();

            // Benzersiz bir ID bulana kadar döngü (çakışma kontrolü)
            let exists = true;
            while (exists) {
                const { data } = await supabase
                    .from('games')
                    .select('id')
                    .eq('id', gameId)
                    .maybeSingle();

                if (!data) {
                    exists = false;
                } else {
                    gameId = get().generateGameId();
                }
            }

            // Oyun kaydını oluştur
            const { error } = await supabase
                .from('games')
                .insert({
                    id: gameId,
                    starting_capital: settings.startingCapital,
                    salary: settings.salary,
                    enable_free_parking: settings.enableFreeParking,
                    free_parking_money: 0,
                    players: [],
                    transaction_history: [],
                    starting_timestamp: null,
                    winner_id: null
                })
                .select()
                .single();

            if (error) throw error;

            // Kurucuyu otomatik olarak oyuna dahil et
            await get().joinGame(gameId, userId, true);

            set({ loading: false });
            return { success: true, gameId };
        } catch (error) {
            console.error('Create game error:', error);
            set({ loading: false });
            return { success: false, error: error.message };
        }
    },

    /**
     * Var olan bir oyuna katılır.
     */
    joinGame: async (gameId, userId, isCreator = false) => {
        try {
            set({ loading: true });

            // Oyun verilerini getir
            const { data: game, error: gameError } = await supabase
                .from('games')
                .select('*')
                .eq('id', gameId.toUpperCase())
                .single();

            if (gameError || !game) {
                set({ loading: false });
                return { success: false, error: 'Oyun bulunamadı' };
            }

            // Kullanıcı verilerini getir
            const { data: user } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (!user) {
                set({ loading: false });
                return { success: false, error: 'Kullanıcı bulunamadı' };
            }

            // Oyuncu zaten oyunda mı?
            const playerExists = game.players.some(p => p.user_id === userId);

            if (!playerExists) {
                // Oyun başlamış mı?
                if (game.starting_timestamp) {
                    set({ loading: false });
                    return { success: false, error: 'Oyun zaten başlamış' };
                }

                // Kapasite kontrolü
                if (game.players.length >= MAX_PLAYERS) {
                    set({ loading: false });
                    return { success: false, error: 'Oyun dolu (maksimum 6 oyuncu)' };
                }

                // Yeni oyuncu objesi
                const newPlayer = {
                    user_id: userId,
                    name: user.name,
                    balance: game.starting_capital,
                    color: PLAYER_COLORS[game.players.length],
                    bankrupt_timestamp: null,
                    is_game_creator: isCreator
                };

                const updatedPlayers = [...game.players, newPlayer];

                // Veritabanını güncelle
                const { error: updateError } = await supabase
                    .from('games')
                    .update({ players: updatedPlayers })
                    .eq('id', gameId.toUpperCase());

                if (updateError) throw updateError;
            }

            // Kullanıcının aktif oyun ID'sini güncelle
            const currentUser = useAuthStore.getState().user;
            if (currentUser && currentUser.id === userId) {
                await useAuthStore.getState().setCurrentGameId(gameId.toUpperCase());
            } else {
                await supabase
                    .from('users')
                    .update({ current_game_id: gameId.toUpperCase() })
                    .eq('id', userId);
            }

            // Realtime dinleyiciye abone ol
            get().subscribeToGame(gameId.toUpperCase());

            set({ loading: false });
            return { success: true };
        } catch (error) {
            console.error('Join game error:', error);
            set({ loading: false });
            return { success: false, error: error.message };
        }
    },

    /**
     * Supabase Realtime ile oyun güncellemelerini canlı olarak dinler.
     * Bağlantı durumunu izler ve gerektiğinde yeniden bağlanmayı tetikler.
     */
    subscribeToGame: async (gameId) => {
        const currentChannel = get().realtimeChannel;
        if (currentChannel) {
            supabase.removeChannel(currentChannel);
        }

        const channel = supabase
            .channel(`game:${gameId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'games',
                    filter: `id=eq.${gameId}`
                },
                (payload) => {
                    if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
                        set({ currentGame: payload.new });
                    } else if (payload.eventType === 'DELETE') {
                        set({ currentGame: null });
                    }
                }
            )
            .subscribe((status) => {
                // Bağlantı durumunu konsole yaz (debug amaçlı)
                console.log(`[Realtime] Channel status: ${status}`);

                if (status === 'SUBSCRIBED') {
                    // Yeni abone olduğumuzda güncel veriyi çek
                    get().refreshGameData(gameId);
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    // Bağlantı hatası - yeniden dene
                    console.warn('[Realtime] Connection error, will retry...');
                }
            });

        set({ realtimeChannel: channel, currentGameId: gameId });

        // İlk veriyi çek
        await get().refreshGameData(gameId);
        return { success: true, subscription: channel };
    },

    /**
     * Oyun verisini Supabase'den taze olarak çeker.
     * Visibility change veya reconnection durumlarında kullanılır.
     */
    refreshGameData: async (gameId) => {
        const targetGameId = gameId || get().currentGameId;
        if (!targetGameId) return;

        try {
            const { data, error } = await supabase
                .from('games')
                .select('*')
                .eq('id', targetGameId)
                .single();

            if (!error && data) {
                set({ currentGame: data, error: null });
            } else if (error) {
                console.error('Refresh game data error:', error);
                set({ error: error.message });
            }
        } catch (err) {
            console.error('[GameStore] Failed to refresh game data:', err);
        }
    },



    /**
     * Sayfa görünürlük durumunu ayarlar.
     * Ekran kapandığında işlemleri durdurur, açıldığında devam ettirir.
     */
    setPageVisibility: (isVisible) => {
        set({ isPageVisible: isVisible });

        if (isVisible) {
            // Sadece logla, işlem yapma (GamePage reload edecek)
            console.log('[Visibility] Page visible');
        } else {
            console.log('[Visibility] Page hidden');
        }
    },



    /**
     * Mevcut oyunu terk eder.
     */
    leaveGame: async (...args) => {
        try {
            const userId = args.length > 1 ? args[1] : args[0];
            const currentGame = get().currentGame;
            if (!currentGame) return { success: false, error: 'Oyun bulunamadı' };

            const player = currentGame.players.find(p => p.user_id === userId);
            if (!player) return { success: true };

            // Son oyuncu ise veya oyun bitmediyse para işlemleri yapılır
            if (currentGame.players.length === 1) {
                await supabase.from('games').delete().eq('id', currentGame.id);
            } else if (!currentGame.winner_id && !player.bankrupt_timestamp) {
                // Çıkan oyuncunun parası bankaya döner
                await get().makeTransaction({
                    gameId: currentGame.id,
                    type: 'toBank',
                    amount: player.balance,
                    fromUserId: userId
                });
            }

            // Kullanıcı profilindeki oyun ID'sini temizle
            const currentUser = useAuthStore.getState().user;
            if (currentUser && currentUser.id === userId) {
                await useAuthStore.getState().setCurrentGameId(null);
            } else {
                await supabase
                    .from('users')
                    .update({ current_game_id: null })
                    .eq('id', userId);
            }

            // Kanaldan ayrıl
            const channel = get().realtimeChannel;
            if (channel) {
                supabase.removeChannel(channel);
            }

            set({ currentGame: null, realtimeChannel: null });
            return { success: true };
        } catch (error) {
            console.error('Leave game error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Oyunu tamamlandı olarak işaretler.
     */
    endGame: async (gameId) => {
        try {
            const currentGame = get().currentGame;
            const activeGameId = gameId || currentGame?.id;
            if (!activeGameId) {
                return { success: false, error: 'Oyun bulunamadı' };
            }

            const players = currentGame?.players || [];
            const activePlayers = players.filter(player => !player.bankrupt_timestamp);
            const winnerId =
                activePlayers.length === 1
                    ? activePlayers[0].user_id
                    : currentGame?.winner_id || players[0]?.user_id || null;

            const { error } = await supabase
                .from('games')
                .update({
                    winner_id: winnerId,
                    ending_timestamp: new Date().toISOString()
                })
                .eq('id', activeGameId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('End game error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Oyuncuyu iflas ettirir ve gerekirse kazananı belirler.
     */
    bankruptPlayer: async (gameId, userId) => {
        try {
            const currentGame = get().currentGame;
            const activeGameId = gameId || currentGame?.id;
            if (!currentGame || !activeGameId) {
                return { success: false, error: 'Oyun bulunamadı' };
            }

            const timestamp = new Date().toISOString();
            const players = currentGame.players.map(player =>
                player.user_id === userId && !player.bankrupt_timestamp
                    ? { ...player, bankrupt_timestamp: timestamp }
                    : player
            );

            const nonBankruptPlayers = players.filter(player => !player.bankrupt_timestamp);
            const winnerId =
                nonBankruptPlayers.length === 1 && players.length > 1
                    ? nonBankruptPlayers[0].user_id
                    : currentGame.winner_id;
            const endingTimestamp = winnerId ? timestamp : currentGame.ending_timestamp;

            const { error } = await supabase
                .from('games')
                .update({
                    players,
                    winner_id: winnerId,
                    ending_timestamp: endingTimestamp
                })
                .eq('id', activeGameId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Bankrupt player error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Oyunu resmen başlatır.
     */
    startGame: async (gameId) => {
        try {
            const { error } = await supabase
                .from('games')
                .update({ starting_timestamp: new Date().toISOString() })
                .eq('id', gameId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Start game error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Para transfer işlemlerini gerçekleştirir.
     * Banka, Ücretsiz Otopark ve Oyuncular arası transferleri yönetir.
     * Sayfa gizli ise işlemi sıraya alır.
     * Ağ hatalarına karşı retry mekanizması içerir.
     */
    makeTransaction: async ({ gameId, type, amount, fromUserId = null, toUserId = null }) => {
        // Direkt DOM kontrolü yap (Store state'i gecikebilir)
        const isHidden = document.visibilityState === 'hidden';

        if (isHidden) {
            // Sayfa gizliyse işlem yapma, hata dön (UI zaten reload edecek)
            return { success: false, error: 'Ekran kapalıyken işlem yapılamaz' };
        }

        // Retry mekanizması ile işlemi dene
        let attempt = 0;
        const maxRetries = 3;

        while (attempt < maxRetries) {
            try {
                attempt++;
                if (attempt > 1) console.log(`[Transaction] Retry attempt ${attempt}/${maxRetries}...`);

                const { data: game, error: fetchError } = await supabase
                    .from('games')
                    .select('*')
                    .eq('id', gameId)
                    .single();

                if (fetchError || !game) {
                    throw new Error('Oyun bulunamadı');
                }

                // İflas kontrolü
                if (fromUserId) {
                    const fromPlayer = game.players.find(p => p.user_id === fromUserId);
                    if (fromPlayer?.bankrupt_timestamp) {
                        throw new Error('İflas eden oyuncu para gönderemez');
                    }
                }

                if (toUserId) {
                    const toPlayer = game.players.find(p => p.user_id === toUserId);
                    if (toPlayer?.bankrupt_timestamp) {
                        throw new Error('İflas eden oyuncuya para gönderilemez');
                    }
                }

                const timestamp = new Date().toISOString();
                let updatedPlayers = [...game.players];
                let updatedFreeParkingMoney = game.free_parking_money;

                // İşlem tipine göre bakiyeleri güncelle
                switch (type) {
                    case 'fromBank':
                        if (!toUserId) throw new Error('Alıcı belirtilmedi');
                        updatedPlayers = updatedPlayers.map(p =>
                            p.user_id === toUserId ? { ...p, balance: p.balance + amount } : p
                        );
                        break;
                    case 'toBank':
                        if (!fromUserId) throw new Error('Gönderen belirtilmedi');
                        updatedPlayers = updatedPlayers.map(p =>
                            p.user_id === fromUserId ? { ...p, balance: p.balance - amount } : p
                        );
                        break;
                    case 'toPlayer':
                        if (!fromUserId || !toUserId) throw new Error('Gönderen veya alıcı belirtilmedi');
                        updatedPlayers = updatedPlayers.map(p => {
                            if (p.user_id === fromUserId) return { ...p, balance: p.balance - amount };
                            else if (p.user_id === toUserId) return { ...p, balance: p.balance + amount };
                            return p;
                        });
                        break;
                    case 'toFreeParking':
                        if (!fromUserId) throw new Error('Gönderen belirtilmedi');
                        updatedPlayers = updatedPlayers.map(p =>
                            p.user_id === fromUserId ? { ...p, balance: p.balance - amount } : p
                        );
                        updatedFreeParkingMoney += amount;
                        break;
                    case 'fromFreeParking':
                        if (!toUserId) throw new Error('Alıcı belirtilmedi');
                        updatedPlayers = updatedPlayers.map(p =>
                            p.user_id === toUserId ? { ...p, balance: p.balance + updatedFreeParkingMoney } : p
                        );
                        updatedFreeParkingMoney = 0;
                        break;
                    case 'fromSalary':
                        if (!toUserId) throw new Error('Alıcı belirtilmedi');
                        updatedPlayers = updatedPlayers.map(p =>
                            p.user_id === toUserId ? { ...p, balance: p.balance + game.salary } : p
                        );
                        break;
                    default:
                        throw new Error('Geçersiz işlem tipi');
                }

                // İflas ve Kazanan Kontrolleri (Aynı mantık)
                updatedPlayers = updatedPlayers.map(p => {
                    if (p.balance <= 0 && !p.bankrupt_timestamp) {
                        return { ...p, bankrupt_timestamp: timestamp };
                    }
                    return p;
                });

                const transaction = {
                    from_user_id: fromUserId || null,
                    to_user_id: toUserId || null,
                    amount: type === 'fromFreeParking' ? game.free_parking_money : amount,
                    timestamp,
                    type
                };

                const updatedHistory = [transaction, ...(game.transaction_history || [])];

                const nonBankruptPlayers = updatedPlayers.filter(p => !p.bankrupt_timestamp);
                let winnerId = game.winner_id;
                let endingTimestamp = game.ending_timestamp;

                if (nonBankruptPlayers.length === 1 && updatedPlayers.length > 1 && !winnerId) {
                    winnerId = nonBankruptPlayers[0].user_id;
                    endingTimestamp = timestamp;
                }

                // Veritabanı güncelleme
                const { error: updateError } = await supabase
                    .from('games')
                    .update({
                        players: updatedPlayers,
                        transaction_history: updatedHistory,
                        free_parking_money: updatedFreeParkingMoney,
                        winner_id: winnerId,
                        ending_timestamp: endingTimestamp
                    })
                    .eq('id', gameId);

                if (updateError) throw updateError;

                return { success: true };

            } catch (error) {
                console.error(`Make transaction attempt ${attempt} failed:`, error);

                // Son deneme ise veya kritik mantık hatası ise hata döndür
                // (Mantık hatalarını retry etme, sadece network/db hatalarını et)
                const isLogicError = error.message.includes('bulunamadı') || error.message.includes('belirtilmedi') || error.message.includes('İflas') || error.message.includes('Geçersiz');

                if (attempt === maxRetries || isLogicError) {
                    return { success: false, error: error.message };
                }

                // Retry öncesi bekle (backoff strategies)
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }

        return { success: false, error: 'Maksimum deneme sayısına ulaşıldı' };
    },

    /**
     * Oyun kurucunun bir oyuncuyu oyundan atmasını sağlar.
     */
    kickPlayer: async (gameId, targetUserId) => {
        try {
            const currentGame = get().currentGame;
            if (!currentGame) return { success: false, error: 'Oyun bulunamadı' };

            const player = currentGame.players.find(p => p.user_id === targetUserId);
            if (!player) return { success: true };

            // Atılan oyuncunun parası bankaya döner
            if (!player.bankrupt_timestamp) {
                await get().makeTransaction({
                    gameId: gameId,
                    type: 'toBank',
                    amount: player.balance,
                    fromUserId: targetUserId
                });
            }

            // Players listesini güncelle (yeniden çekiyoruz ki transaction sonrası güncel olsun)
            const { data: updatedGame } = await supabase
                .from('games')
                .select('players')
                .eq('id', gameId)
                .single();

            if (updatedGame) {
                const updatedPlayers = updatedGame.players.filter(p => p.user_id !== targetUserId);

                // Veritabanını güncelle
                const { error: updateError } = await supabase
                    .from('games')
                    .update({ players: updatedPlayers })
                    .eq('id', gameId);

                if (updateError) throw updateError;
            }

            // Atılan oyuncunun current_game_id'sini temizle (sonsuz döngüyü engelle)
            await supabase
                .from('users')
                .update({ current_game_id: null })
                .eq('id', targetUserId);

            return { success: true };
        } catch (error) {
            console.error('Kick player error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Oyunu tamamen siler ve herkesi atar. (Sadece kurucu)
     */
    disbandGame: async (gameId) => {
        try {
            // Önce oyundaki tüm oyuncuların current_game_id'lerini temizle (sonsuz döngüyü engelle)
            const currentGame = get().currentGame;
            if (currentGame?.players) {
                const playerIds = currentGame.players.map(p => p.user_id);
                await supabase
                    .from('users')
                    .update({ current_game_id: null })
                    .in('id', playerIds);
            }

            const { error } = await supabase
                .from('games')
                .delete()
                .eq('id', gameId);

            if (error) throw error;

            // Store'u temizle
            get().cleanup();

            return { success: true };
        } catch (error) {
            console.error('Disband game error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Store temizliği yapar ve realtime bağlantısını keser.
     */
    cleanup: () => {
        const channel = get().realtimeChannel;
        if (channel) {
            supabase.removeChannel(channel);
        }
        set({ currentGame: null, currentGameId: null, realtimeChannel: null });
    },

    /**
     * Bitmiş son oyunları getirir.
     */
    getRecentGames: async (limit = 10) => {
        try {
            const { data, error } = await supabase
                .from('games')
                .select('*')
                .not('winner_id', 'is', null)
                .not('ending_timestamp', 'is', null)
                .order('ending_timestamp', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return { success: true, games: data || [] };
        } catch (error) {
            console.error('Get recent games error:', error);
            return { success: false, error: error.message, games: [] };
        }
    },

    /**
     * Kullanıcının genel istatistiklerini hesaplar.
     */
    getUserStats: async (userId) => {
        try {
            const { data, error } = await supabase
                .from('games')
                .select('*')
                .not('winner_id', 'is', null)
                .not('ending_timestamp', 'is', null);

            if (error) throw error;

            const userGames = (data || []).filter(game =>
                game.players.some(p => p.user_id === userId)
            );
            const totalGames = userGames.length;
            const wonGames = userGames.filter(game => game.winner_id === userId).length;

            // Toplam oyun süresi
            const totalPlayTime = userGames.reduce((total, game) => {
                if (game.starting_timestamp && game.ending_timestamp) {
                    const start = new Date(game.starting_timestamp);
                    const end = new Date(game.ending_timestamp);
                    return total + (end - start);
                }
                return total;
            }, 0);

            return {
                success: true,
                stats: {
                    totalGames,
                    wonGames,
                    totalPlayTime
                }
            };
        } catch (error) {
            console.error('Get user stats error:', error);
            return {
                success: false,
                error: error.message,
                stats: { totalGames: 0, wonGames: 0, totalPlayTime: 0 }
            };
        }
    }
}));
