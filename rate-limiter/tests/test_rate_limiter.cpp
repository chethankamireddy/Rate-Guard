// RateGuard C++ Engine Unit Tests
#include <winsock2.h>
#include <windows.h>
#include <iostream>
#include <vector>
#include <deque>
#include <string>
#include <cstdint>
#include <cmath>
#include <cassert>

static ULONGLONG get_time_ms() {
    static LARGE_INTEGER freq;
    static BOOL initialized = FALSE;
    if (!initialized) {
        QueryPerformanceFrequency(&freq);
        initialized = TRUE;
    }
    LARGE_INTEGER counter;
    QueryPerformanceCounter(&counter);
    return (ULONGLONG)((counter.QuadPart * 1000ULL) / freq.QuadPart);
}

struct CritSec {
    CRITICAL_SECTION cs;
    CritSec()  { InitializeCriticalSection(&cs); }
    ~CritSec() { DeleteCriticalSection(&cs); }
    void lock()   { EnterCriticalSection(&cs); }
    void unlock() { LeaveCriticalSection(&cs); }
};

struct CritSecLock {
    CritSec& cs_;
    CritSecLock(CritSec& cs) : cs_(cs) { cs_.lock(); }
    ~CritSecLock() { cs_.unlock(); }
};

struct TokenBucketTestState {
    double tokens;
    double capacity;
    double refill_rate;
    ULONGLONG last_refill_ms;
    uint64_t limit;
    uint64_t window_sec;
    CritSec cs;

    TokenBucketTestState(uint64_t lim, uint64_t wsec, uint64_t brst)
        : limit(lim), window_sec(wsec) {
        capacity = (double)(brst > 0 ? brst : lim);
        tokens = capacity;
        refill_rate = (double)lim / (double)(wsec > 0 ? wsec : 1);
        last_refill_ms = get_time_ms();
    }

    bool evaluate(uint64_t* out_remaining = nullptr, uint64_t* out_retry = nullptr) {
        CritSecLock lock(cs);
        ULONGLONG now_ms = get_time_ms();
        double elapsed_sec = (double)(now_ms - last_refill_ms) / 1000.0;
        last_refill_ms = now_ms;

        tokens += elapsed_sec * refill_rate;
        if (tokens > capacity) tokens = capacity;

        if (tokens >= 1.0) {
            tokens -= 1.0;
            if (out_remaining) *out_remaining = (uint64_t)floor(tokens);
            if (out_retry) *out_retry = 0;
            return true;
        } else {
            double deficit = 1.0 - tokens;
            double wait = (refill_rate > 0.0) ? (deficit / refill_rate) : 1.0;
            if (out_remaining) *out_remaining = 0;
            if (out_retry) *out_retry = (uint64_t)ceil(wait);
            return false;
        }
    }
};

struct SlidingWindowTestState {
    uint64_t limit;
    uint64_t window_ms;
    std::deque<ULONGLONG> timestamps;
    CritSec cs;

    SlidingWindowTestState(uint64_t lim, uint64_t wsec)
        : limit(lim), window_ms(wsec * 1000ULL) {}

    bool evaluate(uint64_t* out_remaining = nullptr, uint64_t* out_retry = nullptr) {
        CritSecLock lock(cs);
        ULONGLONG now_ms = get_time_ms();
        ULONGLONG threshold = (now_ms > window_ms) ? (now_ms - window_ms) : 0;

        while (!timestamps.empty() && timestamps.front() <= threshold) {
            timestamps.pop_front();
        }

        size_t count = timestamps.size();
        if (count < (size_t)limit) {
            timestamps.push_back(now_ms);
            if (out_remaining) *out_remaining = limit - count - 1;
            if (out_retry) *out_retry = 0;
            return true;
        } else {
            if (out_remaining) *out_remaining = 0;
            if (!timestamps.empty()) {
                ULONGLONG oldest = timestamps.front();
                ULONGLONG elapsed_ms = now_ms - oldest;
                int64_t wait_ms = (int64_t)window_ms - (int64_t)elapsed_ms;
                if (out_retry) *out_retry = (wait_ms > 0) ? (uint64_t)(wait_ms / 1000 + 1) : 1;
            } else {
                if (out_retry) *out_retry = window_ms / 1000;
            }
            return false;
        }
    }
};

static int g_passed = 0;
static int g_failed = 0;

#define ASSERT_TEST(cond, name) \
    if (!(cond)) { \
        std::cerr << "  [FAILED] " << name << " (line " << __LINE__ << ")\n"; \
        g_failed++; \
        return; \
    }

void test_token_bucket_basic() {
    TokenBucketTestState tb(5, 60, 5);
    uint64_t rem = 0, retry = 0;
    for (int i = 0; i < 5; ++i) {
        ASSERT_TEST(tb.evaluate(&rem, &retry) == true, "TokenBucket should allow first 5 requests");
    }
    ASSERT_TEST(tb.evaluate(&rem, &retry) == false, "TokenBucket should reject 6th request");
    ASSERT_TEST(retry > 0, "TokenBucket retry-after should be positive on rejection");
    std::cout << "  [PASSED] Token Bucket Basic Limits & Burst\n";
    g_passed++;
}

void test_sliding_window_basic() {
    SlidingWindowTestState sw(5, 60);
    uint64_t rem = 0, retry = 0;
    for (int i = 0; i < 5; ++i) {
        ASSERT_TEST(sw.evaluate(&rem, &retry) == true, "SlidingWindow should allow first 5 requests");
    }
    ASSERT_TEST(sw.evaluate(&rem, &retry) == false, "SlidingWindow should reject 6th request");
    ASSERT_TEST(rem == 0, "SlidingWindow remaining should be 0");
    std::cout << "  [PASSED] Sliding Window Basic Limits\n";
    g_passed++;
}

struct ThreadParam {
    TokenBucketTestState* tb;
    int requests_per_thread;
    volatile LONG* allowed_count;
};

static DWORD WINAPI tb_thread_proc(LPVOID lpParam) {
    ThreadParam* p = (ThreadParam*)lpParam;
    for (int i = 0; i < p->requests_per_thread; ++i) {
        if (p->tb->evaluate()) {
            InterlockedIncrement(p->allowed_count);
        }
    }
    return 0;
}

void test_concurrency() {
    const int capacity = 50;
    TokenBucketTestState tb(capacity, 60, capacity);
    volatile LONG allowed = 0;
    const int NUM_THREADS = 8;
    const int REQS_PER_THREAD = 25; // 200 total requests

    HANDLE threads[NUM_THREADS];
    ThreadParam params[NUM_THREADS];

    for (int i = 0; i < NUM_THREADS; ++i) {
        params[i].tb = &tb;
        params[i].requests_per_thread = REQS_PER_THREAD;
        params[i].allowed_count = &allowed;
        threads[i] = CreateThread(nullptr, 0, tb_thread_proc, &params[i], 0, nullptr);
    }

    WaitForMultipleObjects(NUM_THREADS, threads, TRUE, 5000);
    for (int i = 0; i < NUM_THREADS; ++i) {
        CloseHandle(threads[i]);
    }

    ASSERT_TEST(allowed == capacity, "Concurrent requests must not exceed capacity");
    std::cout << "  [PASSED] Concurrency Safety Across " << NUM_THREADS << " Threads (" << allowed << " allowed out of " << (NUM_THREADS * REQS_PER_THREAD) << ")\n";
    g_passed++;
}

int main() {
    std::cout << "=== RateGuard C++ Engine Unit & Concurrency Tests ===\n";
    test_token_bucket_basic();
    test_sliding_window_basic();
    test_concurrency();

    std::cout << "\nResults: " << g_passed << " passed, " << g_failed << " failed.\n";
    return g_failed == 0 ? 0 : 1;
}
