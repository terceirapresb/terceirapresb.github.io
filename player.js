
// Detecta se é um iPhone/iPad
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

export default class WebAudioMultiTrackPlayer {
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
        this.isUnlocked = false;

        if ('audioSession' in navigator) {
            navigator.audioSession.type = 'playback';
            console.log('Audio Session API configurada para playback');
        }

        this.setupIOSUnlock();

        if (isIOS) {
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && this.audioContext.state === 'suspended') {
                    console.log('App voltou do background, AudioContext suspenso');
                    this.isUnlocked = false;
                }
            });
        }
        console.log('AudioContext initial state:', this.audioContext.state);
    }

    setupIOSUnlock() {
        const unlockAudioContext = async () => {
            if (this.isUnlocked) return;
            
            try {
                const buffer = this.audioContext.createBuffer(1, 1, 22050);
                const source = this.audioContext.createBufferSource();
                source.buffer = buffer;
                source.connect(this.audioContext.destination);
                
                if (source.start) {
                    source.start(0);
                } else if (source.noteOn) {
                    source.noteOn(0);
                }
                
                if (this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
                }
                
                if (this.audioContext.state === 'running') {
                    this.isUnlocked = true;
                    console.log('AudioContext desbloqueado com sucesso!');
                    
                    ['touchstart', 'touchend', 'click'].forEach(event => {
                        document.removeEventListener(event, unlockAudioContext);
                    });
                }
            } catch (e) {
                console.error('Erro ao desbloquear AudioContext:', e);
            }
        };

        ['touchstart', 'touchend', 'click'].forEach(event => {
            document.addEventListener(event, unlockAudioContext, { once: true });
        });
    }

    async load(trackList) {
        this.stop();
        this.tracks = [];
        this.onStateChange({ isLoading: true, duration: 0, currentTime: 0 });

        const DOWNLOAD_WEIGHT = 0.5;
        const DECODE_WEIGHT = 0.5;

        const totalCount = trackList.length;
        let downloadProgress = new Array(totalCount).fill(0);
        let decodedTracks = 0;
        let currentLoadingTrack = '';
        let loadingPhase = 'preparando';
        let completedTracks = [];

        const updateOverallProgress = () => {
            const downloadPart = (downloadProgress.reduce((a, b) => a + b, 0) / totalCount) * DOWNLOAD_WEIGHT;
            const decodePart = (decodedTracks / totalCount) * DECODE_WEIGHT;
            const percentage = Math.round((downloadPart + decodePart) * 100);
            this.onLoadProgress({ 
                percentage, 
                currentTrack: currentLoadingTrack,
                phase: loadingPhase,
                totalTracks: totalCount,
                completedTracks: completedTracks.length,
                downloadedTracks: downloadProgress.filter(p => p === 1).length,
                decodedTracks: decodedTracks
            });
        };

        const loadPromises = trackList.map((trackInfo, index) =>
            new Promise((resolve, reject) => {
                const request = new XMLHttpRequest();
                request.open('GET', trackInfo.path, true);
                request.responseType = 'arraybuffer';

                request.onprogress = (event) => {
                    if (event.lengthComputable) {
                        downloadProgress[index] = event.loaded / event.total;
                        currentLoadingTrack = trackInfo.name;
                        loadingPhase = 'baixando';
                        updateOverallProgress();
                    }
                };

                request.onload = () => {
                    downloadProgress[index] = 1;
                    currentLoadingTrack = trackInfo.name;
                    loadingPhase = 'decodificando';
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
                            uiElements: {}
                        });
                        decodedTracks++;
                        completedTracks.push(trackInfo.name);
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
            this.onLoadProgress({ percentage: 100 });
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

        if (isIOS && !this.isUnlocked) {
            console.warn('AudioContext não está desbloqueado no iOS');
            await this.forceUnlock();
            if (!this.isUnlocked) {
                alert('Por favor, toque na tela primeiro para habilitar o áudio no iOS.');
                return;
            }
        }

        if (this.audioContext.state === 'suspended' || this.audioContext.state === 'interrupted') {
            try {
                await this.audioContext.resume();
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (e) {
                console.error("Falha ao retomar AudioContext:", e);
                alert("Erro ao iniciar áudio. Por favor, tente novamente.");
                return;
            }
        } else if (this.audioContext.state === 'closed') {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.setupIOSUnlock();
            await this.forceUnlock();
        }

        if (this.audioContext.state !== 'running') {
            console.error('AudioContext não está em estado running:', this.audioContext.state);
            return;
        }

        this.isPlaying = true;
        this.startTime = this.audioContext.currentTime - this.pauseTime;

        this.tracks.forEach(track => {
            track.source = this.audioContext.createBufferSource();
            track.source.buffer = track.buffer;
            track.source.connect(track.analyser);
            track.source.start(this.audioContext.currentTime, this.pauseTime);
        });

        this.onStateChange({ isPlaying: true });
        this._startProgressLoop();
    }

    async forceUnlock() {
        if (this.isUnlocked) return;
        
        try {
            const buffer = this.audioContext.createBuffer(1, 1, 22050);
            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(this.audioContext.destination);
            
            if (source.start) {
                source.start(0);
            } else if (source.noteOn) {
                source.noteOn(0);
            }
            
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            if (this.audioContext.state === 'running') {
                this.isUnlocked = true;
                console.log('AudioContext forçadamente desbloqueado!');
            }
        } catch (e) {
            console.error('Erro ao forçar desbloqueio:', e);
        }
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

    linearToLogarithmicGain(linearValue) {
        if (linearValue === 1.0) return 1.0;
        const minDb = -60;
        const maxDb = 6;
        const normalizedValue = linearValue / 1.5;
        const gainDb = normalizedValue * (maxDb - minDb) + minDb;
        return Math.pow(10, gainDb / 20);
    }

    _updateGains() {
        const anyTrackSoloed = this.tracks.some(t => t.isSoloed);

        this.tracks.forEach(track => {
            let newGain = this.linearToLogarithmicGain(track.volume);

            if (track.isMuted) {
                newGain = 0;
            } else if (anyTrackSoloed) {
                if (!track.isSoloed) {
                    newGain = 0;
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
