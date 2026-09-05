# language: de
Funktionalität: Meetingraum-Buchung mit Genehmigungspflicht
  Als Mitarbeiter möchte ich einen genehmigungspflichtigen Meetingraum anfragen können,
  und als Raumverantwortliche möchte ich diese Anfrage genehmigen oder ablehnen können.

  Szenario: Genehmigungspflichtige Buchung wird zur Anfrage und anschließend genehmigt
    Angenommen ich bin angemeldet als "Herr Demir"
    Wenn ich den Meetingraum "Konferenzraum A" für morgen 10 bis 11 Uhr anfrage
    Dann hat die Buchung den Status "pending_approval"
    Wenn "Frau Ostermann" die Anfrage genehmigt
    Dann hat die Buchung den Status "confirmed"

  Szenario: Ablehnung erfordert eine Begründung
    Angenommen ich bin angemeldet als "Herr Demir"
    Wenn ich den Meetingraum "Konferenzraum A" für übermorgen 14 bis 15 Uhr anfrage
    Und "Dr. Maria Schmidt" versucht die Anfrage ohne Begründung abzulehnen
    Dann erhält "Dr. Maria Schmidt" den Fehlercode "REASON_REQUIRED"
    Wenn "Dr. Maria Schmidt" die Anfrage mit der Begründung "Raum gesperrt" ablehnt
    Dann hat die Buchung den Status "rejected"
