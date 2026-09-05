# language: de
Funktionalität: Vertrauliche Raumblockierung
  Als Mitarbeiter mit vertraulicher Aufgabe möchte ich einen Raum ohne Freigabeprüfung
  blockieren können, wobei jede Blockierung in einem zugriffsbeschränkten Audit-Log landet.

  Szenario: Blockierung ohne vertrauliche Rolle wird abgelehnt
    Angenommen ich bin angemeldet als "Ali Yilmaz"
    Wenn ich versuche den Raum "Konferenzraum A" vertraulich zu blockieren
    Dann erhalte ich den Fehlercode "NOT_AUTHORIZED"

  Szenario: FM-Admin blockiert einen Raum vertraulich und der Vorgang wird protokolliert
    Angenommen ich bin angemeldet als "Herr Brandt"
    Wenn ich den Raum "Konferenzraum A" mit Begründung "VS-NFD Vorbereitung" vertraulich blockiere
    Dann ist die Blockierung erfolgreich
    Und der Vorgang erscheint im vertraulichen Audit-Log

  Szenario: Blockierungen über 72 Stunden werden abgelehnt
    Angenommen ich bin angemeldet als "Herr Brandt"
    Wenn ich versuche den Raum "Konferenzraum A" für 80 Stunden vertraulich zu blockieren
    Dann erhalte ich den Fehlercode "MAX_DURATION_EXCEEDED"
