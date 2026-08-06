# ESP32 firmware

PlatformIO is the selected tool runner and is invoked with `uv run pio`. No board,
ESP32 variant, Arduino/ESP-IDF framework, LED chipset, pin assignment, power
design, or storage format has been selected yet.

Do not create `platformio.ini` until the target board and framework are known.
Keep eventual hardware access behind narrow interfaces so core behavior can be
tested without flashing a device.
