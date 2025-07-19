
import { formatTime } from './utils.js';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
let unlockButton = null;

export function getUIElements() {
    return {
        container: document.getElementById('player-container'),
        title: document.getElementById('player-title'),
        songSelectorContainer: document.getElementById('song-selector-container'),
        songSelect: document.getElementById('song-select'),
        playBtn: document.getElementById('play-btn'),
        pauseBtn: document.getElementById('pause-btn'),
        stopBtn: document.getElementById('stop-btn'),
        progressBar: document.getElementById('progress-bar'),
        timeCurrent: document.getElementById('time-current'),
        timeDuration: document.getElementById('time-duration'),
        loadingStatus: document.getElementById('loading-status'),
        tracksContainer: document.getElementById('tracks-container'),
        scriptTag: document.getElementById('multitrack-player-script'),
        fixedHeader: document.getElementById('fixed-header'),
        retryBtn: document.getElementById('retry-btn'),
        resetBtn: document.getElementById('reset-btn')
    };
}

export function createIOSUnlockButton(player, onUnlock) {
    if (unlockButton) return;

    unlockButton = document.createElement('div');
    unlockButton.className = 'ios-unlock-overlay';
    unlockButton.innerHTML = `
        <div class="ios-unlock-modal">
            <h2>🎵 Iniciar Player de Áudio</h2>
            <p>O iOS requer sua permissão para reproduzir áudio.</p>
            <button class="ios-unlock-btn">Tocar para Iniciar</button>
        </div>
    `;
    document.body.appendChild(unlockButton);
    
    const btnElement = unlockButton.querySelector('.ios-unlock-btn');
    btnElement.addEventListener('click', async () => {
        btnElement.textContent = 'Inicializando...';
        btnElement.disabled = true;
        
        await player.forceUnlock();
        
        if (player.isUnlocked) {
            unlockButton.remove();
            unlockButton = null;
            if (onUnlock) onUnlock();
        } else {
            btnElement.textContent = 'Tentar Novamente';
            btnElement.disabled = false;
        }
    });
}

export function renderTrackControls(player, tracksContainer) {
    tracksContainer.innerHTML = '';
    player.tracks.forEach(track => {
        const control = document.createElement('div');
        control.className = 'track-control';
        control.innerHTML = `
            <div class="track-info">
                <span class="track-name">${track.name}</span>
                <div class="track-buttons">
                    <button class="mute-btn" aria-label="Mute ${track.name}">Mute</button>
                    <button class="solo-btn" aria-label="Solo ${track.name}">Solo</button>
                </div>
            </div>
            <div class="volume-control">
                <span class="label">Volume:</span>
                <input type="range" class="volume-slider" min="0" max="1.5" step="0.01" value="1" role="slider" aria-valuemin="0" aria-valuemax="150" aria-valuenow="100" aria-valuetext="100%">
                <span class="volume-percentage">100%</span>
            </div>
            <div class="volume-meter-container">
                <div class="volume-meter-bar"></div>
            </div>
        `;
        tracksContainer.appendChild(control);

        track.uiElements.control = control;
        track.uiElements.volumeSlider = control.querySelector('.volume-slider');
        track.uiElements.volumePercentage = control.querySelector('.volume-percentage');
        track.uiElements.muteBtn = control.querySelector('.mute-btn');
        track.uiElements.soloBtn = control.querySelector('.solo-btn');
        track.uiElements.volumeMeterBar = control.querySelector('.volume-meter-bar');

        track.uiElements.volumeSlider.addEventListener('input', (e) => {
            const volume = parseFloat(e.target.value);
            player.setTrackVolume(track.name, volume);
            const percentage = Math.round(volume * 100);
            track.uiElements.volumePercentage.textContent = `${percentage}%`;
            track.uiElements.volumeSlider.setAttribute('aria-valuenow', percentage);
            track.uiElements.volumeSlider.setAttribute('aria-valuetext', `${percentage}%`);
        });

        track.uiElements.volumeSlider.addEventListener('dblclick', () => {
            track.uiElements.volumeSlider.value = 1;
            player.setTrackVolume(track.name, 1);
            track.uiElements.volumePercentage.textContent = `100%`;
            track.uiElements.volumeSlider.setAttribute('aria-valuenow', 100);
            track.uiElements.volumeSlider.setAttribute('aria-valuetext', `100%`);
        });

        track.uiElements.muteBtn.addEventListener('click', () => {
            const isMuted = player.toggleMute(track.name);
            track.uiElements.muteBtn.classList.toggle('active', isMuted);
            track.uiElements.muteBtn.setAttribute('aria-pressed', isMuted);
            updateTrackControlVisuals(player);
        });

        track.uiElements.muteBtn.addEventListener('dblclick', () => {
            player.tracks.forEach(t => {
                if (t.isMuted) {
                    player.toggleMute(t.name);
                }
            });
            player.tracks.forEach(t => {
                if (t.uiElements.muteBtn) {
                    t.uiElements.muteBtn.classList.remove('active');
                    t.uiElements.muteBtn.setAttribute('aria-pressed', 'false');
                }
            });
            updateTrackControlVisuals(player);
        });

        track.uiElements.soloBtn.addEventListener('click', () => {
            const soloStates = player.toggleSolo(track.name);
            player.tracks.forEach(t => {
                if (t.uiElements.soloBtn) {
                    const state = soloStates.find(s => s.name === t.name);
                    if (state && state.isSoloed) {
                        t.uiElements.soloBtn.classList.add('active');
                        t.uiElements.soloBtn.setAttribute('aria-pressed', 'true');
                    } else {
                        t.uiElements.soloBtn.classList.remove('active');
                        t.uiElements.soloBtn.setAttribute('aria-pressed', 'false');
                    }
                }
            });
            updateTrackControlVisuals(player);
        });

        track.uiElements.soloBtn.addEventListener('dblclick', () => {
            player.tracks.forEach(t => {
                if (t.isSoloed) {
                    player.toggleSolo(t.name);
                }
            });
            player.tracks.forEach(t => {
                if (t.uiElements.soloBtn) {
                    t.uiElements.soloBtn.classList.remove('active');
                    t.uiElements.soloBtn.setAttribute('aria-pressed', 'false');
                }
            });
            updateTrackControlVisuals(player);
        });
    });
    updateTrackControlVisuals(player);
}

export function updateButtons(ui, player, isPlaying, isLoading, isError = false) {
    ui.playBtn.disabled = isPlaying || isLoading || isError;
    ui.pauseBtn.disabled = !isPlaying || isLoading || isError;
    ui.stopBtn.disabled = (!isPlaying && player.getCurrentTime() === 0) || isLoading || isError;
    ui.progressBar.disabled = isLoading || isError;

    ui.playBtn.setAttribute('aria-disabled', ui.playBtn.disabled);
    ui.pauseBtn.setAttribute('aria-disabled', ui.pauseBtn.disabled);
    ui.stopBtn.setAttribute('aria-disabled', ui.stopBtn.disabled);
    ui.progressBar.setAttribute('aria-disabled', ui.progressBar.disabled);
}

export function updateTrackControlVisuals(player) {
    const anyTrackSoloed = player.tracks.some(t => t.isSoloed);

    player.tracks.forEach(track => {
        const control = track.uiElements.control;
        const muteBtn = track.uiElements.muteBtn;
        const soloBtn = track.uiElements.soloBtn;
        const trackNameSpan = control.querySelector('.track-name');
        const volumeLabel = control.querySelector('.volume-control .label');
        const volumePercentageSpan = track.uiElements.volumePercentage;

        muteBtn.classList.toggle('active', track.isMuted);
        muteBtn.setAttribute('aria-pressed', track.isMuted);

        soloBtn.classList.toggle('active', track.isSoloed);
        soloBtn.setAttribute('aria-pressed', track.isSoloed);

        if (anyTrackSoloed && !track.isSoloed) {
            control.classList.add('silenced-by-solo');
            trackNameSpan.style.color = 'var(--light-text-color)';
            volumeLabel.style.color = 'var(--light-text-color)';
            volumePercentageSpan.style.color = 'var(--light-text-color)';
        } else {
            control.classList.remove('silenced-by-solo');
            trackNameSpan.style.color = 'var(--text-color)';
            volumeLabel.style.color = 'var(--light-text-color)';
            volumePercentageSpan.style.color = 'var(--light-text-color)';
        }
    });
}

export function setupEventListeners(ui, player, loadSongCallback) {
    let isSeeking = false;

    ui.playBtn.addEventListener('click', async () => {
        if (isIOS && !player.isUnlocked) {
            const originalText = ui.playBtn.textContent;
            ui.playBtn.textContent = 'Iniciando...';
            ui.playBtn.disabled = true;
            
            await player.play();
            
            ui.playBtn.textContent = originalText;
            ui.playBtn.disabled = false;
        } else {
            player.play();
        }
    });
    ui.pauseBtn.addEventListener('click', () => player.pause());
    ui.stopBtn.addEventListener('click', () => player.stop());
    ui.retryBtn.addEventListener('click', () => loadSongCallback());

    const onSeek = () => {
        if (isSeeking) {
            const time = parseFloat(ui.progressBar.value);
            player.seek(time);
        }
    };
    const startSeeking = () => isSeeking = true;
    const stopSeeking = () => isSeeking = false;
    
    ui.progressBar.addEventListener('mousedown', startSeeking);
    ui.progressBar.addEventListener('touchstart', startSeeking);
    ui.progressBar.addEventListener('input', onSeek);
    ui.progressBar.addEventListener('change', onSeek);
    ui.progressBar.addEventListener('mouseup', stopSeeking);
    ui.progressBar.addEventListener('touchend', stopSeeking);

    ui.progressBar.setAttribute('aria-valuetext', `0 minutos e 0 segundos de ${formatTime(player.getDuration())}`);

    ui.resetBtn.addEventListener('click', () => {
        player.resetMix();
        
        player.tracks.forEach(track => {
            if (track.uiElements.volumeSlider) {
                track.uiElements.volumeSlider.value = track.volume;
                track.uiElements.volumePercentage.textContent = `${Math.round(track.volume * 100)}%`;
                track.uiElements.muteBtn.classList.remove('active');
                track.uiElements.soloBtn.classList.remove('active');
            }
        });
        updateTrackControlVisuals(player);
    });

    const updateScrollableHeight = () => {
        const headerHeight = ui.fixedHeader.offsetHeight;
        ui.tracksContainer.closest('.scrollable-content').style.maxHeight = `calc(100vh - ${headerHeight + 40}px)`;
    };
    updateScrollableHeight();
    window.addEventListener('resize', updateScrollableHeight);
}
