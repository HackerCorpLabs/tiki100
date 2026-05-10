# Z80 CPU Module
# Copyright (C) Marat Fayzullin 1994,1995,1996,1997
project(cpu)

set(SOURCES
    Z80.c
)

set(HEADERS
    Z80.h
    Codes.h
    CodesCB.h
    CodesED.h
    CodesXX.h
    CodesXCB.h
    Tables.h
)

# Create library
add_library(cpu STATIC ${SOURCES} ${HEADERS})

# Include directories
target_include_directories(cpu
    PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}
)

# Debugger support
if(DEBUGGER_ENABLED)
    target_compile_definitions(cpu PRIVATE DEBUG)
endif()

# Set properties
set_target_properties(cpu PROPERTIES
    POSITION_INDEPENDENT_CODE ON
)
