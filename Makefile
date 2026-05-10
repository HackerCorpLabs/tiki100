# TIKI-100 Emulator Makefile - CMake wrapper
# Based on the TIKI-100 emulator by Asbjorn Djupdal 2000-2001

# Build directories
BUILD_DIR = build
BUILD_DIR_RELEASE = build_release
BUILD_DIR_WASM = build_wasm
BUILD_DIR_WASM_GLASS = build_wasm_glass

# Commands
CMAKE = cmake
EMCMAKE = emcmake

# Options
DEBUGGER_ENABLED ?= ON

# CMake generator selection.
# On Windows (w64devkit / MSYS2) we force Ninja so CMake does not default to
# Visual Studio (which would require MSVC and fail on a pure MinGW setup).
# On Linux / macOS / Raspberry Pi, we let CMake pick its default (Unix Makefiles).
ifeq ($(OS),Windows_NT)
    CMAKE_GENERATOR_FLAG := -G Ninja
else
    CMAKE_GENERATOR_FLAG :=
endif

# Default target
.PHONY: all
all: debug

# Detect host platform (Windows via MSYS/MinGW vs Unix-likes)
UNAME_S := $(shell uname -s 2>/dev/null)
ifeq ($(findstring MINGW,$(UNAME_S)),MINGW)
    HOST_WINDOWS := 1
endif
ifeq ($(findstring MSYS,$(UNAME_S)),MSYS)
    HOST_WINDOWS := 1
endif
ifeq ($(OS),Windows_NT)
    HOST_WINDOWS := 1
endif

# Check for required dependencies
.PHONY: check-deps
check-deps:
	@echo "Checking dependencies..."
	@command -v cmake >/dev/null 2>&1 || { echo "Error: cmake not found. Please install cmake."; exit 1; }
	@command -v gcc >/dev/null 2>&1 || { echo "Error: gcc not found. Please install gcc."; exit 1; }
ifdef HOST_WINDOWS
	@# On Windows, SDL2 can come from two places:
	@#   1. A vendored MinGW devel tree at external/SDL2/  (w64devkit case)
	@#   2. MSYS2 pacman-installed SDL2 visible to pkg-config  (MSYS2 / CI case)
	@# Accept either. If neither, offer the fetch helper.
	@if [ -d external/SDL2 ]; then \
	    echo "  SDL2: vendored tree at external/SDL2/"; \
	elif pkg-config --exists sdl2 2>/dev/null; then \
	    echo "  SDL2: pkg-config ($$(pkg-config --modversion sdl2))"; \
	else \
	    echo "Error: SDL2 not found." >&2; \
	    echo "  - For w64devkit: run 'make fetch-sdl2' to download external/SDL2/" >&2; \
	    echo "  - For MSYS2:    pacman -S <mingw-prefix>-SDL2 <mingw-prefix>-pkgconf" >&2; \
	    exit 1; \
	fi
else ifeq ($(UNAME_S),Darwin)
	@# Accept SDL2 via pkg-config OR Homebrew cmake config (no pkg-config install needed)
	@if pkg-config --exists sdl2 2>/dev/null; then \
	    echo "  SDL2: pkg-config ($$(pkg-config --modversion sdl2))"; \
	elif [ -d /opt/homebrew/lib/cmake/SDL2 ] || [ -d /usr/local/lib/cmake/SDL2 ]; then \
	    echo "  SDL2: Homebrew cmake config"; \
	else \
	    echo "Error: SDL2 not found. Install with: brew install sdl2" >&2; exit 1; \
	fi
else
	@pkg-config --exists sdl2 2>/dev/null || { \
	    echo "Error: SDL2 not found. Please install libsdl2-dev." >&2; \
	    echo "  See docs/BUILDING.md for per-distro install instructions." >&2; \
	    exit 1; \
	}
endif
	@echo "All dependencies found."

# Download SDL2 MinGW devel into external/SDL2/  (local Windows dev only)
.PHONY: fetch-sdl2
fetch-sdl2:
	@sh scripts/fetch-sdl2.sh

.PHONY: debug release wasm wasm-run wasm-glass wasm-glass-run clean help

debug: check-deps
	@echo "Building debug version..."
	@mkdir -p $(BUILD_DIR)
	cd $(BUILD_DIR) && $(CMAKE) .. $(CMAKE_GENERATOR_FLAG) -DCMAKE_BUILD_TYPE=Debug -DDEBUGGER_ENABLED=$(DEBUGGER_ENABLED)
	cd $(BUILD_DIR) && $(CMAKE) --build . -j $$(nproc 2>/dev/null || echo 4)
	@echo ""
	@echo "Build complete: $(BUILD_DIR)/bin/tiki100"
	@echo "Run with: $(BUILD_DIR)/bin/tiki100 -fd0 disks/t400.dsk"

release: check-deps
	@echo "Building release version..."
	@mkdir -p $(BUILD_DIR_RELEASE)
	cd $(BUILD_DIR_RELEASE) && $(CMAKE) .. $(CMAKE_GENERATOR_FLAG) -DCMAKE_BUILD_TYPE=Release -DDEBUGGER_ENABLED=OFF
	cd $(BUILD_DIR_RELEASE) && $(CMAKE) --build . -j $$(nproc 2>/dev/null || echo 4)

wasm:
	@echo "Building WebAssembly version..."
	@command -v emcmake >/dev/null 2>&1 || { echo "Error: emcmake not found. Please install and activate Emscripten SDK."; exit 1; }
	@mkdir -p $(BUILD_DIR_WASM)
	cd $(BUILD_DIR_WASM) && $(EMCMAKE) $(CMAKE) .. -DBUILD_WASM=ON -DDEBUGGER_ENABLED=OFF
	cd $(BUILD_DIR_WASM) && $(CMAKE) --build . -- -j$$(nproc 2>/dev/null || echo 4)
	@echo ""
	@echo "WASM build complete: $(BUILD_DIR_WASM)/bin/"

wasm-glass: ts-compile
	@echo "Building WebAssembly version (glass UI)..."
	@command -v emcmake >/dev/null 2>&1 || { echo "Error: emcmake not found. Please install and activate Emscripten SDK."; exit 1; }
	@mkdir -p $(BUILD_DIR_WASM_GLASS)
	cd $(BUILD_DIR_WASM_GLASS) && $(EMCMAKE) $(CMAKE) .. -DBUILD_WASM=ON -DDEBUGGER_ENABLED=OFF
	cd $(BUILD_DIR_WASM_GLASS) && $(CMAKE) --build . -- -j$$(nproc 2>/dev/null || echo 4)
	@echo "Copying glass UI assets to build directory..."
	@mkdir -p $(BUILD_DIR_WASM_GLASS)/bin
	@cp template-glass/index.html $(BUILD_DIR_WASM_GLASS)/bin/
	@cp -r template-glass/css $(BUILD_DIR_WASM_GLASS)/bin/ 2>/dev/null || true
	@cp -r template-glass/js $(BUILD_DIR_WASM_GLASS)/bin/ 2>/dev/null || true
	@cp template-glass/favicon.ico $(BUILD_DIR_WASM_GLASS)/bin/ 2>/dev/null || true
	@cp template-glass/tiki-logo.png $(BUILD_DIR_WASM_GLASS)/bin/ 2>/dev/null || true
	@cp -r template-glass/lib $(BUILD_DIR_WASM_GLASS)/bin/ 2>/dev/null || true
	@mkdir -p $(BUILD_DIR_WASM_GLASS)/bin/rom
	@cp rom/tikirom-* $(BUILD_DIR_WASM_GLASS)/bin/rom/ 2>/dev/null || true
	@cp -r disks/boot $(BUILD_DIR_WASM_GLASS)/bin/disks/ 2>/dev/null || true
	@cp -r disks/library $(BUILD_DIR_WASM_GLASS)/bin/disks/ 2>/dev/null || true
	@mkdir -p $(BUILD_DIR_WASM_GLASS)/bin/images
	@cp images/*.jpg $(BUILD_DIR_WASM_GLASS)/bin/images/ 2>/dev/null || true
	@mkdir -p $(BUILD_DIR_WASM_GLASS)/bin/manuals
	@cp docs/manuals/*.pdf $(BUILD_DIR_WASM_GLASS)/bin/manuals/ 2>/dev/null || true
	@cp docs/manuals/manuals.json $(BUILD_DIR_WASM_GLASS)/bin/manuals/ 2>/dev/null || true
	@cp docs/Intro.pdf $(BUILD_DIR_WASM_GLASS)/bin/manuals/ 2>/dev/null || true
	@mkdir -p $(BUILD_DIR_WASM_GLASS)/bin/disks/hdd
	@cp disks/hdd/*.dsk $(BUILD_DIR_WASM_GLASS)/bin/disks/hdd/ 2>/dev/null || true
	@# Cache-bust
	@BUILD_TS=$$(date +%s); \
	sed -i \
	  -e "s|src=\"tiki100wasm.js\"|src=\"tiki100wasm.js?v=$$BUILD_TS\"|g" \
	  -e "s|href=\"css/styles.css\"|href=\"css/styles.css?v=$$BUILD_TS\"|g" \
	  -e "s|src=\"js/\([^\"]*\)\"|src=\"js/\1?v=$$BUILD_TS\"|g" \
	  $(BUILD_DIR_WASM_GLASS)/bin/index.html 2>/dev/null || true; \
	echo "Cache-bust: v=$$BUILD_TS"
	@echo ""
	@echo "Glass UI WASM build complete: $(BUILD_DIR_WASM_GLASS)/bin/"
	@echo "Run with: make wasm-glass-run"

wasm-run: wasm
	@echo "Starting HTTP server for WASM build..."
	cd $(BUILD_DIR_WASM)/bin && python3 -m http.server 8000

wasm-glass-run: wasm-glass
	@echo "Starting HTTP server for glass UI WASM build..."
	cd $(BUILD_DIR_WASM_GLASS)/bin && python3 -m http.server 8000

# Compile TypeScript keyboard bundle (esbuild) - required for wasm-glass
.PHONY: ts-compile
ts-compile:
	@command -v npx >/dev/null 2>&1 || { echo "Error: npx not found. Install Node.js."; exit 1; }
	@echo "Compiling keyboard TypeScript..."
	cd template-glass && npx esbuild ts/keyboard/VirtualKeyboard.ts --bundle --outfile=js/keyboard.js --format=iife --global-name=TikiKeyboard --target=es2015

clean:
	@echo "Cleaning build directories..."
	rm -rf $(BUILD_DIR) $(BUILD_DIR_RELEASE) $(BUILD_DIR_WASM) $(BUILD_DIR_WASM_GLASS)

boot: debug
	@echo "Booting TIKI-100 from floppy..."
	$(BUILD_DIR)/bin/tiki100 -fd0 disks/boot/tiko_kjerne_v4.01.dsk

run: debug
	@echo "Running TIKI-100 with hard disks..."
	$(BUILD_DIR)/bin/tiki100 -hd0 disks/hdd/HD0.dsk -hd1 disks/hdd/HD1.dsk

help:
	@echo "TIKI-100 Emulator Build System"
	@echo "---------------------------------------------------------------"
	@echo "Targets:"
	@echo "  all (default)   - Same as 'debug'"
	@echo "  debug           - Build debug version (SDL2)"
	@echo "  release         - Build optimized release version"
	@echo "  fetch-sdl2      - Download SDL2 MinGW devel (local Windows / w64devkit)"
	@echo "  wasm            - Build WebAssembly version"
	@echo "  wasm-run        - Build and serve WASM version"
	@echo "  wasm-glass      - Build WASM with glassmorphism UI"
	@echo "  wasm-glass-run  - Build and serve glass UI"
	@echo "  clean           - Remove all build directories"
	@echo "  run             - Build and run with hard disk (disks/HD1.dsk)"
	@echo "  boot            - Build and boot from floppy (tiko_kjerne_v4.01.dsk)"
	@echo "  help            - Show this help"
	@echo ""
	@echo "Options (environment variables):"
	@echo "  DEBUGGER_ENABLED=ON|OFF  Enable/disable Z80 debugger"
	@echo ""
	@echo "Examples:"
	@echo "  make debug"
	@echo "  make run"
	@echo "  make wasm-glass-run"
	@echo "  DEBUGGER_ENABLED=OFF make release"
	@echo ""
