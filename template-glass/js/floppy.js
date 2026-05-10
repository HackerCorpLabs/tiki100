/* TIKI-100 Emulator - Floppy Drive Management */

(function() {
    'use strict';

    document.addEventListener('DOMContentLoaded', function() {
        setupFloppyInput('floppy-a', 0, 'btn-eject-a', 'floppy-a-status');
        setupFloppyInput('floppy-b', 1, 'btn-eject-b', 'floppy-b-status');
    });

    function setupFloppyInput(inputId, drive, ejectId, statusId) {
        var input = document.getElementById(inputId);
        var ejectBtn = document.getElementById(ejectId);
        var statusEl = document.getElementById(statusId);

        if (input) {
            input.addEventListener('change', function(e) {
                var file = e.target.files[0];
                if (!file) return;
                if (!Module || !moduleReady) return;

                /* Check if already mounted */
                if (statusEl && statusEl.textContent !== 'Empty') {
                    alert('FD' + drive + ' already has a disk. Eject first.');
                    input.value = '';
                    return;
                }

                var reader = new FileReader();
                reader.onload = function(ev) {
                    var data = new Uint8Array(ev.target.result);
                    var ptr = Module._malloc(data.length);
                    Module.HEAPU8.set(data, ptr);
                    Module._MountFloppy(drive, ptr, data.length);
                    Module._free(ptr);
                    if (statusEl) statusEl.textContent = file.name;
                    console.log('Mounted FD' + drive + ': ' + file.name + ' (' + data.length + ' bytes)');
                };
                reader.readAsArrayBuffer(file);
            });
        }

        if (ejectBtn) {
            ejectBtn.addEventListener('click', function() {
                if (!Module || !moduleReady) return;
                Module._UnmountFloppy(drive);
                if (input) input.value = '';
                if (statusEl) statusEl.textContent = 'Empty';
                console.log('Ejected FD' + drive);
            });
        }
    }
})();
