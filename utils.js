
export async function loadSongs() {
    try {
        console.log('🎵 Carregando lista de músicas...');
        const response = await fetch('songs.json');
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`);
        }
        
        const loadedSongs = await response.json();
        console.log('✅ Músicas carregadas com sucesso:', Object.keys(loadedSongs));
        return loadedSongs;
        
    } catch (error) {
        console.error('❌ Erro ao carregar songs.json:', error);
        
        const container = document.getElementById('player-container');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: red;">
                    <h2>❌ Erro ao Carregar Músicas</h2>
                    <p>Não foi possível carregar o arquivo songs.json</p>
                    <p><strong>Erro:</strong> ${error.message}</p>
                    <p>Verifique se o arquivo songs.json existe e está no formato correto.</p>
                    <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px;">
                        🔄 Tentar Novamente
                    </button>
                </div>
            `;
        }
        
        throw error;
    }
}

export function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
