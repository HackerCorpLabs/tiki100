# Serial ports

The TIKI-100 has a Z80 DART dual-channel serial controller. Both channels (A and B) can be independently routed to real TCP connections through three operating modes. This feature is available in the SDL2 native builds (Linux, macOS, Windows) — it is not compiled into the WebAssembly build.

**Both channels default to Modem mode at startup.**

## Modes

| Mode | Description |
|------|-------------|
| **Modem** | Emulates a Hayes-compatible modem. Dial out with `ATDT host:port` from any terminal program running on the TIKI-100. Default for both channels. |
| **Listen** | TCP server. Binds a local port and accepts one connection at a time. Useful for hosting services or piping data in from another machine. |
| **Connect** | TCP client. Connects to a fixed host and port, with exponential-backoff reconnect on failure. Useful for a dedicated link to a remote host. |

## Configuring at startup (command-line)

Pass `-sera` and/or `-serb` to pre-configure a channel at launch:

```bash
# Channel A in modem mode (this is also the default — no flag needed)
tiki100 -sera modem -fd0 disks/boot/tiko_kjerne_v4.01.dsk

# Channel A listens on TCP port 5000 (e.g. for a TIKI-100 BBS)
tiki100 -sera listen:5000

# Channel B connects outbound to a fixed host
tiki100 -serb connect:myhost.example.com:4000

# Mix: Channel A modem for dialing, Channel B fixed link
tiki100 -sera modem -serb connect:logger.local:9999
```

Format:

```
-sera modem
-sera listen:<port>
-sera connect:<host>:<port>
```

(Same forms apply to `-serb`.)

## Configuring at runtime (F12 menu)

Press **F12** to open the configuration overlay, then select the **Serial** tab. Each channel has its own row with three mode buttons. Select a mode, fill in the host/port fields if needed, and press **Apply A** or **Apply B**. The change takes effect immediately — the worker thread is restarted with the new configuration.

The status line beneath each channel shows the active mode and, in Modem mode, the currently connected host:port (updated live as you dial and hang up).

---

## Modem mode — AT command reference

When a channel is in Modem mode, it presents a Hayes-compatible AT command interface to the terminal software running on the TIKI-100.

**Input rules**

- Commands must start with `AT` (case-insensitive).
- Commands are terminated by carriage return (`CR`, `\r`).
- Backspace (ASCII 8 or 127) deletes the previous character.
- Echo is on by default — each typed character is sent back to the terminal.
- In Data mode, `+++` with at least 1 second of silence before and after escapes back to Command mode without dropping the connection.

**Result codes**

| Code | Meaning |
|------|---------|
| `OK` | Command accepted and executed |
| `ERROR` | Unknown or malformed command |
| `CONNECT` | TCP connection established |
| `NO CARRIER` | Connection attempt failed, or existing connection dropped |
| `RING` | Incoming call (server mode, every 3 seconds) |

**Command reference**

| Command | Description |
|---------|-------------|
| `AT` | No-op — returns OK. Use to check that the modem is responsive. |
| `ATZ` | Reset. Hangs up any active connection, restores echo-on and raw mode, clears the command buffer. Server socket (if any) is preserved. |
| `ATE0` | Disable local echo. |
| `ATE1` | Enable local echo (default). |
| `ATH` / `ATH0` | Hang up. Closes the active connection and returns `NO CARRIER` then `OK`. |
| `ATO` | Return to Data mode. Resumes a connection that was escaped with `+++`. |
| `ATA` | Answer an incoming call. Only useful in server mode (`AT+SERVER=1,port`) when a `RING` is displayed. |
| `ATDT host:port` | Dial (TCP connect) to `host:port`. Port is optional — defaults to the value set by `AT+PORT=` (initially 23). Returns `CONNECT` on success or `NO CARRIER` on failure. |
| `ATDP host:port` | Alias for `ATDT`. (Pulse-dial — irrelevant here, treated identically.) |
| `ATI` / `ATI0` | Product identification: `TIKI-100 Emulator Modem`. |
| `ATI1` | Firmware version string. |
| `ATI2` | ROM checksum (returns `000`). |
| `ATI3` | Long description: emulator name, Z80 DART info, Hayes compatibility note. |
| `ATI4` | Full hardware summary: CPU, RAM, video modes, sound, FDD, HDD, and which serial channel this is. |
| `AT+IP?` | Returns the local IP address of the host machine. |
| `AT+STATUS?` | Returns `CONNECTED` or `DISCONNECTED` based on whether a data connection is active. |
| `AT+PORT=n` | Set the default dial port used when `ATDT host` is given without an explicit port number. Default is `23`. |
| `AT+SERVER=1,port` | Start a TCP listen server on `port`. Incoming connections trigger `RING` every 3 seconds; accept with `ATA`. |
| `AT+SERVER=0` | Stop the listen server and reject any pending incoming connection. |
| `AT+TELNET=0` | Raw TCP mode (default). All bytes are forwarded as-is. |
| `AT+TELNET=1` | Telnet mode. Incoming IAC negotiation sequences are intercepted: the modem responds with `IAC DONT`/`IAC WONT` for all options, and the negotiation bytes are stripped before forwarding to the TIKI-100. Use this when connecting to a BBS or any Unix host on port 23. |

---

## Dialing a BBS — recommended sequence

Most telnet BBSes negotiate terminal options (echo, terminal type, etc.) before sending their welcome banner. Without responding to these, some servers wait indefinitely. Enable telnet mode before dialing:

```
AT+TELNET=1
ATDT bbs.example.com:23
```

Or, since port 23 is the default:

```
AT+TELNET=1
ATDT bbs.example.com
```

A full sample session in a TIKI-100 terminal program:

```
AT                          <- check modem is alive
OK
AT+TELNET=1                 <- handle telnet IAC negotiations
OK
ATDT bbs.fozztexx.com       <- dial (port 23 by default)

CONNECT
Welcome to Level 29 BBS ...
Login:
```

To suspend the session without hanging up (e.g. to check something in Command mode):

```
+++                         <- 1 second pause, type +++, wait 1 second
OK
AT+STATUS?
CONNECTED
OK
ATO                         <- return to Data mode
CONNECT
```

To hang up:

```
+++
OK
ATH
NO CARRIER
OK
```
