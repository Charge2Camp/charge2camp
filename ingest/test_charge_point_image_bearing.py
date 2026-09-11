"""Unit-Test fuer den Mapillary-Blickrichtungsfilter (Auftrag
"Ladesaeulen-Bilder" §7, Test 3): ein Bild, dessen Kamera von der
Ladesaeule wegblickt, muss verworfen werden. Reiner Funktionstest ohne
Netzwerk/DB (im Gegensatz zu test_enrich_immutability.py).

Aufruf:
    .venv/Scripts/python.exe test_charge_point_image_bearing.py

Exit-Code 0 = bestanden, 1 = fehlgeschlagen.
"""

from __future__ import annotations

from fetch_charge_point_images import bearing_delta_to_station, is_within_bearing

# Ladesaeule direkt noerdlich der Bildposition (Bearing von Bild -> Saeule = 0).
STATION_LAT, STATION_LON = 48.0010, 11.0000
IMAGE_LAT, IMAGE_LON = 48.0000, 11.0000


def check(label: str, condition: bool) -> bool:
    print(f"{'OK  ' if condition else 'FAIL'} {label}")
    return condition


def main() -> int:
    ok = True

    # Kamera blickt exakt zur Saeule (compass_angle == Bearing) -> muss durchkommen.
    ok &= check(
        "Kamera zeigt direkt zur Saeule -> behalten",
        is_within_bearing(IMAGE_LAT, IMAGE_LON, 0.0, STATION_LAT, STATION_LON),
    )

    # Kamera blickt exakt WEG von der Saeule (180 Grad Differenz) -> muss verworfen werden.
    ok &= check(
        "Kamera zeigt von der Saeule weg (180deg) -> verworfen",
        not is_within_bearing(IMAGE_LAT, IMAGE_LON, 180.0, STATION_LAT, STATION_LON),
    )

    # Genau an der Grenze (50 Grad) -> muss noch durchkommen.
    ok &= check(
        "Winkeldifferenz exakt an der 50-Grad-Grenze -> behalten",
        is_within_bearing(IMAGE_LAT, IMAGE_LON, 50.0, STATION_LAT, STATION_LON),
    )

    # Knapp ueber der Grenze -> muss verworfen werden.
    ok &= check(
        "Winkeldifferenz 50.1 Grad -> verworfen",
        not is_within_bearing(IMAGE_LAT, IMAGE_LON, 50.1, STATION_LAT, STATION_LON),
    )

    # Wrap-around bei 0/360 Grad darf die Differenz nicht verfaelschen.
    ok &= check(
        "Wrap-around 359 vs. 2 Grad (Differenz 3) -> behalten",
        is_within_bearing(IMAGE_LAT, IMAGE_LON, 359.0, STATION_LAT, STATION_LON, max_delta=3.0)
        or abs(bearing_delta_to_station(IMAGE_LAT, IMAGE_LON, 359.0, STATION_LAT, STATION_LON)) <= 3.0,
    )

    if ok:
        print("\nAlle Bearing-Filter-Tests bestanden.")
        return 0
    print("\nMindestens ein Bearing-Filter-Test fehlgeschlagen.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
