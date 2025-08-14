-- Vibe Clink profile: UTF-8, aliases, and Git branch in prompt

-- Ensure UTF-8 output (Clink will set code page to 65001)
settings.set("utf8_output", "true")
-- Ensure console code page is UTF-8 universally
os.execute('chcp 65001 >nul')

-- Basic, fast Git branch detection (no external scripts required)
local function get_git_branch()
    local pipe = io.popen("git rev-parse --abbrev-ref HEAD 2>nul")
    if not pipe then return nil end
    local branch = pipe:read("*l")
    pipe:close()
    if branch == nil or branch == "HEAD" or branch == "" then return nil end
    return branch
end

local function prompt_filter(prompt)
    local branch = get_git_branch()
    if branch then
        return prompt:gsub("%$G$G", " [$E[92m" .. branch .. "$E[0m]$G$G")
    end
    return prompt
end

-- Register prompt filter (priority 50)
clink.prompt.register_filter(prompt_filter, 50)

-- Aliases for common repo tasks (cmd.exe friendly)
-- Some environments expose clink.set_alias(), others expose clink.aliases[]; fallback to DOSKEY if neither.
local function set_alias(name, value)
    if clink.set_alias then
        clink.set_alias(name, value)
    elseif clink.aliases then
        clink.aliases[name] = value
    else
        os.execute('doskey ' .. name .. '=' .. value .. ' $*')
    end
end

set_alias("dev",      "bun run dev")
set_alias("devs",     "bun run dev:start")
set_alias("test",     "bun run test:orchestrated")
set_alias("lint",     "bun run lint")
set_alias("lintfix",  "bun run lint:fix")
set_alias("play",     "bunx playwright test --reporter=line")
set_alias("serve",    "bun run docs:serve")
set_alias("killnode", "taskkill /F /IM node.exe")
set_alias("ports",    "bun run dev:status")

-- Optional: simple argmatcher for `bun run <script>` completions
local bun_run = clink.argmatcher():addarg(function ()
    -- Parse package.json scripts names quickly via bun (fast) if available
    local tmp = os.tmpname()
    os.remove(tmp) -- ensure unique
    local cmd = 'bun -e "console.log(Object.keys(require(\"./package.json\").scripts||{}).join(\"\n\"))" 2>nul'
    local f = io.popen(cmd)
    if not f then return {} end
    local out = f:read("*a")
    f:close()
    local items = {}
    for line in out:gmatch("[^\r\n]+") do table.insert(items, line) end
    return items
end)

clink.argmatcher("bun"):setendoffset(1):addarg({"run"}):addflags({"--help"})
clink.argmatcher("bun run"):addarg(bun_run)


