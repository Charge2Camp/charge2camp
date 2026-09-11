-- Rueckbau der Ladesaeulen-Bildergalerie (Auftrag "Bilder Rueckbau und
-- Button"): Street-Level-Fotos (Mapillary/Commons) beantworten die
-- eigentliche Frage nicht ("passt mein 15-m-Gespann hier durch?") --
-- ersetzt durch einen externen Google-Maps-Link (kein Datenbankzugriff
-- noetig, siehe src/lib/google-maps-link.ts).
--
-- enrich.charge_point_image_override wurde vor diesem Rueckbau geprueft
-- (0 Zeilen in Produktion, siehe Session-Log) -- deshalb ohne Backup
-- geloescht, statt sie stehen zu lassen (Auftragsdokument Teil A4: "Ist
-- sie leer -> loeschen"). Waere sie nicht leer gewesen, wuerde sie hier
-- stattdessen stehen bleiben.

drop view if exists core.v_charge_point_image;
drop table if exists core.charge_point_image;
drop table if exists enrich.charge_point_image_override;
