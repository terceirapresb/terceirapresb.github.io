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
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.tracks = [];
            this.soloTrack = null;
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

            const loadPromises = trackList.map(trackInfo =>
                new Promise((resolve, reject) => {
                    const request = new XMLHttpRequest();
                    request.open('GET', trackInfo.path, true);
                    request.responseType = 'arraybuffer';
                    request.onload = () => {
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
                                volume: 1
                            });
                            loadedCount++;
                            this.onLoadProgress({ loaded: loadedCount, total: totalCount });
                            resolve();
                        }, reject);
                    };
                    request.onerror = () => reject(new Error(`Error fetching ${trackInfo.path}`));
                    request.send();
                })
            );

            await Promise.all(loadPromises);
            this.tracks.sort((a, b) => trackList.findIndex(t => t.name === a.name) - trackList.findIndex(t => t.name === b.name));
            this.tracks.forEach(track => track.gainNode.connect(track.analyser).connect(this.audioContext.destination));
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
            else this.onProgressUpdate(this.pauseTime, this.getDuration());
        }

        _updateGains() {
            const soloTrack = this.tracks.find(t => t.isSoloed);
            this.tracks.forEach(track => {
                let newGain = track.volume;
                if (track.isMuted) {
                    newGain = 0;
                } else if (soloTrack && !track.isSoloed) {
                    newGain = 0;
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

            // Desativa solo de outras faixas se a atual foi solada
            if (track.isSoloed) {
                this.tracks.forEach(t => {
                    if (t.name !== trackName) t.isSoloed = false;
                });
            }
            
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
        scriptTag: document.getElementById('multitrack-player-script')
    };

    let isSeeking = false;

    function init() {
        const urlParams = new URLSearchParams(window.location.search);
        const dataAttrSong = ui.scriptTag.dataset.musica;
        const dataAttrWidth = ui.scriptTag.dataset.width;
        const dataAttrHeight = ui.scriptTag.dataset.height;

        const songFromUrl = urlParams.get('musica');
        const songToLoad = songFromUrl || dataAttrSong;

        if (dataAttrWidth) ui.container.style.width = dataAttrWidth;
        if (dataAttrHeight) ui.container.style.height = dataAttrHeight;

        if (songToLoad && songs[songToLoad]) {
            ui.songSelectorContainer.style.display = 'none';
            loadSong(songToLoad);
        } else {
            Object.keys(songs).forEach(songName => {
                const option = document.createElement('option');
                option.value = songName;
                option.textContent = songName;
                ui.songSelect.appendChild(option);
            });
            ui.songSelect.addEventListener('change', () => loadSong(ui.songSelect.value));
            loadSong(Object.keys(songs)[0]);
        }

        setupEventListeners();
    }

    function setupEventListeners() {
        ui.playBtn.addEventListener('click', () => player.play());
        ui.pauseBtn.addEventListener('click', () => player.pause());
        ui.stopBtn.addEventListener('click', () => player.stop());

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
    }

    async function loadSong(songName) {
        if (!songName || !songs[songName]) return;
        
        ui.title.textContent = songName;
        updateButtons(false, true);
        ui.tracksContainer.innerHTML = '';
        ui.loadingStatus.textContent = `Carregando ${songName}... (0%)`;

        await player.load(songs[songName]);

        ui.loadingStatus.textContent = `Música "${songName}" carregada.`;
        renderTrackControls();
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
                        <button class="mute-btn">Mute</button>
                        <button class="solo-btn">Solo</button>
                    </div>
                </div>
                <div class="volume-control">
                    <span class="label">Volume:</span>
                    <input type="range" class="volume-slider" min="0" max="1.5" step="0.01" value="1">
                    <span class="volume-percentage">100%</span>
                </div>
                <div class="volume-meter-container">
                    <div class="volume-meter-bar"></div>
                </div>
            `;
            ui.tracksContainer.appendChild(control);

            const volumeSlider = control.querySelector('.volume-slider');
            const volumePercentage = control.querySelector('.volume-percentage');
            const muteBtn = control.querySelector('.mute-btn');
            const soloBtn = control.querySelector('.solo-btn');

            volumeSlider.addEventListener('input', (e) => {
                const volume = parseFloat(e.target.value);
                player.setTrackVolume(track.name, volume);
                volumePercentage.textContent = `${Math.round(volume * 100)}%`;
            });

            muteBtn.addEventListener('click', () => {
                const isMuted = player.toggleMute(track.name);
                muteBtn.classList.toggle('active', isMuted);
            });

            soloBtn.addEventListener('click', () => {
                const soloStates = player.toggleSolo(track.name);
                document.querySelectorAll('.solo-btn').forEach(btn => btn.classList.remove('active'));
                soloStates.forEach(state => {
                    if (state.isSoloed) {
                        const btn = [...document.querySelectorAll('.track-name')].find(el => el.textContent === state.name).closest('.track-control').querySelector('.solo-btn');
                        btn.classList.add('active');
                    }
                });
            });
        });
    }

    function updateButtons(isPlaying, isLoading) {
        ui.playBtn.disabled = isPlaying || isLoading;
        ui.pauseBtn.disabled = !isPlaying || isLoading;
        ui.stopBtn.disabled = (!isPlaying && player.getCurrentTime() === 0) || isLoading;
        ui.progressBar.disabled = isLoading;
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

        // Update volume meters
        document.querySelectorAll('.track-control').forEach((control, index) => {
            const track = player.tracks[index];
            if (track && track.volumeData) {
                const value = track.volumeData.reduce((a, b) => a + b, 0) / track.volumeData.length;
                const meter = control.querySelector('.volume-meter-bar');
                if (meter) {
                    meter.style.width = `${(value / 255) * 100}%`;
                }
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
        }
        if (state.currentTime !== undefined) {
            ui.progressBar.value = state.currentTime;
            ui.timeCurrent.textContent = formatTime(state.currentTime);
            const progressPercent = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
            ui.progressBar.style.backgroundSize = `${progressPercent}% 100%`;
        }
    };

    player.onLoadProgress = ({ loaded, total }) => {
        const percentage = Math.round((loaded / total) * 100);
        ui.loadingStatus.textContent = `Carregando... (${percentage}%)`;
    };

    init();
});