/* TIKI-100 Emulator - WASM Module Initialization */

var Module = null;
var moduleReady = false;

function loadTikiModule() {
    var config = {
        print: function(text) {
            console.log('[TIKI-100]', text);
        },
        printErr: function(text) {
            console.error('[TIKI-100]', text);
        },
        onRuntimeInitialized: function() {
            console.log('TIKI-100 WASM runtime initialized');
            moduleReady = true;
            if (typeof onModuleReady === 'function') {
                onModuleReady();
            }
        }
    };

    TikiModule(config).then(function(instance) {
        Module = instance;
        console.log('TIKI-100 module factory resolved');
    }).catch(function(err) {
        console.error('Failed to load TIKI-100 module:', err);
    });
}

/* Fetch a file from the webserver and write it into Emscripten MEMFS.
 * Returns a Promise that resolves when the file is written. */
function loadFileToMEMFS(url, memfsPath) {
    return fetch(url).then(function(response) {
        if (!response.ok) throw new Error('Failed to fetch ' + url + ': ' + response.status);
        return response.arrayBuffer();
    }).then(function(buffer) {
        var data = new Uint8Array(buffer);
        Module.FS.writeFile(memfsPath, data);
        console.log('MEMFS: wrote ' + memfsPath + ' (' + data.length + ' bytes)');
        return data.length;
    });
}

/* Fetch a file and pass it to the WASM MountFloppy function.
 * drive: 0=A, 1=B */
function loadAndMountFloppy(url, drive) {
    return fetch(url).then(function(response) {
        if (!response.ok) throw new Error('Failed to fetch ' + url + ': ' + response.status);
        return response.arrayBuffer();
    }).then(function(buffer) {
        var data = new Uint8Array(buffer);
        var ptr = Module._malloc(data.length);
        Module.HEAPU8.set(data, ptr);
        Module._MountFloppy(drive, ptr, data.length);
        Module._free(ptr);
        console.log('Mounted floppy drive ' + (drive === 0 ? 'A' : 'B') + ': ' + url + ' (' + data.length + ' bytes)');
    });
}

/* Fetch an HDD image and mount it via WASM MountHDD.
 * drive: 0 or 1 */
function loadHDDImage(url, drive) {
    return fetch(url).then(function(response) {
        if (!response.ok) throw new Error('Failed to fetch ' + url + ': ' + response.status);
        return response.arrayBuffer();
    }).then(function(buffer) {
        var data = new Uint8Array(buffer);
        var ptr = Module._malloc(data.length);
        Module.HEAPU8.set(data, ptr);
        Module._MountHDD(drive, ptr, data.length);
        Module._free(ptr);
        console.log('Mounted HDD drive ' + drive + ': ' + url + ' (' + data.length + ' bytes)');

        var statusEl = document.getElementById('hd' + drive + '-status');
        if (statusEl) statusEl.textContent = url.split('/').pop();
    }).catch(function(err) {
        console.warn('HDD ' + drive + ' not loaded: ' + err.message);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadTikiModule);
} else {
    loadTikiModule();
}
