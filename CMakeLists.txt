cmake_minimum_required(VERSION 3.20)

project(songstick_leds LANGUAGES CXX)

option(SONGSTICK_BUILD_TESTS "Build native tests" ON)
option(SONGSTICK_BUILD_WASM "Build the WebAssembly facade" OFF)

add_library(songstick_core
    core/src/playback.cpp
)
target_include_directories(songstick_core PUBLIC core/include)
target_compile_features(songstick_core PUBLIC cxx_std_17)
target_compile_options(songstick_core PRIVATE
    -Wall
    -Wextra
    -Wpedantic
    -Wconversion
    -Wsign-conversion
)

if(EMSCRIPTEN)
    target_compile_options(songstick_core PRIVATE -fno-exceptions -fno-rtti)
endif()

if(SONGSTICK_BUILD_TESTS)
    enable_testing()
    add_executable(songstick_core_tests tests/unit/playback_test.cpp)
    target_link_libraries(songstick_core_tests PRIVATE songstick_core)
    target_compile_options(songstick_core_tests PRIVATE
        -Wall
        -Wextra
        -Wpedantic
        -Wconversion
        -Wsign-conversion
    )
    add_test(NAME songstick_core_tests COMMAND songstick_core_tests)
endif()

if(SONGSTICK_BUILD_WASM)
    if(NOT EMSCRIPTEN)
        message(FATAL_ERROR "SONGSTICK_BUILD_WASM requires the Emscripten toolchain")
    endif()

    add_executable(songstick_wasm web/wasm/songstick_wasm.cpp)
    target_link_libraries(songstick_wasm PRIVATE songstick_core embind)
    target_compile_options(songstick_wasm PRIVATE -fno-exceptions)
    target_link_options(songstick_wasm PRIVATE
        -fno-exceptions
        "-sMODULARIZE=1"
        "-sEXPORT_ES6=1"
        "-sEXPORT_NAME=createSongstickModule"
        "-sENVIRONMENT=web"
        "-sINCOMING_MODULE_JS_API=['wasmBinary']"
        "-sALLOW_MEMORY_GROWTH=0"
        "-sFILESYSTEM=0"
    )
    set_target_properties(songstick_wasm PROPERTIES
        OUTPUT_NAME songstick
        SUFFIX ".js"
    )
endif()
