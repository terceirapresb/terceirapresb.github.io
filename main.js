document.addEventListener('DOMContentLoaded', () => {

    const songs = {
        "Clamo Jesus": [
            { name: "Bass", path: "audio/Clamo Jesus/Bass.mp3" },
            { name: "Drums", path: "audio/Clamo Jesus/Drums.mp3" },
            { name: "Guitar", path: "audio/Clamo Jesus/Guitar.mp3" },
            { name: "Other", path: "audio/Clamo Jesus/Other.mp3" },
            { name: "Piano", path: "audio/Clamo Jesus/Piano.mp3" },
            { name: "Vocals", path: "audio/Clamo Jesus/Vocals.mp3" },
        ],
        "Eu e minha casa": [
            { name: "Bass", path: "audio/Eu e minha casa/Bass.mp3" },
            { name: "Drums", path: "audio/Eu e minha casa/Drums.mp3" },
            { name: "Guitar", path: "audio/Eu e minha casa/Guitar.mp3" },
            { name: "Other", path: "audio/Eu e minha casa/Other.mp3" },
            { name: "Piano", path: "audio/Eu e minha casa/Piano.mp3" },
            { name: "Vocals", path: "audio/Eu e minha casa/Vocals.mp3" },
        ],
        "Galileu": [
            { name: "Bass", path: "audio/Galileu/Bass.mp3" },
            { name: "Drums", path: "audio/Galileu/Drums.mp3" },
            { name: "Guitar", path: "audio/Galileu/Guitar.mp3" },
            { name: "Other", path: "audio/Galileu/Other.mp3" },
            { name: "Piano", path: "audio/Galileu/Piano.mp3" },
            { name: "Vocals", path: "audio/Galileu/Vocals.mp3" },
        ],
        "O senhor dos exercitos": [
            { name: "Bass", path: "audio/O senhor dos exercitos/Bass.mp3" },
            { name: "Drums", path: "audio/O senhor dos exercitos/Drums.mp3" },
            { name: "Guitar", path: "audio/O senhor dos exercitos/Guitar.mp3" },
            { name: "Other", path: "audio/O senhor dos exercitos/Other.mp3" },
            { name: "Piano", path: "audio/O senhor dos exercitos/Piano.mp3" },
            { name: "Vocals", path: "audio/O senhor dos exercitos/Vocals.mp3" },
        ]
    };

    class WebAudioMultiTrackPlayer {
        constructor() {
            this.audioContext = null; // Initialize as null
            this.tracks = [];
            this.isPlaying = false;
            this.startTime = 0;
            this.pauseTime = 0;
            this.animationFrameId = null;
            this.onProgressUpdate = () => {};
            this.onStateChange = () => {};
            this.onLoadProgress = () => {};
        }

        async load(trackList) {
            // Garante que o AudioContext esteja ativo para decodificação
            if (!this.audioContext || this.audioContext.state === 'closed') {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.audioContext.state === 'suspended' || this.audioContext.state === 'interrupted') {
                try {
                    await this.audioContext.resume();
                } catch (e) {
                    console.error("Falha ao retomar AudioContext para decodificação:", e);
                    this.onStateChange({ isLoading: false, error: "Erro ao preparar áudio para carregamento." });
                    return; // Impede o carregamento se o contexto não puder ser retomado
                }
            }

            this.stop();
            this.tracks = [];
            this.onStateChange({ isLoading: true, duration: 0, currentTime: 0 });

            const DOWNLOAD_WEIGHT = 0.5; // 50% of progress is for downloading
            const DECODE_WEIGHT = 0.5;   // 50% of progress is for decoding

            const totalCount = trackList.length;
            let downloadProgress = new Array(totalCount).fill(0);
            let decodedTracks = 0;

            const updateOverallProgress = () => {
                const downloadPart = (downloadProgress.reduce((a, b) => a + b, 0) / totalCount) * DOWNLOAD_WEIGHT;
                const decodePart = (decodedTracks / totalCount) * DECODE_WEIGHT;
                const percentage = Math.round((downloadPart + decodePart) * 100);
                this.onLoadProgress({ percentage });
            };

            const loadPromises = trackList.map((trackInfo, index) =>
                new Promise((resolve, reject) => {
                    const request = new XMLHttpRequest();
                    request.open('GET', trackInfo.path, true);
                    request.responseType = 'arraybuffer';

                    request.onprogress = (event) => {
                        if (event.lengthComputable) {
                            downloadProgress[index] = event.loaded / event.total;
                            updateOverallProgress();
                        }
                    };

                    request.onload = () => {
                        downloadProgress[index] = 1; // Ensure download is marked as 100%
                        updateOverallProgress();

                        this.audioContext.decodeAudioData(request.response, (buffer) => {
                            const analyser = this.audioContext.createAnalyser();
                            analyser.fftSize = 256;
                            this.tracks.push({
                                name: trackInfo.name,
                                buffer: buffer,
                                source: null,
                                gainNode: this.audioContext.createGain(),
                                analyser: analyser,
                                volumeData: new Uint8Array(analyser.frequencyBinCount),
                                isMuted: false,
                                isSoloed: false,
                                volume: 1,
                                uiElements: {} // Para armazenar referências aos elementos da UI
                            });
                            decodedTracks++;
                            updateOverallProgress();
                            resolve();
                        }, (error) => {
                            console.error(`Error decoding audio data for ${trackInfo.name}:`, error);
                            reject(new Error(`Erro ao decodificar ${trackInfo.name}`));
                        });
                    };

                    request.onerror = () => {
                        console.error(`Error fetching audio file for ${trackInfo.name}:`, request.statusText);
                        reject(new Error(`Erro ao carregar ${trackInfo.name} (Status: ${request.status})`));
                    };
                    request.send();
                })
            );

            try {
                await Promise.all(loadPromises);
                this.onLoadProgress({ percentage: 100 }); // Final update to guarantee 100%
                this.tracks.sort((a, b) => trackList.findIndex(t => t.name === a.name) - trackList.findIndex(t => t.name === b.name));
                this.tracks.forEach(track => {
                    track.analyser.connect(track.gainNode);
                    track.gainNode.connect(this.audioContext.destination);
                });
                this.onStateChange({ isLoading: false, duration: this.getDuration() });
            } catch (error) {
                this.onStateChange({ isLoading: false, error: error.message });
                console.error("Failed to load all tracks:", error);
            }
        }

        async play() {
            if (this.isPlaying || this.tracks.length === 0) return;

            // Cria o AudioContext se ainda não foi criado
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Tenta retomar o AudioContext se estiver suspenso (necessário para mobile)
            if (this.audioContext.state === 'suspended' || this.audioContext.state === 'interrupted') {
                try {
                    await this.audioContext.resume();
                } catch (e) {
                    console.error("Falha ao retomar AudioContext:", e);
                    alert("Erro ao retomar AudioContext: " + e.message);
                    return; // Impede a reprodução se o contexto não puder ser retomado
                }
            } else if (this.audioContext.state === 'closed') {
                // Se o contexto foi fechado, cria um novo
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }


            this.isPlaying = true;
            this.startTime = this.audioContext.currentTime - this.pauseTime;

            this.tracks.forEach(track => {
                track.source = this.audioContext.createBufferSource();
                track.source.buffer = track.buffer;
                track.source.connect(track.analyser); // Conecta source ao analyser primeiro
                track.source.start(this.audioContext.currentTime, this.pauseTime);
            });

            this.onStateChange({ isPlaying: true });
            this._startProgressLoop();
        }

        pause() {
            if (!this.isPlaying) return;
            this.pauseTime = this.audioContext.currentTime - this.startTime;
            this.tracks.forEach(track => track.source.stop());
            this.isPlaying = false;
            this.onStateChange({ isPlaying: false });
            this._stopProgressLoop();
        }

        stop() {
            if (this.tracks.length === 0) return;
            if (this.isPlaying) {
                this.tracks.forEach(track => track.source.stop());
            }
            this.isPlaying = false;
            this.pauseTime = 0;
            this.onStateChange({ isPlaying: false, currentTime: 0 });
            this._stopProgressLoop();
        }

        seek(time) {
            const wasPlaying = this.isPlaying;
            if (wasPlaying) this.pause();
            this.pauseTime = time;
            if (wasPlaying) this.play();
            else this.onProgressUpdate(this.pauseTime, this.getDuration());
        }

        // Função de conversão linear para logarítmica (dB)
        // Mapeia o slider de 0-1.5 para um ganho em dB
        // -60dB (quase mudo) a +6dB (um pouco acima do normal)
        linearToLogarithmicGain(linearValue) {
            const minDb = -60; // Quase mudo
            const maxDb = 6;   // Um pouco acima do normal
            // Normaliza o valor linear (0-1.5) para 0-1
            const normalizedValue = linearValue / 1.5;
            // Converte para escala logarítmica
            const gainDb = normalizedValue * (maxDb - minDb) + minDb;
            // Converte dB para ganho linear para o AudioContext
            return Math.pow(10, gainDb / 20);
        }

        _updateGains() {
            const anyTrackSoloed = this.tracks.some(t => t.isSoloed);

            this.tracks.forEach(track => {
                // Usa a função logarítmica para calcular o ganho efetivo
                let newGain = this.linearToLogarithmicGain(track.volume);

                if (track.isMuted) {
                    newGain = 0;
                } else if (anyTrackSoloed) {
                    if (!track.isSoloed) {
                        newGain = 0; // Silencia faixas não soladas
                    }
                }
                track.gainNode.gain.setTargetAtTime(newGain, this.audioContext.currentTime, 0.01);
            });
        }

        setTrackVolume(trackName, volume) {
            const track = this.tracks.find(t => t.name === trackName);
            if (track) {
                track.volume = volume;
                this._updateGains();
            }
        }

        toggleMute(trackName) {
            const track = this.tracks.find(t => t.name === trackName);
            if (track) {
                track.isMuted = !track.isMuted;
                this._updateGains();
                return track.isMuted;
            }
            return false;
        }

        toggleSolo(trackName) {
            const track = this.tracks.find(t => t.name === trackName);
            if (!track) return false;

            track.isSoloed = !track.isSoloed;
            
            this._updateGains();
            return this.tracks.map(t => ({ name: t.name, isSoloed: t.isSoloed }));
        }

        getDuration() {
            return this.tracks.length > 0 ? this.tracks[0].buffer.duration : 0;
        }

        getCurrentTime() {
            if (this.isPlaying) {
                return this.audioContext.currentTime - this.startTime;
            }
            return this.pauseTime;
        }

        _startProgressLoop() {
            const loop = () => {
                const currentTime = this.getCurrentTime();
                const duration = this.getDuration();
                this.onProgressUpdate(currentTime, duration);

                this.tracks.forEach(track => {
                    track.analyser.getByteFrequencyData(track.volumeData);
                });

                if (currentTime >= duration) {
                    this.stop();
                } else {
                    this.animationFrameId = requestAnimationFrame(loop);
                }
            };
            this.animationFrameId = requestAnimationFrame(loop);
        }

        _stopProgressLoop() {
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
        }
    }

    // --- LÓGICA DA UI ---
    const player = new WebAudioMultiTrackPlayer();
    const ui = {
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
        retryBtn: document.getElementById('retry-btn')
    };

    let isSeeking = false;
    let currentSongName = null; // Para armazenar o nome da música atual em caso de erro

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

        setupEventListeners();
    }

    function setupEventListeners() {
        ui.playBtn.addEventListener('click', () => player.play());
        ui.pauseBtn.addEventListener('click', () => player.pause());
        ui.stopBtn.addEventListener('click', () => player.stop());
        ui.retryBtn.addEventListener('click', () => loadSong(currentSongName));

        const onSeek = () => {
            if (isSeeking) {
                const time = parseFloat(ui.progressBar.value);
                player.seek(time);
            }
        };
        ui.progressBar.addEventListener('mousedown', () => isSeeking = true);
        ui.progressBar.addEventListener('input', onSeek);
        ui.progressBar.addEventListener('change', onSeek); // For keyboard/accessibility
        ui.progressBar.addEventListener('mouseup', () => isSeeking = false);

        // Adiciona aria-valuetext para o progresso
        ui.progressBar.setAttribute('aria-valuetext', `0 minutos e 0 segundos de ${formatTime(player.getDuration())}`);

        // Ajusta a altura máxima do scrollable-content com base na altura do fixed-header
        const updateScrollableHeight = () => {
            const headerHeight = ui.fixedHeader.offsetHeight;
            ui.tracksContainer.closest('.scrollable-content').style.maxHeight = `calc(100vh - ${headerHeight + 40}px)`; // +40px para padding/margem
        };
        // Chama no início e em redimensionamentos
        updateScrollableHeight();
        window.addEventListener('resize', updateScrollableHeight);
    }

    async function loadSong(songName) {
        if (!songName || !songs[songName]) {
            ui.loadingStatus.textContent = `Erro: Música "${songName}" não encontrada.`;
            ui.loadingStatus.style.color = 'red';
            ui.retryBtn.style.display = 'block'; // Mostra o botão de tentar novamente
            updateButtons(false, false, true); // Desabilita botões de play/pause/stop
            return;
        }
        
        ui.title.textContent = songName;
        updateButtons(false, true); // Desabilita botões de play/pause/stop durante o carregamento
        ui.retryBtn.style.display = 'none'; // Esconde o botão de tentar novamente
        ui.tracksContainer.innerHTML = '';
        ui.loadingStatus.textContent = `Carregando ${songName}... (0%)`;
        ui.loadingStatus.style.color = 'var(--light-text-color)'; // Reseta a cor

        try {
            await player.load(songs[songName]);
            ui.loadingStatus.textContent = `Música "${songName}" carregada.`;
            renderTrackControls();
            updateButtons(false, false); // Reabilita botões após carregamento
        } catch (error) {
            ui.loadingStatus.textContent = `Erro ao carregar a música: ${error.message}.`;
            ui.loadingStatus.style.color = 'red';
            ui.retryBtn.style.display = 'block'; // Mostra o botão de tentar novamente
            console.error("Load song error:", error);
            updateButtons(false, false, true); // Desabilita botões de play/pause/stop
        }
    }

    function renderTrackControls() {
        ui.tracksContainer.innerHTML = '';
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
            ui.tracksContainer.appendChild(control);

            // Armazena referências aos elementos da UI diretamente no objeto track
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
                track.uiElements.volumeSlider.value = 1; // Reset to 100%
                player.setTrackVolume(track.name, 1);
                track.uiElements.volumePercentage.textContent = `100%`;
                track.uiElements.volumeSlider.setAttribute('aria-valuenow', 100);
                track.uiElements.volumeSlider.setAttribute('aria-valuetext', `100%`);
            });

            track.uiElements.muteBtn.addEventListener('click', () => {
                const isMuted = player.toggleMute(track.name);
                track.uiElements.muteBtn.classList.toggle('active', isMuted);
                track.uiElements.muteBtn.setAttribute('aria-pressed', isMuted);
                updateTrackControlVisuals();
            });

            track.uiElements.muteBtn.addEventListener('dblclick', () => {
                player.tracks.forEach(t => {
                    if (t.isMuted) {
                        player.toggleMute(t.name);
                    }
                });
                // Atualiza o estado visual de TODOS os botões de mute
                player.tracks.forEach(t => {
                    if (t.uiElements.muteBtn) {
                        t.uiElements.muteBtn.classList.remove('active');
                        t.uiElements.muteBtn.setAttribute('aria-pressed', 'false');
                    }
                });
                updateTrackControlVisuals();
            });

            track.uiElements.soloBtn.addEventListener('click', () => {
                const soloStates = player.toggleSolo(track.name);
                // Atualiza o estado visual de TODOS os botões de solo
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
                updateTrackControlVisuals();
            });

            track.uiElements.soloBtn.addEventListener('dblclick', () => {
                player.tracks.forEach(t => {
                    if (t.isSoloed) {
                        player.toggleSolo(t.name);
                    }
                });
                // Atualiza o estado visual de TODOS os botões de solo
                player.tracks.forEach(t => {
                    if (t.uiElements.soloBtn) {
                        t.uiElements.soloBtn.classList.remove('active');
                        t.uiElements.soloBtn.setAttribute('aria-pressed', 'false');
                    }
                });
                updateTrackControlVisuals();
            });
        });
        updateTrackControlVisuals(); // Initial visual update
    }

    function updateButtons(isPlaying, isLoading, isError = false) {
        ui.playBtn.disabled = isPlaying || isLoading || isError;
        ui.pauseBtn.disabled = !isPlaying || isLoading || isError;
        ui.stopBtn.disabled = (!isPlaying && player.getCurrentTime() === 0) || isLoading || isError;
        ui.progressBar.disabled = isLoading || isError;

        // Atualiza aria-disabled
        ui.playBtn.setAttribute('aria-disabled', ui.playBtn.disabled);
        ui.pauseBtn.setAttribute('aria-disabled', ui.pauseBtn.disabled);
        ui.stopBtn.setAttribute('aria-disabled', ui.stopBtn.disabled);
        ui.progressBar.setAttribute('aria-disabled', ui.progressBar.disabled);
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    player.onProgressUpdate = (currentTime, duration) => {
        if (!isSeeking) {
            ui.progressBar.value = currentTime;
        }
        ui.timeCurrent.textContent = formatTime(currentTime);
        const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
        ui.progressBar.style.backgroundSize = `${progressPercent}% 100%`;

        // Atualiza aria-valuetext para o progresso
        ui.progressBar.setAttribute('aria-valuenow', currentTime);
        ui.progressBar.setAttribute('aria-valuetext', `${formatTime(currentTime)} de ${formatTime(duration)}`);

        // Update volume meters
        player.tracks.forEach(track => {
            if (track.analyser && track.volumeData && track.uiElements.volumeMeterBar) {
                // Calcula o RMS para uma representação mais precisa do volume
                track.analyser.getByteFrequencyData(track.volumeData);
                let sumSquares = 0;
                for (let i = 0; i < track.volumeData.length; i++) {
                    const normalizedValue = track.volumeData[i] / 255; // Normaliza para 0-1
                    sumSquares += normalizedValue * normalizedValue;
                }
                const rms = Math.sqrt(sumSquares / track.volumeData.length);
                const meterValue = rms * 100; // Converte para porcentagem

                track.uiElements.volumeMeterBar.style.width = `${meterValue}%`;
            }
        });
    };

    player.onStateChange = (state) => {
        if (state.isLoading !== undefined) {
            updateButtons(player.isPlaying, state.isLoading);
            ui.loadingStatus.style.display = state.isLoading ? 'block' : 'none';
        }
        if (state.isPlaying !== undefined) {
            updateButtons(state.isPlaying, false);
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
            ui.loadingStatus.textContent = `Erro: ${state.error}`; // Exibe erro na UI
            ui.loadingStatus.style.color = 'red';
            ui.retryBtn.style.display = 'block'; // Mostra o botão de tentar novamente
            updateButtons(false, false, true); // Desabilita botões de play/pause/stop
            
        }
    };

    player.onLoadProgress = ({ percentage }) => {
        const songName = ui.songSelect.value || ui.title.textContent;
        ui.loadingStatus.textContent = `Carregando ${songName}... (${percentage}%)`;
        ui.loadingStatus.style.color = 'var(--light-text-color)'; // Reseta a cor
    };

    // Função para atualizar o visual dos controles de faixa (mute/solo)
    function updateTrackControlVisuals() {
        const anyTrackSoloed = player.tracks.some(t => t.isSoloed);

        player.tracks.forEach(track => {
            // Acessa os elementos da UI diretamente do objeto track
            const control = track.uiElements.control;
            const muteBtn = track.uiElements.muteBtn;
            const soloBtn = track.uiElements.soloBtn;
            const volumeSlider = track.uiElements.volumeSlider;
            const trackNameSpan = control.querySelector('.track-name');
            const volumeLabel = control.querySelector('.volume-control .label');
            const volumePercentageSpan = track.uiElements.volumePercentage;

            // Atualiza o estado do botão Mute
            muteBtn.classList.toggle('active', track.isMuted);
            muteBtn.setAttribute('aria-pressed', track.isMuted);

            // Atualiza o estado do botão Solo
            soloBtn.classList.toggle('active', track.isSoloed);
            soloBtn.setAttribute('aria-pressed', track.isSoloed);

            // Feedback visual para faixas silenciadas por solo
            if (anyTrackSoloed && !track.isSoloed) {
                control.classList.add('silenced-by-solo');
                // REMOVIDO: volumeSlider.disabled = true;
                // REMOVIDO: volumeSlider.setAttribute('aria-disabled', 'true');
                trackNameSpan.style.color = 'var(--light-text-color)';
                volumeLabel.style.color = 'var(--light-text-color)';
                volumePercentageSpan.style.color = 'var(--light-text-color)';
            } else {
                control.classList.remove('silenced-by-solo');
                // REMOVIDO: volumeSlider.disabled = false;
                // REMOVIDO: volumeSlider.setAttribute('aria-disabled', 'false');
                trackNameSpan.style.color = 'var(--text-color)';
                volumeLabel.style.color = 'var(--light-text-color)'; // Mantém a cor padrão
                volumePercentageSpan.style.color = 'var(--light-text-color)'; // Mantém a cor padrão
            }
        });
    }

    init();
});