-- core.charge_points_within_corridor (Migration 20260922000000) fuehrte bei
-- laengeren Routen (mehrere hundert km, viele Geometriepunkte) zu
-- "canceling statement due to statement timeout" -- ST_DWithin/
-- ST_LineLocatePoint gegen eine komplexe geography-Linie ist zu teuer.
-- Die Routenplanung nutzt stattdessen die bereits bewaehrte, schnelle
-- core.charge_points_within_radius (Punkt-Umkreis) mehrfach an entlang der
-- Route verteilten Stichprobenpunkten (siehe fetchCorridorChargingStations
-- in routenplaner/actions.ts) -- diese Funktion wird nicht mehr gebraucht.
drop function if exists core.charge_points_within_corridor(text, double precision);
