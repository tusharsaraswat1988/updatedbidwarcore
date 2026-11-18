# BIDWAR Fan Platform — Security Threat Model

## Concurrency-Safe Session Rotation Algorithm

### Rotation Logic (Lua)
```lua
local current = redis.call('get', 'session:current')
if (token == current) then
    local newToken = generateToken()
    redis.call('set', 'session:prev', current, 'EX', 30)
    redis.call('set', 'session:current', newToken)
    return { newToken, 'success' }
else
    -- Re-check if token is in previous (maybe rotation already happened)
    local prev = redis.call('get', 'session:prev')
    if (token == prev) then
        return { current, 'success' }
    end
    return { nil, 'unauthorized' }
end
```

### Behaviour
- **Winning Request:** Receives `newToken`.
- **Losing Request:** If concurrent, receives the *newly issued* token if the rotation already completed, or the *previous* token remains valid for 30s.
- **Overlapping Window:** Grace period (30s) ensures no logout for legitimate parallel requests.
- **Multi-Instance:** Redis Lua atomicity prevents race conditions.
