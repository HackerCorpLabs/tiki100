# Machine Module
# Core emulator logic for TIKI-100
# Copyright (C) Asbjorn Djupdal 2000-2001
project(machine)

set(SOURCES
    TIKI-100_emul.c
    mem.c
)

set(HEADERS
    TIKI-100_emul.h
    protos.h
)

# Create library
add_library(machine STATIC ${SOURCES} ${HEADERS})

# Include directories
target_include_directories(machine
    PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}
    PRIVATE ${CMAKE_SOURCE_DIR}/src/cpu
    PRIVATE ${CMAKE_SOURCE_DIR}/src/devices
    PRIVATE ${CMAKE_SOURCE_DIR}/src/devices/video
    PRIVATE ${CMAKE_SOURCE_DIR}/src/devices/keyboard
    PRIVATE ${CMAKE_SOURCE_DIR}/src/devices/floppy
    PRIVATE ${CMAKE_SOURCE_DIR}/src/devices/serial
    PRIVATE ${CMAKE_SOURCE_DIR}/src/devices/parallel
    PRIVATE ${CMAKE_SOURCE_DIR}/src/devices/ctc
    PRIVATE ${CMAKE_SOURCE_DIR}/src/devices/sound
    PRIVATE ${CMAKE_SOURCE_DIR}/src/devices/hdd
    PRIVATE ${CMAKE_SOURCE_DIR}/src/debugger
)

# Link dependencies
target_link_libraries(machine
    PUBLIC cpu
    PUBLIC devices
    PUBLIC debugger
)

# Debugger support
if(DEBUGGER_ENABLED)
    target_compile_definitions(machine PRIVATE DEBUG)
endif()

# Set properties
set_target_properties(machine PROPERTIES
    POSITION_INDEPENDENT_CODE ON
)
