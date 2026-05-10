/* serial_net.h
 * TCP/modem serial routing for TIKI-100 Z80 DART channels.
 * SDL frontend only — excluded from WASM builds.
 */

#ifndef SERIAL_NET_H
#define SERIAL_NET_H

#include <stdint.h>

typedef enum {
    SERMODE_LISTEN  = 0,   /* TCP server: bind + accept one connection at a time */
    SERMODE_CONNECT = 1,   /* TCP client: connect with exponential-backoff retry */
    SERMODE_MODEM   = 2    /* Hayes AT command emulator (ATDT to dial out) */
} SerNetMode;

typedef struct {
    SerNetMode mode;
    char       host[256];
    int        port;
} SerNetConfig;

/* Initialise/shutdown — call once from the SDL frontend main(). */
void serialnet_init(void);
void serialnet_shutdown(void);

/* (Re)configure a channel and start/restart its worker thread.
 * channel: 0 = Serial B (DART port 0), 1 = Serial A (DART port 1).
 * Stops the current thread first if one is running. */
void serialnet_configure(int channel, SerNetMode mode,
                         const char *host, int port);

/* Called from the sendChar() stub — emulation thread writes a TX byte. */
void serialnet_send(int channel, uint8_t byte_val);

/* Called from the getChar() stub — emulation thread reads one RX byte.
 * Returns -1 if the RX queue is empty. */
int  serialnet_recv(int channel);

/* Returns 1 if bytes are waiting in the RX queue for this channel. */
int  serialnet_has_data(int channel);

/* Copies the current modem connection target ("host:port", "(incoming)",
 * or "(none)") into buf.  Safe to call from any thread. */
void serialnet_modem_target(int channel, char *buf, int buflen);

/* Returns 1 if TX/RX activity occurred within the last ~150 ms. */
int serialnet_tx_led(int channel);
int serialnet_rx_led(int channel);

#endif /* SERIAL_NET_H */
