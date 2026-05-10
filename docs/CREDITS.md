# Credits and licenses

- **Original TIKI-100 emulator**: Copyright (C) Asbjorn Djupdal 2000-2001.
  Free to use and distribute. Not for commercial use in original or modified form.
  Contact author before making changes. Source files: machine core, memory, video,
  keyboard, floppy, serial, parallel, CTC, and original sound stub.
- **Z80 CPU emulator**: Copyright (C) Marat Fayzullin 1994-1997.
  Not for commercial distribution. Notify author of changes.
  Source files: Z80.c, Z80.h, Codes.h, CodesCB.h, CodesED.h, CodesXX.h,
  CodesXCB.h, Tables.h, Debug.c.
- **AY-3-8912 sound chip** (BSD-3-Clause):
  - MAME ay8910.cpp by Couriersud (2008), based on code by Ville Hallik, Michael Cuddy,
    Tatsuyuki Satoh, Fabrice Frances, Nicola Salmoria
  - Andre Weissflog's chips library ay38910.h (zlib/libpng license)
  - Ported to C# by Ronny Hansen (RetroCore), then to C for this emulator
  - Volume table from real AY-3-8910 measurements by Matthew Westcott (Dec 2001)
  - DC adjustment filter from StSound / ayumi
- **WD1010 HDC**: Ported from RetroCore C# (Ronny Hansen, MIT license)
