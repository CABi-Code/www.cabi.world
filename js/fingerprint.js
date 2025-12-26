// Сбор отпечатка устройства (МИНИМАЛЬНЫЙ набор)

async function murmurHash3(key) {
    let i = 0;
    let h = 0;
    const c1 = 0xcc9e2d51;
    const c2 = 0x1b873593;
    for (; i < key.length; i++) {
        let k = key.charCodeAt(i);
        k = Math.imul(k, c1);
        k = (k << 15) | (k >>> 17);
        k = Math.imul(k, c2);
        h ^= k;
        h = (h << 13) | (h >>> 19);
        h = Math.imul(h, 5) + 0xe6546b64;
    }
    h ^= key.length;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0).toString(16);
}

export async function getFingerprint() {
    const data = {};

    // Базовые данные браузера
    data.userAgent = navigator.userAgent;
    data.language = navigator.language;
    data.languages = navigator.languages ? navigator.languages.join(',') : '';
    data.timezone = new Date().getTimezoneOffset();
    
    // ТОЛЬКО глубина цвета (24, 32 и т.д.)
    data.colorDepth = screen.colorDepth;
    
    data.doNotTrack = navigator.doNotTrack;
    data.platform = navigator.platform;
    data.cores = navigator.hardwareConcurrency || 0;

    // Canvas fingerprint
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Canvas FP', 2, 15);
    data.canvas = canvas.toDataURL();

    // WebGL fingerprint
    try {
        const glCanvas = document.createElement('canvas');
        const gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl');
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            data.webglVendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
            data.webglRenderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        }
    } catch (e) {
        data.webglVendor = data.webglRenderer = 'error';
    }

    // Audio fingerprint
    try {
        const AudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        const context = new AudioContext(1, 5000, 44100);
        const oscillator = context.createOscillator();
        oscillator.type = 'triangle';
        oscillator.frequency.value = 10000;
        const compressor = context.createDynamicsCompressor();
        oscillator.connect(compressor);
        compressor.connect(context.destination);
        oscillator.start(0);
        const buffer = await context.startRendering();
        const channelData = buffer.getChannelData(0);
        let hash = 0;
        for (let i = 0; i < channelData.length; i += 100) hash += channelData[i];
        data.audio = hash.toString();
    } catch (e) {
        data.audio = 'error';
    }

    // Список установленных шрифтов
    const fonts = ['Arial', 'Courier New', 'Georgia', 'Times New Roman', 'Verdana', 
                   'Comic Sans MS', 'Impact', 'Trebuchet MS', 'Helvetica', 'Tahoma'];
    const span = document.createElement('span');
    span.innerHTML = 'mmmmmmmmmmlli';
    span.style.fontSize = '100px';
    span.style.position = 'absolute';
    span.style.left = '-9999px';
    document.body.appendChild(span);
    const defaultWidth = span.offsetWidth;
    data.fonts = fonts.filter(f => {
        span.style.fontFamily = f;
        return span.offsetWidth !== defaultWidth;
    }).join(',');
    document.body.removeChild(span);

    // Создаём хэш из ВСЕХ данных
    const strForHash = Object.entries(data)
        .map(([, value]) => value)
        .join('|||');
    data.hash = await murmurHash3(strForHash);

    return data;
}