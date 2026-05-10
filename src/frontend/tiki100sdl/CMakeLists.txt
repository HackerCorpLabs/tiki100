# SDL2 Native Frontend
project(tiki100sdl)

set(SOURCES
    tiki100sdl.c
    menu.c
    ${CMAKE_SOURCE_DIR}/external/tinyfiledialogs/tinyfiledialogs.c
)

# Windows resource file for embedded .exe icon.
if(WIN32)
    set(TIKI_ICO_PATH "${CMAKE_CURRENT_SOURCE_DIR}/tiki100.ico")
    # Convert forward slashes to backslashes for windres on Windows
    string(REPLACE "/" "\\\\" TIKI_ICO_PATH "${TIKI_ICO_PATH}")
    configure_file("${CMAKE_CURRENT_SOURCE_DIR}/tiki100.rc.in"
                   "${CMAKE_CURRENT_BINARY_DIR}/tiki100.rc" @ONLY)
    list(APPEND SOURCES "${CMAKE_CURRENT_BINARY_DIR}/tiki100.rc")
endif()

# Create executable
add_executable(tiki100 ${SOURCES})

# Include directories
target_include_directories(tiki100 PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_SOURCE_DIR}/src/cpu
    ${CMAKE_SOURCE_DIR}/src/machine
    ${CMAKE_SOURCE_DIR}/src/devices
    ${CMAKE_SOURCE_DIR}/src/devices/video
    ${CMAKE_SOURCE_DIR}/src/devices/keyboard
    ${CMAKE_SOURCE_DIR}/src/devices/floppy
    ${CMAKE_SOURCE_DIR}/src/devices/serial
    ${CMAKE_SOURCE_DIR}/src/devices/parallel
    ${CMAKE_SOURCE_DIR}/src/devices/ctc
    ${CMAKE_SOURCE_DIR}/src/devices/sound
    ${CMAKE_SOURCE_DIR}/src/devices/hdd
    ${CMAKE_SOURCE_DIR}/src/debugger
    ${CMAKE_SOURCE_DIR}/external/nuklear
    ${CMAKE_SOURCE_DIR}/external/tinyfiledialogs
    ${SDL2_INCLUDE_DIRS}
)

# Link libraries.
# Link order matters for MinGW ld (single-pass): SDL2main.a must come BEFORE
# SDL2.dll.a so that unresolved references in SDL_windows_main.c (SDL_strlen,
# SDL_memcpy, SDL_SetMainReady, ...) can be satisfied by SDL2 afterwards.
if(WIN32 AND TARGET SDL2::SDL2main)
    target_link_libraries(tiki100 PRIVATE SDL2::SDL2main)
endif()

target_link_libraries(tiki100 PRIVATE
    machine
    devices
    cpu
    debugger
    ${SDL2_LIBRARIES}
)

# libm is only needed on Unix-likes; MinGW folds math into libc.
if(NOT WIN32)
    target_link_libraries(tiki100 PRIVATE m)
endif()

# Compile definitions
target_compile_definitions(tiki100 PRIVATE
    _GNU_SOURCE
)

if(DEBUGGER_ENABLED)
    target_compile_definitions(tiki100 PRIVATE DEBUG)
endif()

# SDL2 compile flags
target_compile_options(tiki100 PRIVATE ${SDL2_CFLAGS_OTHER})
