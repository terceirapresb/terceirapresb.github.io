document.addEventListener('DOMContentLoaded', () => {

    // --- ESTRUTURA DE DADOS DAS MÚSICAS ---
    const songs = {
        "Clamo Jesus": [
            { name: "Bass", path: "audio/Clamo Jesus/Bass.wav" },
            { name: "Drums", path: "audio/Clamo Jesus/Drums.wav" },
            { name: "Guitar", path: "audio/Clamo Jesus/Guitar.wav" },
            { name: "Other", path: "audio/Clamo Jesus/Other.wav" },
            { name: "Piano", path: "audio/Clamo Jesus/Piano.wav" },
            { name: "Vocals", path: "audio/Clamo Jesus/Vocals.wav" },
        ],
        "Eu e minha casa": [
            { name: "Bass", path: "audio/Eu e minha casa/Bass.wav" },
            { name: "Drums", path: "audio/Eu e minha casa/Drums.wav" },
            { name: "Guitar", path: "audio/Eu e minha casa/Guitar.wav" },
            { name: "Other", path: "audio/Eu e minha casa/Other.wav" },
            { name: "Piano", path: "audio/Eu e minha casa/Piano.wav" },
            { name: "Vocals", path: "audio/Eu e minha casa/Vocals.wav" },
        ],
        "Galileu": [
            { name: "Bass", path: "audio/Galileu/Bass.wav" },
            { name: "Drums", path: "audio/Galileu/Drums.wav" },
            { name: "Guitar", path: "audio/Galileu/Guitar.wav" },
            { name: "Other", path: "audio/Galileu/Other.wav" },
            { name: "Piano", path: "audio/Galileu/Piano.wav" },
            { name: "Vocals", path: "audio/Galileu/Vocals.wav" },
        ],
        "O senhor dos exercitos": [
            { name: "Bass", path: "audio/O senhor dos exercitos/Bass.wav" },
            { name: "Drums", path: "audio/O senhor dos exercitos/Drums.wav" },
            { name: "Guitar", path: "audio/O senhor dos exercitos/Guitar.wav" },
            { name: "Other", path: "audio/O senhor dos exercitos/Other.wav" },
            { name: "Piano", path: "audio/O senhor dos exercitos/Piano.wav" },
            { name: "Vocals", path: "audio/O senhor dos exercitos/Vocals.wav" },
        ]
    };

    // --- CLASSE DO PLAYER ---
    class WebAudioMultiTrackPlayer {
        constructor() {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
            this.stop();
            this.tracks = [];
            this.onStateChange({ isLoading: true, duration: 0, currentTime: 0 });

            let loadedCount = 0;
            const totalCount = trackList.length;

            const loadPromises = trackList.map(trackInfo => {
                return new Promise((resolve, reject) => {
                    const request = new XMLHttpRequest();
                    request.open('GET', trackInfo.path, true);
                    request.responseType = 'arraybuffer';

                    request.onload = () => {
                        this.audioContext.decodeAudioData(request.response, (buffer) => {
                            this.tracks.push({
                                name: trackInfo.name,
                                buffer: buffer,
                                source: null,
                                gainNode: this.audioContext.createGain(),
                                isMuted: false,
                                volume: 1
                            });
                            loadedCount++;
                            this.onLoadProgress({ loaded: loadedCount, total: totalCount });
                            resolve();
                        }, reject);
                    };

                    request.onerror = () => reject(new Error(`Error fetching ${trackInfo.path}`));
                    request.send();
                });
            });

            await Promise.all(loadPromises);
            this.tracks.sort((a, b) => trackList.findIndex(t => t.name === a.name) - trackList.findIndex(t => t.name === b.name));
            this.tracks.forEach(track => track.gainNode.connect(this.audioContext.destination));
            this.onStateChange({ isLoading: false, duration: this.getDuration() });
        }

        play() {
            if (this.isPlaying || this.tracks.length === 0) return;
            this.audioContext.resume();

            this.isPlaying = true;
            this.startTime = this.audioContext.currentTime - this.pauseTime;

            this.tracks.forEach(track => {
                track.source = this.audioContext.createBufferSource();
                track.source.buffer = track.buffer;
                track.source.connect(track.gainNode);
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
            else this.onProgressUpdate(this.pauseTime);
        }

        setTrackVolume(trackName, volume) {
            const track = this.tracks.find(t => t.name === trackName);
            if (track) {
                track.volume = volume;
                if (!track.isMuted) {
                    track.gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
                }
            }
        }

        toggleMute(trackName) {
            const track = this.tracks.find(t => t.name === trackName);
            if (track) {
                track.isMuted = !track.isMuted;
                const newGain = track.isMuted ? 0 : track.volume;
                track.gainNode.gain.setValueAtTime(newGain, this.audioContext.currentTime);
                return track.isMuted;
            }
            return false;
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
                this.onProgressUpdate(currentTime);
                if (currentTime >= this.getDuration()) {
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

    const songSelect = document.getElementById('song-select');
    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const stopBtn = document.getElementById('stop-btn');
    const progressBar = document.getElementById('progress-bar');
    const timeCurrent = document.getElementById('time-current');
    const timeDuration = document.getElementById('time-duration');
    const loadingStatus = document.getElementById('loading-status');
    const tracksContainer = document.getElementById('tracks-container');
    const pageTitle = document.querySelector('h1');

    let isSeeking = false;

    function setupUI() {
        // Preencher seletor de músicas
        Object.keys(songs).forEach(songName => {
            const option = document.createElement('option');
            option.value = songName;
            option.textContent = songName;
            songSelect.appendChild(option);
        });

        // Event Listeners
        songSelect.addEventListener('change', () => loadSelectedSong());
        playBtn.addEventListener('click', () => player.play());
        pauseBtn.addEventListener('click', () => player.pause());
        stopBtn.addEventListener('click', () => player.stop());

        progressBar.addEventListener('mousedown', () => isSeeking = true);
        progressBar.addEventListener('mouseup', () => isSeeking = false);
        progressBar.addEventListener('input', () => {
            if (isSeeking) {
                const time = parseFloat(progressBar.value);
                player.seek(time);
            }
        });

        updateButtons(false, false);
    }

    async function loadSelectedSong() {
        const songName = songSelect.value;
        const trackList = songs[songName];
        
        pageTitle.textContent = songName; // Atualiza o título da página
        updateButtons(false, true);
        tracksContainer.innerHTML = '';
        loadingStatus.textContent = `Carregando ${songName}... (0%)`;

        await player.load(trackList);

        loadingStatus.textContent = `Música "${songName}" carregada.`;
        renderTrackControls();
    }

    function renderTrackControls() {
        tracksContainer.innerHTML = '';
        player.tracks.forEach(track => {
            const control = document.createElement('div');
            control.className = 'track-control';
            control.innerHTML = `
                <label>${track.name}</label>
                <input type="range" class="volume-slider" min="0" max="1.5" step="0.01" value="1">
                <button class="mute-btn">Mute</button>
            `;
            tracksContainer.appendChild(control);

            const volumeSlider = control.querySelector('.volume-slider');
            volumeSlider.addEventListener('input', (e) => {
                player.setTrackVolume(track.name, parseFloat(e.target.value));
            });

            const muteBtn = control.querySelector('.mute-btn');
            muteBtn.addEventListener('click', () => {
                const isMuted = player.toggleMute(track.name);
                muteBtn.textContent = isMuted ? 'Unmute' : 'Mute';
                muteBtn.style.backgroundColor = isMuted ? '#d9534f' : '';
            });
        });
    }

    function updateButtons(isPlaying, isLoading) {
        playBtn.disabled = isPlaying || isLoading;
        pauseBtn.disabled = !isPlaying || isLoading;
        stopBtn.disabled = (!isPlaying && player.getCurrentTime() === 0) || isLoading;
        progressBar.disabled = isLoading;
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    player.onProgressUpdate = (currentTime) => {
        if (!isSeeking) {
            progressBar.value = currentTime;
        }
        timeCurrent.textContent = formatTime(currentTime);
    };

    player.onStateChange = (state) => {
        if (state.isLoading !== undefined) {
            updateButtons(player.isPlaying, state.isLoading);
            loadingStatus.style.display = state.isLoading ? 'block' : 'none';
        }
        if (state.isPlaying !== undefined) {
            updateButtons(state.isPlaying, false);
        }
        if (state.duration !== undefined) {
            progressBar.max = state.duration;
            timeDuration.textContent = formatTime(state.duration);
        }
        if (state.currentTime !== undefined) {
            progressBar.value = state.currentTime;
            timeCurrent.textContent = formatTime(state.currentTime);
            if (state.currentTime === 0) { // Limpa a barra de progresso no stop
                progressBar.value = 0;
            }
        }
    };

    player.onLoadProgress = ({ loaded, total }) => {
        const percentage = Math.round((loaded / total) * 100);
        const songName = songSelect.value;
        loadingStatus.textContent = `Carregando ${songName}... (${percentage}%)`;
    };

    // Inicialização
    setupUI();
    loadSelectedSong(); // Carrega a primeira música da lista por padrão
});
