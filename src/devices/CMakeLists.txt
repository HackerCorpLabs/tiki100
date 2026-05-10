# Devices Module
# Peripheral device emulation for TIKI-100
project(devices)

# Collect sources from device subdirectories
set(SOURCES
    video/video.c
    keyboard/keyboard.c
    floppy/disk.c
    serial/serial.c
    parallel/parallel.c
    ctc/ctc.c
    sound/sound.c
    sound/ay3_8912.c
    hdd/hdd.c
)

# TCP serial networking — SDL frontend only, not for WASM
if(NOT PLATFORM_WASM)
    list(APPEND SOURCES serial/serial_net.c)
endif()

# Create library
add_library(devices STATIC ${SOURCES})

# Include directories
target_include_directories(devices
    PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}
    PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/video
    PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/keyboard
    PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/floppy
    PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/serial
    PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/parallel
    PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/ctc
    PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/sound
    PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/hdd
    PRIVATE ${CMAKE_SOURCE_DIR}/src/cpu
    PRIVATE ${CMAKE_SOURCE_DIR}/src/machine
)

# Link dependencies
target_link_libraries(devices
    PUBLIC cpu
)

# pthreads for TCP serial networking (not needed for WASM)
if(NOT PLATFORM_WASM)
    find_package(Threads REQUIRED)
    target_link_libraries(devices PUBLIC Threads::Threads)
endif()

# Winsock2 for TCP serial networking on Windows
if(PLATFORM_WINDOWS)
    target_link_libraries(devices PUBLIC ws2_32)
endif()

# Set properties
set_target_properties(devices PROPERTIES
    POSITION_INDEPENDENT_CODE ON
)

# Platform-specific configurations
if(PLATFORM_LINUX)
    target_compile_definitions(devices PRIVATE PLATFORM_LINUX)
elseif(PLATFORM_WINDOWS)
    target_compile_definitions(devices PRIVATE PLATFORM_WINDOWS)
elseif(PLATFORM_WASM)
    target_compile_definitions(devices PRIVATE PLATFORM_WASM)
endif()
