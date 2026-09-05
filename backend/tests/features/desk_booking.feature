# language: de
Funktionalität: Desk-Buchung
  Als Mitarbeiter möchte ich schnell einen Arbeitsplatz buchen können,
  damit ich ohne Umwege einen Platz für den Tag reserviert habe.

  Szenario: UJ-1 - Schnellbuchung des gewohnten Platzes
    Angenommen ich bin angemeldet als "Ali Yilmaz"
    Wenn ich die Schnellbuchungs-Empfehlungen abrufe
    Dann sollte mein gewohnter Platz "N-01" angezeigt werden

  Szenario: Konflikt bei doppelter Buchung führt zu einer Alternative
    Angenommen ich bin angemeldet als "Johannes Schneider"
    Und der Arbeitsplatz "N-04" ist für morgen bereits von "Ali Yilmaz" gebucht
    Wenn ich versuche den Arbeitsplatz "N-04" für morgen zu buchen
    Dann erhalte ich den Fehlercode "DESK_CONFLICT"
    Und es wird mir ein alternativer Arbeitsplatz vorgeschlagen

  Szenario: Zonen-Kontingent blockiert nicht berechtigte Referate
    Angenommen ich bin angemeldet als "Herr Brandt"
    Und eine Zone "Referat IT — Nord" für die Liegenschaft "Nürnberg Zentrale" existiert
    Und der Arbeitsplatz "R-02" dieser Zone zugewiesen ist mit Referat "2.1"
    Wenn "Dr. Maria Schmidt" versucht den Arbeitsplatz "R-02" für übermorgen zu buchen
    Dann erhält "Dr. Maria Schmidt" den Fehlercode "ZONE_RESTRICTED"

  Szenario: Ein Raum, der einer Abteilung zugeordnet ist, ist auch für alle Unter-Referate buchbar
    Angenommen ich bin angemeldet als "Herr Kaiser"
    Wenn ich den Arbeitsplatz "A12-01" für in 33 Tagen buche
    Dann ist die Buchung bestätigt

  Szenario: Ein Raum, der nur einem Unter-Referat zugeordnet ist, bleibt für die Elternabteilung gesperrt
    Angenommen ich bin angemeldet als "Frau Lehmann"
    Wenn ich versuche den Arbeitsplatz "QS-01" für in 34 Tagen zu buchen
    Dann erhalte ich den Fehlercode "ZONE_RESTRICTED"

  Szenario: Doppelbuchung wird als Warnung angezeigt und kann mit Begründung übernommen werden
    Angenommen ich bin angemeldet als "Ali Yilmaz"
    Und ich einen Arbeitsplatz "F-03" für in 35 Tagen gebucht habe
    Wenn ich versuche den Arbeitsplatz "S-02" für in 35 Tagen zu buchen
    Dann erhalte ich den Fehlercode "DOUBLE_BOOKING_WARNING"
    Wenn ich den Arbeitsplatz "S-02" für in 35 Tagen trotz Doppelbuchung mit Begründung "Übergabe an zwei Standorten" buche
    Dann ist die Buchung bestätigt
