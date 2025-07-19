
import WebAudioMultiTrackPlayer from './player.js';
import { loadSongs, formatTime } from './utils.js';
import { getUIElements, createIOSUnlockButton, renderTrackControls, updateButtons, setupEventListeners } from './ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    let songs = {};

    try {
        songs = await loadSongs();
    } catch (error) {
        return;
    }

    const player = new WebAudioMultiTrackPlayer();
    const ui = getUIElements();
    let currentSongName = null;
    let isLoading = false;

    if (isIOS && !player.isUnlocked) {
        createIOSUnlockButton(player, () => {
            if (currentSongName) {
                loadSong(currentSongName);
            }
        });
    }

    function init() {
        const urlParams = new URLSearchParams(window.location.search);
        const dataAttrSong = ui.scriptTag.dataset.musica;
        const songFromUrl = urlParams.get('musica');
        const songToLoad = songFromUrl || dataAttrSong;

        if (songToLoad && songs[songToLoad]) {
            ui.songSelectorContainer.style.display = 'none';
            currentSongName = songToLoad;
            loadSong(songToLoad);
        } else {
            Object.keys(songs).forEach(songName => {
                const option = document.createElement('option');
                option.value = songName;
                option.textContent = songName;
                ui.songSelect.appendChild(option);
            });
            ui.songSelect.addEventListener('change', () => {
                currentSongName = ui.songSelect.value;
                loadSong(ui.songSelect.value);
            });
            currentSongName = Object.keys(songs)[0];
            loadSong(Object.keys(songs)[0]);
        }

        setupEventListeners(ui, player, () => loadSong(currentSongName));
    }

    async function loadSong(songName) {
        if (isLoading) {
            console.warn('Uma música já está sendo carregada. A nova solicitação foi ignorada.');
            return;
        }
        isLoading = true;

        if (!songName || !songs[songName]) {
            ui.loadingStatus.textContent = `Erro: Música "${songName}" não encontrada.`;
            ui.loadingStatus.style.color = 'red';
            ui.retryBtn.style.display = 'block';
            updateButtons(ui, player, false, false, true);
            alert(`Ocorreu um erro: música não encontrada`);
            return;
        }
        
        if (isIOS && player.audioContext.state === 'suspended') {
            console.log('AudioContext foi suspenso. Tentando reativar...');
            player.isUnlocked = false;
            
            await player.forceUnlock();
            
            if (!player.isUnlocked) {
                createIOSUnlockButton(player, () => loadSong(songName));
                return;
            }
        }
        
        ui.title.textContent = songName;
        updateButtons(ui, player, false, true);
        ui.retryBtn.style.display = 'none';
        ui.tracksContainer.innerHTML = '';
        ui.loadingStatus.innerHTML = `🎵 ${songName} - Iniciando carregamento...`;
        ui.loadingStatus.style.color = 'var(--light-text-color)';

        try {
            await player.load(songs[songName]);
            ui.loadingStatus.innerHTML = `✅ Música "${songName}" carregada com sucesso!`;
            renderTrackControls(player, ui.tracksContainer);
            updateButtons(ui, player, false, false);

        } catch (error) {
            ui.loadingStatus.textContent = `Erro ao carregar a música: ${error.message}.`;
            ui.loadingStatus.style.color = 'red';
            ui.retryBtn.style.display = 'block';
            console.error("Load song error:", error);
            updateButtons(ui, player, false, false, true);
        } finally {
            isLoading = false;
        }
    }

    player.onProgressUpdate = (currentTime, duration) => {
        if (!ui.progressBar.disabled) {
            ui.progressBar.value = currentTime;
        }
        ui.timeCurrent.textContent = formatTime(currentTime);
        const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
        ui.progressBar.style.backgroundSize = `${progressPercent}% 100%`;

        ui.progressBar.setAttribute('aria-valuenow', currentTime);
        ui.progressBar.setAttribute('aria-valuetext', `${formatTime(currentTime)} de ${formatTime(duration)}`);

        player.tracks.forEach(track => {
            if (track.analyser && track.volumeData && track.uiElements.volumeMeterBar) {
                track.analyser.getByteFrequencyData(track.volumeData);
                let sumSquares = 0;
                for (let i = 0; i < track.volumeData.length; i++) {
                    const normalizedValue = track.volumeData[i] / 255;
                    sumSquares += normalizedValue * normalizedValue;
                }
                const rms = Math.sqrt(sumSquares / track.volumeData.length);
                const meterValue = rms * 100;

                track.uiElements.volumeMeterBar.style.width = `${meterValue}%`;
            }
        });
    };

    player.onStateChange = (state) => {
        if (state.isLoading !== undefined) {
            updateButtons(ui, player, player.isPlaying, state.isLoading);
            ui.loadingStatus.style.display = state.isLoading ? 'block' : 'none';
        }
        if (state.isPlaying !== undefined) {
            updateButtons(ui, player, state.isPlaying, false);
        }
        if (state.duration !== undefined) {
            ui.progressBar.max = state.duration;
            ui.timeDuration.textContent = formatTime(state.duration);
            ui.progressBar.setAttribute('aria-valuemax', state.duration);
        }
        if (state.currentTime !== undefined) {
            ui.progressBar.value = state.currentTime;
            ui.timeCurrent.textContent = formatTime(state.currentTime);
            const progressPercent = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
            ui.progressBar.style.backgroundSize = `${progressPercent}% 100%`;
            ui.progressBar.setAttribute('aria-valuenow', state.currentTime);
            ui.progressBar.setAttribute('aria-valuetext', `${formatTime(state.currentTime)} de ${formatTime(ui.progressBar.max)}`);
        }
        if (state.error) {
            ui.loadingStatus.textContent = `Erro: ${state.error}`;
            ui.loadingStatus.style.color = 'red';
            ui.retryBtn.style.display = 'block';
            updateButtons(ui, player, false, false, true);
        }
    };

    player.onLoadProgress = (progress) => {
        const songName = ui.songSelect.value || ui.title.textContent;
        let statusText = `🎵 ${songName}`;
        
        if (progress.phase === 'preparando') {
            statusText += ` - Preparando...`;
        } else if (progress.phase === 'baixando') {
            statusText += ` - Baixando: ${progress.currentTrack}`;
            statusText += ` (${progress.downloadedTracks}/${progress.totalTracks} faixas)`;
        } else if (progress.phase === 'decodificando') {
            statusText += ` - Processando: ${progress.currentTrack}`;
            statusText += ` (${progress.decodedTracks}/${progress.totalTracks} faixas)`;
        }
        
        statusText += ` - ${progress.percentage}%`;
        
        const progressBar = `<div style="
            width: 100%;
            height: 4px;
            background-color: #e0e0e0;
            border-radius: 2px;
            margin-top: 8px;
            overflow: hidden;
        ">
            <div style="
                width: ${progress.percentage}%;
                height: 100%;
                background-color: #007aff;
                transition: width 0.3s ease;
            "></div>
        </div>`;
        
        ui.loadingStatus.innerHTML = statusText + progressBar;
        ui.loadingStatus.style.color = 'var(--light-text-color)';
    };

    init();
});
