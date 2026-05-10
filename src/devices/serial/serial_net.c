/* serial_net.c
 * TCP/modem serial routing for TIKI-100 Z80 DART channels.
 * SDL frontend only — compiled only when PLATFORM_WASM is not defined.
 */

#ifndef PLATFORM_WASM

#ifdef _WIN32
#  define WIN32_LEAN_AND_MEAN
#  include <winsock2.h>
#  include <ws2tcpip.h>
#  include <windows.h>
   typedef SOCKET snet_fd_t;
#  define SNET_INVALID      INVALID_SOCKET
#  define SNET_IS_VALID(f)  ((f) != INVALID_SOCKET)
#  define SNET_CLOSE(f)     closesocket(f)
#  define SNET_RECV(fd,b,n) recv((fd),(char*)(b),(n),0)
#  define SNET_SEND(fd,b,n) send((fd),(const char*)(b),(n),0)
#else
#  include <errno.h>
#  include <unistd.h>
#  include <fcntl.h>
#  include <netdb.h>
#  include <sys/socket.h>
#  include <netinet/in.h>
#  include <netinet/tcp.h>
#  include <arpa/inet.h>
#  include <poll.h>
   typedef int snet_fd_t;
#  define SNET_INVALID      (-1)
#  define SNET_IS_VALID(f)  ((f) >= 0)
#  define SNET_CLOSE(f)     close(f)
#  define SNET_RECV(fd,b,n) recv((fd),(b),(n),0)
#  define SNET_SEND(fd,b,n) send((fd),(b),(n),0)
#endif

#include <pthread.h>
#include <stdbool.h>
#include <stdatomic.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "serial_net.h"

/* -------------------------------------------------------------------------
 * Ring buffer — 64 KB per direction per channel
 * ------------------------------------------------------------------------- */

#define SNET_QUEUE_SIZE (64 * 1024)

typedef struct {
    uint8_t         buf[SNET_QUEUE_SIZE];
    int             head;
    int             tail;
    pthread_mutex_t mtx;
} SNetQueue;

static void queue_init(SNetQueue *q) {
    q->head = q->tail = 0;
    pthread_mutex_init(&q->mtx, NULL);
}

static void queue_destroy(SNetQueue *q) {
    pthread_mutex_destroy(&q->mtx);
}

static void queue_write(SNetQueue *q, uint8_t byte) {
    pthread_mutex_lock(&q->mtx);
    int next = (q->head + 1) % SNET_QUEUE_SIZE;
    if (next != q->tail) {
        q->buf[q->head] = byte;
        q->head = next;
    }
    pthread_mutex_unlock(&q->mtx);
}

static int queue_read(SNetQueue *q) {
    pthread_mutex_lock(&q->mtx);
    if (q->head == q->tail) {
        pthread_mutex_unlock(&q->mtx);
        return -1;
    }
    int byte = q->buf[q->tail];
    q->tail = (q->tail + 1) % SNET_QUEUE_SIZE;
    pthread_mutex_unlock(&q->mtx);
    return byte;
}

static int queue_has_data(SNetQueue *q) {
    pthread_mutex_lock(&q->mtx);
    int has = (q->head != q->tail);
    pthread_mutex_unlock(&q->mtx);
    return has;
}

/* -------------------------------------------------------------------------
 * Per-channel state
 * ------------------------------------------------------------------------- */

#define MODEM_CMD  0
#define MODEM_DATA 1

typedef struct {
    SerNetConfig     cfg;
    pthread_mutex_t  cfgMtx;

    pthread_t        thread;
    atomic_bool      threadRunning;
    atomic_bool      shutdownReq;

    SNetQueue        txq;   /* emulation → network */
    SNetQueue        rxq;   /* network → emulation */

    int              channel;      /* 0 = SerB, 1 = SerA */

    /* modem sub-state */
    int              modemState;
    char             cmdBuf[128];
    int              cmdLen;
    int              plusCount;
    long             lastNonPlusMs;

    /* current modem connection target — updated by worker, read by menu */
    char             modemTarget[280]; /* protected by cfgMtx */

    /* TX/RX activity timestamps for LED indicators (ms_now() values) */
    _Atomic long     lastTxMs;
    _Atomic long     lastRxMs;
} SNetChannel;

static SNetChannel channels[2];

/* -------------------------------------------------------------------------
 * Platform helpers
 * ------------------------------------------------------------------------- */

static long ms_now(void) {
#ifdef _WIN32
    return (long)GetTickCount64();
#else
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (long)(ts.tv_sec * 1000L + ts.tv_nsec / 1000000L);
#endif
}

static void ms_sleep(int ms) {
#ifdef _WIN32
    Sleep((DWORD)ms);
#else
    struct timespec ts;
    ts.tv_sec  = ms / 1000;
    ts.tv_nsec = (long)(ms % 1000) * 1000000L;
    nanosleep(&ts, NULL);
#endif
}

/* Sleep in 100 ms increments checking shutdownReq. Returns 1 if shutdown. */
static int shutdown_sleep(SNetChannel *ch, int total_ms) {
    int elapsed = 0;
    while (elapsed < total_ms) {
        if (atomic_load(&ch->shutdownReq)) return 1;
        int step = (total_ms - elapsed > 100) ? 100 : (total_ms - elapsed);
        ms_sleep(step);
        elapsed += step;
    }
    return atomic_load(&ch->shutdownReq);
}

static void set_nodelay(snet_fd_t fd) {
    int on = 1;
    setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, (const char *)&on, sizeof(on));
}

static void set_nonblocking(snet_fd_t fd) {
#ifdef _WIN32
    u_long mode = 1;
    ioctlsocket(fd, FIONBIO, &mode);
#else
    int flags = fcntl(fd, F_GETFL, 0);
    fcntl(fd, F_SETFL, flags | O_NONBLOCK);
#endif
}

static void set_blocking(snet_fd_t fd) {
#ifdef _WIN32
    u_long mode = 0;
    ioctlsocket(fd, FIONBIO, &mode);
#else
    int flags = fcntl(fd, F_GETFL, 0);
    fcntl(fd, F_SETFL, flags & ~O_NONBLOCK);
#endif
}

/* Poll fd. Returns bitmask: 1=readable, 2=writable, 4=error; 0=timeout. */
static int fd_poll(snet_fd_t fd, int want_write, int timeout_ms) {
#ifdef _WIN32
    WSAPOLLFD pfd;
    memset(&pfd, 0, sizeof(pfd));
    pfd.fd     = fd;
    pfd.events = POLLRDNORM;
    if (want_write) pfd.events |= POLLWRNORM;
    int r = WSAPoll(&pfd, 1, timeout_ms);
    if (r <= 0) return 0;
    int ret = 0;
    if (pfd.revents & POLLRDNORM)                      ret |= 1;
    if (pfd.revents & POLLWRNORM)                      ret |= 2;
    if (pfd.revents & (POLLERR | POLLHUP | POLLNVAL))  ret |= 4;
    return ret;
#else
    struct pollfd pfd;
    memset(&pfd, 0, sizeof(pfd));
    pfd.fd     = fd;
    pfd.events = POLLIN;
    if (want_write) pfd.events |= POLLOUT;
    int r = poll(&pfd, 1, timeout_ms);
    if (r <= 0) return 0;
    int ret = 0;
    if (pfd.revents & POLLIN)                         ret |= 1;
    if (pfd.revents & POLLOUT)                        ret |= 2;
    if (pfd.revents & (POLLERR | POLLHUP | POLLNVAL)) ret |= 4;
    return ret;
#endif
}

static int resolve_address(const char *host, int port, struct sockaddr_in *out) {
    memset(out, 0, sizeof(*out));
    out->sin_family = AF_INET;
    out->sin_port   = htons((uint16_t)port);
    if (inet_pton(AF_INET, host, &out->sin_addr) == 1) return 0;
    struct hostent *he = gethostbyname(host);
    if (!he) return -1;
    memcpy(&out->sin_addr, he->h_addr_list[0], (size_t)he->h_length);
    return 0;
}

static snet_fd_t try_connect(const struct sockaddr_in *addr, int timeout_ms) {
    snet_fd_t fd = socket(AF_INET, SOCK_STREAM, 0);
    if (!SNET_IS_VALID(fd)) return SNET_INVALID;

    set_nonblocking(fd);

#ifdef _WIN32
    int r = connect(fd, (const struct sockaddr *)addr, sizeof(*addr));
    if (r == SOCKET_ERROR && WSAGetLastError() != WSAEWOULDBLOCK) {
        SNET_CLOSE(fd); return SNET_INVALID;
    }
#else
    int r = connect(fd, (const struct sockaddr *)addr, sizeof(*addr));
    if (r < 0 && errno != EINPROGRESS) {
        SNET_CLOSE(fd); return SNET_INVALID;
    }
#endif

    /* Wait for writable = connection established */
    int ev = fd_poll(fd, 1, timeout_ms);
    if (!(ev & 2)) {
        SNET_CLOSE(fd); return SNET_INVALID;
    }

    int err = 0;
    socklen_t elen = sizeof(err);
    getsockopt(fd, SOL_SOCKET, SO_ERROR, (char *)&err, &elen);
    if (err != 0) {
        SNET_CLOSE(fd); return SNET_INVALID;
    }

    set_blocking(fd);
    set_nodelay(fd);
    return fd;
}

/* -------------------------------------------------------------------------
 * RX helpers — always called from the worker thread
 * ------------------------------------------------------------------------- */

static void push_rx(SNetChannel *ch, uint8_t byte) {
    queue_write(&ch->rxq, byte);
}

static void push_rx_str(SNetChannel *ch, const char *s) {
    while (*s) push_rx(ch, (uint8_t)*s++);
}

/* -------------------------------------------------------------------------
 * Inner service loop — shared by server and client workers.
 * Returns 0 = peer disconnected, 1 = shutdown requested.
 * ------------------------------------------------------------------------- */

static int service_loop(SNetChannel *ch, snet_fd_t fd) {
    uint8_t buf[512];

    while (!atomic_load(&ch->shutdownReq)) {
        int want_write = queue_has_data(&ch->txq);
        int ev = fd_poll(fd, want_write, 100);

        if (ev & 4) break;

        if (ev & 1) {
            int n = (int)SNET_RECV(fd, buf, sizeof(buf));
            if (n <= 0) break;
            for (int i = 0; i < n; i++) push_rx(ch, buf[i]);
        }

        if ((ev & 2) && queue_has_data(&ch->txq)) {
            int v;
            while ((v = queue_read(&ch->txq)) >= 0) {
                uint8_t b = (uint8_t)v;
                if (SNET_SEND(fd, &b, 1) < 0) goto done;
            }
        }
    }
done:
    return atomic_load(&ch->shutdownReq) ? 1 : 0;
}

/* -------------------------------------------------------------------------
 * Listen (server) worker
 * ------------------------------------------------------------------------- */

static void *server_worker(void *arg) {
    SNetChannel *ch = (SNetChannel *)arg;

    pthread_mutex_lock(&ch->cfgMtx);
    int port = ch->cfg.port;
    pthread_mutex_unlock(&ch->cfgMtx);

    snet_fd_t listenFd = socket(AF_INET, SOCK_STREAM, 0);
    if (!SNET_IS_VALID(listenFd)) {
        fprintf(stderr, "serial_net ch%d: socket() failed\n", ch->channel);
        goto done;
    }

    {
        int on = 1;
        setsockopt(listenFd, SOL_SOCKET, SO_REUSEADDR, (const char *)&on, sizeof(on));
    }

    {
        struct sockaddr_in addr;
        memset(&addr, 0, sizeof(addr));
        addr.sin_family      = AF_INET;
        addr.sin_addr.s_addr = INADDR_ANY;
        addr.sin_port        = htons((uint16_t)port);

        if (bind(listenFd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
            fprintf(stderr, "serial_net ch%d: bind(port %d) failed\n", ch->channel, port);
            SNET_CLOSE(listenFd);
            goto done;
        }
    }
    listen(listenFd, 1);
    printf("serial_net ch%d: listening on TCP port %d\n", ch->channel, port);

    while (!atomic_load(&ch->shutdownReq)) {
        if (!fd_poll(listenFd, 0, 500)) continue;

        snet_fd_t clientFd = accept(listenFd, NULL, NULL);
        if (!SNET_IS_VALID(clientFd)) continue;

        set_nodelay(clientFd);
        printf("serial_net ch%d: accepted connection\n", ch->channel);

        service_loop(ch, clientFd);

        printf("serial_net ch%d: connection closed\n", ch->channel);
        SNET_CLOSE(clientFd);
    }

    SNET_CLOSE(listenFd);
done:
    atomic_store(&ch->threadRunning, false);
    return NULL;
}

/* -------------------------------------------------------------------------
 * Connect (client) worker
 * ------------------------------------------------------------------------- */

static void *client_worker(void *arg) {
    SNetChannel *ch = (SNetChannel *)arg;

    pthread_mutex_lock(&ch->cfgMtx);
    char host[256];
    int  port = ch->cfg.port;
    strncpy(host, ch->cfg.host, sizeof(host) - 1);
    host[sizeof(host) - 1] = '\0';
    pthread_mutex_unlock(&ch->cfgMtx);

    struct sockaddr_in addr;
    while (resolve_address(host, port, &addr) < 0) {
        fprintf(stderr, "serial_net ch%d: cannot resolve '%s'\n", ch->channel, host);
        if (shutdown_sleep(ch, 10000)) goto done;
    }

    int backoff = 1000;
    while (!atomic_load(&ch->shutdownReq)) {
        printf("serial_net ch%d: connecting to %s:%d\n", ch->channel, host, port);
        snet_fd_t fd = try_connect(&addr, 5000);
        if (!SNET_IS_VALID(fd)) {
            fprintf(stderr, "serial_net ch%d: connect failed, retry in %d s\n",
                    ch->channel, backoff / 1000);
            if (shutdown_sleep(ch, backoff)) goto done;
            if (backoff < 30000) backoff *= 2;
            continue;
        }

        printf("serial_net ch%d: connected to %s:%d\n", ch->channel, host, port);
        backoff = 1000;

        service_loop(ch, fd);
        SNET_CLOSE(fd);

        printf("serial_net ch%d: disconnected, reconnecting...\n", ch->channel);
        if (shutdown_sleep(ch, 1000)) goto done;
    }
done:
    atomic_store(&ch->threadRunning, false);
    return NULL;
}

/* -------------------------------------------------------------------------
 * Modem worker — Hayes AT command emulation
 * ------------------------------------------------------------------------- */

typedef struct {
    snet_fd_t connFd;       /* active data connection */
    snet_fd_t serverFd;     /* listen socket for AT+SERVER mode */
    snet_fd_t pendingFd;    /* incoming conn waiting for ATA */
    int       echo;         /* 1=on (default), 0=off */
    int       telnet;       /* 0=raw (default), 1=strip IAC */
    int       defPort;      /* default dial port (default 23) */
    long      lastRingMs;
    int       telnetSkip;   /* IAC state: 0=normal, 1=saw IAC, 2=saw WILL/DO */
    int       telnetCmd;    /* command byte seen after IAC (e.g. 0xFB=WILL) */
} ModemCtx;

static void modem_reset(SNetChannel *ch, ModemCtx *ctx) {
    if (SNET_IS_VALID(ctx->connFd)) {
        SNET_CLOSE(ctx->connFd);
        ctx->connFd = SNET_INVALID;
    }
    if (SNET_IS_VALID(ctx->pendingFd)) {
        SNET_CLOSE(ctx->pendingFd);
        ctx->pendingFd = SNET_INVALID;
    }
    /* serverFd survives ATZ */
    ctx->echo        = 1;
    ctx->telnet      = 0;
    ctx->defPort     = 23;
    ctx->telnetSkip  = 0;
    ctx->telnetCmd   = 0;
    pthread_mutex_lock(&ch->cfgMtx);
    strncpy(ch->modemTarget, "(none)", sizeof(ch->modemTarget) - 1);
    pthread_mutex_unlock(&ch->cfgMtx);
    ch->modemState    = MODEM_CMD;
    ch->cmdLen        = 0;
    ch->plusCount     = 0;
    ch->lastNonPlusMs = ms_now();
}

static void modem_process_cmd(SNetChannel *ch, ModemCtx *ctx) {
    ch->cmdBuf[ch->cmdLen] = '\0';
    ch->cmdLen = 0;

    /* Uppercase copy, strip CR/LF */
    char cmd[128];
    int ci = 0;
    for (int i = 0; ch->cmdBuf[i] && ci < 127; i++) {
        char c = ch->cmdBuf[i];
        if (c >= 'a' && c <= 'z') c = (char)(c - 32);
        if (c != '\r' && c != '\n') cmd[ci++] = c;
    }
    cmd[ci] = '\0';

    /* Must start with AT */
    if (strncmp(cmd, "AT", 2) != 0) {
        push_rx_str(ch, "\r\nERROR\r\n");
        return;
    }

    const char *p = cmd + 2;

    if (*p == '\0') {
        push_rx_str(ch, "\r\nOK\r\n");

    } else if (strcmp(p, "Z") == 0) {
        modem_reset(ch, ctx);
        push_rx_str(ch, "\r\nOK\r\n");

    } else if (strcmp(p, "E0") == 0) {
        ctx->echo = 0;
        push_rx_str(ch, "\r\nOK\r\n");

    } else if (strcmp(p, "E1") == 0) {
        ctx->echo = 1;
        push_rx_str(ch, "\r\nOK\r\n");

    } else if (strcmp(p, "H") == 0 || strcmp(p, "H0") == 0) {
        if (SNET_IS_VALID(ctx->connFd)) {
            SNET_CLOSE(ctx->connFd);
            ctx->connFd = SNET_INVALID;
            push_rx_str(ch, "\r\nNO CARRIER\r\n");
        }
        if (SNET_IS_VALID(ctx->pendingFd)) {
            SNET_CLOSE(ctx->pendingFd);
            ctx->pendingFd = SNET_INVALID;
        }
        pthread_mutex_lock(&ch->cfgMtx);
        strncpy(ch->modemTarget, "(none)", sizeof(ch->modemTarget) - 1);
        pthread_mutex_unlock(&ch->cfgMtx);
        ch->modemState = MODEM_CMD;
        push_rx_str(ch, "\r\nOK\r\n");

    } else if (strcmp(p, "O") == 0) {
        if (SNET_IS_VALID(ctx->connFd)) {
            ch->modemState = MODEM_DATA;
            push_rx_str(ch, "\r\nCONNECT\r\n");
        } else {
            push_rx_str(ch, "\r\nNO CARRIER\r\n");
        }

    } else if (strcmp(p, "A") == 0) {
        if (SNET_IS_VALID(ctx->pendingFd)) {
            ctx->connFd    = ctx->pendingFd;
            ctx->pendingFd = SNET_INVALID;
            set_nodelay(ctx->connFd);
            pthread_mutex_lock(&ch->cfgMtx);
            snprintf(ch->modemTarget, sizeof(ch->modemTarget), "(incoming)");
            pthread_mutex_unlock(&ch->cfgMtx);
            ch->modemState    = MODEM_DATA;
            ch->plusCount     = 0;
            ch->lastNonPlusMs = ms_now();
            push_rx_str(ch, "\r\nCONNECT\r\n");
        } else {
            push_rx_str(ch, "\r\nNO CARRIER\r\n");
        }

    } else if (strncmp(p, "DT", 2) == 0 || strncmp(p, "DP", 2) == 0) {
        const char *target = p + 2;
        while (*target == ' ') target++;

        char thost[256] = "";
        int  tport = ctx->defPort;

        const char *colon = strrchr(target, ':');
        if (colon && colon != target) {
            int hlen = (int)(colon - target);
            if (hlen > 0 && hlen < 256) {
                strncpy(thost, target, (size_t)hlen);
                thost[hlen] = '\0';
            }
            tport = atoi(colon + 1);
        } else if (*target) {
            strncpy(thost, target, sizeof(thost) - 1);
        }

        if (thost[0] == '\0' || tport <= 0 || tport > 65535) {
            push_rx_str(ch, "\r\nNO CARRIER\r\n");
            return;
        }

        push_rx_str(ch, "\r\n");

        struct sockaddr_in addr;
        if (resolve_address(thost, tport, &addr) < 0) {
            push_rx_str(ch, "NO CARRIER\r\n");
            return;
        }

        snet_fd_t fd = try_connect(&addr, 10000);
        if (!SNET_IS_VALID(fd)) {
            push_rx_str(ch, "NO CARRIER\r\n");
            return;
        }

        printf("serial_net ch%d modem: connected to %s:%d\n", ch->channel, thost, tport);
        push_rx_str(ch, "CONNECT\r\n");
        ctx->connFd = fd;
        pthread_mutex_lock(&ch->cfgMtx);
        snprintf(ch->modemTarget, sizeof(ch->modemTarget), "%s:%d", thost, tport);
        pthread_mutex_unlock(&ch->cfgMtx);
        ch->modemState    = MODEM_DATA;
        ch->plusCount     = 0;
        ch->lastNonPlusMs = ms_now();

    } else if (strcmp(p, "I") == 0 || strcmp(p, "I0") == 0) {
        push_rx_str(ch, "\r\nTIKI-100 Emulator Modem\r\n\r\nOK\r\n");

    } else if (strcmp(p, "I1") == 0) {
        push_rx_str(ch, "\r\nv1.0\r\n\r\nOK\r\n");

    } else if (strcmp(p, "I2") == 0) {
        push_rx_str(ch, "\r\n000\r\n\r\nOK\r\n");

    } else if (strcmp(p, "I3") == 0) {
        push_rx_str(ch, "\r\nTIKI-100 SDL2 Emulator - Virtual TCP Modem\r\n"
                        "Z80 DART dual-channel serial emulation\r\n"
                        "Hayes AT command set compatible\r\n"
                        "\r\nOK\r\n");

    } else if (strcmp(p, "I4") == 0) {
        char info[512];
        snprintf(info, sizeof(info),
            "\r\n"
            "TIKI-100 - Norwegian CP/M Computer (Tiki Data AS, 1984)\r\n"
            "  CPU  : Zilog Z80 @ 4 MHz\r\n"
            "  RAM  : 64 KB main + 32 KB graphics\r\n"
            "  ROM  : 8 KB monitor (0xF000-0xFFFF)\r\n"
            "  Video: HIGHRES 1024x256 / MEDRES 512x256 / LOWRES 256x256\r\n"
            "  Sound: AY-3-8912 PSG @ 2 MHz\r\n"
            "  FDD  : FD1771 floppy controller\r\n"
            "  HDD  : WD1010 hard disk controller\r\n"
            "  SER  : Z80 DART, channel %c\r\n"
            "  Modem: Hayes AT, virtual TCP - ATDT host:port to dial\r\n"
            "\r\nOK\r\n",
            ch->channel == 1 ? 'A' : 'B');
        push_rx_str(ch, info);

    } else if (strcmp(p, "+IP?") == 0) {
        char ipbuf[64] = "127.0.0.1";
        /* UDP connect trick: no packet sent, but routes to reveal local IP */
        snet_fd_t probe = socket(AF_INET, SOCK_DGRAM, 0);
        if (SNET_IS_VALID(probe)) {
            struct sockaddr_in dst;
            memset(&dst, 0, sizeof(dst));
            dst.sin_family = AF_INET;
            dst.sin_port   = htons(80);
            inet_pton(AF_INET, "8.8.8.8", &dst.sin_addr);
            if (connect(probe, (struct sockaddr *)&dst, sizeof(dst)) == 0) {
                struct sockaddr_in local;
                socklen_t len = sizeof(local);
                if (getsockname(probe, (struct sockaddr *)&local, &len) == 0)
                    inet_ntop(AF_INET, &local.sin_addr, ipbuf, sizeof(ipbuf));
            }
            SNET_CLOSE(probe);
        }
        char resp[128];
        snprintf(resp, sizeof(resp), "\r\n%s\r\n\r\nOK\r\n", ipbuf);
        push_rx_str(ch, resp);

    } else if (strcmp(p, "+STATUS?") == 0) {
        push_rx_str(ch, SNET_IS_VALID(ctx->connFd)
                        ? "\r\nCONNECTED\r\n\r\nOK\r\n"
                        : "\r\nDISCONNECTED\r\n\r\nOK\r\n");

    } else if (strncmp(p, "+PORT=", 6) == 0) {
        int np = atoi(p + 6);
        if (np > 0 && np <= 65535) {
            ctx->defPort = np;
            push_rx_str(ch, "\r\nOK\r\n");
        } else {
            push_rx_str(ch, "\r\nERROR\r\n");
        }

    } else if (strncmp(p, "+SERVER=", 8) == 0) {
        const char *args = p + 8;
        if (args[0] == '0') {
            if (SNET_IS_VALID(ctx->serverFd)) {
                SNET_CLOSE(ctx->serverFd);
                ctx->serverFd = SNET_INVALID;
            }
            if (SNET_IS_VALID(ctx->pendingFd)) {
                SNET_CLOSE(ctx->pendingFd);
                ctx->pendingFd = SNET_INVALID;
            }
            push_rx_str(ch, "\r\nOK\r\n");
        } else if (args[0] == '1' && args[1] == ',') {
            int sport = atoi(args + 2);
            if (sport <= 0 || sport > 65535) {
                push_rx_str(ch, "\r\nERROR\r\n");
                return;
            }
            if (SNET_IS_VALID(ctx->serverFd)) {
                SNET_CLOSE(ctx->serverFd);
                ctx->serverFd = SNET_INVALID;
            }
            snet_fd_t sfd = socket(AF_INET, SOCK_STREAM, 0);
            if (!SNET_IS_VALID(sfd)) {
                push_rx_str(ch, "\r\nERROR\r\n");
                return;
            }
            int on = 1;
            setsockopt(sfd, SOL_SOCKET, SO_REUSEADDR, (const char *)&on, sizeof(on));
            struct sockaddr_in saddr;
            memset(&saddr, 0, sizeof(saddr));
            saddr.sin_family      = AF_INET;
            saddr.sin_addr.s_addr = INADDR_ANY;
            saddr.sin_port        = htons((uint16_t)sport);
            if (bind(sfd, (struct sockaddr *)&saddr, sizeof(saddr)) < 0 ||
                listen(sfd, 1) < 0) {
                SNET_CLOSE(sfd);
                push_rx_str(ch, "\r\nERROR\r\n");
                return;
            }
            ctx->serverFd   = sfd;
            ctx->lastRingMs = 0;
            printf("serial_net ch%d modem: server on port %d\n", ch->channel, sport);
            push_rx_str(ch, "\r\nOK\r\n");
        } else {
            push_rx_str(ch, "\r\nERROR\r\n");
        }

    } else if (strcmp(p, "+TELNET=0") == 0) {
        ctx->telnet = 0;
        push_rx_str(ch, "\r\nOK\r\n");

    } else if (strcmp(p, "+TELNET=1") == 0) {
        ctx->telnet = 1;
        push_rx_str(ch, "\r\nOK\r\n");

    } else {
        push_rx_str(ch, "\r\nERROR\r\n");
    }
}

static void *modem_worker(void *arg) {
    SNetChannel *ch = (SNetChannel *)arg;

    ModemCtx ctx;
    ctx.connFd      = SNET_INVALID;
    ctx.serverFd    = SNET_INVALID;
    ctx.pendingFd   = SNET_INVALID;
    ctx.echo        = 1;
    ctx.telnet      = 0;
    ctx.defPort     = 23;
    ctx.lastRingMs  = 0;
    ctx.telnetSkip  = 0;
    ctx.telnetCmd   = 0;

    pthread_mutex_lock(&ch->cfgMtx);
    strncpy(ch->modemTarget, "(none)", sizeof(ch->modemTarget) - 1);
    pthread_mutex_unlock(&ch->cfgMtx);

    ch->modemState    = MODEM_CMD;
    ch->cmdLen        = 0;
    ch->plusCount     = 0;
    ch->lastNonPlusMs = ms_now();

    while (!atomic_load(&ch->shutdownReq)) {

        /* Poll server socket for incoming connections (CMD mode only) */
        if (SNET_IS_VALID(ctx.serverFd) && !SNET_IS_VALID(ctx.pendingFd) &&
            ch->modemState == MODEM_CMD) {
            if (fd_poll(ctx.serverFd, 0, 0) & 1) {
                snet_fd_t newFd = accept(ctx.serverFd, NULL, NULL);
                if (SNET_IS_VALID(newFd)) {
                    ctx.pendingFd  = newFd;
                    ctx.lastRingMs = 0;
                }
            }
        }

        /* Send RING every 3s while a connection is waiting */
        if (SNET_IS_VALID(ctx.pendingFd) && ch->modemState == MODEM_CMD) {
            long now = ms_now();
            if (now - ctx.lastRingMs >= 3000) {
                push_rx_str(ch, "\r\nRING\r\n");
                ctx.lastRingMs = now;
            }
        }

        if (ch->modemState == MODEM_CMD) {
            ms_sleep(10);
            int v;
            while ((v = queue_read(&ch->txq)) >= 0) {
                uint8_t b = (uint8_t)v;
                if (ctx.echo) push_rx(ch, b);

                if (b == '\r') {
                    if (ch->cmdLen > 0)
                        modem_process_cmd(ch, &ctx);
                    if (ch->modemState == MODEM_DATA) break;
                } else if (b == '\n') {
                    /* LF ignored in command mode */
                } else if (b == 8 || b == 127) {
                    if (ch->cmdLen > 0) ch->cmdLen--;
                } else if (ch->cmdLen < 127) {
                    ch->cmdBuf[ch->cmdLen++] = (char)b;
                }
            }

        } else { /* MODEM_DATA */
            int want_write = queue_has_data(&ch->txq);
            int ev = fd_poll(ctx.connFd, want_write, 100);

            if (ev & 4) goto disconnect;

            /* Network → CPU (with optional telnet IAC negotiation handling) */
            if (ev & 1) {
                uint8_t buf[512];
                int n = (int)SNET_RECV(ctx.connFd, buf, sizeof(buf));
                if (n <= 0) goto disconnect;
                for (int i = 0; i < n; i++) {
                    uint8_t b = buf[i];
                    if (ctx.telnet) {
                        if (ctx.telnetSkip == 0) {
                            if (b == 0xFF) { ctx.telnetSkip = 1; continue; }
                        } else if (ctx.telnetSkip == 1) {
                            /* command byte after IAC */
                            ctx.telnetCmd = b;
                            if (b >= 0xFB && b <= 0xFE) {
                                ctx.telnetSkip = 2; /* need option byte */
                            } else {
                                ctx.telnetSkip = 0; /* 2-byte IAC, done */
                            }
                            continue;
                        } else { /* telnetSkip == 2: option byte */
                            /* Respond: WILL → DONT, DO → WONT (refuse everything) */
                            uint8_t resp[3] = { 0xFF, 0x00, b };
                            if (ctx.telnetCmd == 0xFB)      resp[1] = 0xFE; /* DONT */
                            else if (ctx.telnetCmd == 0xFD) resp[1] = 0xFC; /* WONT */
                            if (resp[1] != 0x00)
                                SNET_SEND(ctx.connFd, resp, 3);
                            ctx.telnetSkip = 0;
                            continue;
                        }
                    }
                    push_rx(ch, b);
                }
            }

            /* CPU → Network, with +++ escape detection */
            if (want_write) {
                int v2;
                while ((v2 = queue_read(&ch->txq)) >= 0) {
                    uint8_t b = (uint8_t)v2;
                    long now = ms_now();

                    if (b == '+') {
                        if ((now - ch->lastNonPlusMs) >= 1000)
                            ch->plusCount++;
                        else
                            ch->plusCount = 0;
                    } else {
                        ch->plusCount     = 0;
                        ch->lastNonPlusMs = now;
                    }

                    uint8_t tb = b;
                    if (SNET_SEND(ctx.connFd, &tb, 1) < 0) goto disconnect;

                    if (ch->plusCount >= 3) {
                        ms_sleep(1100);
                        if (!queue_has_data(&ch->txq)) {
                            printf("serial_net ch%d modem: +++ escape to CMD mode\n",
                                   ch->channel);
                            ch->plusCount  = 0;
                            ch->modemState = MODEM_CMD;
                            push_rx_str(ch, "\r\nOK\r\n");
                            /* connFd stays open until ATH */
                        } else {
                            ch->plusCount = 0;
                        }
                        break;
                    }
                }
            }
            continue;

disconnect:
            printf("serial_net ch%d modem: connection dropped\n", ch->channel);
            SNET_CLOSE(ctx.connFd);
            ctx.connFd     = SNET_INVALID;
            pthread_mutex_lock(&ch->cfgMtx);
            strncpy(ch->modemTarget, "(none)", sizeof(ch->modemTarget) - 1);
            pthread_mutex_unlock(&ch->cfgMtx);
            ch->modemState = MODEM_CMD;
            push_rx_str(ch, "\r\nNO CARRIER\r\n");
        }
    }

    if (SNET_IS_VALID(ctx.connFd))    SNET_CLOSE(ctx.connFd);
    if (SNET_IS_VALID(ctx.serverFd))  SNET_CLOSE(ctx.serverFd);
    if (SNET_IS_VALID(ctx.pendingFd)) SNET_CLOSE(ctx.pendingFd);
    atomic_store(&ch->threadRunning, false);
    return NULL;
}

/* -------------------------------------------------------------------------
 * Thread dispatch
 * ------------------------------------------------------------------------- */

static void *channel_worker(void *arg) {
    SNetChannel *ch = (SNetChannel *)arg;

    pthread_mutex_lock(&ch->cfgMtx);
    SerNetMode mode = ch->cfg.mode;
    pthread_mutex_unlock(&ch->cfgMtx);

    switch (mode) {
        case SERMODE_LISTEN:  return server_worker(arg);
        case SERMODE_CONNECT: return client_worker(arg);
        case SERMODE_MODEM:   return modem_worker(arg);
        default:
            atomic_store(&ch->threadRunning, false);
            return NULL;
    }
}

/* -------------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------------- */

void serialnet_init(void) {
#ifdef _WIN32
    WSADATA wsaData;
    WSAStartup(MAKEWORD(2, 2), &wsaData);
#endif
    memset(channels, 0, sizeof(channels));
    for (int i = 0; i < 2; i++) {
        channels[i].channel = i;
        pthread_mutex_init(&channels[i].cfgMtx, NULL);
        queue_init(&channels[i].txq);
        queue_init(&channels[i].rxq);
        atomic_store(&channels[i].threadRunning, false);
        atomic_store(&channels[i].shutdownReq,   false);
    }
}

void serialnet_shutdown(void) {
    for (int i = 0; i < 2; i++) {
        atomic_store(&channels[i].shutdownReq, true);
        if (atomic_load(&channels[i].threadRunning)) {
            pthread_join(channels[i].thread, NULL);
        }
        atomic_store(&channels[i].threadRunning, false);
        queue_destroy(&channels[i].txq);
        queue_destroy(&channels[i].rxq);
        pthread_mutex_destroy(&channels[i].cfgMtx);
    }
#ifdef _WIN32
    WSACleanup();
#endif
}

void serialnet_configure(int channel, SerNetMode mode,
                         const char *host, int port) {
    if (channel < 0 || channel > 1) return;
    SNetChannel *ch = &channels[channel];

    /* Stop existing thread */
    atomic_store(&ch->shutdownReq, true);
    if (atomic_load(&ch->threadRunning)) {
        pthread_join(ch->thread, NULL);
        atomic_store(&ch->threadRunning, false);
    }

    if (mode != SERMODE_LISTEN && mode != SERMODE_CONNECT && mode != SERMODE_MODEM) {
        atomic_store(&ch->shutdownReq, false);
        return;
    }

    pthread_mutex_lock(&ch->cfgMtx);
    ch->cfg.mode = mode;
    ch->cfg.port = port;
    if (host) strncpy(ch->cfg.host, host, sizeof(ch->cfg.host) - 1);
    else       ch->cfg.host[0] = '\0';
    pthread_mutex_unlock(&ch->cfgMtx);

    /* Flush queues */
    pthread_mutex_lock(&ch->txq.mtx);
    ch->txq.head = ch->txq.tail = 0;
    pthread_mutex_unlock(&ch->txq.mtx);
    pthread_mutex_lock(&ch->rxq.mtx);
    ch->rxq.head = ch->rxq.tail = 0;
    pthread_mutex_unlock(&ch->rxq.mtx);
    atomic_store(&ch->shutdownReq, false);

    if (pthread_create(&ch->thread, NULL, channel_worker, ch) == 0) {
        atomic_store(&ch->threadRunning, true);
    } else {
        fprintf(stderr, "serial_net ch%d: pthread_create failed\n", ch->channel);
    }
}

void serialnet_send(int channel, uint8_t byte_val) {
    if (channel < 0 || channel > 1) return;
    if (!atomic_load(&channels[channel].threadRunning)) return;
    queue_write(&channels[channel].txq, byte_val);
    atomic_store(&channels[channel].lastTxMs, ms_now());
}

int serialnet_tx_led(int channel) {
    if (channel < 0 || channel > 1) return 0;
    long t = atomic_load(&channels[channel].lastTxMs);
    return t > 0 && (ms_now() - t) < 150;
}

int serialnet_rx_led(int channel) {
    if (channel < 0 || channel > 1) return 0;
    long t = atomic_load(&channels[channel].lastRxMs);
    return t > 0 && (ms_now() - t) < 150;
}

int serialnet_recv(int channel) {
    if (channel < 0 || channel > 1) return -1;
    int v = queue_read(&channels[channel].rxq);
    if (v >= 0) atomic_store(&channels[channel].lastRxMs, ms_now());
    return v;
}

int serialnet_has_data(int channel) {
    if (channel < 0 || channel > 1) return 0;
    return queue_has_data(&channels[channel].rxq);
}

void serialnet_modem_target(int channel, char *buf, int buflen) {
    if (channel < 0 || channel > 1 || !buf || buflen <= 0) return;
    SNetChannel *ch = &channels[channel];
    pthread_mutex_lock(&ch->cfgMtx);
    strncpy(buf, ch->modemTarget, (size_t)(buflen - 1));
    buf[buflen - 1] = '\0';
    pthread_mutex_unlock(&ch->cfgMtx);
}

#endif /* PLATFORM_WASM */
