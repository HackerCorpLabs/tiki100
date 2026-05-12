cmake_minimum_required(VERSION 3.14)

# Prevent in-source builds to protect the existing Makefile
if(CMAKE_SOURCE_DIR STREQUAL CMAKE_BINARY_DIR)
    message(FATAL_ERROR
        "In-source builds are not allowed!\n"
        "This would overwrite the existing Makefile in the root folder.\n"
        "Please create a build directory and run cmake from there:\n"
        "  mkdir -p build && cd build && cmake ..\n"
        "To remove files created by an attempted in-source build, run:\n"
        "  rm -rf CMakeCache.txt CMakeFiles/\n"
    )
endif()

project(tiki100 VERSION 1.0.3 DESCRIPTION "TIKI-100 Emulator" LANGUAGES C)

# Options
option(BUILD_WASM "Build for WebAssembly using Emscripten" OFF)
option(DEBUGGER_ENABLED "Enable Z80 debugger support" ON)

# Platform detection - WIN32 is set by CMake on all Windows builds
# (MSVC, MinGW, w64devkit, MSYS2) regardless of CMAKE_SYSTEM_NAME.
if(WIN32)
    set(PLATFORM_WINDOWS TRUE)
    enable_language(RC)
    message(STATUS "Building for Windows (WIN32)")
elseif(CMAKE_SYSTEM_NAME STREQUAL "Linux")
    set(PLATFORM_LINUX TRUE)
    message(STATUS "Building for Linux")
elseif(APPLE)
    set(PLATFORM_MACOS TRUE)
    message(STATUS "Building for macOS")
elseif(CMAKE_SYSTEM_NAME STREQUAL "Emscripten")
    set(PLATFORM_WASM TRUE)
    message(STATUS "Building for WebAssembly")
else()
    message(WARNING "Unsupported platform: ${CMAKE_SYSTEM_NAME}")
endif()

# Handle debugger configuration
if(DEBUGGER_ENABLED)
    add_definitions(-DDEBUG)
    message(STATUS "Z80 debugger support enabled")
else()
    message(STATUS "Z80 debugger support disabled")
endif()

# Endianness - default to little-endian (x86/ARM)
add_definitions(-DLSB_FIRST)

# Expose project version to C code
add_definitions(-DTIKI100_VERSION="${PROJECT_VERSION}")

# Find SDL2 for native builds
if(NOT (PLATFORM_WASM OR BUILD_WASM))
    set(VENDORED_SDL2_DIR "${CMAKE_SOURCE_DIR}/external/SDL2")
    if(PLATFORM_WINDOWS AND EXISTS "${VENDORED_SDL2_DIR}")
        # Vendored MinGW SDL2 devel release ships CMake config files under
        # x86_64-w64-mingw32/lib/cmake/SDL2/ (or i686-w64-mingw32/ for 32-bit).
        if(CMAKE_SIZEOF_VOID_P EQUAL 8)
            set(SDL2_ARCH_DIR "x86_64-w64-mingw32")
        else()
            set(SDL2_ARCH_DIR "i686-w64-mingw32")
        endif()
        set(SDL2_DIR "${VENDORED_SDL2_DIR}/${SDL2_ARCH_DIR}/lib/cmake/SDL2" CACHE PATH "SDL2 config dir")
        find_package(SDL2 REQUIRED CONFIG)
        if(TARGET SDL2::SDL2)
            set(SDL2_LIBRARIES SDL2::SDL2)
        endif()
        message(STATUS "SDL2 found (vendored, ${SDL2_ARCH_DIR}): ${SDL2_VERSION}")
    elseif(PLATFORM_MACOS)
        # Homebrew installs SDL2 cmake config files under its prefix.
        # Check both Apple Silicon (/opt/homebrew) and Intel (/usr/local).
        foreach(_brew_prefix IN ITEMS /opt/homebrew /usr/local)
            if(IS_DIRECTORY "${_brew_prefix}/lib/cmake/SDL2")
                list(PREPEND CMAKE_PREFIX_PATH "${_brew_prefix}")
                break()
            endif()
        endforeach()
        find_package(SDL2 QUIET CONFIG)
        if(SDL2_FOUND AND TARGET SDL2::SDL2)
            set(SDL2_LIBRARIES SDL2::SDL2)
            if(NOT SDL2_INCLUDE_DIRS)
                get_target_property(SDL2_INCLUDE_DIRS SDL2::SDL2 INTERFACE_INCLUDE_DIRECTORIES)
            endif()
            message(STATUS "SDL2 found (cmake config): ${SDL2_VERSION}")
        else()
            find_package(PkgConfig REQUIRED)
            pkg_check_modules(SDL2 REQUIRED sdl2)
            message(STATUS "SDL2 found (pkg-config): ${SDL2_VERSION}")
        endif()
    else()
        # Linux / Raspberry Pi
        find_package(PkgConfig REQUIRED)
        pkg_check_modules(SDL2 REQUIRED sdl2)
        message(STATUS "SDL2 found (pkg-config): ${SDL2_VERSION}")
    endif()
endif()

# Output directories
set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)

# Add subdirectories in dependency order
add_subdirectory(src/cpu)
add_subdirectory(src/devices)
add_subdirectory(src/debugger)
add_subdirectory(src/machine)

# Add frontend subdirectories conditionally
if(BUILD_WASM)
    add_subdirectory(src/frontend/tiki100wasm)
else()
    add_subdirectory(src/frontend/tiki100sdl)
endif()

# Copy ROM files and catalog to build output
file(MAKE_DIRECTORY "${CMAKE_BINARY_DIR}/bin/rom")
file(GLOB ROM_FILES "${CMAKE_SOURCE_DIR}/rom/tikirom-*")
foreach(ROM_FILE ${ROM_FILES})
    get_filename_component(ROM_NAME ${ROM_FILE} NAME)
    configure_file(${ROM_FILE} "${CMAKE_BINARY_DIR}/bin/rom/${ROM_NAME}" COPYONLY)
endforeach()

# Copy JSON catalogs for the F12 config menu
file(MAKE_DIRECTORY "${CMAKE_BINARY_DIR}/bin/disks/boot")
file(MAKE_DIRECTORY "${CMAKE_BINARY_DIR}/bin/disks/library")
configure_file("${CMAKE_SOURCE_DIR}/rom/roms.json"
    "${CMAKE_BINARY_DIR}/bin/rom/roms.json" COPYONLY)
configure_file("${CMAKE_SOURCE_DIR}/disks/boot/floppies.json"
    "${CMAKE_BINARY_DIR}/bin/disks/boot/floppies.json" COPYONLY)
configure_file("${CMAKE_SOURCE_DIR}/disks/library/floppies.json"
    "${CMAKE_BINARY_DIR}/bin/disks/library/floppies.json" COPYONLY)

# Display build configuration
message(STATUS "")
message(STATUS "======================= Build Configuration =====================")
message(STATUS "Debugger support: ${DEBUGGER_ENABLED}")
message(STATUS "Platform: ${CMAKE_SYSTEM_NAME}")
message(STATUS "================================================================")
message(STATUS "")
