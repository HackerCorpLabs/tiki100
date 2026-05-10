# WebAssembly Frontend
project(tiki100wasm)

set(SOURCES
    tiki100wasm.c
)

# Create executable (becomes .js + .wasm via Emscripten)
add_executable(tiki100wasm ${SOURCES})

# Include directories
target_include_directories(tiki100wasm PRIVATE
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
)

# Link libraries
target_link_libraries(tiki100wasm PRIVATE
    machine
    devices
    cpu
    debugger
)

# Emscripten-specific configurations
if(PLATFORM_WASM)
    set_target_properties(tiki100wasm PROPERTIES
        RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
        SUFFIX ".js"
    )

    set(EMSCRIPTEN_LINK_FLAGS
        "-s WASM=1 \
         -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap','FS','addFunction','UTF8ToString','HEAPU8','FS_createPreloadedFile'] \
         -sFORCE_FILESYSTEM \
         -s EXPORTED_FUNCTIONS=['_main','_Init','_Boot','_Step','_Stop','_IsInitialized','_SendKey','_GetFrameBuffer','_GetFrameBufferWidth','_GetFrameBufferHeight','_GetLockStatus','_GetGrafikkStatus','_GetDiskStatus','_IsDirty','_MountFloppy','_UnmountFloppy','_Reset','_SetVolume','_MountHDD','_UnmountHDD','_LoadROM','_ayFillAudioBufferWasm','_GetPrinterBuffer','_GetPrinterBufferLen','_ClearPrinterBuffer','_malloc','_free','_GetDbgStepCount','_GetDbgPlotCount','_GetDbgLoopEmulCount'] \
         -s EXPORT_NAME='TikiModule' \
         -s MODULARIZE=1 \
         -s ALLOW_TABLE_GROWTH=1 \
         -s ALLOW_MEMORY_GROWTH=1 \
         --no-heap-copy"
    )

    if(CMAKE_BUILD_TYPE STREQUAL "Debug")
        set(EMSCRIPTEN_LINK_FLAGS "${EMSCRIPTEN_LINK_FLAGS} -s ASSERTIONS=1")
    endif()

    set_target_properties(tiki100wasm PROPERTIES
        LINK_FLAGS "${EMSCRIPTEN_LINK_FLAGS}"
    )

    # Copy template to build output
    if(EXISTS "${CMAKE_SOURCE_DIR}/template-glass/index.html")
        configure_file(
            "${CMAKE_SOURCE_DIR}/template-glass/index.html"
            "${CMAKE_BINARY_DIR}/bin/index.html"
            COPYONLY
        )
    endif()
endif()
