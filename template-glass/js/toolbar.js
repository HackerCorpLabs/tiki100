/* TIKI-100 Emulator - Toolbar, Menu Bar & Window Management */

(function() {
    'use strict';

    document.addEventListener('DOMContentLoaded', function() {
        var btnPower = document.getElementById('btn-power');
        var btnReset = document.getElementById('btn-reset');
        var bootSelect = null; /* replaced by radio buttons */
        var volumeSlider = document.getElementById('volume-slider');
        var volumeLabel = document.getElementById('volume-label');
        var themeSelect = document.getElementById('theme-select');
        var btnMountCatalog = document.getElementById('btn-mount-catalog');

        /* Power on/off toggle */
        if (btnPower) {
            btnPower.addEventListener('click', function() {
                if (btnPower.classList.contains('powered-on')) {
                    /* Power off */
                    Emulation.stop();
                    btnPower.classList.remove('powered-on');
                    btnPower.title = 'Power on';
                } else {
                    /* Power on */
                    var bootRadio = document.querySelector('input[name="boot-device"]:checked');
                    var mode = bootRadio ? bootRadio.value : 'floppy';
                    Emulation.start(mode);
                    btnPower.classList.add('powered-on');
                    btnPower.title = 'Power off';
                }
            });
        }

        /* Reset */
        if (btnReset) {
            btnReset.addEventListener('click', function() { Emulation.reset(); });
        }

        /* Menu bar dropdowns */
        var openMenu = null;
        document.querySelectorAll('.menu-dropdown').forEach(function(dropdown) {
            var btn = dropdown.querySelector('.menu-btn');
            var items = dropdown.querySelector('.menu-items');
            if (!btn || !items) return;

            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (openMenu === items) {
                    items.classList.remove('open');
                    openMenu = null;
                } else {
                    if (openMenu) openMenu.classList.remove('open');
                    items.classList.add('open');
                    openMenu = items;
                }
            });

            /* Prevent clicks inside menu from closing it via document handler */
            items.addEventListener('click', function(e) { e.stopPropagation(); });

            /* Hover to switch between open menus */
            btn.addEventListener('mouseenter', function() {
                if (openMenu && openMenu !== items) {
                    openMenu.classList.remove('open');
                    items.classList.add('open');
                    openMenu = items;
                }
            });

            /* Menu item clicks */
            items.querySelectorAll('button').forEach(function(item) {
                item.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var winId = this.getAttribute('data-window');
                    var url = this.getAttribute('data-url');
                    if (winId) {
                        var win = document.getElementById(winId);
                        if (win) {
                            win.style.display = '';
                            bringToFront(win);
                        }
                    } else if (url) {
                        window.open(url, '_blank', 'noopener,noreferrer');
                    }
                    items.classList.remove('open');
                    openMenu = null;
                });
            });
        });

        /* Close menus on click outside */
        document.addEventListener('click', function() {
            if (openMenu) {
                openMenu.classList.remove('open');
                openMenu = null;
            }
        });

        /* Generic window drag resize helper */
        function addResizeHandle(handleId, winId, minW, minH) {
            var handle = document.getElementById(handleId);
            var win = document.getElementById(winId);
            if (!handle || !win) return;
            var resizing = false, startX, startY, startW, startH;
            handle.addEventListener('mousedown', function(e) {
                resizing = true;
                startX = e.clientX; startY = e.clientY;
                startW = win.offsetWidth; startH = win.offsetHeight;
                e.preventDefault(); e.stopPropagation();
            });
            document.addEventListener('mousemove', function(e) {
                if (!resizing) return;
                win.style.width = Math.max(minW, startW + (e.clientX - startX)) + 'px';
                win.style.height = Math.max(minH, startH + (e.clientY - startY)) + 'px';
            });
            document.addEventListener('mouseup', function() { resizing = false; });
        }

        addResizeHandle('printer-resize', 'window-printer', 300, 200);

        /* Keyboard drag resize */
        addResizeHandle('kb-resize', 'window-keyboard', 300, 100);

        /* Keyboard zoom +/- */
        var kbZoomIn = document.getElementById('kb-zoom-in');
        var kbZoomOut = document.getElementById('kb-zoom-out');
        var kbWin = document.getElementById('window-keyboard');
        if (kbZoomIn && kbZoomOut && kbWin) {
            kbZoomIn.addEventListener('click', function(e) {
                e.stopPropagation();
                var w = kbWin.offsetWidth;
                kbWin.style.width = Math.round(w * 1.15) + 'px';
            });
            kbZoomOut.addEventListener('click', function(e) {
                e.stopPropagation();
                var w = kbWin.offsetWidth;
                kbWin.style.width = Math.max(300, Math.round(w * 0.85)) + 'px';
            });
        }

        /* Free resize toggle - shared with initScreenResize */
        window._tikiFreeResize = false;
        var freeResizeCheck = document.getElementById('free-resize');
        if (freeResizeCheck) {
            freeResizeCheck.addEventListener('change', function() {
                window._tikiFreeResize = this.checked;
            });
        }

        /* Virtual keyboard */
        var btnVK = document.getElementById('btn-vk-toggle');
        var vkContainer = document.getElementById('virtual-keyboard-container');
        if (vkContainer) {
            TikiVirtualKeyboard.init(vkContainer);
        }
        if (btnVK) {
            btnVK.addEventListener('click', function() {
                TikiVirtualKeyboard.toggle();
            });
        }

        /* CPU speed radio buttons */
        var speedRadios = document.querySelectorAll('input[name="cpu-speed"]');
        speedRadios.forEach(function(radio) {
            radio.addEventListener('change', function() {
                Emulation.setFullSpeed(this.value === 'fast');
                localStorage.setItem('tiki100-cpuspeed', this.value);
            });
        });
        var savedSpeed = localStorage.getItem('tiki100-cpuspeed');
        if (savedSpeed) {
            var r = document.querySelector('input[name="cpu-speed"][value="' + savedSpeed + '"]');
            if (r) r.checked = true;
            Emulation.setFullSpeed(savedSpeed === 'fast');
        }

        /* ROM selection */
        var btnLoadRom = document.getElementById('btn-load-rom');
        if (btnLoadRom) {
            btnLoadRom.addEventListener('click', function() {
                var romSelect = document.getElementById('rom-select');
                if (!romSelect || !Module || !moduleReady) return;
                var romFile = romSelect.value;
                console.log('Loading ROM: ' + romFile);
                /* Write to MEMFS then call loadROM which reads it and resets */
                loadFileToMEMFS('rom/' + romFile, '/' + romFile).then(function() {
                    Module.ccall('LoadROM', 'number', ['string'], ['/' + romFile]);
                    console.log('ROM switched to ' + romFile + ' and machine rebooted');
                }).catch(function(err) {
                    console.error('Failed to load ROM:', err);
                });
            });
        }

        /* Reboot button */
        var btnReboot = document.getElementById('btn-reboot');
        if (btnReboot) {
            btnReboot.addEventListener('click', function() {
                if (Module && moduleReady) Module._Reset();
            });
        }

        /* HDD file upload */
        setupHDDInput('hdd-0', 0, 'btn-eject-hd0', 'hd0-status');
        setupHDDInput('hdd-1', 1, 'btn-eject-hd1', 'hd1-status');

        /* Volume slider */
        if (volumeSlider) {
            volumeSlider.addEventListener('input', function() {
                var val = parseInt(this.value);
                if (volumeLabel) volumeLabel.textContent = val + '%';
                if (Module && moduleReady && Module._SetVolume) {
                    Module._SetVolume(val);
                }
                localStorage.setItem('tiki100-volume', val);
            });
            var savedVol = localStorage.getItem('tiki100-volume');
            if (savedVol !== null) {
                volumeSlider.value = savedVol;
                if (volumeLabel) volumeLabel.textContent = savedVol + '%';
            }
        }

        /* Theme selector (now in Machine Settings) */
        if (themeSelect) {
            themeSelect.addEventListener('change', function() {
                document.body.setAttribute('data-theme', this.value);
                localStorage.setItem('tiki100-theme', this.value);
            });
            /* Load saved theme, default to tiki */
            var saved = localStorage.getItem('tiki100-theme') || 'tiki';
            document.body.setAttribute('data-theme', saved);
            themeSelect.value = saved;
        }

        /* Boot device radio buttons */
        var bootRadios = document.querySelectorAll('input[name="boot-device"]');
        bootRadios.forEach(function(radio) {
            radio.addEventListener('change', function() {
                localStorage.setItem('tiki100-bootdevice', this.value);
            });
        });
        var savedBoot = localStorage.getItem('tiki100-bootdevice');
        if (savedBoot) {
            var r = document.querySelector('input[name="boot-device"][value="' + savedBoot + '"]');
            if (r) r.checked = true;
        }

        /* Mount from catalog */
        if (btnMountCatalog) {
            btnMountCatalog.addEventListener('click', function() {
                var catalog = document.getElementById('floppy-catalog');
                var driveSelect = document.getElementById('floppy-mount-drive');
                if (!catalog || !driveSelect) return;
                var url = catalog.value;
                var drive = parseInt(driveSelect.value);
                if (!url) return;
                if (!Module || !moduleReady) return;

                /* Check if drive already has a disk mounted */
                var statusEl = document.getElementById(drive === 0 ? 'floppy-a-status' : 'floppy-b-status');
                if (statusEl && statusEl.textContent !== 'Empty') {
                    alert('FD' + drive + ' already has a disk mounted. Eject it first.');
                    return;
                }

                loadAndMountFloppy(url, drive).then(function() {
                    if (statusEl) statusEl.textContent = url.split('/').pop();
                });
            });
        }

        /* Printer controls */
        var btnPrinterClear = document.getElementById('btn-printer-clear');
        var btnPrinterCopy = document.getElementById('btn-printer-copy');
        if (btnPrinterClear) {
            btnPrinterClear.addEventListener('click', function() {
                var output = document.getElementById('printer-output');
                if (output) output.textContent = '';
                if (Module && moduleReady && Module._ClearPrinterBuffer)
                    Module._ClearPrinterBuffer();
            });
        }
        if (btnPrinterCopy) {
            btnPrinterCopy.addEventListener('click', function() {
                var output = document.getElementById('printer-output');
                if (output && output.textContent) {
                    navigator.clipboard.writeText(output.textContent).then(function() {
                        console.log('Printer output copied to clipboard');
                    });
                }
            });
        }

        /* Poll printer buffer every 500ms */
        setInterval(function() {
            if (!Module || !moduleReady || !Module._GetPrinterBufferLen) return;
            var len = Module._GetPrinterBufferLen();
            if (len > 0) {
                var ptr = Module._GetPrinterBuffer();
                var text = Module.UTF8ToString(ptr, len);
                var output = document.getElementById('printer-output');
                if (output) {
                    output.textContent += text;
                    output.scrollTop = output.scrollHeight;
                }
                Module._ClearPrinterBuffer();
            }
        }, 500);

        /* Load floppy catalog */
        loadFloppyCatalog();
        loadManuals();

        /* Alt+key shortcuts for TIKI special keys */
        var altKeyMap = {
            'KeyG': 0x84,  /* Alt+G = GRAFIKK */
            'KeyB': 0x03,  /* Alt+B = BRYT */
            'KeyA': 0x1a,  /* Alt+A = ANGRE */
            'KeyL': 0x83,  /* Alt+L = LOCK */
            'KeyH': 0x0a,  /* Alt+H = HJELP */
            'KeyU': 0x05,  /* Alt+U = UTVID */
        };

        /* Keyboard input */
        document.addEventListener('keydown', function(e) {
            if (!Emulation.isRunning()) return;
            if (!Module || !Module._SendKey) return;

            /* Alt shortcuts for TIKI special keys */
            if (e.altKey && altKeyMap[e.code] !== undefined) {
                Module._SendKey(altKeyMap[e.code], 1);
                e.preventDefault();
                return;
            }

            var key = mapKeyToTiki(e.code, e.key);
            if (key !== null) {
                Module._SendKey(key, 1);
                e.preventDefault();
            }
        });

        document.addEventListener('keyup', function(e) {
            if (!Emulation.isRunning()) return;
            if (!Module || !Module._SendKey) return;

            if (e.altKey && altKeyMap[e.code] !== undefined) {
                Module._SendKey(altKeyMap[e.code], 0);
                e.preventDefault();
                return;
            }

            var key = mapKeyToTiki(e.code, e.key);
            if (key !== null) {
                Module._SendKey(key, 0);
                e.preventDefault();
            }
        });

        initDraggableWindows();
        initScreenMaximize();
        initScreenZoom();
        initScreenResize();
        initScreenAutoFit();
        initTaskbar();
    });

    function loadFloppyCatalog() {
        var catalog = document.getElementById('floppy-catalog');
        if (!catalog) return;

        fetch('disks/boot/floppies.json').then(function(r) { return r.json(); }).then(function(data) {
            if (data.floppies) {
                var group = document.createElement('optgroup');
                group.label = 'Boot Disks';
                data.floppies.forEach(function(f) {
                    var opt = document.createElement('option');
                    opt.value = 'disks/boot/' + f.file;
                    opt.textContent = '[' + (f.size || '?') + 'K] ' + f.label;
                    group.appendChild(opt);
                });
                catalog.appendChild(group);
            }
        }).catch(function() {});

        fetch('disks/library/floppies.json').then(function(r) { return r.json(); }).then(function(data) {
            if (data.floppies) {
                var group = document.createElement('optgroup');
                group.label = 'Software Library';
                data.floppies.forEach(function(f) {
                    var opt = document.createElement('option');
                    opt.value = 'disks/library/' + f.file;
                    opt.textContent = '[' + (f.size || '?') + 'K] ' + f.label;
                    group.appendChild(opt);
                });
                catalog.appendChild(group);
            }
        }).catch(function() {});
    }

    /* Load manuals.json and dynamically add entries to Help menu */
    function loadManuals() {
        fetch('manuals/manuals.json').then(function(r) {
            if (!r.ok) throw new Error('not found');
            return r.json();
        }).then(function(data) {
            if (!data.manuals || !data.manuals.length) return;

            /* Find the Help menu items container */
            var helpMenus = document.querySelectorAll('.menu-items');
            var helpItems = null;
            helpMenus.forEach(function(menu) {
                var prev = menu.previousElementSibling;
                if (prev && prev.textContent.trim() === 'Help') helpItems = menu;
            });
            if (!helpItems) return;

            /* Add separator */
            var sep = document.createElement('hr');
            sep.className = 'config-divider';
            sep.style.margin = '4px 8px';
            helpItems.appendChild(sep);

            /* Add manual entries */
            var manualCounter = 0;
            data.manuals.forEach(function(m) {
                var btn = document.createElement('button');
                btn.textContent = m.label;
                var winId = 'window-manual-' + (manualCounter++);
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    openManualWindow(winId, m.label, encodeURI('manuals/' + m.file));
                    helpItems.classList.remove('open');
                });
                helpItems.appendChild(btn);
            });
        }).catch(function() {
            /* No manuals.json - skip silently */
        });
    }

    /* Create or show a PDF manual in a glass window */
    var manualWindows = {};
    function openManualWindow(id, title, url) {
        if (manualWindows[id]) {
            manualWindows[id].style.display = '';
            bringToFront(manualWindows[id]);
            return;
        }

        var win = document.createElement('div');
        win.className = 'glass-window';
        win.id = id;
        win.style.width = '800px';
        win.style.height = '600px';
        win.style.top = '40px';
        win.style.left = '100px';
        win.style.display = 'flex';
        win.style.flexDirection = 'column';
        win.style.zIndex = '10';

        var popoutWindow = null;

        win.innerHTML =
            '<div class="window-header">' +
            '  <span class="window-title">' + title + '</span>' +
            '  <div class="window-controls">' +
            '    <button class="window-btn window-popout" title="Pop out to new window">' +
            '      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 1h4v4M11 1L6 6M4 1H2a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V8"/></svg>' +
            '    </button>' +
            '    <button class="window-btn window-close" title="Close">x</button>' +
            '  </div>' +
            '</div>' +
            '<div class="window-body" style="padding:0;flex:1;overflow:hidden;">' +
            '  <iframe src="' + url + '" style="width:100%;height:100%;border:none;"></iframe>' +
            '</div>' +
            '<div class="resize-handle"></div>';

        /* Close button */
        win.querySelector('.window-close').addEventListener('click', function() {
            win.style.display = 'none';
        });

        /* Pop-out button */
        win.querySelector('.window-popout').addEventListener('click', function(e) {
            e.stopPropagation();
            if (popoutWindow && !popoutWindow.closed) {
                /* Pop back in: close external window, show inline */
                popoutWindow.close();
                popoutWindow = null;
                win.style.display = '';
                win.querySelector('.window-popout').title = 'Pop out to new window';
            } else {
                /* Pop out: open in new browser window, hide inline */
                popoutWindow = window.open(url, title.replace(/\s/g, '_'),
                    'width=900,height=700,menubar=no,toolbar=no,location=no,status=no');
                if (popoutWindow) {
                    win.style.display = 'none';
                    /* Poll for window close to pop back in */
                    var pollClose = setInterval(function() {
                        if (popoutWindow && popoutWindow.closed) {
                            popoutWindow = null;
                            win.style.display = '';
                            clearInterval(pollClose);
                        }
                    }, 500);
                }
            }
        });

        /* Draggable header */
        var header = win.querySelector('.window-header');
        var isDragging = false, startX, startY, origLeft, origTop;
        header.addEventListener('mousedown', function(e) {
            if (e.target.classList.contains('window-btn')) return;
            isDragging = true;
            startX = e.clientX; startY = e.clientY;
            var rect = win.getBoundingClientRect();
            origLeft = rect.left; origTop = rect.top;
            e.preventDefault();
        });
        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            win.style.left = (origLeft + e.clientX - startX) + 'px';
            win.style.top = (origTop + e.clientY - startY) + 'px';
        });
        document.addEventListener('mouseup', function() { isDragging = false; });

        /* Resize handle */
        var handle = win.querySelector('.resize-handle');
        var isResizing = false, rsX, rsY, rsW, rsH;
        handle.addEventListener('mousedown', function(e) {
            isResizing = true;
            rsX = e.clientX; rsY = e.clientY;
            rsW = win.offsetWidth; rsH = win.offsetHeight;
            e.preventDefault(); e.stopPropagation();
        });
        document.addEventListener('mousemove', function(e) {
            if (!isResizing) return;
            win.style.width = Math.max(400, rsW + (e.clientX - rsX)) + 'px';
            win.style.height = Math.max(300, rsH + (e.clientY - rsY)) + 'px';
        });
        document.addEventListener('mouseup', function() { isResizing = false; });

        document.querySelector('.main-content').appendChild(win);
        bringToFront(win);
        manualWindows[id] = win;
    }

    function mapKeyToTiki(code, key) {
        /* Use e.code for all keys to get the BASE key regardless of shift state.
         * The TIKI-100 keyboard matrix handles shift internally -
         * we send Shift as a separate key and the base key unshifted. */
        switch (code) {
            case 'ControlLeft':
            case 'ControlRight': return 0x81;
            case 'ShiftLeft':
            case 'ShiftRight':   return 0x82;
            case 'Enter':        return 0x0d;
            case 'Space':        return 0x20;
            case 'Backspace':    return 0x7f;
            case 'Delete':       return 0x7f;
            case 'CapsLock':     return 0x83;
            case 'ArrowLeft':    return 0x08;
            case 'ArrowRight':   return 0x0c;
            case 'ArrowUp':      return 0x0b;
            case 'ArrowDown':    return 0x1c;
            case 'PageUp':       return 0x17;
            case 'PageDown':     return 0x1f;
            case 'Home':         return 0x09;
            case 'Tab':          return 0x18;
            case 'F1':           return 0x01;
            case 'F2':           return 0x02;
            case 'F3':           return 0x06;
            case 'F4':           return 0x07;
            case 'F5':           return 0x0e;
            case 'F6':           return 0x0f;
            case 'F7':           return 0x83;
            case 'F8':           return 0x84;
            case 'F9':           return 0x1a;
            case 'F10':          return 0x03;
            case 'F11':          return 0x0a;
            /* Letters - use code to get base key */
            case 'KeyA': return 0x61; case 'KeyB': return 0x62;
            case 'KeyC': return 0x63; case 'KeyD': return 0x64;
            case 'KeyE': return 0x65; case 'KeyF': return 0x66;
            case 'KeyG': return 0x67; case 'KeyH': return 0x68;
            case 'KeyI': return 0x69; case 'KeyJ': return 0x6a;
            case 'KeyK': return 0x6b; case 'KeyL': return 0x6c;
            case 'KeyM': return 0x6d; case 'KeyN': return 0x6e;
            case 'KeyO': return 0x6f; case 'KeyP': return 0x70;
            case 'KeyQ': return 0x71; case 'KeyR': return 0x72;
            case 'KeyS': return 0x73; case 'KeyT': return 0x74;
            case 'KeyU': return 0x75; case 'KeyV': return 0x76;
            case 'KeyW': return 0x77; case 'KeyX': return 0x78;
            case 'KeyY': return 0x79; case 'KeyZ': return 0x7a;
            /* Digits - always send base digit regardless of shift */
            case 'Digit0': return 0x30; case 'Digit1': return 0x31;
            case 'Digit2': return 0x32; case 'Digit3': return 0x33;
            case 'Digit4': return 0x34; case 'Digit5': return 0x35;
            case 'Digit6': return 0x36; case 'Digit7': return 0x37;
            case 'Digit8': return 0x38; case 'Digit9': return 0x39;
            /* Punctuation - base key codes */
            case 'Comma':        return 0x2c; /* , */
            case 'Period':       return 0x2e; /* . */
            case 'Minus':        return 0x2b; /* + on Nordic (physical key right of 0) */
            case 'Equal':        return 0x27; /* ' on Nordic (dead key position) */
            case 'BracketLeft':  return 0xe5; /* aa on Nordic */
            case 'BracketRight': return 0x5e; /* ^ */
            case 'Semicolon':    return 0xf8; /* oe on Nordic */
            case 'Quote':        return 0xe6; /* ae on Nordic */
            case 'Backslash':    return 0x27; /* ' */
            case 'Slash':        return 0x2d; /* - */
            case 'Backquote':    return 0x3c; /* < */
            case 'IntlBackslash': return 0x3c; /* < on Nordic */
        }
        return null;
    }

    function setupHDDInput(inputId, drive, ejectId, statusId) {
        var input = document.getElementById(inputId);
        var ejectBtn = document.getElementById(ejectId);
        var statusEl = document.getElementById(statusId);

        if (input) {
            input.addEventListener('change', function(e) {
                var file = e.target.files[0];
                if (!file) return;
                if (!Module || !moduleReady) return;
                if (statusEl && statusEl.textContent !== 'Not mounted') {
                    alert('HD' + drive + ' already mounted. Eject first.');
                    input.value = '';
                    return;
                }
                var reader = new FileReader();
                reader.onload = function(ev) {
                    var data = new Uint8Array(ev.target.result);
                    var ptr = Module._malloc(data.length);
                    Module.HEAPU8.set(data, ptr);
                    Module._MountHDD(drive, ptr, data.length);
                    Module._free(ptr);
                    if (statusEl) statusEl.textContent = file.name;
                    console.log('Mounted HD' + drive + ': ' + file.name + ' (' + data.length + ' bytes)');
                };
                reader.readAsArrayBuffer(file);
            });
        }

        if (ejectBtn) {
            ejectBtn.addEventListener('click', function() {
                if (!Module || !moduleReady) return;
                Module._UnmountHDD(drive);
                if (input) input.value = '';
                if (statusEl) statusEl.textContent = 'Not mounted';
                console.log('Ejected HD' + drive);
            });
        }
    }

    /* Window z-index manager (ported from nd100x) */
    var zCounter = 100;

    function bringToFront(win) {
        if (!win) return;
        if (zCounter >= 8899) {
            zCounter = 100;
            document.querySelectorAll('.glass-window').forEach(function(w) {
                w.style.zIndex = '10';
            });
        }
        zCounter++;
        win.style.zIndex = zCounter;
    }

    function initTaskbar() {
        var taskbar = document.getElementById('window-taskbar');
        if (!taskbar) return;

        /* Click-to-focus on all glass windows */
        document.querySelectorAll('.glass-window').forEach(function(win) {
            win.addEventListener('mousedown', function() {
                bringToFront(win);
            });
        });

        function updateTaskbar() {
            var windows = document.querySelectorAll('.glass-window');
            var buttons = [];

            windows.forEach(function(win) {
                var titleEl = win.querySelector('.window-title');
                if (!titleEl) return;
                var id = win.id;
                var name = titleEl.textContent;
                var visible = win.style.display !== 'none';

                if (visible) {
                    buttons.push({id: id, name: name});
                }
            });

            /* Only rebuild if changed */
            var currentIds = [];
            taskbar.querySelectorAll('.taskbar-btn').forEach(function(b) {
                currentIds.push(b.getAttribute('data-win-id'));
            });

            var newIds = buttons.map(function(b) { return b.id; });
            if (JSON.stringify(currentIds) === JSON.stringify(newIds)) return;

            taskbar.innerHTML = '';
            buttons.forEach(function(b) {
                var btn = document.createElement('button');
                btn.className = 'taskbar-btn';
                btn.setAttribute('data-win-id', b.id);
                btn.textContent = b.name;
                btn.addEventListener('click', function() {
                    var win = document.getElementById(b.id);
                    if (!win) return;
                    /* Bring to front */
                    bringToFront(win);
                    /* If hidden, show it */
                    if (win.style.display === 'none') {
                        win.style.display = '';
                    }
                });
                taskbar.appendChild(btn);
            });
        }

        /* Update every 500ms */
        setInterval(updateTaskbar, 500);
        updateTaskbar();
    }

    function initScreenMaximize() {
        var btn = document.getElementById('screen-maximize');
        var icon = document.getElementById('screen-maximize-icon');
        var win = document.getElementById('window-screen');
        if (!btn || !icon || !win) return;

        /* SVG paths from nd100x */
        var expandSVG = '<polyline points="9,1 13,1 13,5"/><line x1="13" y1="1" x2="8" y2="6"/><polyline points="5,13 1,13 1,9"/><line x1="1" y1="13" x2="6" y2="8"/>';
        var collapseSVG = '<polyline points="5,1 1,1 1,5"/><line x1="1" y1="1" x2="6" y2="6"/><polyline points="9,13 13,13 13,9"/><line x1="13" y1="13" x2="8" y2="8"/>';

        var savedRect = null;

        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (win.classList.contains('maximized')) {
                /* Restore */
                win.classList.remove('maximized');
                win.removeAttribute('data-manual-resize');
                if (savedRect) {
                    win.style.left = savedRect.left;
                    win.style.top = savedRect.top;
                    win.style.width = savedRect.width;
                    win.style.height = savedRect.height;
                }
                icon.innerHTML = expandSVG;
                btn.title = 'Maximize';
            } else {
                /* Save and maximize - fit 2:1 aspect ratio in available space */
                savedRect = {
                    left: win.style.left,
                    top: win.style.top,
                    width: win.style.width,
                    height: win.style.height
                };

                var container = win.parentElement;
                var availW = container.clientWidth;
                var availH = container.clientHeight;
                var headerH = 32; /* window header height */
                var bodyH = availH - headerH;

                /* Snap to integer multiple of 512x256 */
                var scale = Math.max(1, Math.min(
                    Math.floor(availW / 512),
                    Math.floor(bodyH / 256)
                ));
                var fitW = 512 * scale;
                var fitH = 256 * scale + headerH;
                if (false) { /* keep structure for brace matching */
                }

                /* Center horizontally */
                var left = Math.max(0, (availW - fitW) / 2);

                win.classList.add('maximized');
                win.style.left = left + 'px';
                win.style.top = '0px';
                win.style.width = fitW + 'px';
                win.style.height = fitH + 'px';

                icon.innerHTML = collapseSVG;
                btn.title = 'Restore';
            }
        });
    }

    function initScreenZoom() {
        var win = document.getElementById('window-screen');
        var btnIn = document.getElementById('screen-zoom-in');
        var btnOut = document.getElementById('screen-zoom-out');
        if (!win || !btnIn || !btnOut) return;

        function setScale(newScale) {
            if (newScale < 1) return;
            var headerH = 32;
            win.style.width = (512 * newScale) + 'px';
            win.style.height = (256 * newScale + headerH) + 'px';
            win.setAttribute('data-manual-resize', '1');
            win.classList.remove('maximized');
        }

        function getCurrentScale() {
            var bodyH = win.offsetHeight - 32;
            return Math.max(1, Math.round(bodyH / 256));
        }

        btnIn.addEventListener('click', function(e) {
            e.stopPropagation();
            setScale(getCurrentScale() + 1);
        });

        btnOut.addEventListener('click', function(e) {
            e.stopPropagation();
            setScale(getCurrentScale() - 1);
        });
    }

    function initScreenAutoFit() {
        var win = document.getElementById('window-screen');
        if (!win) return;

        function fitScreen() {
            /* Don't auto-fit if manually resized or maximized */
            if (win.classList.contains('maximized')) return;
            if (win.getAttribute('data-manual-resize')) return;

            var container = win.parentElement;
            if (!container) return;
            var availW = container.clientWidth - 40;
            var availH = container.clientHeight - 40;
            var headerH = 32;

            /* Snap to integer multiple of 512x256 (MEDRES base resolution).
             * This ensures crisp pixel rendering with no fractional scaling. */
            var bodyH = availH - headerH;
            var scale = Math.max(1, Math.min(
                Math.floor(availW / 512),
                Math.floor(bodyH / 256)
            ));
            var fitW = 512 * scale;
            var fitH = 256 * scale + headerH;

            win.style.width = fitW + 'px';
            win.style.height = fitH + 'px';
            win.style.left = '20px';
            win.style.top = '20px';
        }

        /* Fit on load and browser resize */
        fitScreen();
        window.addEventListener('resize', fitScreen);
    }

    function initScreenResize() {
        var handle = document.getElementById('screen-resize');
        var win = document.getElementById('window-screen');
        if (!handle || !win) return;

        var isResizing = false;
        var startX, startY, startW, startH;

        handle.addEventListener('mousedown', function(e) {
            if (win.classList.contains('maximized')) return;
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startW = win.offsetWidth;
            startH = win.offsetHeight;
            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('mousemove', function(e) {
            if (!isResizing) return;
            var newW = Math.max(512, startW + (e.clientX - startX));
            var newH = Math.max(288, startH + (e.clientY - startY));
            var headerH = 32;

            if (window._tikiFreeResize) {
                /* Free resize - any size, may have non-integer pixel scaling */
                win.style.width = newW + 'px';
                win.style.height = newH + 'px';
            } else {
                /* Snap to integer multiples of 512x256 for crisp pixels */
                var scale = Math.max(1, Math.min(
                    Math.floor(newW / 512),
                    Math.floor((newH - headerH) / 256)
                ));
                win.style.width = (512 * scale) + 'px';
                win.style.height = (256 * scale + headerH) + 'px';
            }
            win.setAttribute('data-manual-resize', '1');
        });

        document.addEventListener('mouseup', function() {
            isResizing = false;
        });
    }

    function initDraggableWindows() {
        document.querySelectorAll('.glass-window').forEach(function(win) {
            var header = win.querySelector('.window-header');
            if (!header) return;

            var isDragging = false;
            var startX, startY, origLeft, origTop;

            header.addEventListener('mousedown', function(e) {
                if (e.target.classList.contains('window-btn')) return;
                if (win.classList.contains('maximized')) return;
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                var rect = win.getBoundingClientRect();
                origLeft = rect.left;
                origTop = rect.top;
                win.style.position = 'absolute';
                e.preventDefault();
            });

            document.addEventListener('mousemove', function(e) {
                if (!isDragging) return;
                win.style.left = (origLeft + e.clientX - startX) + 'px';
                win.style.top = (origTop + e.clientY - startY) + 'px';
                win.style.right = 'auto';
                win.style.bottom = 'auto';
            });

            document.addEventListener('mouseup', function() { isDragging = false; });

            var closeBtn = win.querySelector('.window-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', function() { win.style.display = 'none'; });
            }
        });
    }
})();
