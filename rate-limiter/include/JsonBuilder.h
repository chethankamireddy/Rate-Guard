#pragma once
// Minimal JSON builder — no external dependencies, header-only

#include <string>
#include <sstream>
#include <vector>
#include <cstdint>
#include <cmath>

namespace json {

inline std::string escape(const std::string& s) {
    std::string out;
    out.reserve(s.size());
    for (char c : s) {
        switch (c) {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n";  break;
            case '\r': out += "\\r";  break;
            case '\t': out += "\\t";  break;
            default:   out += c;      break;
        }
    }
    return out;
}

inline std::string str(const std::string& s) {
    return "\"" + escape(s) + "\"";
}

inline std::string num(double v) {
    std::ostringstream oss;
    if (std::isnan(v) || std::isinf(v)) return "0";
    oss << v;
    return oss.str();
}

inline std::string num(uint64_t v) {
    return std::to_string(v);
}

inline std::string num(int64_t v) {
    return std::to_string(v);
}

inline std::string num(int v) {
    return std::to_string(v);
}

inline std::string boolean(bool v) {
    return v ? "true" : "false";
}

class Object {
public:
    Object& add(const std::string& key, const std::string& value_json) {
        entries_.push_back("\"" + key + "\":" + value_json);
        return *this;
    }
    Object& add_str(const std::string& key, const std::string& value) {
        return add(key, str(value));
    }
    Object& add_num(const std::string& key, double value) {
        return add(key, num(value));
    }
    Object& add_num(const std::string& key, uint64_t value) {
        return add(key, num(value));
    }
    Object& add_num(const std::string& key, int64_t value) {
        return add(key, num(value));
    }
    Object& add_num(const std::string& key, int value) {
        return add(key, num(value));
    }
    Object& add_bool(const std::string& key, bool value) {
        return add(key, boolean(value));
    }

    std::string build() const {
        std::string out = "{";
        for (size_t i = 0; i < entries_.size(); ++i) {
            if (i > 0) out += ",";
            out += entries_[i];
        }
        out += "}";
        return out;
    }

private:
    std::vector<std::string> entries_;
};

} // namespace json
