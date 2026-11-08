cmake_minimum_required(VERSION 3.10)
project(RateGuardEngine CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(include)

# On Windows link ws2_32
if(WIN32)
    set(EXTRA_LIBS ws2_32)
else()
    set(EXTRA_LIBS pthread)
endif()

add_executable(engine src/engine.cpp)
target_link_libraries(engine ${EXTRA_LIBS})

add_executable(test_runner tests/test_rate_limiter.cpp)
target_link_libraries(test_runner ${EXTRA_LIBS})
