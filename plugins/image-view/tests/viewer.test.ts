import { describe, expect, test } from "claude-code/testing"

import {
  appleScriptString,
  chooseViewer,
  expandHome,
  hotkeyOf,
  iTermSessionUuid,
  isITerm,
  openLabel,
  paneCommand,
  paneScript,
  quickLookArgv,
  shellQuote,
  splitScript,
} from "../hooks/viewer"

describe("terminal detection", () => {
  test("iTerm2 is recognised by TERM_PROGRAM or LC_TERMINAL", () => {
    expect(isITerm({ TERM_PROGRAM: "iTerm.app" })).toBe(true)
    expect(isITerm({ TERM_PROGRAM: "tmux", LC_TERMINAL: "iTerm2" })).toBe(true)
    expect(isITerm({ TERM_PROGRAM: "ghostty" })).toBe(false)
    expect(isITerm({})).toBe(false)
  })

  test("iTerm2 gets the split, everything else Quick Look", () => {
    expect(chooseViewer({ TERM_PROGRAM: "iTerm.app" })).toBe("iterm-split")
    expect(chooseViewer({ LC_TERMINAL: "iTerm2" })).toBe("iterm-split")
    expect(chooseViewer({ TERM_PROGRAM: "WezTerm" })).toBe("quick-look")
    expect(chooseViewer({})).toBe("quick-look")
  })

  test("the session's unique id is the part after the colon", () => {
    expect(iTermSessionUuid("w0t1p2:6F1C-AB")).toBe("6F1C-AB")
    expect(iTermSessionUuid("6F1C-AB")).toBe("6F1C-AB")
    expect(iTermSessionUuid(undefined)).toBeUndefined()
    expect(iTermSessionUuid("")).toBeUndefined()
  })
})

describe("quoting", () => {
  test("shell words survive spaces, quotes and dollars", () => {
    expect(shellQuote("/Users/me/Library/Application Support/a.png")).toBe(
      "'/Users/me/Library/Application Support/a.png'",
    )
    expect(shellQuote("it's $HOME")).toBe(`'it'\\''s $HOME'`)
  })

  test("AppleScript strings escape backslashes and double quotes", () => {
    expect(appleScriptString('say "hi" \\ bye')).toBe('"say \\"hi\\" \\\\ bye"')
  })

  test("the split command quotes the script path for iTerm2 and AppleScript", () => {
    const command = paneCommand("/tmp/my dir/view-1.zsh")
    expect(command).toBe("/bin/zsh -f '/tmp/my dir/view-1.zsh'")
    const script = splitScript(command, "ABC")
    expect(script).toContain(
      `split vertically with default profile command "/bin/zsh -f '/tmp/my dir/view-1.zsh'"`,
    )
    expect(script).toContain('if unique id of aSession is "ABC"')
    expect(script).toContain("set columns of pane to (round (total * 0.4))")
  })

  test("without a session id the split uses the current session", () => {
    const script = splitScript("/bin/zsh -f '/tmp/x.zsh'", undefined)
    expect(script).not.toContain("unique id")
    expect(script).toContain("current session of current window")
  })
})

describe("pane script", () => {
  const image = "/Users/me/Library/Application Support/it's.png"

  test("uses imgcat when there is one, then waits for a key", () => {
    const script = paneScript(image, "/opt/imgcat")
    expect(script).toContain(`'/opt/imgcat' ${shellQuote(image)}`)
    expect(script).toContain("press any key to close")
    expect(script).toContain("read -sk1")
    expect(script).not.toContain("1337")
  })

  test("prints the inline-image escape itself when imgcat is missing", () => {
    const script = paneScript(image, null)
    expect(script).toContain("\\033]1337;File=inline=1")
    expect(script).toContain(`base64 < ${shellQuote(image)}`)
    expect(script).not.toContain("imgcat")
  })
})

describe("fallbacks and labels", () => {
  test("Quick Look runs detached with the path as its own argument", () => {
    expect(quickLookArgv("/a b/c.png")).toEqual([
      "/bin/sh",
      "-c",
      'qlmanage -p "$1" >/dev/null 2>&1 &',
      "image-view",
      "/a b/c.png",
    ])
  })

  test("~ expands against HOME, and nothing without it", () => {
    expect(expandHome("~/.iterm2/imgcat", "/Users/me")).toBe(
      "/Users/me/.iterm2/imgcat",
    )
    expect(expandHome("~/.iterm2/imgcat", undefined)).toBeUndefined()
    expect(expandHome("/bin/x", undefined)).toBe("/bin/x")
  })

  test("only images #1 to #9 get a digit hotkey", () => {
    expect(hotkeyOf(1)).toBe("1")
    expect(hotkeyOf(9)).toBe("9")
    expect(hotkeyOf(10)).toBeUndefined()
  })

  test("the label shrinks to a glyph on a narrow tile", () => {
    expect(openLabel(1, 40)).toBe("full size")
    expect(openLabel(1, 8)).toBe("⤢")
    expect(openLabel(12, 40)).toBe("#12 full size")
    expect(openLabel(12, 8)).toBe("#12 ⤢")
  })
})
