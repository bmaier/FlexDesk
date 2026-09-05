# language: de
Funktionalität: Vertretung und Serienbuchung
  Als Team-Assistenz möchte ich für abwesende Kolleg:innen buchen und stornieren können,
  ohne dass mir dafür ein Grund vorliegen muss.

  Szenario: Buchung ohne Vertretungsberechtigung wird abgelehnt
    Angenommen ich bin angemeldet als "Frau Kessler"
    Wenn ich versuche für "Hans Müller" einen Arbeitsplatz zu buchen
    Dann erhalte ich den Fehlercode "DELEGATION_MISSING"

  Szenario: Team-Assistenz bucht und storniert im Auftrag
    Angenommen ich bin angemeldet als "Frau Kaya"
    Wenn ich für "Hans Müller" einen Arbeitsplatz für in 3 Tagen buche
    Dann ist die Buchung bestätigt
    Wenn ich diese Buchung storniere
    Dann ist die Buchung storniert

  Szenario: Serienbuchung über mehrere Termine mit Konfliktbehandlung
    Angenommen ich bin angemeldet als "Frau Kaya"
    Wenn ich für "Hans Müller" eine Serienbuchung für Montag und Dienstag über 3 Wochen anlege
    Dann wurden mehrere Termine erfolgreich gebucht
