(() => {
    const player = document.querySelector('.player');
    const frameCount = Number(player.dataset.frameCount);
    const sourceFps = Number(player.dataset.sourceFps || 12);
    const framePath = player.dataset.framePath;
    const frame = document.getElementById('frame');
    const screen = document.querySelector('.screen');
    const frameNumber = document.getElementById('frameNumber');
    const timeDisplay = document.getElementById('timeDisplay');
    const seekBar = document.getElementById('seekBar');
    const playButton = document.getElementById('playButton');
    const fpsSelect = document.getElementById('fpsSelect');
    const loopButton = document.getElementById('loopButton');
    const settings = document.getElementById('settings');
    const cache = new Map();
    const jumpFrames = sourceFps * 10;
    const storageKey = `frame-player:${framePath}`;
    let index = 0;
    let fps = Number(fpsSelect.value);
    let playing = true;
    let looping = true;
    let rafId = 0;
    let lastPaintTime = 0;
    let playbackPosition = 0;

    const formatTime = (frameIndex) => {
        const totalSeconds = Math.floor(frameIndex / sourceFps);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        return `${minutes}:${seconds}`;
    };

    const getFramePath = (frameIndex) => {
        const number = String(frameIndex + 1).padStart(6, '0');
        return `${framePath}/frame_${number}.jpeg`;
    };

    const updateStatus = () => {
        frameNumber.textContent = `${index + 1} / ${frameCount}`;
        timeDisplay.textContent = `${formatTime(index)} / ${formatTime(frameCount - 1)}`;
        seekBar.value = index;
    };

    const pruneCache = () => {
        while (cache.size > 10) cache.delete(cache.keys().next().value);
    };

    const preloadFrame = (frameIndex) => {
        if (frameIndex < 0 || frameIndex >= frameCount || cache.has(frameIndex)) return;
        const image = new Image();
        image.decoding = 'async';
        image.src = getFramePath(frameIndex);
        cache.set(frameIndex, image.src);
        image.onload = pruneCache;
        image.onerror = () => cache.delete(frameIndex);
        pruneCache();
    };

    const prefetchAround = () => {
        for (let offset = -4; offset <= 4; offset++) preloadFrame(index + offset);
    };

    const showFrame = () => {
        index = Math.max(0, Math.min(index, frameCount - 1));
        const src = cache.get(index) || getFramePath(index);
        frame.src = src;
        updateStatus();
        prefetchAround();
    };

    const stopPlayback = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
    };

    const startPlayback = () => {
        stopPlayback();
        lastPaintTime = performance.now();
        rafId = requestAnimationFrame(playbackLoop);
    };

    const setPlaying = (shouldPlay) => {
        playing = shouldPlay;
        playButton.setAttribute('aria-pressed', String(playing));
        playButton.innerHTML = playing ? '&#9208; Pause' : '&#9654; Play';
        if (playing) startPlayback();
        else stopPlayback();
    };

    const updateFrame = (step) => {
        const nextIndex = index + step;
        if (nextIndex >= frameCount) {
            if (!looping) {
                index = frameCount - 1;
                playbackPosition = index;
                setPlaying(false);
                showFrame();
                return;
            }
            index = 0;
            playbackPosition = 0;
        } else {
            index = Math.max(nextIndex, 0);
            playbackPosition = index;
        }
        showFrame();
    };

    const playbackLoop = (timestamp) => {
        if (!playing) return;
        const elapsedMilliseconds = timestamp - lastPaintTime;
        if (elapsedMilliseconds >= 1000 / fps) {
            playbackPosition += elapsedMilliseconds * sourceFps / 1000;
            lastPaintTime = timestamp;
            const nextIndex = Math.floor(playbackPosition);
            if (nextIndex >= frameCount) {
                updateFrame(frameCount - index);
            } else if (nextIndex !== index) {
                index = nextIndex;
                showFrame();
            }
        }
        rafId = requestAnimationFrame(playbackLoop);
    };

    const jump = (amount) => {
        const wasPlaying = playing;
        setPlaying(false);
        index = Math.max(0, Math.min(index + amount, frameCount - 1));
        playbackPosition = index;
        showFrame();
        if (wasPlaying) setPlaying(true);
    };

    const setFps = (value) => {
        fps = Number(value);
        player.dataset.fps = fps;
        localStorage.setItem(storageKey, JSON.stringify({ fps, looping }));
        if (playing) startPlayback();
    };

    playButton.addEventListener('click', () => setPlaying(!playing));
    document.getElementById('backButton').addEventListener('click', () => history.back());
    document.getElementById('rewindButton').addEventListener('click', () => jump(-jumpFrames));
    document.getElementById('forwardButton').addEventListener('click', () => jump(jumpFrames));
    document.getElementById('stepBackButton').addEventListener('click', () => jump(-1));
    document.getElementById('stepForwardButton').addEventListener('click', () => jump(1));
    document.getElementById('fullscreenButton').addEventListener('click', async () => {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
            return;
        }
        const requestFullscreen = player.requestFullscreen || player.webkitRequestFullscreen;
        if (!requestFullscreen) return;
        try {
            await requestFullscreen.call(player, { navigationUI: 'hide' });
        } catch {
            await requestFullscreen.call(player);
        }
    });
    document.getElementById('zoomButton').addEventListener('click', (event) => {
        const zoomed = screen.classList.toggle('is-zoomed');
        event.currentTarget.setAttribute('aria-pressed', String(zoomed));
    });
    document.getElementById('settingsButton').addEventListener('click', () => {
        settings.hidden = !settings.hidden;
    });
    loopButton.addEventListener('click', () => {
        looping = !looping;
        loopButton.setAttribute('aria-pressed', String(looping));
        localStorage.setItem(storageKey, JSON.stringify({ fps, looping }));
    });
    fpsSelect.addEventListener('change', (event) => setFps(event.target.value));
    seekBar.addEventListener('input', () => {
        const wasPlaying = playing;
        setPlaying(false);
        index = Number(seekBar.value);
        playbackPosition = index;
        showFrame();
        if (wasPlaying) setPlaying(true);
    });

    document.addEventListener('keydown', (event) => {
        if (event.target.matches('input, select, button')) return;
        if (event.code === 'Space') { event.preventDefault(); setPlaying(!playing); }
        if (event.key === 'ArrowLeft') jump(-1);
        if (event.key === 'ArrowRight') jump(1);
        if (event.key === 'j') jump(-jumpFrames);
        if (event.key === 'l') jump(jumpFrames);
        if (event.key === 'f') document.getElementById('fullscreenButton').click();
    });

    try {
        const saved = JSON.parse(localStorage.getItem(storageKey));
        if (saved?.fps) {
            fpsSelect.value = String(saved.fps);
            setFps(saved.fps);
        }
        if (saved?.looping !== undefined) {
            looping = saved.looping;
            loopButton.setAttribute('aria-pressed', String(looping));
        }
    } catch { /* Ignore unavailable or malformed local preferences. */ }

    seekBar.max = frameCount - 1;
    const updateFullscreenButton = () => {
        const fullscreen = document.fullscreenElement === player || document.webkitFullscreenElement === player;
        document.getElementById('fullscreenButton').textContent = fullscreen ? 'EXIT FULLSCREEN' : 'FULLSCREEN';
    };
    document.addEventListener('fullscreenchange', updateFullscreenButton);
    document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
    setPlaying(true);
    showFrame();
})();
