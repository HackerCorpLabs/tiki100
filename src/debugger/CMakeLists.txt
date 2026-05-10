# Z80 Debugger Module
# Copyright (C) Marat Fayzullin 1995,1996,1997
project(debugger)

set(SOURCES
    Debug.c
)

# Create library
add_library(debugger STATIC ${SOURCES})

# Include directories
target_include_directories(debugger
    PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}
    PRIVATE ${CMAKE_SOURCE_DIR}/src/cpu
)

# Debugger support
if(DEBUGGER_ENABLED)
    target_compile_definitions(debugger PRIVATE DEBUG)
endif()

# Set properties
set_target_properties(debugger PROPERTIES
    POSITION_INDEPENDENT_CODE ON
)
